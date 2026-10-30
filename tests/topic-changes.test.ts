import { describe, expect, it } from "vitest"
import { diffTopics } from "@/lib/topic-changes"
import type { TopicSummary } from "@/shared/types"

const topic = (id: number, people: number, resolved = false): TopicSummary => ({
  id,
  label: `topic ${id}`,
  people,
  resolved,
  understood: 0,
  stillConfused: 0,
})

describe("diffTopics", () => {
  it("reports a new open topic with its starting head count", () => {
    expect(diffTopics([], [topic(1, 2)])).toEqual([
      { kind: "new_topic", topicId: 1, label: "topic 1", delta: 2 },
    ])
  })

  it("reports how many more people joined", () => {
    expect(diffTopics([topic(1, 2)], [topic(1, 5)])).toEqual([
      { kind: "more_people", topicId: 1, label: "topic 1", delta: 3 },
    ])
  })

  it("reports a topic the host just resolved", () => {
    expect(diffTopics([topic(1, 4)], [topic(1, 4, true)])).toMatchObject([
      { kind: "resolved", topicId: 1 },
    ])
  })

  it("reports a resolved topic that people are confused about again", () => {
    expect(diffTopics([topic(1, 4, true)], [topic(1, 5)])).toMatchObject([
      { kind: "reopened", topicId: 1, delta: 1 },
    ])
  })

  it("stays quiet when people leave or nothing changed", () => {
    expect(diffTopics([topic(1, 4)], [topic(1, 3)])).toEqual([])
    expect(diffTopics([topic(1, 4), topic(2, 1)], [topic(1, 4), topic(2, 1)])).toEqual([])
  })

  it("does not announce a topic that appears already resolved", () => {
    expect(diffTopics([], [topic(1, 3, true)])).toEqual([])
  })
})
