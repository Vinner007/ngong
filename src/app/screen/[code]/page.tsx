import type { Metadata } from "next"
import { RoomNotFound } from "@/components/room-states"
import { ProjectorScreen } from "@/components/screen/projector-screen"
import { isValidRoomCode, normalizeRoomCode } from "@/shared/room-code"

export const metadata: Metadata = { title: "จอโปรเจกเตอร์", robots: { index: false } }

export default async function ProjectorPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code)
  if (!isValidRoomCode(code)) return <RoomNotFound />
  return <ProjectorScreen code={code} />
}
