"use client"

// The bottom sheets the host opens from the dashboard.

import { Check, Copy, DoorClosed, Play, Presentation, RotateCcw, Sparkles, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { QrCode } from "@/components/qr-code"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { api } from "@/lib/api-client"
import { errorMessage } from "@/lib/messages"
import { LABEL_MAX_LENGTH } from "@/shared/limits"
import type { TopicExplanation, TopicSummary } from "@/shared/types"

// ---------- share ----------

export function ShareSheet({
  open,
  onOpenChange,
  code,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
}) {
  const toast = useToast()
  const [origin, setOrigin] = useState("")
  // window is only available after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(window.location.origin), [])
  const joinUrl = `${origin}/r/${code}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast.show("คัดลอกลิงก์แล้ว", "success")
    } catch {
      toast.show("คัดลอกไม่ได้ ลองกดค้างที่ลิงก์แทน", "error")
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="ชวนนักศึกษาเข้าห้อง">
      <div className="flex flex-col items-center">
        {origin ? <QrCode value={joinUrl} label={`QR สำหรับเข้าห้อง ${code}`} className="size-60" /> : null}
        <p className="mt-4 text-sm text-muted">หรือเข้า {origin.replace(/^https?:\/\//, "")} แล้วใส่รหัส</p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-[0.25em]">{code}</p>
      </div>
      <div className="mt-6 grid gap-2">
        <Button variant="secondary" block onClick={copyLink}>
          <Copy className="size-4" aria-hidden />
          คัดลอกลิงก์เข้าห้อง
        </Button>
        <a
          href={`/screen/${code}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 text-[15px] font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <Presentation className="size-4" aria-hidden />
          เปิดบนจอโปรเจกเตอร์
        </a>
      </div>
    </BottomSheet>
  )
}

// ---------- AI explanation ----------

export function ExplainSheet({
  code,
  topic,
  onClose,
}: {
  code: string
  topic: TopicSummary | null
  onClose: () => void
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; explanation: TopicExplanation }
    | { kind: "error"; message: string }
  >({ kind: "loading" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!topic) return
    let cancelled = false
    // Starting a new request resets the sheet to its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" })
    api
      .explainTopic(code, topic.id)
      .then(({ explanation }) => !cancelled && setState({ kind: "ready", explanation }))
      .catch((error: unknown) => !cancelled && setState({ kind: "error", message: errorMessage(error) }))
    return () => {
      cancelled = true
    }
  }, [code, topic, attempt])

  return (
    <BottomSheet
      open={topic !== null}
      onOpenChange={(open) => !open && onClose()}
      title="AI ช่วยคิดวิธีอธิบายใหม่"
      description={topic ? `หัวข้อ: ${topic.label}` : undefined}
    >
      <div aria-live="polite">
        {state.kind === "loading" ? (
          <div className="space-y-3 py-2" aria-busy="true">
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <Sparkles className="size-4 animate-pulse text-primary" aria-hidden />
              กำลังอ่านสิ่งที่นักศึกษางง…
            </p>
            <div className="h-4 w-full animate-pulse rounded bg-surface-hover" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-surface-hover" />
            <div className="h-20 w-full animate-pulse rounded-xl bg-surface-hover" />
          </div>
        ) : state.kind === "error" ? (
          <div className="py-2">
            <p className="text-danger">{state.message}</p>
            <Button variant="secondary" block className="mt-4" onClick={() => setAttempt((n) => n + 1)}>
              <RotateCcw className="size-4" aria-hidden />
              ลองใหม่
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <section>
              <h3 className="text-sm font-semibold text-muted">ลองพูดแบบนี้</h3>
              <p className="mt-1 whitespace-pre-line text-[17px] leading-relaxed">
                {state.explanation.explanation}
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-muted">ตัวอย่าง</h3>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-xl bg-bg p-3 font-mono text-sm leading-relaxed">
                {state.explanation.example}
              </pre>
            </section>
            <p className="text-xs text-muted">สร้างโดย AI จากข้อความของนักศึกษา ตรวจทานก่อนใช้นะ</p>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

// ---------- rename ----------

export function RenameSheet({
  topic,
  onClose,
  onSave,
}: {
  topic: TopicSummary | null
  onClose: () => void
  onSave: (topic: TopicSummary, label: string) => Promise<void>
}) {
  const [label, setLabel] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Prefill with the current label each time a different topic is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (topic) setLabel(topic.label)
  }, [topic])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!topic || !label.trim()) return
    setSaving(true)
    await onSave(topic, label.trim())
    setSaving(false)
  }

  return (
    <BottomSheet
      open={topic !== null}
      onOpenChange={(open) => !open && onClose()}
      title="แก้ชื่อหัวข้อ"
      description="ชื่อที่คุณตั้ง AI จะไม่เปลี่ยนทับ"
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="topic-label" className="sr-only">
          ชื่อหัวข้อ
        </label>
        <input
          id="topic-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={LABEL_MAX_LENGTH}
          enterKeyHint="done"
          className="block h-12 w-full rounded-[var(--radius-control)] border border-border bg-bg px-4 text-base focus:border-primary"
        />
        <Button type="submit" size="lg" block className="mt-4" loading={saving} disabled={!label.trim()}>
          {saving ? null : <Check className="size-5" aria-hidden />}
          บันทึก
        </Button>
      </form>
    </BottomSheet>
  )
}

// ---------- room menu ----------

export function HostMenuSheet({
  open,
  onOpenChange,
  code,
  isClosed,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
  isClosed: boolean
  onDeleted: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<"demo" | "close" | "delete" | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function run(action: "demo" | "close" | "delete") {
    setBusy(action)
    try {
      if (action === "demo") {
        await api.startDemo(code)
        toast.show("เริ่มจำลองห้องเรียนแล้ว ดูความงงทยอยเข้ามาได้เลย", "success")
      }
      if (action === "close") {
        await api.closeRoom(code)
        toast.show("ปิดรับความงงแล้ว", "success")
      }
      if (action === "delete") {
        await api.deleteRoom(code)
        onDeleted()
      }
      onOpenChange(false)
    } catch (error) {
      toast.show(errorMessage(error), "error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmingDelete(false)
        onOpenChange(next)
      }}
      title="จัดการห้อง"
    >
      <div className="grid gap-2">
        <Button variant="secondary" block loading={busy === "demo"} disabled={isClosed} onClick={() => run("demo")}>
          {busy === "demo" ? null : <Play className="size-4" aria-hidden />}
          จำลองห้องเรียน (ทดลองระบบ)
        </Button>
        <Button variant="secondary" block loading={busy === "close"} disabled={isClosed} onClick={() => run("close")}>
          {busy === "close" ? null : <DoorClosed className="size-4" aria-hidden />}
          {isClosed ? "ปิดรับความงงแล้ว" : "ปิดรับความงง"}
        </Button>

        {confirmingDelete ? (
          <div className="mt-2 rounded-[var(--radius-card)] border border-danger/40 bg-danger-soft p-4">
            <p className="font-medium text-danger">ลบห้องนี้และข้อความทั้งหมดทันที?</p>
            <p className="mt-1 text-sm text-muted">ย้อนกลับไม่ได้ นักศึกษาทุกคนจะออกจากห้อง</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                ยกเลิก
              </Button>
              <Button variant="danger" loading={busy === "delete"} onClick={() => run("delete")}>
                ลบเลย
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" block className="text-danger" onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="size-4" aria-hidden />
            ลบห้องและข้อมูลทั้งหมด
          </Button>
        )}
      </div>
    </BottomSheet>
  )
}
