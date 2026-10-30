"use client"

import { Ellipsis, EyeOff, LoaderCircle, Play, Presentation, QrCode, Users } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ConfusionMeter } from "@/components/confusion-meter"
import { ConnectionBadge, OfflineBanner } from "@/components/connection-badge"
import { ExplainSheet, HostMenuSheet, RenameSheet, ShareSheet } from "@/components/host/host-sheets"
import { HostTopicCard } from "@/components/host/host-topic-card"
import { RoomDeleted, RoomError, RoomNotFound, RoomSkeleton } from "@/components/room-states"
import { Button, buttonVariants } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { api } from "@/lib/api-client"
import { cn } from "@/lib/cn"
import { errorMessage } from "@/lib/messages"
import { useRoom } from "@/lib/use-room"
import type { HostQuestion, HostSnapshot, QuestionStatus, TopicSummary } from "@/shared/types"

type Tab = "topics" | "all"

const STATUS_LABEL: Record<QuestionStatus, string> = {
  pending: "กำลังจัดกลุ่ม",
  clustered: "",
  hidden: "ซ่อนแล้ว",
  failed: "จัดกลุ่มไม่สำเร็จ",
}

export function HostRoom({ code }: { code: string }) {
  const toast = useToast()
  const { status, snapshot, viewer, connection, refresh } = useRoom(code, "host")

  const [tab, setTab] = useState<Tab>("topics")
  const [shareOpen, setShareOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [explainTopic, setExplainTopic] = useState<TopicSummary | null>(null)
  const [renameTopic, setRenameTopic] = useState<TopicSummary | null>(null)
  const [deleted, setDeleted] = useState(false)

  const hostSnapshot = snapshot && "host" in snapshot ? (snapshot as HostSnapshot) : null
  const questions = useHostQuestions(code, hostSnapshot)

  if (deleted || status === "deleted") return <RoomDeleted />
  if (status === "loading") return <RoomSkeleton />
  if (status === "not_found") return <RoomNotFound />
  if (status === "error" || !snapshot) return <RoomError onRetry={() => void refresh()} />
  if (viewer && !viewer.isHost) return <NotHost code={code} />

  const isClosed = snapshot.status === "closed"
  const openTopics = snapshot.topics.filter((topic) => !topic.resolved)
  const resolvedTopics = snapshot.topics.filter((topic) => topic.resolved)
  const stats = hostSnapshot?.host
  const waiting = (stats?.pendingQuestions ?? 0) + (stats?.failedQuestions ?? 0)

  async function act(action: () => Promise<unknown>, success?: string) {
    try {
      await action()
      if (success) toast.show(success, "success")
      questions.reload()
    } catch (error) {
      toast.show(errorMessage(error), "error")
    }
  }

  const cardProps = {
    questionsLoading: questions.loading,
    onExpand: questions.load,
    onExplain: setExplainTopic,
    onRename: setRenameTopic,
    onResolve: (topic: TopicSummary) =>
      act(() => api.resolveTopic(code, topic.id), "ทำเครื่องหมายว่าทวนแล้ว นักศึกษาจะได้ตอบว่าเข้าใจหรือยัง"),
    onHide: (question: HostQuestion) => act(() => api.hideQuestion(code, question.id), "ซ่อนข้อความแล้ว"),
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{snapshot.title || "ห้องของคุณ"}</h1>
            <p className="flex items-center gap-2 text-sm text-muted">
              <span className="font-mono tracking-widest">{snapshot.code}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" aria-hidden />
                {snapshot.confusion.online} ออนไลน์
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ConnectionBadge state={connection} className="hidden sm:inline-flex" />
            <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)} aria-label="แชร์ QR เข้าห้อง">
              <QrCode className="size-5" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} aria-label="จัดการห้อง">
              <Ellipsis className="size-5" aria-hidden />
            </Button>
          </div>
        </div>
      </header>
      <OfflineBanner state={connection} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <ConfusionMeter confusion={snapshot.confusion} />
          {waiting > 0 ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />
              กำลังจัดกลุ่ม {waiting} ข้อความ
            </p>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="มุมมอง"
          className="mt-4 grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-surface-hover p-1"
        >
          {(
            [
              ["topics", `หัวข้อ (${snapshot.topics.length})`],
              ["all", `ข้อความทั้งหมด (${stats?.totalQuestions ?? 0})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value)
                if (value === "all") questions.load()
              }}
              className={cn(
                "min-h-11 rounded-[calc(var(--radius-control)-4px)] text-sm font-semibold transition-colors",
                tab === value ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "topics" ? (
          snapshot.topics.length === 0 ? (
            <EmptyTopics isClosed={isClosed} onShare={() => setShareOpen(true)} onDemo={() => act(() => api.startDemo(code), "เริ่มจำลองห้องเรียนแล้ว")} />
          ) : (
            <>
              <ol className="mt-4 space-y-3">
                {openTopics.map((topic, index) => (
                  <HostTopicCard
                    key={topic.id}
                    rank={index + 1}
                    topic={topic}
                    questions={questions.byTopic.get(topic.id) ?? []}
                    {...cardProps}
                  />
                ))}
              </ol>
              {resolvedTopics.length > 0 ? (
                <section className="mt-8" aria-labelledby="resolved-heading">
                  <h2 id="resolved-heading" className="text-sm font-semibold text-muted">
                    ทวนแล้ว
                  </h2>
                  <ol className="mt-3 space-y-3">
                    {resolvedTopics.map((topic, index) => (
                      <HostTopicCard
                        key={topic.id}
                        rank={index + 1}
                        topic={topic}
                        questions={questions.byTopic.get(topic.id) ?? []}
                        {...cardProps}
                      />
                    ))}
                  </ol>
                </section>
              ) : null}
            </>
          )
        ) : (
          <AllQuestions questions={questions.all} loading={questions.loading} onHide={cardProps.onHide} />
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          <a
            href={`/screen/${code}`}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ size: "lg", block: true })}
          >
            <Presentation className="size-5" aria-hidden />
            เปิดบนจอโปรเจกเตอร์
          </a>
        </div>
      </div>

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} code={code} />
      <HostMenuSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        code={code}
        isClosed={isClosed}
        onDeleted={() => setDeleted(true)}
      />
      <ExplainSheet code={code} topic={explainTopic} onClose={() => setExplainTopic(null)} />
      <RenameSheet
        topic={renameTopic}
        onClose={() => setRenameTopic(null)}
        onSave={async (topic, label) => {
          await act(() => api.renameTopic(code, topic.id, label), "บันทึกชื่อหัวข้อแล้ว")
          setRenameTopic(null)
        }}
      />
    </div>
  )
}

/** Raw questions are fetched only when the host looks at them, then kept fresh while visible. */
function useHostQuestions(code: string, snapshot: HostSnapshot | null) {
  const [all, setAll] = useState<HostQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [wanted, setWanted] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const { questions } = await api.listQuestions(code)
      setAll(questions)
    } catch {
      // The list is a convenience; the snapshot still shows the topics.
    } finally {
      setLoading(false)
    }
  }, [code])

  const load = useCallback(() => {
    setWanted(true)
    void reload()
  }, [reload])

  // Refetch when the numbers change, but only once the host has opened a list.
  const version = snapshot
    ? `${snapshot.host.totalQuestions}:${snapshot.host.pendingQuestions}:${snapshot.host.hiddenQuestions}:${snapshot.topics.map((topic) => `${topic.id}-${topic.people}`).join(",")}`
    : ""
  useEffect(() => {
    // Syncing with the server after the snapshot changed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wanted) void reload()
  }, [wanted, version, reload])

  const byTopic = useMemo(() => {
    const groups = new Map<number, HostQuestion[]>()
    for (const question of all) {
      if (question.status !== "clustered" || question.topicId === null) continue
      groups.set(question.topicId, [...(groups.get(question.topicId) ?? []), question])
    }
    return groups
  }, [all])

  const reloadIfOpen = useCallback(() => {
    if (wanted) void reload()
  }, [wanted, reload])

  return { all, byTopic, loading, load, reload: reloadIfOpen }
}

function AllQuestions({
  questions,
  loading,
  onHide,
}: {
  questions: HostQuestion[]
  loading: boolean
  onHide: (question: HostQuestion) => void
}) {
  if (loading && questions.length === 0) {
    return <p className="mt-6 text-center text-sm text-muted">กำลังโหลด…</p>
  }
  if (questions.length === 0) {
    return <p className="mt-6 text-center text-sm text-muted">ยังไม่มีข้อความ</p>
  }
  return (
    <ul className="mt-4 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
      {questions.map((question) => (
        <li key={question.id} className="flex items-start gap-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className={cn("break-words", question.status === "hidden" && "text-muted line-through")}>
              {question.body}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {question.topicLabel ?? STATUS_LABEL[question.status]}
              {question.status !== "clustered" && question.topicLabel ? ` · ${STATUS_LABEL[question.status]}` : ""}
              {" · "}
              {new Date(question.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          {question.status !== "hidden" ? (
            <button
              type="button"
              onClick={() => onHide(question)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-danger"
              aria-label="ซ่อนข้อความนี้"
            >
              <EyeOff className="size-4" aria-hidden />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function EmptyTopics({
  isClosed,
  onShare,
  onDemo,
}: {
  isClosed: boolean
  onShare: () => void
  onDemo: () => void
}) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center">
      <QrCode className="size-8 text-muted" aria-hidden />
      <p className="mt-3 font-medium">ยังไม่มีใครส่งความงง</p>
      <p className="mt-1 text-sm text-muted">ให้นักศึกษาสแกน QR หรือใส่รหัสห้อง แล้วหัวข้อที่งงจะขึ้นที่นี่</p>
      <div className="mt-5 grid w-full max-w-xs gap-2">
        <Button onClick={onShare}>
          <QrCode className="size-4" aria-hidden />
          แสดง QR เข้าห้อง
        </Button>
        <Button variant="secondary" onClick={onDemo} disabled={isClosed}>
          <Play className="size-4" aria-hidden />
          ลองจำลองห้องเรียน
        </Button>
      </div>
    </div>
  )
}

function NotHost({ code }: { code: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">หน้านี้สำหรับผู้สอนของห้องนี้</h1>
      <p className="mt-2 text-muted">
        ถ้าคุณเป็นนักศึกษา เข้าห้องได้ที่ปุ่มด้านล่าง ถ้าคุณเป็นผู้สอน ให้เปิดจากเบราว์เซอร์ที่ใช้สร้างห้อง
      </p>
      <Link href={`/r/${code}`} className={buttonVariants({ size: "lg", block: true, className: "mt-8" })}>
        เข้าห้องแบบนักศึกษา
      </Link>
    </main>
  )
}
