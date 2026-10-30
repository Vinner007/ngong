import type { Metadata } from "next"
import { RoomNotFound } from "@/components/room-states"
import { StudentRoom } from "@/components/student/student-room"
import { isValidRoomCode, normalizeRoomCode } from "@/shared/room-code"

export const metadata: Metadata = { title: "ส่งความงง", robots: { index: false } }

export default async function StudentRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code)
  if (!isValidRoomCode(code)) return <RoomNotFound />
  return <StudentRoom code={code} />
}
