import { z } from "zod"
import { LABEL_MAX_LENGTH, QUESTION_MAX_LENGTH, TITLE_MAX_LENGTH } from "./limits"

// Request bodies. The same schemas run in the browser (to disable the send button early)
// and on the server (as the real gate), so the two can never disagree.

/** Collapses runs of whitespace and trims, so "   " counts as empty. */
const cleanText = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max))

export const createRoomSchema = z.object({
  title: cleanText(TITLE_MAX_LENGTH).default(""),
})

export const askSchema = z.object({
  text: cleanText(QUESTION_MAX_LENGTH).pipe(z.string().min(1)),
})

export const feedbackSchema = z.object({
  feedback: z.enum(["understood", "still_confused"]),
})

export const renameTopicSchema = z.object({
  label: cleanText(LABEL_MAX_LENGTH).pipe(z.string().min(1)),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type AskInput = z.infer<typeof askSchema>
export type FeedbackInput = z.infer<typeof feedbackSchema>
export type RenameTopicInput = z.infer<typeof renameTopicSchema>
