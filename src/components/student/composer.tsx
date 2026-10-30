"use client"

import { SendHorizontal, Timer } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import { QUESTION_MAX_LENGTH } from "@/shared/limits"
import { askSchema } from "@/shared/schemas"

interface ComposerProps {
  disabled: boolean
  disabledReason?: string
  /** Epoch ms until which sending is paused (cooldown after a send, or a rate limit). */
  cooldownUntil: number
  onSend: (text: string) => Promise<boolean>
}

/**
 * Sticky composer at the bottom of the screen: within thumb reach and, thanks to
 * interactive-widget=resizes-content, always above the on-screen keyboard.
 */
export function Composer({ disabled, disabledReason, cooldownUntil, onSend }: ComposerProps) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const secondsLeft = useSecondsUntil(cooldownUntil)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isValid = askSchema.safeParse({ text }).success
  const coolingDown = secondsLeft > 0
  const canSend = isValid && !sending && !coolingDown && !disabled

  useAutoGrow(textareaRef, text)

  async function send() {
    if (!canSend) return
    setSending(true)
    const sent = await onSend(text)
    setSending(false)
    if (sent) {
      setText("")
      navigator.vibrate?.(10)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends on a hardware keyboard; Shift+Enter adds a new line.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  const remaining = QUESTION_MAX_LENGTH - text.length
  const placeholder = disabled ? (disabledReason ?? "ส่งไม่ได้ตอนนี้") : "งงตรงไหน พิมพ์ได้เลย…"

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
      className="border-t border-border bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-lg items-end gap-2">
        <label htmlFor="question" className="sr-only">
          พิมพ์สิ่งที่งง
        </label>
        <textarea
          id="question"
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={QUESTION_MAX_LENGTH}
          rows={1}
          enterKeyHint="send"
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby="question-counter"
          className="max-h-32 min-h-12 flex-1 resize-none rounded-[var(--radius-control)] border border-border bg-bg px-4 py-2.5 text-base leading-relaxed placeholder:text-muted focus:border-primary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={coolingDown ? `ส่งได้อีกใน ${secondsLeft} วินาที` : "ส่ง"}
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] font-semibold transition-colors",
            canSend ? "bg-primary text-primary-fg hover:bg-primary-hover" : "bg-surface-hover text-muted",
          )}
        >
          {coolingDown ? (
            <span className="flex flex-col items-center leading-none">
              <Timer className="size-4" aria-hidden />
              <span className="mt-0.5 text-xs tabular-nums">{secondsLeft}</span>
            </span>
          ) : (
            <SendHorizontal className="size-5" aria-hidden />
          )}
        </button>
      </div>
      <p
        id="question-counter"
        className={cn(
          "mx-auto mt-1 w-full max-w-lg text-xs tabular-nums",
          remaining < 20 ? "text-level-medium" : "text-muted",
        )}
      >
        {text.length}/{QUESTION_MAX_LENGTH}
        {coolingDown ? ` · ส่งข้อความถัดไปได้ใน ${secondsLeft} วินาที` : ""}
      </p>
    </form>
  )
}

function useSecondsUntil(until: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= Date.now()) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [until])
  return Math.max(0, Math.ceil((until - now) / 1000))
}

function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }, [ref, value])
}
