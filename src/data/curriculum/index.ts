import type { Lesson } from '../types'
import { OUTLINE, STAGES, type OutlineLesson } from '../outline'
import { STAGE01 } from './stage01'
import { STAGE02 } from './stage02'
import { STAGE03 } from './stage03'
import { STAGE04 } from './stage04'
import { STAGE05 } from './stage05'
import { STAGE06 } from './stage06'
import { STAGE09 } from './stage09'
import { STAGE10 } from './stage10'
import { STAGE12 } from './stage12'

/** 已经写好完整内容的课 */
export const LESSONS: Lesson[] = [
  ...STAGE01,
  ...STAGE02,
  ...STAGE03,
  ...STAGE04,
  ...STAGE05,
  ...STAGE06,
  ...STAGE09,
  ...STAGE10,
  ...STAGE12,
]
const byDay = new Map(LESSONS.map((l) => [l.day, l]))

export const lessonByDay = (day: number): Lesson | undefined => byDay.get(day)
export const outlineByDay = (day: number): OutlineLesson | undefined => OUTLINE[day - 1]
export const stageOf = (day: number) => STAGES.find((s) => day >= s.from && day <= s.to)!
export const isBuilt = (day: number) => byDay.has(day)
export { OUTLINE, STAGES }

/** 问答库：所有已写好课程的问答，带出处 */
export const QA_ALL = LESSONS.flatMap((l) => l.qa.map((q, i) => ({ ...q, day: l.day, id: `${l.day}-${i}`, lessonTitle: l.title })))

/** 温习卡：已学课程里的单选题 */
export const cardIdsOf = (l: Lesson) => l.quiz.map((q, i) => (q.t === 'choice' ? `${l.day}-${i}` : null)).filter(Boolean) as string[]
export function cardById(id: string) {
  const [d, i] = id.split('-').map(Number)
  const l = byDay.get(d)
  const q = l?.quiz[i]
  return q && q.t === 'choice' && l ? { lesson: l, q, idx: i } : null
}
