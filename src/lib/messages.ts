import { ApiError, type ClientErrorCode } from "./api-client"

// Every error the user can see, in plain, friendly Thai.
const ERROR_MESSAGES: Record<ClientErrorCode, string> = {
  bad_request: "ข้อความไม่ถูกต้อง ลองใหม่อีกครั้งนะ",
  forbidden_origin: "คำขอนี้ถูกปฏิเสธเพื่อความปลอดภัย ลองโหลดหน้าใหม่",
  unauthorized: "ส่วนนี้สำหรับผู้สอนของห้องนี้เท่านั้น",
  not_found: "ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว",
  room_closed: "ห้องนี้ปิดรับความงงแล้ว",
  rate_limited: "ส่งถี่ไปหน่อย รอสักครู่แล้วค่อยส่งใหม่นะ",
  room_full: "ห้องนี้รับข้อความเต็มแล้ว",
  not_allowed: "ทำรายการนี้ไม่ได้",
  ai_unavailable: "AI ยังไม่ว่างตอนนี้ ลองใหม่อีกครั้ง",
  internal: "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง",
  network: "ไม่มีอินเทอร์เน็ต ลองเชื่อมต่อใหม่อีกครั้ง",
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return ERROR_MESSAGES[error.code]
  return ERROR_MESSAGES.internal
}
