"use client"

import { DoorClosed, MessageCircleQuestionMark, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { BrandMark } from "@/components/brand-mark"
import { BubbleField } from "@/components/bubble-field"
import { ConfusionMeter } from "@/components/confusion-meter"
import { ConnectionBadge } from "@/components/connection-badge"
import { QrCode } from "@/components/qr-code"
import { RoomDeleted, RoomError, RoomNotFound, RoomSkeleton } from "@/components/room-states"
import { useRoom } from "@/lib/use-room"

/**
 * Read-only view for the projector. It only ever receives the public snapshot (topic labels and
 * counts), so it is safe to show to the whole room: no raw messages, no host controls.
 */
export function ProjectorScreen({ code }: { code: string }) {
  const { status, snapshot, connection, refresh } = useRoom(code, "screen")
  const [origin, setOrigin] = useState("")
  // window is only available after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(window.location.origin), [])

  if (status === "loading") return <RoomSkeleton />
  if (status === "not_found") return <RoomNotFound />
  if (status === "deleted") return <RoomDeleted />
  if (status === "error" || !snapshot) return <RoomError onRetry={() => void refresh()} />

  const joinUrl = `${origin}/r/${code}`
  const hasOpenTopics = snapshot.topics.some((topic) => !topic.resolved && topic.people > 0)

  return (
    <div className="theme-projector min-h-dvh bg-bg text-text">
      <div className="mx-auto flex min-h-dvh max-w-[1800px] flex-col gap-6 p-4 lg:grid lg:grid-cols-[minmax(280px,26rem)_1fr] lg:gap-10 lg:p-10">
        <aside className="flex flex-col gap-5 rounded-3xl border border-border bg-surface p-6 lg:p-8">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xl font-semibold">
              <BrandMark />
              งงตรงไหน
            </span>
            <ConnectionBadge state={connection} />
          </div>

          {snapshot.title ? <h1 className="text-2xl font-semibold lg:text-3xl">{snapshot.title}</h1> : null}

          {snapshot.status === "open" ? (
            <>
              <p className="text-lg text-muted lg:text-xl">สแกนเพื่อบอกว่างงตรงไหน ไม่มีใครเห็นชื่อ</p>
              {origin ? (
                <QrCode value={joinUrl} label={`QR สำหรับเข้าห้อง ${code}`} className="mx-auto aspect-square w-full max-w-80" />
              ) : null}
              <div className="text-center">
                <p className="text-muted lg:text-lg">{origin.replace(/^https?:\/\//, "")} · รหัส</p>
                <p className="font-mono text-5xl font-bold tracking-[0.2em] lg:text-6xl">{code}</p>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-3 text-xl text-muted">
              <DoorClosed className="size-6" aria-hidden />
              ปิดรับความงงแล้ว
            </p>
          )}

          <p className="mt-auto inline-flex items-center gap-2 text-lg text-muted">
            <Users className="size-5" aria-hidden />
            ออนไลน์ {snapshot.confusion.online} คน
          </p>
        </aside>

        <main className="flex min-h-[60vh] flex-col gap-6">
          <div className="rounded-3xl border border-border bg-surface p-6">
            <ConfusionMeter confusion={snapshot.confusion} size="xl" showHint={false} />
          </div>
          <div className="relative flex-1 rounded-3xl border border-border bg-surface">
            {hasOpenTopics ? (
              <BubbleField topics={snapshot.topics} className="absolute inset-0 p-4" />
            ) : (
              <div className="flex h-full min-h-[40vh] flex-col items-center justify-center p-8 text-center">
                <MessageCircleQuestionMark className="size-14 text-muted" aria-hidden />
                <p className="mt-4 text-3xl font-semibold">ยังไม่มีใครงง</p>
                <p className="mt-2 text-xl text-muted">หรือยังไม่มีใครกล้าบอก ลองสแกน QR ดูนะ</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
