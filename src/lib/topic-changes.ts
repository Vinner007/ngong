// Turns two consecutive room snapshots into the events the projector animates and announces.
// Only public data is used (topic labels and head counts), never raw messages.

import type { TopicSummary } from "@/shared/types"

export type TopicEventKind = "new_topic" | "more_people" | "resolved" | "reopened"

export interface TopicChange {
  kind: TopicEventKind
  topicId: number
  label: string
  /** How many people joined since the previous snapshot (only for new_topic and more_people). */
  delta: number
}

export interface TopicEvent extends TopicChange {
  id: number
}

export function diffTopics(previous: TopicSummary[], next: TopicSummary[]): TopicChange[] {
  const previousById = new Map(previous.map((topic) => [topic.id, topic]))
  const changes: TopicChange[] = []

  for (const topic of next) {
    const before = previousById.get(topic.id)
    const base = { topicId: topic.id, label: topic.label }

    if (!before) {
      if (!topic.resolved) changes.push({ ...base, kind: "new_topic", delta: topic.people })
      continue
    }
    if (!before.resolved && topic.resolved) {
      changes.push({ ...base, kind: "resolved", delta: 0 })
      continue
    }
    if (before.resolved && !topic.resolved) {
      changes.push({ ...base, kind: "reopened", delta: Math.max(0, topic.people - before.people) })
      continue
    }
    if (!topic.resolved && topic.people > before.people) {
      changes.push({ ...base, kind: "more_people", delta: topic.people - before.people })
    }
  }

  return changes
}
