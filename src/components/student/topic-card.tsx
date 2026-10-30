"use client"

import { Check, CircleCheck, Hand, ThumbsDown, ThumbsUp, Users } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/cn"
import type { Feedback, Membership, TopicSummary } from "@/shared/types"

interface TopicCardProps {
  topic: TopicSummary
  membership: Membership | undefined
  busy: boolean
  disabled: boolean
  onToggleMeToo: (topic: TopicSummary) => void
  onFeedback: (topic: TopicSummary, feedback: Feedback) => void
}

export function TopicCard({
  topic,
  membership,
  busy,
  disabled,
  onToggleMeToo,
  onFeedback,
}: TopicCardProps) {
  if (topic.resolved) {
    return (
      <ResolvedTopicCard topic={topic} membership={membership} busy={busy} onFeedback={onFeedback} />
    )
  }

  return (
    <OpenTopicCard
      topic={topic}
      membership={membership}
      busy={busy}
      disabled={disabled}
      onToggleMeToo={onToggleMeToo}
    />
  )
}

function OpenTopicCard({
  topic,
  membership,
  busy,
  disabled,
  onToggleMeToo,
}: Omit<TopicCardProps, "onFeedback">) {
  // Each "ฉันก็งง" tap bumps `cheer`, which re-mounts the wave and the "+1" so they replay.
  const [cheer, setCheer] = useState(0)
  const [waving, setWaving] = useState(false)

  const joined = membership !== undefined
  const ownQuestion = membership?.via === "ask"

  function handleClick() {
    if (!joined) {
      setCheer((count) => count + 1)
      setWaving(true)
    }
    onToggleMeToo(topic)
  }

  return (
    <li className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <p className="text-[17px] font-medium leading-snug">{topic.label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted">
          <Users className="size-4" aria-hidden />
          {topic.people} คนงงเรื่องนี้
        </span>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || disabled || ownQuestion}
          aria-pressed={joined}
          className={cn(
            "relative inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors disabled:cursor-default",
            joined
              ? "bg-primary text-primary-fg"
              : "border border-border bg-bg text-text hover:bg-surface-hover",
            (busy || disabled) && "opacity-60",
          )}
        >
          {waving ? (
            <span
              key={cheer}
              className="inline-flex origin-[60%_90%] animate-wave"
              onAnimationEnd={() => setWaving(false)}
            >
              <Hand className="size-4" aria-hidden />
            </span>
          ) : joined ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Hand className="size-4" aria-hidden />
          )}
          {ownQuestion ? "คุณถามเรื่องนี้" : joined ? "งงด้วย" : "ฉันก็งง"}
          {cheer > 0 ? (
            <span
              key={`plus-${cheer}`}
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 animate-float-up text-sm font-bold text-primary"
            >
              +1
            </span>
          ) : null}
        </button>
      </div>
    </li>
  )
}

function ResolvedTopicCard({
  topic,
  membership,
  busy,
  onFeedback,
}: {
  topic: TopicSummary
  membership: Membership | undefined
  busy: boolean
  onFeedback: (topic: TopicSummary, feedback: Feedback) => void
}) {
  return (
    <li className="rounded-[var(--radius-card)] border border-border bg-surface/60 p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
        <CircleCheck className="size-4" aria-hidden />
        ผู้สอนทวนเรื่องนี้แล้ว
      </p>
      <p className="mt-1 text-[17px] font-medium leading-snug text-muted">{topic.label}</p>

      {membership ? (
        <fieldset className="mt-3" disabled={busy}>
          <legend className="text-sm">ตอนนี้เข้าใจหรือยัง?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <FeedbackButton
              active={membership.feedback === "understood"}
              onClick={() => onFeedback(topic, "understood")}
              icon={ThumbsUp}
              label="เข้าใจแล้ว"
            />
            <FeedbackButton
              active={membership.feedback === "still_confused"}
              onClick={() => onFeedback(topic, "still_confused")}
              icon={ThumbsDown}
              label="ยังงงอยู่"
            />
          </div>
        </fieldset>
      ) : null}
    </li>
  )
}

function FeedbackButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof ThumbsUp
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] text-[15px] font-medium transition-colors",
        active ? "bg-primary text-primary-fg" : "border border-border bg-bg hover:bg-surface-hover",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}
