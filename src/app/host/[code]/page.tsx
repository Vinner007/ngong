import type { Metadata } from "next"
import { HostRoom } from "@/components/host/host-room"
import { RoomNotFound } from "@/components/room-states"
import { isValidRoomCode, normalizeRoomCode } from "@/shared/room-code"

export const metadata: Metadata = { title: "ห้องของผู้สอน", robots: { index: false } }

export default async function HostRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code)
  if (!isValidRoomCode(code)) return <RoomNotFound />
  return <HostRoom code={code} />
}
