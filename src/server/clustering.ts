// Pure math for grouping questions into topics. No I/O here, so every function is unit-tested.
//
// The approach is "online leader clustering": each new question is compared with the centre
// (centroid) of every existing topic. If the closest one is similar enough it joins that topic,
// otherwise it starts a new one. Unlike k-means we never need to know the number of topics in
// advance, and each question costs one pass over the topics: O(k).

import { RELABEL_AT_SIZES } from "@/shared/limits"

export type Vector = Float32Array

export interface TopicCentroid {
  topicId: number
  centroid: Vector
  /** Number of questions averaged into the centroid. */
  size: number
}

export type Assignment =
  | { kind: "existing"; topicId: number; similarity: number }
  | { kind: "new" }

export function cosineSimilarity(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
  }

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    normA += x * x
    normB += y * y
  }

  if (normA === 0 || normB === 0) return 0
  return dot / Math.sqrt(normA * normB)
}

/** Scales a vector to length 1 so that averaging gives every question the same weight. */
export function normalize(vector: Vector): Vector {
  let length = 0
  for (const value of vector) length += value * value
  length = Math.sqrt(length)
  if (length === 0) return Float32Array.from(vector)
  return vector.map((value) => value / length)
}

export function findNearestTopic(
  vector: Vector,
  topics: readonly TopicCentroid[],
  threshold: number,
): Assignment {
  let bestTopicId: number | null = null
  let bestSimilarity = -Infinity

  for (const topic of topics) {
    const similarity = cosineSimilarity(vector, topic.centroid)
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestTopicId = topic.topicId
    }
  }

  if (bestTopicId === null || bestSimilarity < threshold) return { kind: "new" }
  return { kind: "existing", topicId: bestTopicId, similarity: bestSimilarity }
}

/** Running mean: the centroid after adding one more vector, without revisiting the old ones. */
export function addToCentroid(centroid: Vector, size: number, vector: Vector): Vector {
  const newSize = size + 1
  return centroid.map((value, i) => value + (vector[i]! - value) / newSize)
}

/**
 * The inverse of addToCentroid, used when the host hides a question.
 * Returns null when the topic would become empty.
 */
export function removeFromCentroid(centroid: Vector, size: number, vector: Vector): Vector | null {
  if (size <= 1) return null
  return centroid.map((value, i) => (value * size - vector[i]!) / (size - 1))
}

/**
 * True when a topic that just grew to `newSize` questions has passed a relabel milestone
 * since its label was last written (at `labeledAtSize`).
 */
export function shouldRelabel(newSize: number, labeledAtSize: number): boolean {
  const reachedMilestones = RELABEL_AT_SIZES.filter((milestone) => milestone <= newSize)
  const latestMilestone = reachedMilestones.at(-1)
  return latestMilestone !== undefined && latestMilestone > labeledAtSize
}

/** Index of the vector closest to the centroid: the question that best represents the topic. */
export function findMedoidIndex(vectors: readonly Vector[], centroid: Vector): number {
  let bestIndex = -1
  let bestSimilarity = -Infinity
  vectors.forEach((vector, index) => {
    const similarity = cosineSimilarity(vector, centroid)
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestIndex = index
    }
  })
  return bestIndex
}

// Vectors are stored in SQLite as raw Float32 bytes: 1024 dimensions take 4 KB,
// a third of the size of the same numbers written out as JSON.
export function vectorToBlob(vector: Vector): ArrayBuffer {
  return vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength) as ArrayBuffer
}

export function blobToVector(blob: ArrayBuffer): Vector {
  return new Float32Array(blob.slice(0))
}
