import { useSyncExternalStore } from 'react'

export const TOTAL_DAYS = 700

export interface Card { box: number; due: string; lapses: number; seen: number }
export interface WrongQ { day: number; idx: number; count: number; last: string }
export interface MyQuestion { id: string; text: string; day?: number; created: string; solved?: boolean }
export interface Settings { showYi: boolean; zodiac: 'tropical' | 'sidereal'; ayanamsa: number; lat: number; lon: number; place: string }

export interface State {
  startDate: string
  completed: Record<number, string>
  checkins: string[]
  cards: Record<string, Card>
  wrong: Record<string, WrongQ>
  notes: Record<string, string>
  tasks: Record<string, boolean>
  explains: Record<string, boolean>
  myQs: MyQuestion[]
  settings: Settings
  onboarded?: boolean
}

const KEY = 'xingxue-v1'
export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number)
  return todayStr(new Date(y, m - 1, d + n))
}
export const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

const DEFAULT_SETTINGS: Settings = { showYi: true, zodiac: 'tropical', ayanamsa: 24.2, lat: 39.9, lon: 116.4, place: '北京' }
const fresh = (): State => ({
  startDate: todayStr(), completed: {}, checkins: [], cards: {}, wrong: {}, notes: {}, tasks: {}, explains: {}, myQs: [], settings: { ...DEFAULT_SETTINGS },
})

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { ...fresh(), ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } }
    }
  } catch { /* 数据损坏时重新开始 */ }
  return fresh()
}

let state: State = load()
const listeners = new Set<() => void>()
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* 存储已满或被禁用 */ } }
persist()

export function update(fn: (s: State) => State | void) {
  const draft = structuredClone(state)
  const r = fn(draft)
  state = r ?? draft
  persist()
  listeners.forEach((l) => l())
}
export const useStore = () =>
  useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
export const getState = () => state

/** "今日一课"只是建议：第一节没完成的课；日历天数按开始日期算 */
export function scheduleInfo(s: State, today = todayStr()) {
  const dayByCalendar = Math.max(1, Math.min(TOTAL_DAYS, daysBetween(s.startDate, today) + 1))
  const done = (d: number) => Boolean(s.completed[d])
  let next = 1
  while (next <= TOTAL_DAYS && done(next)) next++
  const missed: number[] = []
  for (let d = 1; d < dayByCalendar && missed.length < 30; d++) if (!done(d)) missed.push(d)
  return { dayByCalendar, next: next > TOTAL_DAYS ? null : next, missed, doneCount: Object.keys(s.completed).length }
}

export function completeLesson(day: number, cardIds: string[] = []) {
  update((s) => {
    const t = todayStr()
    if (!s.completed[day]) s.completed[day] = t
    if (!s.checkins.includes(t)) s.checkins.push(t)
    for (const id of cardIds) if (!s.cards[id]) s.cards[id] = { box: 0, due: addDays(t, 1), lapses: 0, seen: 0 }
  })
}

export function streak(s: State, today = todayStr()) {
  const set = new Set(s.checkins)
  let d = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(d)) { n++; d = addDays(d, -1) }
  return n
}

export function recordQuiz(day: number, idx: number, correct: boolean) {
  if (correct) return
  update((s) => {
    const k = `${day}-${idx}`
    const w = s.wrong[k] ?? { day, idx, count: 0, last: '' }
    w.count++; w.last = todayStr()
    s.wrong[k] = w
  })
}
export const clearWrong = (k: string) => update((s) => { delete s.wrong[k] })

// ── 间隔重复：莱特纳盒子，间隔 1、2、4、7、15、30、60 天 ──
export const INTERVALS = [1, 2, 4, 7, 15, 30, 60]
export const DAILY_REVIEW_CAP = 15
export function reviewCard(id: string, correct: boolean) {
  update((s) => {
    const c = s.cards[id] ?? { box: 0, due: todayStr(), lapses: 0, seen: 0 }
    c.seen++
    if (correct) {
      c.box = Math.min(c.box + 1, INTERVALS.length - 1)
      c.due = addDays(todayStr(), INTERVALS[c.box])
    } else {
      c.box = 0; c.lapses++; c.due = addDays(todayStr(), 1)
    }
    s.cards[id] = c
  })
}
export const dueCards = (s: State, today = todayStr()) =>
  Object.entries(s.cards).filter(([, c]) => c.due <= today).sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([id]) => id)

export const setNote = (id: string, text: string) => update((s) => { s.notes[id] = text })
export const toggleTask = (id: string) => update((s) => { s.tasks[id] = !s.tasks[id] })
export const toggleExplain = (id: string) => update((s) => { s.explains[id] = !s.explains[id] })
export const setSettings = (p: Partial<Settings>) => update((s) => { s.settings = { ...s.settings, ...p } })
export const addMyQ = (text: string, day?: number) => update((s) => {
  s.myQs.unshift({ id: Math.random().toString(36).slice(2, 9), text, day, created: todayStr() })
})
export const toggleMyQ = (id: string) => update((s) => { const q = s.myQs.find((x) => x.id === id); if (q) q.solved = !q.solved })
export const removeMyQ = (id: string) => update((s) => { s.myQs = s.myQs.filter((x) => x.id !== id) })

export const finishOnboarding = () => update((s) => {
  if (!Object.keys(s.completed).length) s.startDate = todayStr()
  s.onboarded = true
})
export const isOnboarded = (s: State) => Boolean(s.onboarded || Object.keys(s.completed).length)
export const resetAll = () => { localStorage.removeItem(KEY); state = load(); persist(); listeners.forEach((l) => l()) }
export const exportBackup = () => JSON.stringify({ app: 'xingxue-tang', version: 1, exported: new Date().toISOString(), state }, null, 1)
export function importBackup(text: string): boolean {
  try {
    const p = JSON.parse(text)
    const s = p.state ?? p
    if (typeof s !== 'object' || !s.completed) return false
    update(() => ({ ...fresh(), ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) } }))
    return true
  } catch { return false }
}
