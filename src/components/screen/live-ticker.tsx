"use client"

import {
  Activity,
  CircleCheck,
  Hand,
  MessageCircleQuestionMark,
  Radio,
  RotateCcw,
} from "lucide-react"
import { AnimatePresence, m } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import type { TopicEvent, TopicEventKind } from "@/lib/topic-changes"

const EVENT_STYLE: Record<TopicEventKind, { icon: typeof Hand; describe: (event: TopicEvent) => string }> = {
  new_topic: { icon: MessageCircleQuestionMark, describe: (event) => `หัวข้อใหม่: ${event.label}` },
  more_people: { icon: Hand, describe: (event) => `+${event.delta} คนงงเรื่อง ${event.label}` },
  resolved: { icon: CircleCheck, describe: (event) => `อาจารย์ทวนเรื่อง ${event.label} แล้ว` },
  reopened: { icon: RotateCcw, describe: (event) => `ยังมีคนงงเรื่อง ${event.label} อยู่` },
}

const IDLE_TEXT = "รอฟังว่าห้องงงตรงไหน…"
/** Screen readers hear at most one update this often, not every event of a busy minute. */
const ANNOUNCE_EVERY_MS = 6_000

/** A one-line news ticker of what just happened, built only from public topic labels and counts. */
export function LiveTicker({ events }: { events: TopicEvent[] }) {
  const [latest, ...earlier] = events
  const latestText = latest ? EVENT_STYLE[latest.kind].describe(latest) : IDLE_TEXT
  const announcement = useThrottledText(latestText, ANNOUNCE_EVERY_MS)
  const LatestIcon = latest ? EVENT_STYLE[latest.kind].icon : Activity

  return (
    <section
      aria-label="ความเคลื่อนไหวล่าสุด"
      className="flex items-center gap-4 overflow-hidden rounded-3xl border border-border bg-surface px-5 py-3 lg:px-6 lg:py-4"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-level-high/15 px-3 py-1 text-sm font-semibold text-level-high">
        <Radio className="size-4 animate-pulse" aria-hidden />
        สด
      </span>

      <div className="relative h-9 min-w-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <m.p
            key={latest?.id ?? "idle"}
            className={cn(
              "absolute inset-0 flex items-center gap-2 text-lg lg:text-2xl",
              latest ? "font-semibold" : "text-muted",
            )}
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <LatestIcon className="size-5 shrink-0 lg:size-6" aria-hidden />
            <span className="truncate">{latestText}</span>
          </m.p>
        </AnimatePresence>
      </div>

      {/* The two events before the latest one, quieter, only where there is room to spare:
          the latest line must never be the one that gets cut off. */}
      <ul className="hidden max-w-[35%] min-w-0 items-center gap-4 overflow-hidden 2xl:flex" aria-hidden>
        {earlier.slice(0, 2).map((event) => {
          const Icon = EVENT_STYLE[event.kind].icon
          return (
            <li key={event.id} className="flex max-w-56 items-center gap-1.5 text-sm text-muted opacity-70">
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{EVENT_STYLE[event.kind].describe(event)}</span>
            </li>
          )
        })}
      </ul>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}

/** Follows `text`, but changes at most once per `intervalMs`, always ending on the newest value. */
function useThrottledText(text: string, intervalMs: number): string {
  const [shown, setShown] = useState(text)
  const lastShownAt = useRef(0)

  useEffect(() => {
    const wait = Math.max(0, lastShownAt.current + intervalMs - Date.now())
    const timer = setTimeout(() => {
      lastShownAt.current = Date.now()
      setShown(text)
    }, wait)
    return () => clearTimeout(timer)
  }, [text, intervalMs])

  return shown
}
