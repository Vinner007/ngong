import type { ConfusionLevel } from "@/shared/types"

// Colour classes per confusion level, shared by the host meter and the projector's mood meter.

export const LEVEL_TEXT_CLASS: Record<ConfusionLevel, string> = {
  low: "text-level-low",
  medium: "text-level-medium",
  high: "text-level-high",
}

export const LEVEL_FILL_CLASS: Record<ConfusionLevel, string> = {
  low: "bg-level-low",
  medium: "bg-level-medium",
  high: "bg-level-high",
}
