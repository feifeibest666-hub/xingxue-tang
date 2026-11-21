import type { Lesson } from '../types'
import { mixFrom } from './build'
import { WEEK_1_2 } from './stage01a'
import { WEEK_3_4 } from './stage01b'
import { WEEK_5_6 } from './stage01c'

const all: Lesson[] = [...WEEK_1_2, ...WEEK_3_4, ...WEEK_5_6]

// 复盘课：在"推导链排序"之后插入本周新课的题（每课 1–2 道），与新题、讲给我听组成混合题
for (const l of all) {
  if (l.kind !== 'review' || l.day === 42) continue
  const week = [1, 2, 3, 4, 5].map((k) => l.day - 7 + k).filter((d) => all.find((x) => x.day === d)?.kind === 'new')
  const mix = mixFrom(all, week, week.length >= 5 ? 1 : 2)
  const at = l.quiz.findIndex((q) => q.t === 'order') + 1
  l.quiz.splice(at, 0, ...mix)
}
const grad = all.find((l) => l.day === 42)!
grad.cert = true

export const STAGE01: Lesson[] = all
