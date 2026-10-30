// Room codes are typed by students on a phone, often read off a projector from the back row,
// so the alphabet drops characters that look alike: 0/O, 1/I/L.
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
export const ROOM_CODE_LENGTH = 6

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`)

// The largest multiple of the alphabet size that fits in a byte. Bytes at or above it are
// thrown away so every character is equally likely (no modulo bias).
const UNBIASED_BYTE_LIMIT = Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length

type RandomBytes = (bytes: Uint8Array) => Uint8Array

const cryptoRandomBytes: RandomBytes = (bytes) => crypto.getRandomValues(bytes)

export function generateRoomCode(randomBytes: RandomBytes = cryptoRandomBytes): string {
  let code = ""
  while (code.length < ROOM_CODE_LENGTH) {
    for (const byte of randomBytes(new Uint8Array(ROOM_CODE_LENGTH * 2))) {
      if (byte >= UNBIASED_BYTE_LIMIT) continue
      code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
      if (code.length === ROOM_CODE_LENGTH) break
    }
  }
  return code
}

/** Turns what a student typed ("k7q x2m", "k7q-x2m") into the canonical form. */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "")
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code)
}
