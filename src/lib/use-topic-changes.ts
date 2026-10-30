"use client"

import { useEffect, useRef, useState } from "react"
import type { TopicSummary } from "@/shared/types"
import { diffTopics, type TopicEvent } from "./topic-changes"

/**
 * The most recent topic events (newest first). The first snapshot only sets the baseline,
 * so opening the projector mid-lecture does not replay everything that already happened.
 */
export function useTopicChanges(topics: TopicSummary[] | undefined, keep = 6): TopicEvent[] {
  const [events, setEvents] = useState<TopicEvent[]>([])
  const previousRef = useRef<TopicSummary[] | null>(null)
  const nextIdRef = useRef(1)

  useEffect(() => {
    if (!topics) return
    const previous = previousRef.current
    previousRef.current = topics
    if (!previous) return

    const fresh = diffTopics(previous, topics).map((change) => ({
      ...change,
      id: nextIdRef.current++,
    }))
    if (fresh.length === 0) return
    setEvents((current) => [...fresh.reverse(), ...current].slice(0, keep))
  }, [topics, keep])

  return events
}
