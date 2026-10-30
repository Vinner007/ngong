import demoData from "../../scripts/demo-questions.json"

export interface DemoTopic {
  name: string
  questions: string[]
}

export const DEMO_COURSE: string = demoData.course
export const DEMO_TOPICS: DemoTopic[] = demoData.topics

/**
 * The order the classroom simulation sends questions in: round-robin across topics so every
 * bubble starts small and grows together, which looks like a real class.
 */
export function demoQuestionOrder(): string[] {
  const order: string[] = []
  const longest = Math.max(...DEMO_TOPICS.map((topic) => topic.questions.length))
  for (let round = 0; round < longest; round++) {
    for (const topic of DEMO_TOPICS) {
      const question = topic.questions[round]
      if (question) order.push(question)
    }
  }
  return order
}
