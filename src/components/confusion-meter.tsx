import { LEVEL_FILL_CLASS, LEVEL_TEXT_CLASS } from "@/components/confusion-level"
import { cn } from "@/lib/cn"
import type { ConfusionLevel, ConfusionSummary } from "@/shared/types"

const LEVEL_LABEL: Record<ConfusionLevel, string> = {
  low: "น้อย",
  medium: "ปานกลาง",
  high: "สูง",
}

const LEVEL_HINT: Record<ConfusionLevel, string> = {
  low: "ห้องส่วนใหญ่ตามทัน",
  medium: "เริ่มมีคนหลุด ลองเช็คหัวข้อด้านล่าง",
  high: "หลายคนงง ลองทวนหัวข้อที่คนงงเยอะสุด",
}

/** The host's meter. Level is shown three ways at once: colour, a word, and a percentage. */
export function ConfusionMeter({ confusion }: { confusion: ConfusionSummary }) {
  const { level, percent, confusedPeople, online } = confusion

  return (
    <section aria-label="ระดับความงงของห้อง">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-muted">ระดับความงงตอนนี้</h2>
        <p className={cn("text-lg font-semibold tabular-nums", LEVEL_TEXT_CLASS[level])}>
          {LEVEL_LABEL[level]} {percent}%
        </p>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-surface-hover"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${LEVEL_LABEL[level]} ${percent} เปอร์เซ็นต์`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", LEVEL_FILL_CLASS[level])}
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        {confusedPeople} จาก {online} คนงงอย่างน้อย 1 เรื่อง · {LEVEL_HINT[level]}
      </p>
    </section>
  )
}
