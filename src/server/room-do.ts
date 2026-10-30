// One Durable Object per room. It owns the room's SQLite database, holds every WebSocket of the
// room, and runs the clustering queue. Because a Durable Object handles one event at a time,
// two similar questions arriving together can never both decide to start a new topic.

import { DurableObject } from "cloudflare:workers"
import { AiUnavailableError, embedTexts, explainTopic, labelTopic } from "@/server/ai"
import {
  findMedoidIndex,
  findNearestTopic,
  shouldRelabel,
  type TopicCentroid,
  type Vector,
} from "@/server/clustering"
import { hasSchema, runMigrations } from "@/server/db/migrations"
import { RoomRepository, type QueuedQuestion, type RoomRecord } from "@/server/db/room-repository"
import { demoQuestionOrder } from "@/server/demo"
import type { Env } from "@/server/env"
import { maskRudeWords } from "@/server/moderation"
import { fail, ok, type Result } from "@/server/result"
import { constantTimeEqual, randomHex, sha256Hex } from "@/server/security"
import {
  ASK_COOLDOWN_MS,
  BROADCAST_DELAY_MS,
  CONFUSION_HIGH_FROM,
  CONFUSION_MEDIUM_FROM,
  CONFUSION_WINDOW_MS,
  DEMO_AUDIENCE_SIZE,
  EMBED_BATCH_SIZE,
  HOST_QUESTION_LIST_LIMIT,
  LLM_SAMPLE_SIZE,
  MAX_PROCESSING_ATTEMPTS,
  MAX_QUESTIONS_PER_ROOM,
  MAX_SOCKETS_PER_ROOM,
  QUESTION_LABEL_PREVIEW_LENGTH,
  RETRY_DELAY_MS,
  ROOM_LIFETIME_MS,
  SIMILARITY_THRESHOLD,
} from "@/shared/limits"
import type {
  ConfusionLevel,
  ConfusionSummary,
  Feedback,
  HostQuestion,
  HostSnapshot,
  RoomSnapshot,
  RoomView,
  ServerMessage,
  SocketRole,
  TopicExplanation,
} from "@/shared/types"

/** Who is calling. Built by the worker from cookies; the browser cannot set these directly. */
export interface Caller {
  deviceId: string
  hostToken: string | null
}

/** Internal headers the worker uses to pass the caller to fetch() for WebSocket upgrades. */
export const SOCKET_HEADERS = {
  role: "X-Ngong-Role",
  deviceId: "X-Ngong-Device",
  hostToken: "X-Ngong-Host-Token",
} as const

// WebSocket tags let us address groups of sockets without keeping our own lists,
// which matters because hibernation wipes in-memory state.
const TAG_HOST = "host"
const TAG_PUBLIC = "public"
const TAG_STUDENT = "student"
const deviceTag = (deviceHash: string) => `device:${deviceHash}`

interface Identity {
  room: RoomRecord
  deviceHash: string
  isHost: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class RoomDO extends DurableObject<Env> {
  private readonly repo: RoomRepository
  private schemaReady = false

  // Queues: each one runs its jobs strictly one after another.
  private clusteringQueue: Promise<void> = Promise.resolve()
  private labelingQueue: Promise<void> = Promise.resolve()
  private readonly topicsWaitingForLabel = new Set<number>()

  private broadcastTimer: ReturnType<typeof setTimeout> | null = null
  private demoRunning = false
  private readonly explanationCache = new Map<string, TopicExplanation>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.repo = new RoomRepository(ctx.storage)
    // Clients ping every 25 s to keep mobile networks from dropping the socket.
    // The runtime answers without waking this object up.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"))
  }

  // =====================================================================
  // Room lifecycle
  // =====================================================================

  async createRoom(input: { code: string; title: string; hostTokenHash: string }): Promise<Result> {
    this.ensureSchema()
    if (this.repo.getRoom()) return fail("not_allowed")

    const now = Date.now()
    const expiresAt = now + ROOM_LIFETIME_MS
    this.repo.createRoom({
      code: input.code,
      title: input.title,
      hostTokenHash: input.hostTokenHash,
      deviceSalt: randomHex(32),
      createdAt: now,
      expiresAt,
    })
    await this.ctx.storage.setAlarm(expiresAt)
    return ok()
  }

  async closeRoom(caller: Caller): Promise<Result> {
    const identity = await this.identifyHost(caller)
    if (!identity.ok) return identity

    this.repo.setRoomStatus("closed")
    this.scheduleBroadcast()
    return ok()
  }

  async deleteRoom(caller: Caller): Promise<Result> {
    const identity = await this.identifyHost(caller)
    if (!identity.ok) return identity

    await this.destroyRoom()
    return ok()
  }

  /** Expiry and retries share the single alarm a Durable Object is allowed to have. */
  async alarm(): Promise<void> {
    const room = this.loadRoom()
    if (!room) return
    if (Date.now() >= room.expiresAt) {
      await this.destroyRoom()
      return
    }
    this.enqueueClustering()
    await this.ctx.storage.setAlarm(room.expiresAt)
  }

  private async destroyRoom(): Promise<void> {
    this.sendToTag(TAG_PUBLIC, { type: "room_deleted" })
    this.sendToTag(TAG_HOST, { type: "room_deleted" })
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.close(1000, "room deleted")
      } catch {
        // Already closing; nothing to do.
      }
    }
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    this.schemaReady = false
    this.explanationCache.clear()
  }

  // =====================================================================
  // Reading
  // =====================================================================

  async getView(caller: Caller): Promise<Result<{ view: RoomView }>> {
    const identity = await this.identify(caller)
    if (!identity.ok) return identity

    const snapshot = identity.isHost
      ? this.buildHostSnapshot(identity.room)
      : this.buildSnapshot(identity.room)

    return ok({
      view: {
        snapshot,
        viewer: {
          isHost: identity.isHost,
          memberships: this.repo.membershipsOf(identity.deviceHash),
        },
      },
    })
  }

  async listQuestions(caller: Caller): Promise<Result<{ questions: HostQuestion[] }>> {
    const identity = await this.identifyHost(caller)
    if (!identity.ok) return identity
    return ok({ questions: this.repo.recentQuestions(HOST_QUESTION_LIST_LIMIT) })
  }

  // =====================================================================
  // Student actions
  // =====================================================================

  async ask(caller: Caller, text: string): Promise<Result<{ questionId: number; cooldownMs: number }>> {
    const identity = await this.identify(caller)
    if (!identity.ok) return identity
    const { room, deviceHash } = identity
    if (room.status === "closed") return fail("room_closed")

    const now = Date.now()
    const lastAskAt = this.repo.lastAskAt(deviceHash)
    if (lastAskAt !== null && now - lastAskAt < ASK_COOLDOWN_MS) {
      return fail("rate_limited", ASK_COOLDOWN_MS - (now - lastAskAt))
    }
    if (this.repo.countQuestions() >= MAX_QUESTIONS_PER_ROOM) return fail("room_full")

    const questionId = this.repo.insertQuestion(deviceHash, maskRudeWords(text), now)
    this.enqueueClustering()
    this.scheduleBroadcast()
    return ok({ questionId, cooldownMs: ASK_COOLDOWN_MS })
  }

  async joinTopic(caller: Caller, topicId: number): Promise<Result> {
    const identity = await this.identify(caller)
    if (!identity.ok) return identity
    if (identity.room.status === "closed") return fail("room_closed")

    const result = this.repo.joinTopic(topicId, identity.deviceHash, Date.now())
    if (result === "topic_not_found") return fail("not_found")
    this.scheduleBroadcast()
    return ok()
  }

  async leaveTopic(caller: Caller, topicId: number): Promise<Result> {
    const identity = await this.identify(caller)
    if (!identity.ok) return identity

    const result = this.repo.leaveTopic(topicId, identity.deviceHash, Date.now())
    if (result === "own_question") return fail("not_allowed")
    this.scheduleBroadcast()
    return ok()
  }

  async sendFeedback(caller: Caller, topicId: number, feedback: Feedback): Promise<Result> {
    const identity = await this.identify(caller)
    if (!identity.ok) return identity

    const result = this.repo.setFeedback(topicId, identity.deviceHash, feedback)
    if (result === "topic_not_found") return fail("not_found")
    if (result !== "saved") return fail("not_allowed")
    this.scheduleBroadcast()
    return ok()
  }

  // =====================================================================
  // Host actions
  // =====================================================================

  async resolveTopic(caller: Caller, topicId: number): Promise<Result> {
    const identity = await this.identifyHost(caller)
    if (!identity.ok) return identity

    if (!this.repo.resolveTopic(topicId, Date.now())) return fail("not_found")
    this.scheduleBroadcast()
    return ok()
  }

  async renameTopic(caller: Caller, topicId: number, label: string): Promise<Result> {
    const identity = await this.identifyHost(caller)
    if (!identity.ok) return identity

    const topic = this.repo.getTopic(topicId)
    if (!topic) return fail("not_found")
    // "host" as the source means the AI will never overwrite the lecturer's wording.
    this.repo.setTopicLabel(topicId, label, "host", topic.questionCount, Date.now())
    this.scheduleBroadcast()
    return ok()
  }

  async hideQuestion(caller: Caller, questionId: number): Promise<Result> {
    const identity = await this.identifyHost(caller)
    if (!identity.ok) return identity

    if (!this.repo.hideQuestion(questionId, Date.now())) return fail("not_found")
    this.scheduleBroadcast()
    return ok()
  }

  async explain(
    caller: Caller,
    topicId: number,
  ): Promise<Result<{ explanation: TopicExplanation }>> {
    const identity = await this.identifyHost(caller)
    if (!identity.ok) return identity

    const topic = this.repo.getTopic(topicId)
    if (!topic) return fail("not_found")

    // Same topic at the same size gets the same answer: no point paying for it twice.
    const cacheKey = `${topic.id}:${topic.questionCount}:${topic.label}`
    const cached = this.explanationCache.get(cacheKey)
    if (cached) return ok({ explanation: cached })

    const apiKey = this.env.ANTHROPIC_API_KEY
    if (!apiKey) return fail("ai_unavailable")

    const questions = this.repo.topicQuestions(topicId, LLM_SAMPLE_SIZE).map((q) => q.body)
    try {
      const explanation = await explainTopic(apiKey, identity.room.title, topic.label, questions)
      this.explanationCache.set(cacheKey, explanation)
      return ok({ explanation })
    } catch (error) {
      console.error("explain failed", { topicId, error: String(error) })
      return fail("ai_unavailable")
    }
  }

  async startDemo(caller: Caller): Promise<Result> {
    const identity = await this.identifyHost(caller)
    if (!identity.ok) return identity
    if (identity.room.status === "closed") return fail("room_closed")
    if (this.demoRunning) return ok()

    this.demoRunning = true
    this.repo.setDemoAudience(DEMO_AUDIENCE_SIZE)
    this.ctx.waitUntil(this.runDemo(identity.room.deviceSalt))
    return ok()
  }

  /** Plays a pretend class: questions trickle in, then a few more students tap "ฉันก็งง". */
  private async runDemo(deviceSalt: string): Promise<void> {
    try {
      const questions = demoQuestionOrder()
      for (const [index, text] of questions.entries()) {
        await sleep(700)
        const deviceHash = await sha256Hex(`${deviceSalt}:demo-asker-${index}`)
        this.repo.insertQuestion(deviceHash, text, Date.now())
        this.enqueueClustering()
        this.scheduleBroadcast()
      }

      await this.clusteringQueue
      const topics = this.repo.snapshotTopics()
      for (let index = 0; index < 14 && topics.length > 0; index++) {
        await sleep(400)
        // Bias the taps towards the first topics so the bubbles end up different sizes.
        const topic = topics[Math.floor(Math.random() ** 2 * topics.length)]!
        const deviceHash = await sha256Hex(`${deviceSalt}:demo-metoo-${index}`)
        this.repo.joinTopic(topic.id, deviceHash, Date.now())
        this.scheduleBroadcast()
      }
    } finally {
      this.demoRunning = false
    }
  }

  // =====================================================================
  // WebSockets
  // =====================================================================

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 })
    }

    const role = request.headers.get(SOCKET_HEADERS.role) as SocketRole | null
    const caller: Caller = {
      deviceId: request.headers.get(SOCKET_HEADERS.deviceId) ?? "",
      hostToken: request.headers.get(SOCKET_HEADERS.hostToken),
    }

    const identity = await this.identify(caller)
    if (!identity.ok) return new Response(null, { status: 404 })
    if (role === "host" && !identity.isHost) return new Response(null, { status: 401 })
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS_PER_ROOM) {
      return new Response(null, { status: 503 })
    }

    const tags =
      role === "host"
        ? [TAG_HOST]
        : role === "screen"
          ? [TAG_PUBLIC]
          : [TAG_PUBLIC, TAG_STUDENT, deviceTag(identity.deviceHash)]

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server, tags)

    // A new student changes the "online" number everyone sees.
    this.scheduleBroadcast()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(): Promise<void> {
    // Clients only send "ping", which the auto-response handles. Anything else is ignored.
  }

  async webSocketClose(socket: WebSocket, code: number): Promise<void> {
    try {
      socket.close(code, "closing")
    } catch {
      // The runtime may already have completed the close handshake.
    }
    this.scheduleBroadcast()
  }

  async webSocketError(): Promise<void> {
    this.scheduleBroadcast()
  }

  private sendToTag(tag: string, message: ServerMessage): void {
    const payload = JSON.stringify(message)
    for (const socket of this.ctx.getWebSockets(tag)) {
      try {
        socket.send(payload)
      } catch {
        // A socket that is closing cannot receive; its close handler will clean up.
      }
    }
  }

  /** Many changes in a short burst become one broadcast. */
  private scheduleBroadcast(): void {
    if (this.broadcastTimer) return
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null
      this.broadcastNow()
    }, BROADCAST_DELAY_MS)
  }

  private broadcastNow(): void {
    const room = this.loadRoom()
    if (!room) return
    this.sendToTag(TAG_PUBLIC, { type: "snapshot", snapshot: this.buildSnapshot(room) })
    this.sendToTag(TAG_HOST, { type: "snapshot", snapshot: this.buildHostSnapshot(room) })
  }

  // =====================================================================
  // Clustering queue
  // =====================================================================

  private enqueueClustering(): void {
    this.clusteringQueue = this.clusteringQueue
      .then(() => this.clusterPendingQuestions())
      .catch((error) => console.error("clustering failed", { error: String(error) }))
  }

  private async clusterPendingQuestions(): Promise<void> {
    while (this.loadRoom()) {
      const batch = this.repo.questionsToEmbed(EMBED_BATCH_SIZE, MAX_PROCESSING_ATTEMPTS)
      if (batch.length === 0) return

      let vectors: Vector[]
      try {
        vectors = await embedTexts(this.env.AI, batch.map((question) => question.body))
      } catch (error) {
        console.error("embedding failed", { count: batch.length, error: String(error) })
        await this.handleEmbeddingFailure(batch)
        return
      }

      const topics = this.repo.topicCentroids()
      batch.forEach((question, index) => this.clusterOne(question, vectors[index]!, topics))
      this.scheduleBroadcast()
    }
  }

  private clusterOne(question: QueuedQuestion, vector: Vector, topics: TopicCentroid[]): void {
    let assignment = findNearestTopic(vector, topics, SIMILARITY_THRESHOLD)
    if (assignment.kind === "new" && !this.repo.canCreateTopic()) {
      // Topic limit reached: put it with whatever is closest rather than dropping it.
      assignment = findNearestTopic(vector, topics, -Infinity)
    }

    const existingTopicId = assignment.kind === "existing" ? assignment.topicId : null
    const topic = this.repo.clusterQuestion(question, vector, existingTopicId, Date.now())
    if (!topic) return

    // Keep the in-memory list current so later questions in the same batch see this one.
    const cached = topics.find((entry) => entry.topicId === topic.id)
    if (cached) {
      cached.centroid = topic.centroid
      cached.size = topic.questionCount
    } else {
      topics.push({ topicId: topic.id, centroid: topic.centroid, size: topic.questionCount })
    }

    this.sendToTag(deviceTag(question.deviceHash), {
      type: "assigned",
      questionId: question.id,
      topicId: topic.id,
      label: topic.label,
    })

    if (topic.labelSource !== "host" && shouldRelabel(topic.questionCount, topic.labeledAtSize)) {
      this.enqueueLabeling(topic.id)
    }
  }

  private async handleEmbeddingFailure(batch: QueuedQuestion[]): Promise<void> {
    for (const question of batch) {
      this.repo.markQuestionFailed(question.id)
      if (question.attempts + 1 >= MAX_PROCESSING_ATTEMPTS) {
        this.sendToTag(deviceTag(question.deviceHash), {
          type: "processing_failed",
          questionId: question.id,
        })
      }
    }
    this.scheduleBroadcast()

    const retryAt = Date.now() + RETRY_DELAY_MS
    const currentAlarm = await this.ctx.storage.getAlarm()
    if (currentAlarm === null || retryAt < currentAlarm) {
      await this.ctx.storage.setAlarm(retryAt)
    }
  }

  // =====================================================================
  // Topic labels
  // =====================================================================

  private enqueueLabeling(topicId: number): void {
    if (this.topicsWaitingForLabel.has(topicId)) return
    this.topicsWaitingForLabel.add(topicId)

    this.labelingQueue = this.labelingQueue
      .then(() => this.relabelTopic(topicId))
      .catch((error) => console.error("labeling failed", { topicId, error: String(error) }))
      .finally(() => this.topicsWaitingForLabel.delete(topicId))
  }

  private async relabelTopic(topicId: number): Promise<void> {
    const room = this.loadRoom()
    const topic = this.repo.getTopic(topicId)
    if (!room || !topic || topic.labelSource === "host") return

    const questions = this.repo.topicQuestions(topicId, LLM_SAMPLE_SIZE)
    let label: string
    let source: "ai" | "question"
    try {
      if (!this.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("No API key configured")
      label = await labelTopic(
        this.env.ANTHROPIC_API_KEY,
        room.title,
        questions.map((question) => question.body),
      )
      source = "ai"
    } catch (error) {
      // Without the LLM, the most typical question in the topic is a decent label.
      console.warn("using medoid label", { topicId, reason: String(error) })
      label = this.medoidLabel(topic.centroid, questions) ?? topic.label
      source = "question"
    }

    // The topic may have changed while we waited for the model.
    const latest = this.repo.getTopic(topicId)
    if (!latest || latest.labelSource === "host") return
    this.repo.setTopicLabel(topicId, label, source, latest.questionCount, Date.now())
    this.scheduleBroadcast()
  }

  private medoidLabel(
    centroid: Vector,
    questions: { body: string; embedding: Vector | null }[],
  ): string | null {
    const withVectors = questions.filter((question) => question.embedding !== null)
    if (withVectors.length === 0) return null
    const index = findMedoidIndex(
      withVectors.map((question) => question.embedding!),
      centroid,
    )
    return withVectors[index]?.body.slice(0, QUESTION_LABEL_PREVIEW_LENGTH) ?? null
  }

  // =====================================================================
  // Snapshots
  // =====================================================================

  private buildSnapshot(room: RoomRecord): RoomSnapshot {
    return {
      code: room.code,
      title: room.title,
      status: room.status,
      confusion: this.measureConfusion(room),
      topics: this.repo.snapshotTopics(),
    }
  }

  private buildHostSnapshot(room: RoomRecord): HostSnapshot {
    return { ...this.buildSnapshot(room), host: this.repo.questionStats() }
  }

  private measureConfusion(room: RoomRecord): ConfusionSummary {
    const confusedPeople = this.repo.countConfusedSince(Date.now() - CONFUSION_WINDOW_MS)
    const online = this.ctx.getWebSockets(TAG_STUDENT).length + room.demoAudience
    // Someone can send a question and then lock their phone, so never divide by fewer
    // people than are known to be confused.
    const audience = Math.max(online, confusedPeople)
    const share = audience === 0 ? 0 : confusedPeople / audience

    let level: ConfusionLevel = "low"
    if (share >= CONFUSION_HIGH_FROM) level = "high"
    else if (share >= CONFUSION_MEDIUM_FROM) level = "medium"

    return { confusedPeople, online: audience, percent: Math.round(share * 100), level }
  }

  // =====================================================================
  // Identity
  // =====================================================================

  private ensureSchema(): void {
    if (this.schemaReady) return
    runMigrations(this.ctx.storage)
    this.schemaReady = true
  }

  /**
   * Returns the room if it exists and has not expired. A request for an unknown code must not
   * create tables, otherwise anyone guessing codes would leave empty databases behind.
   */
  private loadRoom(): RoomRecord | null {
    if (!this.schemaReady) {
      if (!hasSchema(this.ctx.storage.sql)) return null
      this.ensureSchema()
    }
    const room = this.repo.getRoom()
    if (!room || Date.now() >= room.expiresAt) return null
    return room
  }

  private async identify(caller: Caller): Promise<Result<Identity>> {
    const room = this.loadRoom()
    if (!room) return fail("not_found")

    const deviceHash = await sha256Hex(`${room.deviceSalt}:${caller.deviceId}`)
    const isHost =
      caller.hostToken !== null &&
      constantTimeEqual(await sha256Hex(caller.hostToken), room.hostTokenHash)

    return ok({ room, deviceHash, isHost })
  }

  private async identifyHost(caller: Caller): Promise<Result<Identity>> {
    const identity = await this.identify(caller)
    if (!identity.ok) return identity
    if (!identity.isHost) return fail("unauthorized")
    return identity
  }
}
