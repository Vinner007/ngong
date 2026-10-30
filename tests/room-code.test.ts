import { describe, expect, it } from "vitest"
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "@/shared/room-code"

describe("generateRoomCode", () => {
  it("only uses unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode()
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      expect(isValidRoomCode(code)).toBe(true)
      expect(code).not.toMatch(/[01ILO]/)
    }
  })

  it("throws away bytes that would bias the distribution", () => {
    // 248 and above are rejected (31 * 8 = 248), so the code is built from the bytes after them.
    let call = 0
    const fakeRandom = (bytes: Uint8Array) => {
      call++
      bytes.fill(call === 1 ? 255 : 0)
      return bytes
    }
    expect(generateRoomCode(fakeRandom)).toBe(ROOM_CODE_ALPHABET[0]!.repeat(ROOM_CODE_LENGTH))
    expect(call).toBe(2)
  })
})

describe("normalizeRoomCode", () => {
  it("accepts lowercase, spaces and dashes", () => {
    expect(normalizeRoomCode(" k7q-x2m ")).toBe("K7QX2M")
  })
})

describe("isValidRoomCode", () => {
  it("rejects ambiguous characters and wrong lengths", () => {
    expect(isValidRoomCode("K7QX2M")).toBe(true)
    expect(isValidRoomCode("K7QX2")).toBe(false)
    expect(isValidRoomCode("K7QX2O")).toBe(false)
    expect(isValidRoomCode("k7qx2m")).toBe(false)
  })
})
