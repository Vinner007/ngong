// Shapes that travel between the server and the browser.

export type RoomStatus = "open" | "closed"
export type ConfusionLevel = "low" | "medium" | "high"
export type MembershipSource = "ask" | "metoo"
export type Feedback = "understood" | "still_confused"
export type QuestionStatus = "pending" | "clustered" | "hidden" | "failed"
export type SocketRole = "student" | "host" | "screen"

export interface TopicSummary {
  id: number
  label: string
  /** People who asked about this topic or tapped "ฉันก็งง", each counted once. */
  people: number
  resolved: boolean
  understood: number
  stillConfused: number
}

export interface ConfusionSummary {
  confusedPeople: number
  online: number
  percent: number
  level: ConfusionLevel
}

/** What everyone in the room may see. It never contains raw question text. */
export interface RoomSnapshot {
  code: string
  title: string
  status: RoomStatus
  confusion: ConfusionSummary
  topics: TopicSummary[]
}

/** Extra numbers only the host sees. */
export interface HostStats {
  totalQuestions: number
  pendingQuestions: number
  failedQuestions: number
  hiddenQuestions: number
}

export interface HostSnapshot extends RoomSnapshot {
  host: HostStats
}

export interface Membership {
  topicId: number
  via: MembershipSource
  feedback: Feedback | null
}

export interface Viewer {
  isHost: boolean
  memberships: Membership[]
}

export interface RoomView {
  snapshot: RoomSnapshot | HostSnapshot
  viewer: Viewer
}

export interface HostQuestion {
  id: number
  body: string
  status: QuestionStatus
  topicId: number | null
  topicLabel: string | null
  createdAt: number
}

export interface TopicExplanation {
  explanation: string
  example: string
}

/** Messages pushed over the WebSocket. Clients never send anything except "ping". */
export type ServerMessage =
  | { type: "snapshot"; snapshot: RoomSnapshot | HostSnapshot }
  | { type: "assigned"; questionId: number; topicId: number; label: string }
  | { type: "processing_failed"; questionId: number }
  | { type: "room_deleted" }

/** Error codes the API returns; the UI turns each one into a friendly Thai message. */
export type ApiErrorCode =
  | "bad_request"
  | "forbidden_origin"
  | "unauthorized"
  | "not_found"
  | "room_closed"
  | "rate_limited"
  | "room_full"
  | "not_allowed"
  | "ai_unavailable"
  | "internal"

export interface ApiErrorBody {
  error: ApiErrorCode
  retryAfterMs?: number
}
