import { describe, expect, it } from "vitest"
import { askSchema, createRoomSchema, renameTopicSchema } from "@/shared/schemas"
import { QUESTION_MAX_LENGTH } from "@/shared/limits"

describe("askSchema", () => {
  it("trims and collapses whitespace", () => {
    expect(askSchema.parse({ text: "  useEffect   รันกี่รอบ \n" })).toEqual({
      text: "useEffect รันกี่รอบ",
    })
  })

  it("rejects blank messages", () => {
    expect(askSchema.safeParse({ text: "   " }).success).toBe(false)
  })

  it("rejects messages over the limit", () => {
    expect(askSchema.safeParse({ text: "ก".repeat(QUESTION_MAX_LENGTH + 1) }).success).toBe(false)
  })

  it("keeps markup as plain text (React escapes it when rendering)", () => {
    expect(askSchema.parse({ text: "<script>alert(1)</script>" }).text).toBe(
      "<script>alert(1)</script>",
    )
  })
})

describe("createRoomSchema", () => {
  it("allows an empty title", () => {
    expect(createRoomSchema.parse({})).toEqual({ title: "" })
  })
})

describe("renameTopicSchema", () => {
  it("requires a label", () => {
    expect(renameTopicSchema.safeParse({ label: "" }).success).toBe(false)
  })
})
