"use client"

import { hierarchy, pack } from "d3-hierarchy"
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import type { TopicSummary } from "@/shared/types"

interface Bubble {
  id: number
  label: string
  people: number
  x: number
  y: number
  r: number
  rank: number
}

type PackNode = { children?: PackNode[]; topic?: TopicSummary }

/**
 * Open topics as circles whose area grows with the number of confused people. d3's circle
 * packing places them; motion springs them to their new size when someone joins.
 * With reduced motion turned on, the spring becomes an instant change.
 */
export function BubbleField({ topics, className }: { topics: TopicSummary[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(containerRef)

  const bubbles = useMemo<Bubble[]>(() => {
    const open = topics.filter((topic) => !topic.resolved && topic.people > 0)
    if (open.length === 0 || size.width === 0 || size.height === 0) return []

    const root = hierarchy<PackNode>({ children: open.map((topic) => ({ topic })) }).sum(
      (node) => node.topic?.people ?? 0,
    )
    const packed = pack<PackNode>().size([size.width, size.height]).padding(14)(root)

    return packed.leaves().map((leaf, index) => ({
      id: leaf.data.topic!.id,
      label: leaf.data.topic!.label,
      people: leaf.data.topic!.people,
      x: leaf.x,
      y: leaf.y,
      r: leaf.r,
      rank: index,
    }))
  }, [topics, size.width, size.height])

  return (
    <div ref={containerRef} className={cn("relative h-full w-full", className)}>
      <LazyMotion features={domAnimation}>
        <MotionConfig reducedMotion="user">
          <AnimatePresence>
            {bubbles.map((bubble) => (
              <BubbleView key={bubble.id} bubble={bubble} />
            ))}
          </AnimatePresence>
        </MotionConfig>
      </LazyMotion>
    </div>
  )
}

function BubbleView({ bubble }: { bubble: Bubble }) {
  const diameter = bubble.r * 2
  // The three biggest topics are solid so they stand out from across the room.
  const prominent = bubble.rank < 3
  const labelSize = Math.max(13, Math.min(bubble.r / 4.2, 40))

  return (
    <m.div
      className={cn(
        "absolute left-0 top-0 flex flex-col items-center justify-center overflow-hidden rounded-full text-center",
        prominent
          ? "bg-primary text-primary-fg"
          : "border-2 border-primary/50 bg-primary-soft text-text",
      )}
      // Padding in pixels from the radius keeps the text inside the circle. (A % padding would
      // be measured against the container's width, not the bubble's.)
      style={{ padding: `${bubble.r * 0.28}px` }}
      initial={{ opacity: 0, scale: 0.3, x: bubble.x - bubble.r, y: bubble.y - bubble.r, width: diameter, height: diameter }}
      animate={{ opacity: 1, scale: 1, x: bubble.x - bubble.r, y: bubble.y - bubble.r, width: diameter, height: diameter }}
      exit={{ opacity: 0, scale: 0.3 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <span
        className="line-clamp-3 font-semibold leading-tight"
        style={{ fontSize: `${labelSize}px` }}
      >
        {bubble.label}
      </span>
      <span
        className="mt-1 font-bold tabular-nums opacity-90"
        style={{ fontSize: `${Math.max(14, labelSize * 1.15)}px` }}
      >
        {bubble.people} คน
      </span>
    </m.div>
  )
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
