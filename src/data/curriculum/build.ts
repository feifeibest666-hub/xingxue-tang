import type { ChoiceQ, ExplainQ, Lesson, OrderQ, QA, Quiz, Screen, SortQ, StepsQ, CalcQ, Tag } from '../types'

export const hook = (q: string, body?: string): Screen => ({ t: 'hook', q, body })
export const T = (tag: Tag, title: string, body: string): Screen => ({ t: 'text', tag, title, body })
export const derive = (title: string, steps: (string | [string, Tag])[], result: string): Screen =>
  ({ t: 'derive', title, steps: steps.map((s) => (typeof s === 'string' ? { s } : { s: s[0], tag: s[1] })), result })
export const analogy = (title: string, life: string, sky: string, breaks: string, pairs?: [string, string][]): Screen =>
  ({ t: 'analogy', title, life, sky, breaks, pairs })
export const debate = (tag: '约定' | '争议', title: string, body: string, sides?: [string, string][]): Screen =>
  ({ t: 'debate', tag, title, body, sides: sides?.map(([who, says]) => ({ who, says })) })
export const W = (w: string, title: string, body?: string, args?: Record<string, unknown>): Screen => ({ t: 'widget', w, title, body, args })
export const connect = (from: string[], to: string, next?: string): Screen => ({ t: 'connect', from, to, next })
export const summary = (...points: [Tag, string][]): Screen => ({ t: 'summary', points })
export const yi = (title: string, body: string): Screen => ({ t: 'yi', title, body })
export const quote = (text: string, source: string, note?: string): Screen => ({ t: 'quote', text, source, note })
export const tasks = (title: string, list: string[], intro?: string): Screen => ({ t: 'tasks', title, tasks: list, intro })
export const write = (id: string, prompt: string, hint?: string, reference?: string): Screen => ({ t: 'write', id, prompt, hint, reference })

export const C = (q: string, opts: string[], a: number, ex: string, back?: number): ChoiceQ => ({ t: 'choice', q, opts, a, ex, back })
export const TF = (q: string, a: boolean, ex: string): ChoiceQ => ({ t: 'choice', q, opts: ['对', '错'], a: a ? 0 : 1, ex })
export const SORT = (q: string, bins: string[], items: [string, number][], ex?: string): SortQ => ({ t: 'sort', q, bins, items, ex })
export const ORDER = (q: string, steps: string[], ex?: string): OrderQ => ({ t: 'order', q, steps, ex })
export const STEPS = (q: string, parts: [string, string[], number, string][]): StepsQ => ({ t: 'steps', q, parts: parts.map(([pq, opts, a, ex]) => ({ q: pq, opts, a, ex })) })
export const CALC = (q: string, answer: number, ex: string, tol = 0.5, unit?: string): CalcQ => ({ t: 'calc', q, answer, ex, tol, unit })
export const EXPLAIN = (q: string, points: string[]): ExplainQ => ({ t: 'explain', q, points })
export const qa = (q: string, a: string, tag?: Tag): QA => ({ q, a, tag })

export const COVER = ['w1-sky-moves', 'w2-seasons', 'w3-why-twelve', 'w4-elements', 'w5-first-six', 'w6-last-six']

type Partial1 = Omit<Lesson, 'stage' | 'kind' | 'cover'> & { kind?: Lesson['kind']; cover?: string }
export function L(x: Partial1): Lesson {
  return { stage: 1, kind: 'new', cover: COVER[Math.floor((x.day - 1) / 7)], minutes: 20, ...x }
}

/** 其他阶段的课：LS(2, 'stage02-cover')({ day, title, ... }) */
export const LS = (stage: number, cover: string | ((day: number) => string)) => (x: Partial1): Lesson =>
  ({ stage, kind: 'new', cover: typeof cover === 'string' ? cover : cover(x.day), minutes: 20, ...x })

/** 复盘课自动插入本周新课的单选题（插在排序题之后）；cert 课不插 */
export function withReviewMix(all: Lesson[], per = 1): Lesson[] {
  for (const l of all) {
    if (l.kind !== 'review' || l.cert) continue
    const week = all.filter((x) => x.kind === 'new' && x.day < l.day && x.day >= l.day - 7).map((x) => x.day)
    const at = l.quiz.findIndex((q) => q.t === 'order') + 1
    l.quiz.splice(at, 0, ...mixFrom(all, week, per))
  }
  return all
}

/** 复盘课的混合题：从指定几天的单选题里各取若干道 */
export function mixFrom(lessons: Lesson[], days: number[], per = 1): Quiz[] {
  const out: Quiz[] = []
  for (const d of days) {
    const l = lessons.find((x) => x.day === d)
    if (!l) continue
    l.quiz.filter((q) => q.t === 'choice').slice(0, per).forEach((q) => out.push({ ...q, back: undefined }))
  }
  return out
}
