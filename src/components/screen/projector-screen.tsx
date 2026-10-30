"use client"

import { DoorClosed, MessageCircleQuestionMark, ShieldCheck, Users } from "lucide-react"
import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { AnimatedNumber } from "@/components/animated-number"
import { BrandMark } from "@/components/brand-mark"
import { BubbleField } from "@/components/bubble-field"
import { ConnectionBadge } from "@/components/connection-badge"
import { QrCode } from "@/components/qr-code"
import { RoomDeleted, RoomError, RoomNotFound, RoomSkeleton } from "@/components/room-states"
import { LiveTicker } from "@/components/screen/live-ticker"
import { MoodMeter } from "@/components/screen/mood-meter"
import { useRoom } from "@/lib/use-room"
import { useTopicChanges } from "@/lib/use-topic-changes"

/**
 * Read-only view for the projector. It only ever receives the public snapshot (topic labels and
 * counts), so it is safe to show to the whole room: no raw messages, no host controls.
 */
export function ProjectorScreen({ code }: { code: string }) {
  const { status, snapshot, connection, refresh } = useRoom(code, "screen")
  const events = useTopicChanges(snapshot?.topics)
  const [origin, setOrigin] = useState("")
  // window is only available after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(window.location.origin), [])

  if (status === "loading") return <RoomSkeleton />
  if (status === "not_found") return <RoomNotFound />
  if (status === "deleted") return <RoomDeleted />
  if (status === "error" || !snapshot) return <RoomError onRetry={() => void refresh()} />

  const joinUrl = `${origin}/r/${code}`
  const host = origin.replace(/^https?:\/\//, "")
  const hasOpenTopics = snapshot.topics.some((topic) => !topic.resolved && topic.people > 0)

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div className="theme-projector min-h-dvh bg-bg text-text">
          <div className="mx-auto flex min-h-dvh max-w-[1800px] flex-col gap-6 p-4 lg:grid lg:grid-cols-[minmax(280px,26rem)_1fr] lg:gap-8 lg:p-8">
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
                  <div>
                    <p className="text-2xl font-bold leading-snug lg:text-3xl">งงตรงไหน สแกนบอกเลย</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-muted lg:text-lg">
                      <ShieldCheck className="size-5 shrink-0" aria-hidden />
                      ไม่ต้องล็อกอิน · ไม่มีใครเห็นชื่อ
                    </p>
                  </div>
                  {origin ? (
                    <QrCode
                      value={joinUrl}
                      label={`QR สำหรับเข้าห้อง ${code}`}
                      className="mx-auto aspect-square w-full max-w-80"
                    />
                  ) : null}
                  <div className="text-center">
                    <p className="text-muted lg:text-lg">หรือเข้า {host} แล้วใส่รหัส</p>
                    <p className="font-mono text-5xl font-bold tracking-[0.2em] lg:text-6xl">{code}</p>
                  </div>
                </>
              ) : (
                <p className="flex items-start gap-3 text-xl text-muted">
                  <DoorClosed className="mt-1 size-6 shrink-0" aria-hidden />
                  ปิดรับความงงแล้ว ขอบคุณที่บอกกันนะ
                </p>
              )}

              <p className="mt-auto inline-flex items-center gap-2 text-lg text-muted">
                <Users className="size-5" aria-hidden />
                อยู่ในห้อง <AnimatedNumber value={snapshot.confusion.online} className="font-semibold tabular-nums text-text" /> คน
              </p>
            </aside>

            <main className="flex min-h-[70vh] flex-col gap-6">
              <div className="rounded-3xl border border-border bg-surface p-5 lg:p-6">
                <MoodMeter confusion={snapshot.confusion} />
              </div>

              <div className="relative min-h-[45vh] flex-1 rounded-3xl border border-border bg-surface">
                {/* Always mounted, so the "ทวนแล้ว!" burst can still play when the last topic is resolved. */}
                <BubbleField topics={snapshot.topics} events={events} className="absolute inset-0 p-4" />
                {hasOpenTopics ? null : <QuietRoom />}
              </div>

              <LiveTicker events={events} />
            </main>
          </div>
        </div>
      </MotionConfig>
    </LazyMotion>
  )
}

function QuietRoom() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
      <m.span
        animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <MessageCircleQuestionMark className="size-14 text-muted" aria-hidden />
      </m.span>
      <p className="mt-4 text-3xl font-semibold">ยังเงียบอยู่…</p>
      <p className="mt-2 max-w-xl text-xl text-muted">
        ใครงงอะไร สแกน QR แล้วพิมพ์มาได้เลย ไม่มีใครรู้ว่าเป็นใคร
      </p>
    </div>
  )
}
