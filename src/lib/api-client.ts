// Typed wrappers around the HTTP API. Components call these and never build URLs themselves.

import type {
  ApiErrorBody,
  ApiErrorCode,
  Feedback,
  HostQuestion,
  RoomView,
  TopicExplanation,
} from "@/shared/types"

export type ClientErrorCode = ApiErrorCode | "network"

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(code)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    })
  } catch {
    throw new ApiError("network", 0)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(body?.error ?? "internal", response.status, body?.retryAfterMs)
  }
  return (await response.json()) as T
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })

const room = (code: string) => `/api/rooms/${code}`

export const api = {
  createRoom: (title: string) => post<{ code: string }>("/api/rooms", { title }),
  getRoom: (code: string) => request<RoomView>(room(code)),

  ask: (code: string, text: string) =>
    post<{ questionId: number; cooldownMs: number }>(`${room(code)}/questions`, { text }),
  joinTopic: (code: string, topicId: number) => post(`${room(code)}/topics/${topicId}/join`),
  leaveTopic: (code: string, topicId: number) =>
    request(`${room(code)}/topics/${topicId}/join`, { method: "DELETE" }),
  sendFeedback: (code: string, topicId: number, feedback: Feedback) =>
    post(`${room(code)}/topics/${topicId}/feedback`, { feedback }),

  listQuestions: (code: string) =>
    request<{ questions: HostQuestion[] }>(`${room(code)}/questions`),
  hideQuestion: (code: string, questionId: number) =>
    post(`${room(code)}/questions/${questionId}/hide`),
  resolveTopic: (code: string, topicId: number) => post(`${room(code)}/topics/${topicId}/resolve`),
  renameTopic: (code: string, topicId: number, label: string) =>
    request(`${room(code)}/topics/${topicId}`, {
      method: "PATCH",
      body: JSON.stringify({ label }),
    }),
  explainTopic: (code: string, topicId: number) =>
    post<{ explanation: TopicExplanation }>(`${room(code)}/topics/${topicId}/explain`),
  startDemo: (code: string) => post(`${room(code)}/demo`),
  closeRoom: (code: string) => post(`${room(code)}/close`),
  deleteRoom: (code: string) => request(room(code), { method: "DELETE" }),
}
