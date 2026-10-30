// The only place that talks to SQLite. Each public method is one unit of work; anything that
// touches more than one table runs inside transactionSync, so counters can never drift from
// the rows they count (a thrown error rolls the whole method back).

import {
  addToCentroid,
  blobToVector,
  removeFromCentroid,
  vectorToBlob,
  type TopicCentroid,
  type Vector,
} from "@/server/clustering"
import { MAX_TOPICS_PER_ROOM, QUESTION_LABEL_PREVIEW_LENGTH } from "@/shared/limits"
import type {
  Feedback,
  HostQuestion,
  HostStats,
  Membership,
  MembershipSource,
  QuestionStatus,
  RoomStatus,
  TopicSummary,
} from "@/shared/types"
import * as Q from "./queries"

// ---------- row shapes as SQLite returns them ----------

type RoomRow = {
  code: string
  title: string
  host_token_hash: string
  device_salt: string
  status: RoomStatus
  demo_audience: number
  created_at: number
  expires_at: number
}

type TopicRow = {
  id: number
  label: string
  label_source: LabelSource
  labeled_at_size: number
  centroid: ArrayBuffer
  question_count: number
  member_count: number
  resolved_at: number | null
}

type MemberRow = { via: MembershipSource; feedback: Feedback | null }

type CountRow = { count: number }

// ---------- shapes handed to the rest of the app ----------

export type LabelSource = "question" | "ai" | "host"

export interface RoomRecord {
  code: string
  title: string
  hostTokenHash: string
  deviceSalt: string
  status: RoomStatus
  demoAudience: number
  createdAt: number
  expiresAt: number
}

export interface NewRoom {
  code: string
  title: string
  hostTokenHash: string
  deviceSalt: string
  createdAt: number
  expiresAt: number
}

export interface TopicRecord {
  id: number
  label: string
  labelSource: LabelSource
  labeledAtSize: number
  centroid: Vector
  questionCount: number
  memberCount: number
  resolvedAt: number | null
}

export interface QueuedQuestion {
  id: number
  deviceHash: string
  body: string
  attempts: number
}

export interface TopicQuestion {
  id: number
  body: string
  embedding: Vector | null
  createdAt: number
}

export type JoinResult = "joined" | "already_member" | "topic_not_found"
export type LeaveResult = "left" | "not_member" | "own_question"
export type FeedbackResult = "saved" | "not_member" | "topic_not_resolved" | "topic_not_found"

export class RoomRepository {
  constructor(private readonly storage: DurableObjectStorage) {}

  private get sql(): SqlStorage {
    return this.storage.sql
  }

  private count(query: string, ...bindings: SqlStorageValue[]): number {
    return this.sql.exec<CountRow>(query, ...bindings).one().count
  }

  // ---------- room ----------

  getRoom(): RoomRecord | null {
    const row = this.sql.exec<RoomRow>(Q.SELECT_ROOM).toArray()[0]
    if (!row) return null
    return {
      code: row.code,
      title: row.title,
      hostTokenHash: row.host_token_hash,
      deviceSalt: row.device_salt,
      status: row.status,
      demoAudience: row.demo_audience,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }
  }

  createRoom(room: NewRoom): void {
    this.sql.exec(
      Q.INSERT_ROOM,
      room.code,
      room.title,
      room.hostTokenHash,
      room.deviceSalt,
      room.createdAt,
      room.expiresAt,
    )
  }

  setRoomStatus(status: RoomStatus): void {
    this.sql.exec(Q.UPDATE_ROOM_STATUS, status)
  }

  setDemoAudience(size: number): void {
    this.sql.exec(Q.UPDATE_ROOM_DEMO_AUDIENCE, size)
  }

  // ---------- questions ----------

  lastAskAt(deviceHash: string): number | null {
    const row = this.sql
      .exec<{ created_at: number }>(Q.SELECT_LAST_ASK_BY_DEVICE, deviceHash)
      .toArray()[0]
    return row?.created_at ?? null
  }

  countQuestions(): number {
    return this.count(Q.COUNT_QUESTIONS)
  }

  questionStats(): HostStats {
    const byStatus = new Map<string, number>()
    for (const row of this.sql.exec<{ status: string; count: number }>(Q.COUNT_QUESTIONS_BY_STATUS)) {
      byStatus.set(row.status, row.count)
    }
    const total = [...byStatus.values()].reduce((sum, value) => sum + value, 0)
    return {
      totalQuestions: total,
      pendingQuestions: byStatus.get("pending") ?? 0,
      failedQuestions: byStatus.get("failed") ?? 0,
      hiddenQuestions: byStatus.get("hidden") ?? 0,
    }
  }

  insertQuestion(deviceHash: string, body: string, now: number): number {
    return this.sql.exec<{ id: number }>(Q.INSERT_QUESTION, deviceHash, body, now).one().id
  }

  questionsToEmbed(limit: number, maxAttempts: number): QueuedQuestion[] {
    return this.sql
      .exec<{ id: number; device_hash: string; body: string; attempts: number }>(
        Q.SELECT_QUESTIONS_TO_EMBED,
        maxAttempts,
        limit,
      )
      .toArray()
      .map((row) => ({
        id: row.id,
        deviceHash: row.device_hash,
        body: row.body,
        attempts: row.attempts,
      }))
  }

  markQuestionFailed(questionId: number): void {
    this.sql.exec(Q.MARK_QUESTION_FAILED, questionId)
  }

  recentQuestions(limit: number): HostQuestion[] {
    return this.sql
      .exec<{
        id: number
        body: string
        status: QuestionStatus
        topic_id: number | null
        topic_label: string | null
        created_at: number
      }>(Q.SELECT_RECENT_QUESTIONS, limit)
      .toArray()
      .map((row) => ({
        id: row.id,
        body: row.body,
        status: row.status,
        topicId: row.topic_id,
        topicLabel: row.topic_label,
        createdAt: row.created_at,
      }))
  }

  topicQuestions(topicId: number, limit: number): TopicQuestion[] {
    return this.sql
      .exec<{ id: number; body: string; embedding: ArrayBuffer | null; created_at: number }>(
        Q.SELECT_TOPIC_QUESTIONS,
        topicId,
        limit,
      )
      .toArray()
      .map((row) => ({
        id: row.id,
        body: row.body,
        embedding: row.embedding ? blobToVector(row.embedding) : null,
        createdAt: row.created_at,
      }))
  }

  // ---------- topics ----------

  topicCentroids(): TopicCentroid[] {
    return this.sql
      .exec<{ id: number; centroid: ArrayBuffer; question_count: number }>(Q.SELECT_TOPIC_CENTROIDS)
      .toArray()
      .map((row) => ({
        topicId: row.id,
        centroid: blobToVector(row.centroid),
        size: row.question_count,
      }))
  }

  getTopic(topicId: number): TopicRecord | null {
    const row = this.sql.exec<TopicRow>(Q.SELECT_TOPIC, topicId).toArray()[0]
    if (!row) return null
    return {
      id: row.id,
      label: row.label,
      labelSource: row.label_source,
      labeledAtSize: row.labeled_at_size,
      centroid: blobToVector(row.centroid),
      questionCount: row.question_count,
      memberCount: row.member_count,
      resolvedAt: row.resolved_at,
    }
  }

  canCreateTopic(): boolean {
    return this.count(Q.COUNT_TOPICS) < MAX_TOPICS_PER_ROOM
  }

  /**
   * Puts an embedded question into a topic: either a new one or `existingTopicId`.
   * Moves the centroid, marks the question clustered and counts the asker as a member,
   * all in one transaction. Returns the topic as it is afterwards, or null if the host
   * hid the question while its embedding was being computed.
   */
  clusterQuestion(
    question: QueuedQuestion,
    vector: Vector,
    existingTopicId: number | null,
    now: number,
  ): TopicRecord | null {
    return this.storage.transactionSync(() => {
      const current = this.sql
        .exec<{ status: QuestionStatus }>(Q.SELECT_QUESTION_STATUS, question.id)
        .toArray()[0]
      if (current?.status !== "pending" && current?.status !== "failed") return null

      const topicId =
        existingTopicId === null
          ? this.createTopicFrom(question, vector, now)
          : this.addQuestionToTopic(existingTopicId, vector, now)

      this.sql.exec(Q.MARK_QUESTION_CLUSTERED, topicId, vectorToBlob(vector), question.id)
      this.addAsker(topicId, question.deviceHash, now)

      return this.getTopic(topicId)!
    })
  }

  private createTopicFrom(question: QueuedQuestion, vector: Vector, now: number): number {
    const label = question.body.slice(0, QUESTION_LABEL_PREVIEW_LENGTH)
    return this.sql
      .exec<{ id: number }>(Q.INSERT_TOPIC, label, vectorToBlob(vector), now, now)
      .one().id
  }

  private addQuestionToTopic(topicId: number, vector: Vector, now: number): number {
    const topic = this.getTopic(topicId)
    if (!topic) throw new Error(`Topic ${topicId} disappeared while clustering`)

    const centroid = addToCentroid(topic.centroid, topic.questionCount, vector)
    this.sql.exec(Q.ADD_QUESTION_TO_TOPIC, vectorToBlob(centroid), now, topicId)
    return topicId
  }

  private addAsker(topicId: number, deviceHash: string, now: number): void {
    const member = this.getMember(topicId, deviceHash)
    if (!member) {
      this.sql.exec(Q.INSERT_MEMBER, topicId, deviceHash, "ask", now)
      this.sql.exec(Q.CHANGE_MEMBER_COUNT, 1, now, topicId)
    } else if (member.via === "metoo") {
      this.sql.exec(Q.MARK_MEMBER_AS_ASKER, topicId, deviceHash)
    }
  }

  setTopicLabel(
    topicId: number,
    label: string,
    source: LabelSource,
    labeledAtSize: number,
    now: number,
  ): void {
    this.sql.exec(Q.UPDATE_TOPIC_LABEL, label, source, labeledAtSize, now, topicId)
  }

  /** Marks a topic as explained again. Returns false if it was already resolved or does not exist. */
  resolveTopic(topicId: number, now: number): boolean {
    return this.storage.transactionSync(() => {
      const topic = this.getTopic(topicId)
      if (!topic || topic.resolvedAt !== null) return false

      this.sql.exec(Q.RESOLVE_TOPIC, now, now, topicId)
      this.sql.exec(Q.CLEAR_TOPIC_FEEDBACK, topicId)
      return true
    })
  }

  /**
   * Hides a question from the host's view and takes it back out of its topic.
   * Returns the affected topic id, or null when there was nothing to hide.
   */
  hideQuestion(questionId: number, now: number): { topicId: number | null } | null {
    return this.storage.transactionSync(() => {
      const question = this.sql
        .exec<{
          id: number
          topic_id: number | null
          device_hash: string
          embedding: ArrayBuffer | null
          status: QuestionStatus
        }>(Q.SELECT_QUESTION_FOR_HIDE, questionId)
        .toArray()[0]
      if (!question || question.status === "hidden") return null

      this.sql.exec(Q.MARK_QUESTION_HIDDEN, questionId)

      const wasClustered =
        question.status === "clustered" && question.topic_id !== null && question.embedding
      if (!wasClustered) return { topicId: null }

      const topicId = question.topic_id!
      this.takeQuestionOutOfTopic(topicId, blobToVector(question.embedding!), now)
      this.dropAskerIfNoQuestionsLeft(topicId, question.device_hash, now)
      return { topicId }
    })
  }

  private takeQuestionOutOfTopic(topicId: number, vector: Vector, now: number): void {
    const topic = this.getTopic(topicId)
    if (!topic) return

    const centroid = removeFromCentroid(topic.centroid, topic.questionCount, vector)
    if (centroid === null) {
      // That was the last question: the topic itself goes away.
      this.sql.exec(Q.DELETE_TOPIC_MEMBERS, topicId)
      this.sql.exec(Q.DELETE_TOPIC, topicId)
      return
    }
    this.sql.exec(Q.REMOVE_QUESTION_FROM_TOPIC, vectorToBlob(centroid), now, topicId)
  }

  private dropAskerIfNoQuestionsLeft(topicId: number, deviceHash: string, now: number): void {
    const member = this.getMember(topicId, deviceHash)
    if (member?.via !== "ask") return

    const remaining = this.count(Q.COUNT_CLUSTERED_BY_DEVICE_IN_TOPIC, topicId, deviceHash)
    if (remaining === 0) this.removeMember(topicId, deviceHash, member, now)
  }

  // ---------- members ----------

  private getMember(topicId: number, deviceHash: string): MemberRow | null {
    return this.sql.exec<MemberRow>(Q.SELECT_MEMBER, topicId, deviceHash).toArray()[0] ?? null
  }

  private removeMember(topicId: number, deviceHash: string, member: MemberRow, now: number): void {
    this.sql.exec(Q.DELETE_MEMBER, topicId, deviceHash)
    this.sql.exec(Q.CHANGE_MEMBER_COUNT, -1, now, topicId)
    if (member.feedback) this.changeFeedbackCounts(topicId, member.feedback, -1)
  }

  private changeFeedbackCounts(topicId: number, feedback: Feedback, delta: number): void {
    const understoodDelta = feedback === "understood" ? delta : 0
    const stillConfusedDelta = feedback === "still_confused" ? delta : 0
    this.sql.exec(Q.CHANGE_FEEDBACK_COUNTS, understoodDelta, stillConfusedDelta, topicId)
  }

  /** "ฉันก็งง": join someone else's topic without typing. */
  joinTopic(topicId: number, deviceHash: string, now: number): JoinResult {
    return this.storage.transactionSync(() => {
      if (!this.getTopic(topicId)) return "topic_not_found"
      if (this.getMember(topicId, deviceHash)) return "already_member"

      this.sql.exec(Q.INSERT_MEMBER, topicId, deviceHash, "metoo", now)
      this.sql.exec(Q.CHANGE_MEMBER_COUNT, 1, now, topicId)
      return "joined"
    })
  }

  /** Undo "ฉันก็งง". People cannot leave a topic they asked about themselves. */
  leaveTopic(topicId: number, deviceHash: string, now: number): LeaveResult {
    return this.storage.transactionSync(() => {
      const member = this.getMember(topicId, deviceHash)
      if (!member) return "not_member"
      if (member.via === "ask") return "own_question"

      this.removeMember(topicId, deviceHash, member, now)
      return "left"
    })
  }

  /** "เข้าใจแล้ว / ยังงงอยู่" after the host explained a topic again. Changing your mind is allowed. */
  setFeedback(topicId: number, deviceHash: string, feedback: Feedback): FeedbackResult {
    return this.storage.transactionSync(() => {
      const topic = this.getTopic(topicId)
      if (!topic) return "topic_not_found"
      if (topic.resolvedAt === null) return "topic_not_resolved"

      const member = this.getMember(topicId, deviceHash)
      if (!member) return "not_member"
      if (member.feedback === feedback) return "saved"

      if (member.feedback) this.changeFeedbackCounts(topicId, member.feedback, -1)
      this.changeFeedbackCounts(topicId, feedback, 1)
      this.sql.exec(Q.UPDATE_MEMBER_FEEDBACK, feedback, topicId, deviceHash)
      return "saved"
    })
  }

  membershipsOf(deviceHash: string): Membership[] {
    return this.sql
      .exec<{ topic_id: number; via: MembershipSource; feedback: Feedback | null }>(
        Q.SELECT_MEMBERSHIPS_BY_DEVICE,
        deviceHash,
      )
      .toArray()
      .map((row) => ({ topicId: row.topic_id, via: row.via, feedback: row.feedback }))
  }

  // ---------- snapshot ----------

  snapshotTopics(): TopicSummary[] {
    return this.sql
      .exec<{
        id: number
        label: string
        member_count: number
        resolved_at: number | null
        understood_count: number
        still_confused_count: number
      }>(Q.SELECT_SNAPSHOT_TOPICS, MAX_TOPICS_PER_ROOM)
      .toArray()
      .map((row) => ({
        id: row.id,
        label: row.label,
        people: row.member_count,
        resolved: row.resolved_at !== null,
        understood: row.understood_count,
        stillConfused: row.still_confused_count,
      }))
  }

  countConfusedSince(since: number): number {
    return this.count(Q.COUNT_CONFUSED_RECENT, since)
  }
}
