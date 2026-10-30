"use client"

import { DoorClosed, LoaderCircle, MessageCircleQuestionMark, ShieldCheck, Users } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { ConnectionBadge, OfflineBanner } from "@/components/connection-badge"
import { RoomDeleted, RoomError, RoomNotFound, RoomSkeleton } from "@/components/room-states"
import { Composer } from "@/components/student/composer"
import { PrivacySheet } from "@/components/student/privacy-sheet"
import { TopicCard } from "@/components/student/topic-card"
import { useToast } from "@/components/ui/toast"
import { ApiError, api } from "@/lib/api-client"
import { errorMessage } from "@/lib/messages"
import { useRoom } from "@/lib/use-room"
import type { Feedback, Membership, TopicSummary } from "@/shared/types"

interface PendingQuestion {
  id: number
  text: string
}

export function StudentRoom({ code }: { code: string }) {
  const toast = useToast()
  const [pending, setPending] = useState<PendingQuestion[]>([])
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [busyTopicId, setBusyTopicId] = useState<number | null>(null)

  const { status, snapshot, viewer, setViewer, connection, refresh } = useRoom(code, "student", {
    onAssigned: ({ questionId, topicId, label }) => {
      setPending((current) => current.filter((question) => question.id !== questionId))
      upsertMembership({ topicId, via: "ask", feedback: null })
      toast.show(`จัดเข้าหัวข้อ “${label}” แล้ว`, "success")
    },
    onProcessingFailed: (questionId) => {
      setPending((current) => current.filter((question) => question.id !== questionId))
      toast.show("จัดกลุ่มข้อความไม่สำเร็จ แต่ผู้สอนยังเห็นข้อความของคุณ", "error")
    },
  })

  const upsertMembership = useCallback(
    (membership: Membership) =>
      setViewer((current) =>
        current
          ? {
              ...current,
              memberships: [
                ...current.memberships.filter((entry) => entry.topicId !== membership.topicId),
                membership,
              ],
            }
          : current,
      ),
    [setViewer],
  )

  const removeMembership = useCallback(
    (topicId: number) =>
      setViewer((current) =>
        current
          ? { ...current, memberships: current.memberships.filter((entry) => entry.topicId !== topicId) }
          : current,
      ),
    [setViewer],
  )

  const membershipByTopic = useMemo(
    () => new Map(viewer?.memberships.map((membership) => [membership.topicId, membership])),
    [viewer],
  )

  if (status === "loading") return <RoomSkeleton />
  if (status === "not_found") return <RoomNotFound />
  if (status === "deleted") return <RoomDeleted />
  if (status === "error" || !snapshot) return <RoomError onRetry={() => void refresh()} />

  const isClosed = snapshot.status === "closed"
  const openTopics = snapshot.topics.filter((topic) => !topic.resolved)
  const resolvedTopics = snapshot.topics.filter((topic) => topic.resolved)

  async function handleSend(text: string): Promise<boolean> {
    try {
      const { questionId, cooldownMs } = await api.ask(code, text)
      setPending((current) => [...current, { id: questionId, text }])
      setCooldownUntil(Date.now() + cooldownMs)
      return true
    } catch (error) {
      if (error instanceof ApiError && error.code === "rate_limited" && error.retryAfterMs) {
        setCooldownUntil(Date.now() + error.retryAfterMs)
      }
      toast.show(errorMessage(error), "error")
      return false
    }
  }

  async function handleToggleMeToo(topic: TopicSummary) {
    const joined = membershipByTopic.has(topic.id)
    setBusyTopicId(topic.id)
    // Optimistic: flip the button now, roll back if the server says no.
    if (joined) removeMembership(topic.id)
    else upsertMembership({ topicId: topic.id, via: "metoo", feedback: null })
    try {
      if (joined) await api.leaveTopic(code, topic.id)
      else await api.joinTopic(code, topic.id)
    } catch (error) {
      toast.show(errorMessage(error), "error")
      void refresh()
    } finally {
      setBusyTopicId(null)
    }
  }

  async function handleFeedback(topic: TopicSummary, feedback: Feedback) {
    const membership = membershipByTopic.get(topic.id)
    if (!membership) return
    setBusyTopicId(topic.id)
    upsertMembership({ ...membership, feedback })
    try {
      await api.sendFeedback(code, topic.id, feedback)
      toast.show(feedback === "understood" ? "เยี่ยมเลย ขอบคุณที่บอกนะ" : "รับทราบ ผู้สอนจะเห็นว่ายังมีคนงงอยู่", "success")
    } catch (error) {
      toast.show(errorMessage(error), "error")
      void refresh()
    } finally {
      setBusyTopicId(null)
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-border bg-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{snapshot.title || "ห้องเรียน"}</h1>
            <p className="font-mono text-sm tracking-widest text-muted">{snapshot.code}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-muted" aria-label={`ออนไลน์ ${snapshot.confusion.online} คน`}>
              <Users className="size-4" aria-hidden />
              {snapshot.confusion.online}
            </span>
            <ConnectionBadge state={connection} />
          </div>
        </div>
      </header>
      <OfflineBanner state={connection} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-4 py-4">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
            <ShieldCheck className="size-4" aria-hidden />
            ไม่มีใครเห็นชื่อคุณ
          </p>

          {isClosed ? (
            <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
              <DoorClosed className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
              <p>ผู้สอนปิดรับความงงแล้ว ขอบคุณที่ช่วยบอกนะ</p>
            </div>
          ) : null}

          {pending.length > 0 ? (
            <section className="mt-5" aria-label="ข้อความที่กำลังจัดกลุ่ม">
              <ul className="space-y-2">
                {pending.map((question) => (
                  <li
                    key={question.id}
                    className="flex items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-border px-4 py-3"
                  >
                    <LoaderCircle className="mt-1 size-4 shrink-0 animate-spin text-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="break-words">{question.text}</p>
                      <p className="text-sm text-muted">กำลังจัดกลุ่ม…</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-6" aria-labelledby="open-topics">
            <h2 id="open-topics" className="text-sm font-semibold text-muted">
              ตอนนี้ในห้องงงเรื่อง
            </h2>
            {openTopics.length === 0 ? (
              <div className="mt-3 flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center">
                <MessageCircleQuestionMark className="size-8 text-muted" aria-hidden />
                <p className="mt-3 font-medium">ยังไม่มีใครงง</p>
                <p className="mt-1 text-sm text-muted">ถ้าคุณงงอยู่ เป็นคนแรกได้เลย คนอื่นอาจงงเหมือนกัน</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {openTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    membership={membershipByTopic.get(topic.id)}
                    busy={busyTopicId === topic.id}
                    disabled={isClosed}
                    onToggleMeToo={handleToggleMeToo}
                    onFeedback={handleFeedback}
                  />
                ))}
              </ul>
            )}
          </section>

          {resolvedTopics.length > 0 ? (
            <section className="mt-8" aria-labelledby="resolved-topics">
              <h2 id="resolved-topics" className="text-sm font-semibold text-muted">
                ผู้สอนทวนแล้ว
              </h2>
              <ul className="mt-3 space-y-3">
                {resolvedTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    membership={membershipByTopic.get(topic.id)}
                    busy={busyTopicId === topic.id}
                    disabled={isClosed}
                    onToggleMeToo={handleToggleMeToo}
                    onFeedback={handleFeedback}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>

      <Composer
        disabled={isClosed}
        disabledReason="ผู้สอนปิดรับความงงแล้ว"
        cooldownUntil={cooldownUntil}
        onSend={handleSend}
      />
      <PrivacySheet />
    </div>
  )
}
