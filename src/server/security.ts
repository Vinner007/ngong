// Small, dependency-free security helpers used by the worker and the Durable Object.

export const DEVICE_COOKIE = "ngong_device"
const DEVICE_ID_PATTERN = /^[0-9a-f]{32}$/
const HOST_TOKEN_PATTERN = /^[0-9a-f]{64}$/

export function hostCookieName(roomCode: string): string {
  return `ngong_host_${roomCode}`
}

export function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** Compares two secrets in time that does not depend on where they first differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}

/**
 * A device id is a random value kept in an HttpOnly cookie. It is never shown to anyone:
 * the room stores only a salted hash of it, so the same phone looks unrelated in two rooms.
 */
export function newDeviceId(): string {
  return randomHex(16)
}

export function isValidDeviceId(value: string | undefined): value is string {
  return value !== undefined && DEVICE_ID_PATTERN.test(value)
}

export function newHostToken(): string {
  return randomHex(32)
}

export function isValidHostToken(value: string | undefined): value is string {
  return value !== undefined && HOST_TOKEN_PATTERN.test(value)
}

// ---------- cookies ----------

export function readCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const separator = part.indexOf("=")
    if (separator === -1) continue
    cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim())
  }
  return cookies
}

interface CookieOptions {
  maxAgeSeconds: number
  path: string
  sameSite: "Strict" | "Lax"
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  return [
    `${name}=${value}`,
    `Max-Age=${options.maxAgeSeconds}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    "HttpOnly",
    "Secure",
  ].join("; ")
}

// ---------- requests ----------

/**
 * Browsers always send Origin on POST/PATCH/DELETE and on WebSocket handshakes. Requiring it to
 * match our own origin blocks CSRF and cross-site WebSocket hijacking in one check.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin")
  return origin !== null && origin === new URL(request.url).origin
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown"
}

// ---------- responses ----------

const BASE_SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-Frame-Options": "DENY",
}

/** JSON responses never need to load anything, so their CSP allows nothing at all. */
const API_CSP = "default-src 'none'; frame-ancestors 'none'"

export function withSecurityHeaders(response: Response, options: { isApi: boolean }): Response {
  const secured = new Response(response.body, response)
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    secured.headers.set(name, value)
  }
  if (options.isApi) {
    secured.headers.set("Content-Security-Policy", API_CSP)
    secured.headers.set("Cache-Control", "no-store")
  }
  return secured
}
