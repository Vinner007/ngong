// Thai students often swear to say how lost they are ("งงสัส ๆ" means "really confused"),
// so rude words are masked rather than rejected: the confusion still counts, the word goes away.
// This list is deliberately short. The real protection is structural: students only ever see
// topic labels, never another student's raw text.
// Thai has no spaces between words, so each entry is matched as a substring. Words that hide
// inside normal vocabulary are left out on purpose ("สัด" is in "สัดส่วน", "เหี่ย" in "เหี่ยว").

const MASK = "•••"

const RUDE_WORDS = [
  "ควย",
  "เหี้ย",
  "สัส",
  "เย็ด",
  "ระยำ",
  "ชาติหมา",
  "ไอ้สัตว์",
  "อีสัตว์",
  "fuck",
  "shit",
  "bitch",
]

const RUDE_WORD_PATTERN = new RegExp(RUDE_WORDS.join("|"), "gi")

export function maskRudeWords(text: string): string {
  return text.replace(RUDE_WORD_PATTERN, MASK)
}
