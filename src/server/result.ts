import type { ApiErrorCode } from "@/shared/types"

// Durable Object methods return a Result instead of throwing, so every failure the caller can
// hit is visible in the type and maps cleanly to an HTTP status in api.ts.

export type Failure = { ok: false; error: ApiErrorCode; retryAfterMs?: number }
export type Result<T extends object = object> = ({ ok: true } & T) | Failure

export function ok(): { ok: true }
export function ok<T extends object>(value: T): { ok: true } & T
export function ok<T extends object>(value?: T) {
  return { ok: true as const, ...(value ?? {}) }
}

export function fail(error: ApiErrorCode, retryAfterMs?: number): Failure {
  return retryAfterMs === undefined ? { ok: false, error } : { ok: false, error, retryAfterMs }
}
