import type { ConfusionLevel, ConfusionSummary } from "@/shared/types"
import { cn } from "@/lib/cn"

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

const LEVEL_TEXT: Record<ConfusionLevel, string> = {
  low: "text-level-low",
  medium: "text-level-medium",
  high: "text-level-high",
}

const LEVEL_FILL: Record<ConfusionLevel, string> = {
  low: "bg-level-low",
  medium: "bg-level-medium",
  high: "bg-level-high",
}

interface ConfusionMeterProps {
  confusion: ConfusionSummary
  size?: "md" | "xl"
  showHint?: boolean
}

/** Level is shown three ways at once: colour, a word, and a percentage. */
export function ConfusionMeter({ confusion, size = "md", showHint = true }: ConfusionMeterProps) {
  const { level, percent, confusedPeople, online } = confusion
  const isLarge = size === "xl"

  return (
    <section aria-label="ระดับความงงของห้อง">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={cn("font-medium text-muted", isLarge ? "text-2xl" : "text-sm")}>
          ระดับความงงตอนนี้
        </h2>
        <p className={cn("font-semibold tabular-nums", LEVEL_TEXT[level], isLarge ? "text-4xl" : "text-lg")}>
          {LEVEL_LABEL[level]} {percent}%
        </p>
      </div>
      <div
        className={cn("mt-2 overflow-hidden rounded-full bg-surface-hover", isLarge ? "h-5" : "h-3")}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${LEVEL_LABEL[level]} ${percent} เปอร์เซ็นต์`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", LEVEL_FILL[level])}
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
      <p className={cn("mt-2 text-muted", isLarge ? "text-xl" : "text-sm")}>
        {confusedPeople} จาก {online} คนงงอย่างน้อย 1 เรื่อง
        {showHint ? ` · ${LEVEL_HINT[level]}` : ""}
      </p>
    </section>
  )
}
