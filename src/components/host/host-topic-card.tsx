"use client"

import { ChevronDown, CircleCheck, EyeOff, Pencil, Sparkles, ThumbsDown, ThumbsUp, Users } from "lucide-react"
import { useId, useState } from "react"
import { cn } from "@/lib/cn"
import type { HostQuestion, TopicSummary } from "@/shared/types"

interface HostTopicCardProps {
  rank: number
  topic: TopicSummary
  questions: HostQuestion[]
  questionsLoading: boolean
  onExpand: () => void
  onExplain: (topic: TopicSummary) => void
  onResolve: (topic: TopicSummary) => void
  onRename: (topic: TopicSummary) => void
  onHide: (question: HostQuestion) => void
}

export function HostTopicCard({
  rank,
  topic,
  questions,
  questionsLoading,
  onExpand,
  onExplain,
  onResolve,
  onRename,
  onHide,
}: HostTopicCardProps) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()

  function toggle() {
    if (!expanded) onExpand()
    setExpanded(!expanded)
  }

  return (
    <li
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface",
        topic.resolved && "bg-surface/60",
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-2">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums",
            topic.resolved ? "bg-surface-hover text-muted" : "bg-primary-soft text-primary",
          )}
          aria-label={topic.resolved ? "ทวนแล้ว" : `อันดับ ${rank}`}
        >
          {topic.resolved ? <CircleCheck className="size-4" aria-hidden /> : rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[17px] font-medium leading-snug", topic.resolved && "text-muted")}>
            {topic.label}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
            <Users className="size-4" aria-hidden />
            {topic.people} คนงง
          </p>
          {topic.resolved ? (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1 text-success">
                <ThumbsUp className="size-4" aria-hidden />
                เข้าใจแล้ว {topic.understood}
              </span>
              <span className="inline-flex items-center gap-1 text-level-high">
                <ThumbsDown className="size-4" aria-hidden />
                ยังงง {topic.stillConfused}
              </span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onRename(topic)}
          className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
          aria-label={`แก้ชื่อหัวข้อ ${topic.label}`}
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <button
          type="button"
          onClick={() => onExplain(topic)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary hover:bg-surface-hover"
        >
          <Sparkles className="size-4" aria-hidden />
          AI ช่วยอธิบาย
        </button>
        {!topic.resolved ? (
          <button
            type="button"
            onClick={() => onResolve(topic)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-surface-hover"
          >
            <CircleCheck className="size-4" aria-hidden />
            ทวนแล้ว
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between border-t border-border px-4 text-sm font-medium text-muted hover:bg-surface-hover"
      >
        {expanded ? "ซ่อนข้อความ" : "ดูข้อความในหัวข้อนี้"}
        <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>

      {expanded ? (
        <div id={panelId} className="border-t border-border px-4 py-2">
          {questionsLoading && questions.length === 0 ? (
            <p className="py-2 text-sm text-muted">กำลังโหลด…</p>
          ) : questions.length === 0 ? (
            <p className="py-2 text-sm text-muted">ไม่มีข้อความที่แสดงได้</p>
          ) : (
            <ul className="divide-y divide-border">
              {questions.map((question) => (
                <li key={question.id} className="flex items-start gap-2 py-2">
                  <p className="min-w-0 flex-1 break-words pt-2.5 text-[15px]">{question.body}</p>
                  <button
                    type="button"
                    onClick={() => onHide(question)}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-danger"
                    aria-label="ซ่อนข้อความนี้"
                    title="ซ่อนข้อความนี้"
                  >
                    <EyeOff className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  )
}
