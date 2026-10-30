"use client"

import { hierarchy, pack } from "d3-hierarchy"
import { CircleCheck, Flame } from "lucide-react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { BUBBLE_TEXT_COLOR, topicColor, topicGlow } from "@/components/screen/topic-colors"
import { cn } from "@/lib/cn"
import type { TopicEvent } from "@/lib/topic-changes"
import type { TopicSummary } from "@/shared/types"

interface Bubble {
  id: number
  label: string
  people: number
  x: number
  y: number
  r: number
}

interface Burst {
  eventId: number
  topicId: number
  x: number
  y: number
  r: number
}

type PackNode = { children?: PackNode[]; topic?: TopicSummary }

const SPRING = { type: "spring", stiffness: 260, damping: 24 } as const
const BURST_MS = 1_800
const PARTICLE_COUNT = 12
/** A topic needs at least this many people, and strictly more than any other, to be "งงสุด". */
const HOTTEST_MIN_PEOPLE = 2

/**
 * Open topics as circles whose area grows with the number of confused people. d3's circle
 * packing places them; motion springs them to new sizes. On top of that:
 * - every bubble floats gently and keeps its own colour,
 * - a "+N" and a ripple play when people join,
 * - the most confusing topic glows and wears a "งงสุด" badge,
 * - a resolved topic bursts into "ทวนแล้ว!" where its bubble used to be.
 * Must be rendered inside LazyMotion (see ProjectorScreen).
 */
export function BubbleField({
  topics,
  events,
  className,
}: {
  topics: TopicSummary[]
  events: TopicEvent[]
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(containerRef)

  const openTopics = useMemo(
    () => topics.filter((topic) => !topic.resolved && topic.people > 0),
    [topics],
  )

  const bubbles = useMemo<Bubble[]>(() => {
    if (openTopics.length === 0 || size.width === 0 || size.height === 0) return []

    const root = hierarchy<PackNode>({ children: openTopics.map((topic) => ({ topic })) }).sum(
      (node) => node.topic?.people ?? 0,
    )
    const packed = pack<PackNode>().size([size.width, size.height]).padding(18)(root)

    return packed.leaves().map((leaf) => ({
      id: leaf.data.topic!.id,
      label: leaf.data.topic!.label,
      people: leaf.data.topic!.people,
      x: leaf.x,
      y: leaf.y,
      r: leaf.r,
    }))
  }, [openTopics, size.width, size.height])

  const hottestId = useMemo(() => findHottestTopic(openTopics), [openTopics])
  const latestGainByTopic = useMemo(() => latestGains(events), [events])

  // Remember where every bubble was, so a resolved topic can celebrate in place
  // even though its bubble has already left the layout.
  const lastPositions = useRef(new Map<number, Bubble>())
  useEffect(() => {
    for (const bubble of bubbles) lastPositions.current.set(bubble.id, bubble)
  }, [bubbles])
  const bursts = useResolvedBursts(events, lastPositions)

  return (
    <div ref={containerRef} className={cn("relative h-full w-full", className)}>
      <AnimatePresence>
        {bubbles.map((bubble) => (
          <BubbleView
            key={bubble.id}
            bubble={bubble}
            hottest={bubble.id === hottestId}
            gain={latestGainByTopic.get(bubble.id)}
          />
        ))}
      </AnimatePresence>
      {bursts.map((burst) => (
        <ResolvedBurst key={burst.eventId} burst={burst} />
      ))}
    </div>
  )
}

function BubbleView({
  bubble,
  hottest,
  gain,
}: {
  bubble: Bubble
  hottest: boolean
  gain: TopicEvent | undefined
}) {
  const reduceMotion = useReducedMotion()
  const diameter = bubble.r * 2
  const labelSize = Math.max(13, Math.min(bubble.r / 4.2, 40))
  const color = topicColor(bubble.id)
  const place = { x: bubble.x - bubble.r, y: bubble.y - bubble.r, width: diameter, height: diameter }

  return (
    <m.div
      className="absolute left-0 top-0"
      initial={{ opacity: 0, scale: 0.3, ...place }}
      animate={{ opacity: 1, scale: 1, ...place }}
      exit={{ opacity: 0, scale: 0.3 }}
      transition={SPRING}
    >
      {/* Idle float. Each bubble gets its own tempo so they never bob in sync. */}
      <m.div
        className="relative size-full"
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{
          duration: 4 + (bubble.id % 5) * 0.45,
          delay: (bubble.id % 7) * 0.3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {gain && !reduceMotion ? (
          <m.span
            key={`ripple-${gain.id}`}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-4"
            style={{ borderColor: color }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.45, opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        ) : null}

        <div
          className={cn(
            "flex size-full flex-col items-center justify-center overflow-hidden rounded-full text-center",
            hottest && "animate-glow",
          )}
          style={
            {
              padding: `${bubble.r * 0.28}px`,
              backgroundColor: color,
              color: BUBBLE_TEXT_COLOR,
              "--bubble-glow": topicGlow(bubble.id, 0.55),
            } as React.CSSProperties
          }
        >
          <span className="line-clamp-3 font-semibold leading-tight" style={{ fontSize: `${labelSize}px` }}>
            {bubble.label}
          </span>
          <span
            className="mt-1 font-bold tabular-nums"
            style={{ fontSize: `${Math.max(14, labelSize * 1.15)}px` }}
          >
            {bubble.people} คนงง
          </span>
        </div>

        {hottest ? (
          <span className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border-2 border-level-high bg-bg px-3 py-1 text-sm font-bold text-level-high shadow-lg lg:text-base">
            <Flame className="size-4" aria-hidden />
            งงสุด
          </span>
        ) : null}

        {gain ? (
          <m.span
            key={`gain-${gain.id}`}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 text-2xl font-bold tabular-nums text-text lg:text-3xl"
            initial={{ opacity: 0, x: "-50%", y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: -52 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          >
            +{gain.delta}
          </m.span>
        ) : null}
      </m.div>
    </m.div>
  )
}

/** A check mark and a ring of confetti dots where a resolved topic's bubble used to be. */
function ResolvedBurst({ burst }: { burst: Burst }) {
  const reduceMotion = useReducedMotion()
  const size = Math.max(burst.r * 1.3, 110)
  const distance = burst.r + 40

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-10"
      style={{ transform: `translate(${burst.x}px, ${burst.y}px)` }}
    >
      {reduceMotion
        ? null
        : Array.from({ length: PARTICLE_COUNT }, (_, index) => {
            const angle = (index / PARTICLE_COUNT) * Math.PI * 2
            return (
              <m.span
                key={index}
                className="absolute -ml-1.5 -mt-1.5 size-3 rounded-full"
                style={{ backgroundColor: topicColor(burst.topicId + index) }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  opacity: 0,
                  scale: 0.4,
                }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
            )
          })}
      <m.div
        className="absolute flex flex-col items-center justify-center gap-1 rounded-full"
        style={{
          width: size,
          height: size,
          left: -size / 2,
          top: -size / 2,
          backgroundColor: topicColor(burst.topicId),
          color: BUBBLE_TEXT_COLOR,
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.12, 1, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: BURST_MS / 1000, times: [0, 0.2, 0.75, 1] }}
      >
        <CircleCheck style={{ width: size * 0.32, height: size * 0.32 }} />
        <span className="font-bold" style={{ fontSize: Math.max(16, size / 7) }}>
          ทวนแล้ว!
        </span>
      </m.div>
    </div>
  )
}

/** Turns new "resolved" events into bursts that remove themselves after BURST_MS. */
function useResolvedBursts(
  events: TopicEvent[],
  positions: React.RefObject<Map<number, Bubble>>,
): Burst[] {
  const [bursts, setBursts] = useState<Burst[]>([])
  const handled = useRef(new Set<number>())

  useEffect(() => {
    const created: Burst[] = []
    for (const event of events) {
      if (event.kind !== "resolved" || handled.current.has(event.id)) continue
      handled.current.add(event.id)
      const position = positions.current.get(event.topicId)
      if (position) {
        created.push({ eventId: event.id, topicId: event.topicId, x: position.x, y: position.y, r: position.r })
      }
    }
    if (created.length === 0) return

    // Bursts are triggered by snapshots arriving from the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBursts((current) => [...current, ...created])
    // Not cleared on re-run on purpose: each burst must still disappear when the next event lands.
    setTimeout(() => {
      setBursts((current) => current.filter((burst) => !created.includes(burst)))
    }, BURST_MS)
  }, [events, positions])

  return bursts
}

/** The newest "people joined" event per topic; its id changing is what replays the +N. */
function latestGains(events: TopicEvent[]): Map<number, TopicEvent> {
  const byTopic = new Map<number, TopicEvent>()
  for (const event of events) {
    const isGain = (event.kind === "more_people" || event.kind === "reopened") && event.delta > 0
    if (isGain && !byTopic.has(event.topicId)) byTopic.set(event.topicId, event)
  }
  return byTopic
}

function findHottestTopic(openTopics: TopicSummary[]): number | null {
  const [first, second] = [...openTopics].sort((a, b) => b.people - a.people)
  if (!first || first.people < HOTTEST_MIN_PEOPLE) return null
  if (second && second.people === first.people) return null
  return first.id
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}
