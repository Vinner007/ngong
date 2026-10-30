// Development-only helper for choosing SIMILARITY_THRESHOLD.
// It embeds the labelled demo questions once, replays the clustering at several thresholds,
// and reports how well each one recovers the six known topics.

import { embedTexts } from "@/server/ai"
import {
  addToCentroid,
  cosineSimilarity,
  findNearestTopic,
  type TopicCentroid,
} from "@/server/clustering"
import { DEMO_TOPICS, demoQuestionOrder } from "@/server/demo"

const THRESHOLDS = [0.5, 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.6, 0.65]

export interface TuningRow {
  threshold: number
  topicsFound: number
  /** Share of questions sitting in a cluster whose majority comes from their own true topic. */
  purity: number
  /** Share of true topics whose questions all ended up in a single cluster. */
  topicsKeptWhole: number
}

export interface PairStats {
  sameTopic: { min: number; mean: number }
  differentTopic: { mean: number; max: number }
}

export async function runThresholdTuning(
  ai: Ai,
): Promise<{ expectedTopics: number; pairs: PairStats; rows: TuningRow[] }> {
  const questions = demoQuestionOrder()
  const trueTopicOf = new Map<string, string>()
  for (const topic of DEMO_TOPICS) {
    for (const question of topic.questions) trueTopicOf.set(question, topic.name)
  }

  const vectors = await embedTexts(ai, questions)
  const rows = THRESHOLDS.map((threshold) => {
    const clusterOf = clusterAll(vectors, threshold)
    return scoreClustering(questions, clusterOf, trueTopicOf, threshold)
  })
  return {
    expectedTopics: DEMO_TOPICS.length,
    pairs: pairStats(questions, vectors, trueTopicOf),
    rows,
  }
}

/** How similar are two questions about the same topic, compared with two about different ones? */
function pairStats(
  questions: string[],
  vectors: Float32Array[],
  trueTopicOf: Map<string, string>,
): PairStats {
  const same: number[] = []
  const different: number[] = []
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const similarity = cosineSimilarity(vectors[i]!, vectors[j]!)
      const sameTopic = trueTopicOf.get(questions[i]!) === trueTopicOf.get(questions[j]!)
      ;(sameTopic ? same : different).push(similarity)
    }
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    sameTopic: { min: round(Math.min(...same)), mean: round(mean(same)) },
    differentTopic: { mean: round(mean(different)), max: round(Math.max(...different)) },
  }
}

function clusterAll(vectors: Float32Array[], threshold: number): number[] {
  const topics: TopicCentroid[] = []
  return vectors.map((vector) => {
    const assignment = findNearestTopic(vector, topics, threshold)
    if (assignment.kind === "new") {
      topics.push({ topicId: topics.length, centroid: vector, size: 1 })
      return topics.length - 1
    }
    const topic = topics[assignment.topicId]!
    topic.centroid = addToCentroid(topic.centroid, topic.size, vector)
    topic.size += 1
    return assignment.topicId
  })
}

function scoreClustering(
  questions: string[],
  clusterOf: number[],
  trueTopicOf: Map<string, string>,
  threshold: number,
): TuningRow {
  const membersByCluster = new Map<number, string[]>()
  const clustersByTrueTopic = new Map<string, Set<number>>()

  questions.forEach((question, index) => {
    const cluster = clusterOf[index]!
    const trueTopic = trueTopicOf.get(question)!
    membersByCluster.set(cluster, [...(membersByCluster.get(cluster) ?? []), trueTopic])
    clustersByTrueTopic.set(trueTopic, (clustersByTrueTopic.get(trueTopic) ?? new Set()).add(cluster))
  })

  let correctlyPlaced = 0
  for (const trueTopics of membersByCluster.values()) {
    const counts = new Map<string, number>()
    for (const topic of trueTopics) counts.set(topic, (counts.get(topic) ?? 0) + 1)
    correctlyPlaced += Math.max(...counts.values())
  }

  const keptWhole = [...clustersByTrueTopic.values()].filter((clusters) => clusters.size === 1)

  return {
    threshold,
    topicsFound: membersByCluster.size,
    purity: round(correctlyPlaced / questions.length),
    topicsKeptWhole: round(keptWhole.length / clustersByTrueTopic.size),
  }
}

const round = (value: number) => Math.round(value * 100) / 100
