"use client"

import { Frown, Hourglass, Meh, Smile } from "lucide-react"
import { m } from "motion/react"
import { AnimatedNumber } from "@/components/animated-number"
import { LEVEL_FILL_CLASS, LEVEL_TEXT_CLASS } from "@/components/confusion-level"
import { cn } from "@/lib/cn"
import { MIN_AUDIENCE_FOR_METER } from "@/shared/limits"
import type { ConfusionLevel, ConfusionSummary } from "@/shared/types"

const MOOD: Record<ConfusionLevel, { icon: typeof Smile; label: string }> = {
  low: { icon: Smile, label: "ชิลๆ ตามทัน" },
  medium: { icon: Meh, label: "เริ่มมึนแล้ว" },
  high: { icon: Frown, label: "งงหนักมาก" },
}

/**
 * The projector's meter: a face that changes with the room's mood, a rolling percentage, and a
 * light streak on the bar when confusion is high. In a nearly empty room it waits instead of
 * shouting "100%" about one person.
 */
export function MoodMeter({ confusion }: { confusion: ConfusionSummary }) {
  const { level, percent, confusedPeople, online } = confusion
  const waiting = online < MIN_AUDIENCE_FOR_METER

  const Icon = waiting ? Hourglass : MOOD[level].icon
  const label = waiting ? "รอเพื่อนเข้าห้องอีกนิด…" : MOOD[level].label
  const tone = waiting ? "text-muted" : LEVEL_TEXT_CLASS[level]
  const fillPercent = waiting ? (online / MIN_AUDIENCE_FOR_METER) * 100 : Math.max(percent, 2)

  return (
    <section aria-label="ห้องนี้งงแค่ไหน" className="flex items-center gap-4 lg:gap-6">
      {/* Re-mounting on every level change gives the face a little wobble. */}
      <m.span
        key={waiting ? "waiting" : level}
        className={cn(
          "flex size-16 shrink-0 items-center justify-center rounded-2xl bg-surface-hover lg:size-20",
          tone,
        )}
        initial={{ rotate: -16, scale: 0.8 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 10 }}
      >
        <Icon className="size-10 lg:size-12" aria-hidden />
      </m.span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 className="text-xl font-medium text-muted lg:text-2xl">ห้องนี้งงแค่ไหน</h2>
          <p className={cn("text-2xl font-bold lg:text-4xl", tone)}>
            {label}
            {waiting ? null : (
              <span className="ml-2 text-xl font-semibold tabular-nums lg:text-2xl">
                <AnimatedNumber value={percent} />%
              </span>
            )}
          </p>
        </div>

        <div
          className="relative mt-3 h-5 overflow-hidden rounded-full bg-surface-hover"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={waiting ? undefined : percent}
          aria-valuetext={waiting ? label : `${label} ${percent} เปอร์เซ็นต์`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              waiting ? "bg-muted/40" : LEVEL_FILL_CLASS[level],
            )}
            style={{ width: `${fillPercent}%` }}
          />
          {!waiting && level === "high" ? (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/4 animate-shimmer bg-gradient-to-r from-transparent via-white/45 to-transparent"
            />
          ) : null}
        </div>

        <p className="mt-2 text-lg text-muted lg:text-xl">
          {waiting ? (
            <>
              เข้ามาแล้ว <AnimatedNumber value={online} className="tabular-nums" /> จาก{" "}
              {MIN_AUDIENCE_FOR_METER} คน ครบเมื่อไหร่จะเริ่มวัดให้
            </>
          ) : (
            <>
              งงอยู่ <AnimatedNumber value={confusedPeople} className="font-semibold tabular-nums text-text" />{" "}
              คน จากทั้งหมด <AnimatedNumber value={online} className="tabular-nums" /> คน
            </>
          )}
        </p>
      </div>
    </section>
  )
}
