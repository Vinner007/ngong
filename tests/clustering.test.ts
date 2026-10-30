import { describe, expect, it } from "vitest"
import {
  addToCentroid,
  blobToVector,
  cosineSimilarity,
  findMedoidIndex,
  findNearestTopic,
  normalize,
  removeFromCentroid,
  shouldRelabel,
  vectorToBlob,
} from "@/server/clustering"

const vec = (...values: number[]) => Float32Array.from(values)

describe("cosineSimilarity", () => {
  it("is 1 for the same direction and 0 for perpendicular vectors", () => {
    expect(cosineSimilarity(vec(1, 0), vec(3, 0))).toBeCloseTo(1)
    expect(cosineSimilarity(vec(1, 0), vec(0, 2))).toBeCloseTo(0)
  })

  it("treats a zero vector as unrelated instead of dividing by zero", () => {
    expect(cosineSimilarity(vec(0, 0), vec(1, 1))).toBe(0)
  })

  it("rejects vectors of different lengths", () => {
    expect(() => cosineSimilarity(vec(1), vec(1, 2))).toThrow()
  })
})

describe("normalize", () => {
  it("scales to length 1", () => {
    const unit = normalize(vec(3, 4))
    expect(unit[0]).toBeCloseTo(0.6)
    expect(unit[1]).toBeCloseTo(0.8)
  })
})

describe("findNearestTopic", () => {
  const topics = [
    { topicId: 1, centroid: vec(1, 0), size: 3 },
    { topicId: 2, centroid: vec(0, 1), size: 1 },
  ]

  it("joins the closest topic when it is similar enough", () => {
    const result = findNearestTopic(vec(0.9, 0.1), topics, 0.8)
    expect(result).toMatchObject({ kind: "existing", topicId: 1 })
  })

  it("starts a new topic when nothing passes the threshold", () => {
    expect(findNearestTopic(vec(1, 1), topics, 0.8)).toEqual({ kind: "new" })
  })

  it("starts a new topic when there are no topics yet", () => {
    expect(findNearestTopic(vec(1, 0), [], 0.5)).toEqual({ kind: "new" })
  })
})

describe("centroid updates", () => {
  it("keeps a running mean", () => {
    const afterTwo = addToCentroid(vec(2, 0), 1, vec(0, 2))
    expect(Array.from(afterTwo)).toEqual([1, 1])
  })

  it("can remove a vector again", () => {
    const afterTwo = addToCentroid(vec(2, 0), 1, vec(0, 2))
    const backToOne = removeFromCentroid(afterTwo, 2, vec(0, 2))
    expect(Array.from(backToOne!)).toEqual([2, 0])
  })

  it("returns null when the last vector is removed", () => {
    expect(removeFromCentroid(vec(1, 1), 1, vec(1, 1))).toBeNull()
  })
})

describe("shouldRelabel", () => {
  it("relabels when a milestone is reached for the first time", () => {
    expect(shouldRelabel(2, 1)).toBe(true)
    expect(shouldRelabel(5, 3)).toBe(true)
  })

  it("does not relabel between milestones", () => {
    expect(shouldRelabel(4, 3)).toBe(false)
    expect(shouldRelabel(1, 1)).toBe(false)
  })

  it("catches up when a topic skips past a milestone", () => {
    expect(shouldRelabel(7, 3)).toBe(true)
  })
})

describe("findMedoidIndex", () => {
  it("picks the vector closest to the centroid", () => {
    const vectors = [vec(1, 0), vec(0.7, 0.7), vec(0, 1)]
    expect(findMedoidIndex(vectors, vec(0.5, 0.5))).toBe(1)
  })
})

describe("vector blobs", () => {
  it("round-trips through bytes", () => {
    const original = vec(0.25, -1.5, 3)
    expect(Array.from(blobToVector(vectorToBlob(original)))).toEqual([0.25, -1.5, 3])
  })
})
