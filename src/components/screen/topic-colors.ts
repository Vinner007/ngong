// Bubble colours for the always-dark projector view. Each is light enough that the dark label
// text (#070b16) on top of it passes WCAG AA by a wide margin.
const TOPIC_COLORS = [
  "#818cf8", // indigo
  "#2dd4bf", // teal
  "#fbbf24", // amber
  "#f472b6", // pink
  "#38bdf8", // sky
  "#a3e635", // lime
  "#fb923c", // orange
  "#c084fc", // violet
] as const

export const BUBBLE_TEXT_COLOR = "#070b16"

/** Colour follows the topic id, so a bubble keeps its colour when the ranking reshuffles. */
export function topicColor(topicId: number): string {
  return TOPIC_COLORS[topicId % TOPIC_COLORS.length]!
}

/** The same colour with transparency, for glows and ripples. */
export function topicGlow(topicId: number, alpha: number): string {
  const hex = topicColor(topicId).slice(1)
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  return `rgb(${r} ${g} ${b} / ${alpha})`
}
