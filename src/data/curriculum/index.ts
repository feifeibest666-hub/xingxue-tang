import { useEffect, useMemo, useState } from 'react'
import type { Lesson, QA } from '../types'
import { OUTLINE, STAGES, type OutlineLesson } from '../outline'
import { registerWidgets } from '../../components/widgets/extra'
import { BUILT } from './registry'

export { OUTLINE, STAGES }
export const outlineByDay = (day: number): OutlineLesson | undefined => OUTLINE[day - 1]
export const stageOf = (day: number) => STAGES.find((s) => day >= s.from && day <= s.to)!

/** 阶段在注册表里即视为已上线；不加载课程 */
export const isBuilt = (day: number) => {
  const st = STAGES.find((s) => day >= s.from && day <= s.to)
  return Boolean(st && BUILT[st.n])
}

const builtStages = () => Object.keys(BUILT).map(Number).sort((a, b) => a - b)

const cache = new Map<number, Lesson[]>()
const pending = new Map<number, Promise<Lesson[]>>()
const listeners = new Set<() => void>()
let version = 0

function notify() {
  version++
  listeners.forEach((l) => l())
}

/** 加载一个阶段的课程；有部件包则注册进 EXTRA。进行中的加载只发一次 */
export function loadStage(n: number): Promise<Lesson[]> {
  const hit = cache.get(n)
  if (hit) return Promise.resolve(hit)
  const entry = BUILT[n]
  if (!entry) return Promise.resolve([])
  let p = pending.get(n)
  if (!p) {
    p = Promise.all([entry.lessons(), entry.widgets?.()]).then(([lessons, widgets]) => {
      if (widgets) registerWidgets(widgets)
      cache.set(n, lessons)
      pending.delete(n)
      notify()
      return lessons
    })
    pending.set(n, p)
  }
  return p
}

let allWidgets: Promise<void> | undefined
/** 加载每个已写阶段的部件包（页面遇到尚未注册的部件名时用） */
export const loadAllWidgets = () => (allWidgets ??= Promise.all(
  builtStages().map((n) => BUILT[n].widgets?.().then(registerWidgets)),
).then(() => { notify() }))

export const loadAll = () => Promise.all(builtStages().map(loadStage)).then((xs) => xs.flat().sort((a, b) => a.day - b.day))

/** 同步取已加载的课；该阶段还没进缓存则 undefined */
export const peekLesson = (day: number) => {
  const st = STAGES.find((s) => day >= s.from && day <= s.to)
  return st ? cache.get(st.n)?.find((l) => l.day === day) : undefined
}

function useLoaded() {
  const [v, set] = useState(version)
  useEffect(() => {
    const f = () => set(version)
    listeners.add(f)
    f()
    return () => { listeners.delete(f) }
  }, [])
  return v
}

/** undefined = 加载中；null = 阶段未注册，或加载后没有这一天；否则是课 */
export function useLesson(day: number): Lesson | null | undefined {
  useLoaded()
  const built = isBuilt(day)
  useEffect(() => { if (built) loadStage(stageOf(day).n) }, [day, built])
  if (!built) return null
  const n = stageOf(day).n
  return cache.has(n) ? (peekLesson(day) ?? null) : undefined
}

/** 不传 days 就加载全部已写阶段；否则只加载这些天所在、且已注册的阶段 */
export function useLessons(days?: number[]): { lessons: Lesson[]; ready: boolean } {
  const v = useLoaded()
  const stages = days
    ? [...new Set(days.filter(isBuilt).map((d) => stageOf(d).n))].sort((a, b) => a - b)
    : builtStages()
  const key = stages.join(',')
  useEffect(() => { stages.forEach(loadStage) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const ready = stages.every((n) => cache.has(n))
  const lessons = useMemo(() => [...cache.values()].flat().sort((a, b) => a.day - b.day), [v])
  return { lessons, ready }
}

export type QAItem = QA & { day: number; id: string; lessonTitle: string }
export const qaOf = (lessons: Lesson[]): QAItem[] =>
  lessons.flatMap((l) => l.qa.map((q, i) => ({ ...q, day: l.day, id: `${l.day}-${i}`, lessonTitle: l.title })))

/** 温习卡：已学课程里的单选题 */
export const cardIdsOf = (l: Lesson) => l.quiz.map((q, i) => (q.t === 'choice' ? `${l.day}-${i}` : null)).filter(Boolean) as string[]
export const dayOfCard = (id: string) => Number(id.split('-')[0])
export function cardById(id: string) {
  const [d, i] = id.split('-').map(Number)
  const l = peekLesson(d)
  const q = l?.quiz[i]
  return q && q.t === 'choice' && l ? { lesson: l, q, idx: i } : null
}
