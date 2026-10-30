// HTTP API, run by the worker before Next.js sees the request.
// Order of checks for every route: match → same-origin (for anything that changes data or opens
// a socket) → per-IP rate limit → identify the caller from cookies → validate the body → call
// the room's Durable Object → turn its Result into an HTTP response.

import type { z } from "zod"
import type { Env } from "@/server/env"
import { isDevelopment } from "@/server/env"
import type { Failure } from "@/server/result"
import { SOCKET_HEADERS, type Caller, type RoomDO } from "@/server/room-do"
import {
  DEVICE_COOKIE,
  clientIp,
  hostCookieName,
  isSameOrigin,
  isValidDeviceId,
  isValidHostToken,
  newDeviceId,
  newHostToken,
  readCookies,
  serializeCookie,
  sha256Hex,
} from "@/server/security"
import { runThresholdTuning } from "@/server/tune"
import { ROOM_LIFETIME_MS } from "@/shared/limits"
import { generateRoomCode, isValidRoomCode } from "@/shared/room-code"
import {
  askSchema,
  createRoomSchema,
  feedbackSchema,
  renameTopicSchema,
} from "@/shared/schemas"
import type { ApiErrorBody, ApiErrorCode, SocketRole } from "@/shared/types"

const MAX_BODY_BYTES = 4_096
const DEVICE_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60

const STATUS_BY_ERROR: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden_origin: 403,
  not_allowed: 403,
  not_found: 404,
  room_closed: 409,
  room_full: 409,
  rate_limited: 429,
  internal: 500,
  ai_unavailable: 503,
}

// ---------- responses ----------

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function errorResponse(error: ApiErrorCode, retryAfterMs?: number): Response {
  const body: ApiErrorBody = retryAfterMs === undefined ? { error } : { error, retryAfterMs }
  const response = json(body, STATUS_BY_ERROR[error])
  if (retryAfterMs !== undefined) {
    response.headers.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)))
  }
  return response
}

/** Turns a Durable Object Result into a response: failures become error JSON, successes `toBody`. */
function fromResult<R extends { ok: boolean }>(
  result: R,
  toBody: (value: Extract<R, { ok: true }>) => unknown = () => ({ ok: true }),
): Response {
  if (!result.ok) {
    const failure = result as unknown as Failure
    return errorResponse(failure.error, failure.retryAfterMs)
  }
  return json(toBody(result as Extract<R, { ok: true }>))
}

async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.output<T> } | { response: Response }> {
  const contentType = request.headers.get("Content-Type") ?? ""
  if (!contentType.startsWith("application/json")) {
    return { response: errorResponse("bad_request") }
  }

  const declaredLength = Number(request.headers.get("Content-Length") ?? 0)
  if (declaredLength > MAX_BODY_BYTES) return { response: errorResponse("bad_request") }

  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return { response: errorResponse("bad_request") }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { response: errorResponse("bad_request") }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { response: errorResponse("bad_request") }
  return { data: parsed.data }
}

// ---------- routing ----------

interface RouteContext {
  request: Request
  env: Env
  url: URL
  code: string
  id: number
  caller: Caller
  room: DurableObjectStub<RoomDO>
}

type Handler = (context: RouteContext) => Promise<Response>

interface Route {
  method: string
  pattern: RegExp
  handler: Handler
  /** Host-only routes still go through the same checks; the Durable Object verifies the token. */
  kind: "read" | "write" | "socket"
}

const CODE = "([A-Z0-9]{6})"
const ID = "(\\d{1,9})"
const route = (method: string, path: string, kind: Route["kind"], handler: Handler): Route => ({
  method,
  pattern: new RegExp(`^/api/rooms/${CODE}${path}$`),
  kind,
  handler,
})

const ROUTES: Route[] = [
  route("GET", "", "read", async ({ room, caller }) =>
    fromResult(await room.getView(caller), ({ view }) => view),
  ),
  route("GET", "/socket", "socket", (context) => openSocket(context)),

  route("POST", "/questions", "write", async ({ request, room, caller }) => {
    const body = await readBody(request, askSchema)
    if ("response" in body) return body.response
    return fromResult(await room.ask(caller, body.data.text), ({ questionId, cooldownMs }) => ({
      questionId,
      cooldownMs,
    }))
  }),
  route("GET", "/questions", "read", async ({ room, caller }) =>
    fromResult(await room.listQuestions(caller), ({ questions }) => ({ questions })),
  ),
  route("POST", `/questions/${ID}/hide`, "write", async ({ room, caller, id }) =>
    fromResult(await room.hideQuestion(caller, id)),
  ),

  route("POST", `/topics/${ID}/join`, "write", async ({ room, caller, id }) =>
    fromResult(await room.joinTopic(caller, id)),
  ),
  route("DELETE", `/topics/${ID}/join`, "write", async ({ room, caller, id }) =>
    fromResult(await room.leaveTopic(caller, id)),
  ),
  route("POST", `/topics/${ID}/feedback`, "write", async ({ request, room, caller, id }) => {
    const body = await readBody(request, feedbackSchema)
    if ("response" in body) return body.response
    return fromResult(await room.sendFeedback(caller, id, body.data.feedback))
  }),
  route("POST", `/topics/${ID}/resolve`, "write", async ({ room, caller, id }) =>
    fromResult(await room.resolveTopic(caller, id)),
  ),
  route("PATCH", `/topics/${ID}`, "write", async ({ request, room, caller, id }) => {
    const body = await readBody(request, renameTopicSchema)
    if ("response" in body) return body.response
    return fromResult(await room.renameTopic(caller, id, body.data.label))
  }),
  route("POST", `/topics/${ID}/explain`, "write", async ({ room, caller, id }) =>
    fromResult(await room.explain(caller, id), ({ explanation }) => ({ explanation })),
  ),

  route("POST", "/demo", "write", async ({ room, caller }) =>
    fromResult(await room.startDemo(caller)),
  ),
  route("POST", "/close", "write", async ({ room, caller }) =>
    fromResult(await room.closeRoom(caller)),
  ),
  route("DELETE", "", "write", async ({ room, caller, code }) => {
    const response = fromResult(await room.deleteRoom(caller))
    response.headers.append("Set-Cookie", expiredHostCookie(code))
    return response
  }),
]

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method

  if (method === "POST" && url.pathname === "/api/rooms") return createRoom(request, env)
  if (method === "GET" && url.pathname === "/api/dev/tune" && isDevelopment(env)) {
    return json(await runThresholdTuning(env.AI))
  }

  for (const candidate of ROUTES) {
    if (candidate.method !== method) continue
    const match = candidate.pattern.exec(url.pathname)
    if (!match) continue

    const code = match[1]!
    if (!isValidRoomCode(code)) return errorResponse("not_found")
    return runRoute(candidate, { request, env, url, code, id: Number(match[2] ?? 0) })
  }

  return errorResponse("not_found")
}

async function runRoute(
  candidate: Route,
  partial: Omit<RouteContext, "caller" | "room">,
): Promise<Response> {
  const { request, env, code } = partial

  if (candidate.kind !== "read" && !isSameOrigin(request)) {
    return errorResponse("forbidden_origin")
  }

  const limiter = candidate.kind === "write" ? env.WRITE_LIMITER : env.READ_LIMITER
  const { success } = await limiter.limit({ key: `${clientIp(request)}:${code}` })
  if (!success) return errorResponse("rate_limited", 60_000)

  const cookies = readCookies(request)
  const existingDeviceId = cookies.get(DEVICE_COOKIE)
  const hostToken = cookies.get(hostCookieName(code))

  // A socket is always opened after the page fetched the room, which already set the cookie.
  if (candidate.kind === "socket" && !isValidDeviceId(existingDeviceId)) {
    return errorResponse("bad_request")
  }

  const deviceId = isValidDeviceId(existingDeviceId) ? existingDeviceId : newDeviceId()
  const caller: Caller = {
    deviceId,
    hostToken: isValidHostToken(hostToken) ? hostToken : null,
  }
  const room = env.ROOM.get(env.ROOM.idFromName(code))

  const response = await candidate.handler({ ...partial, caller, room })
  if (deviceId !== existingDeviceId && response.status !== 101) {
    response.headers.append("Set-Cookie", deviceCookie(deviceId))
  }
  return response
}

// ---------- special routes ----------

async function createRoom(request: Request, env: Env): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse("forbidden_origin")

  const { success } = await env.CREATE_ROOM_LIMITER.limit({ key: clientIp(request) })
  if (!success) return errorResponse("rate_limited", 60_000)

  const body = await readBody(request, createRoomSchema)
  if ("response" in body) return body.response

  const hostToken = newHostToken()
  const hostTokenHash = await sha256Hex(hostToken)

  // A clash among ~887 million codes is very unlikely, but a retry costs nothing.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode()
    const room = env.ROOM.get(env.ROOM.idFromName(code))
    const result = await room.createRoom({ code, title: body.data.title, hostTokenHash })
    if (!result.ok) continue

    const response = json({ code }, 201)
    response.headers.append(
      "Set-Cookie",
      serializeCookie(hostCookieName(code), hostToken, {
        maxAgeSeconds: ROOM_LIFETIME_MS / 1000,
        path: `/api/rooms/${code}`,
        sameSite: "Strict",
      }),
    )
    const cookies = readCookies(request)
    if (!isValidDeviceId(cookies.get(DEVICE_COOKIE))) {
      response.headers.append("Set-Cookie", deviceCookie(newDeviceId()))
    }
    return response
  }
  return errorResponse("internal")
}

async function openSocket({ request, url, caller, room }: RouteContext): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") return errorResponse("bad_request")

  const requestedRole = url.searchParams.get("role")
  const role: SocketRole =
    requestedRole === "host" || requestedRole === "screen" ? requestedRole : "student"

  // Rebuild the headers we pass on, so a client can never smuggle in its own X-Ngong-* values.
  const headers = new Headers(request.headers)
  for (const name of Object.values(SOCKET_HEADERS)) headers.delete(name)
  headers.set(SOCKET_HEADERS.role, role)
  headers.set(SOCKET_HEADERS.deviceId, caller.deviceId)
  if (caller.hostToken) headers.set(SOCKET_HEADERS.hostToken, caller.hostToken)

  return room.fetch(new Request(request, { headers }))
}

function deviceCookie(deviceId: string): string {
  return serializeCookie(DEVICE_COOKIE, deviceId, {
    maxAgeSeconds: DEVICE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "Lax",
  })
}

function expiredHostCookie(code: string): string {
  return serializeCookie(hostCookieName(code), "", {
    maxAgeSeconds: 0,
    path: `/api/rooms/${code}`,
    sameSite: "Strict",
  })
}
