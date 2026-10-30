import { LoaderCircle, WifiOff } from "lucide-react"
import type { ConnectionState } from "@/lib/use-room"
import { cn } from "@/lib/cn"

const LABELS: Record<ConnectionState, string> = {
  live: "สด",
  connecting: "กำลังเชื่อมต่อ",
  reconnecting: "กำลังเชื่อมต่อใหม่",
  offline: "ออฟไลน์",
}

/** Small status pill. Colour is never the only signal: there is always a word next to it. */
export function ConnectionBadge({ state, className }: { state: ConnectionState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted",
        className,
      )}
    >
      {state === "live" ? (
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
      ) : state === "offline" ? (
        <WifiOff className="size-3.5" aria-hidden />
      ) : (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
      )}
      {LABELS[state]}
    </span>
  )
}

/** Full-width banner shown while the connection is down, so nobody keeps typing into the void. */
export function OfflineBanner({ state }: { state: ConnectionState }) {
  if (state === "live" || state === "connecting") return null
  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-danger-soft px-4 py-2 text-sm font-medium text-danger"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      {state === "offline"
        ? "ไม่มีอินเทอร์เน็ต ข้อมูลจะอัปเดตเมื่อกลับมาออนไลน์"
        : "การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่…"}
    </div>
  )
}
