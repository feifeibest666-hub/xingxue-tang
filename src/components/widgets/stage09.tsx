// 第 9 阶段：行运、回归、推运、太阳弧、预测日记、回溯时间轴
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Btns, Note, PlayBtn, Slider, reduceMotion, useLoop, usePlaying, wheel, type WidgetMap } from './common'
import { CasePicker, MyBirthForm, NeedMine, SIGN_CN, Wheel, fmtL, useChartOf } from './natal'
import { GlyphAt } from '../Glyph'
import { PLACES } from './tools'
import { caseById } from '../../data/cases'
import { ANGULARITY, HOUSE_TOPICS } from '../../data/classical'
import {
  BODIES, BODY_COLOR, BODY_NAME, BODY_SHORT, findLonCrossings, norm, positionsAt, sep, signIdx, wholeHouse,
  type Birth, type Body, type Chart,
} from '../../lib/natal'
import {
  NAIBOD, ageAt, dateAtAge, eclipses, fmtDate, hits, lunations, progressed, returnsOf, solarArc, solarReturn, transitHits, transitList,
  type Transit,
} from '../../lib/timing'
import { setNote, todayStr, useStore } from '../../lib/store'

const DAY = 86400000
const INK = '#f6f1e4'
const GOLD = '#c2a05a'
const MUTED = 'rgba(246,241,228,0.72)'
const LINE = 'rgba(246,241,228,0.16)'
const tap: CSSProperties = { minHeight: 32 }
const ASP_CN: Record<number, string> = { 0: '合', 60: '六分', 90: '四分', 120: '三分', 180: '对分' }
const JOURNAL_KEY = 'pred-journal'
type Mover = Exclude<Body, 'node'>
type Slow = 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
const SLOW: Slow[] = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
const JUPITER_MEAN = 11.862
const SATURN_MEAN = 29.457

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const pointName = (id: string) => (id === 'asc' ? '上升' : id === 'mc' ? '天顶' : BODY_NAME[id as Body] ?? id)
const pointShort = (id: string) => (id === 'asc' ? '升' : id === 'mc' ? '顶' : BODY_SHORT[id as Body] ?? id)
const pointColor = (id: string) => (id === 'asc' || id === 'mc' ? INK : BODY_COLOR[id as Body] ?? GOLD)

function parseDay(iso: string, hour = 12): Date | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0))
}
function isoAddDays(iso: string, days: number) {
  const t = parseDay(iso, 0)
  return t ? fmtDate(new Date(t.getTime() + days * DAY)) : iso
}
function isoAddMonths(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return fmtDate(new Date(Date.UTC(y, m - 1 + months, d)))
}
function isoSpan(a: string, b: string) {
  const t1 = parseDay(a, 0), t2 = parseDay(b, 0)
  if (!t1 || !t2) return 0
  return Math.round((t2.getTime() - t1.getTime()) / DAY)
}

/** 出生地时区（小时，东为正）下的钟面，以及时区记号 */
export function fmtWhen(t: Date, tzHours: number) {
  const x = new Date(t.getTime() + tzHours * 3600000)
  const p = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0')
  const clock = `${x.getUTCFullYear()}-${p(x.getUTCMonth() + 1)}-${p(x.getUTCDate())} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}:${p(x.getUTCSeconds())}`
  const ah = Math.abs(tzHours)
  const hh = Math.floor(ah + 1e-9)
  const mm = Math.round((ah - hh) * 60)
  const zone = ah < 1e-6 ? '与世界时相同' : `比世界时${tzHours > 0 ? '早' : '晚'} ${hh} 小时 ${p(mm)} 分`
  return { clock, zone }
}

export function unwrapLons(lons: number[]) {
  if (!lons.length) return [] as number[]
  const ys = [lons[0]]
  for (let i = 1; i < lons.length; i++) {
    let d = lons[i] - lons[i - 1]
    if (d > 180) d -= 360
    if (d < -180) d += 360
    ys.push(ys[i - 1] + d)
  }
  return ys
}
export function alignDeg(target: number, ys: number[]) {
  if (!ys.length) return target
  const mid = ys.reduce((a, b) => a + b, 0) / ys.length
  let best = target, bestD = Infinity
  for (let k = -4; k <= 4; k++) {
    const v = target + 360 * k
    const dist = Math.abs(v - mid)
    if (dist < bestD) { best = v; bestD = dist }
  }
  return best
}
/** 逆行圈的中点：从留逆黄经往回走到留顺黄经 */
export function retroMid(retroLon: number, directLon: number) {
  const back = norm(retroLon - directLon)
  return { back, mid: norm(retroLon - back / 2) }
}

export function clusterByAge<T extends { age: number }>(rows: T[], gap: number): T[][] {
  const sorted = [...rows].sort((a, b) => a.age - b.age)
  const out: T[][] = []
  for (const r of sorted) {
    const g = out[out.length - 1]
    if (!g || r.age - g[g.length - 1].age > gap) out.push([r])
    else g.push(r)
  }
  return out
}

export interface SaHit { from: string; to: string; aspect: number; orb: number }
/** 太阳弧已经加进 directed。同一个点与自己的相位不列出（那只是弧长本身）。 */
export function saHits(directed: Record<string, number>, natal: Record<string, number>, orb = 1): SaHit[] {
  const out: SaHit[] = []
  for (const [a, al] of Object.entries(directed)) for (const [b, bl] of Object.entries(natal)) {
    if (a === b || al == null || bl == null) continue
    for (const asp of [0, 60, 90, 120, 180]) {
      if (!hits(al, bl, asp, orb)) continue
      out.push({ from: a, to: b, aspect: asp, orb: Math.abs(sep(al, bl) - asp) })
    }
  }
  return out.sort((p, q) => p.orb - q.orb || p.aspect - q.aspect || p.from.localeCompare(q.from))
}
export function arcSelfAspect(arc: number): { name: string; dist: number } | null {
  let best: { name: string; dist: number } | null = null
  for (const [d, name] of [[0, '合'], [60, '六分'], [90, '四分'], [120, '三分'], [180, '对分']] as const) {
    const dist = d === 0 ? Math.min(arc, 360 - arc) : Math.min(Math.abs(arc - d), Math.abs(arc - (360 - d)))
    if (dist <= 1 && (!best || dist < best.dist)) best = { name, dist }
  }
  return best
}

export interface CycleHit { t: Date; age: number }
export interface CycleGroup { short: string; hits: CycleHit[] }
export interface Cycles { jupiter: CycleHit[]; saturn: CycleHit[]; uranus: CycleGroup[] }

const yieldThread = () => new Promise((r) => setTimeout(r, 0))

export async function loadCycles(c: Chart): Promise<Cycles> {
  const end = dateAtAge(c.ut, 90)
  const map = (ts: Date[]): CycleHit[] => ts
    .map((t) => ({ t, age: ageAt(c.ut, t) }))
    .filter((x) => x.age > 0.05 && x.age <= 90.25)
    .sort((a, b) => a.age - b.age)
  const jupiter = await returnsOf(c, 'jupiter', 90)
  await yieldThread()
  const saturn = await returnsOf(c, 'saturn', 90)
  await yieldThread()
  const sq1 = await transitHits('uranus', norm(c.pos.uranus.lon + 90), c.ut, end)
  await yieldThread()
  const opp = await transitHits('uranus', norm(c.pos.uranus.lon + 180), c.ut, end)
  await yieldThread()
  const sq2 = await transitHits('uranus', norm(c.pos.uranus.lon + 270), c.ut, end)
  return {
    jupiter: map(jupiter),
    saturn: map(saturn),
    uranus: [
      { short: '天王星四分本命天王星', hits: map(sq1) },
      { short: '天王星对分本命天王星', hits: map(opp) },
      { short: '天王星四分本命天王星', hits: map(sq2) },
    ],
  }
}

export function nearbyCycles(age: number, cyc: Cycles, windowYears = 1.5) {
  const items: { label: string; age: number; delta: number; date: string }[] = []
  const push = (label: string, h: CycleHit) => {
    const delta = h.age - age
    if (Math.abs(delta) <= windowYears) items.push({ label, age: h.age, delta, date: fmtDate(h.t) })
  }
  for (const h of cyc.jupiter) push('木星回归', h)
  for (const h of cyc.saturn) push('土星回归', h)
  for (const g of cyc.uranus) for (const h of g.hits) push(g.short, h)
  return items.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
}
export function deltaText(d: number) {
  if (Math.abs(d) < 0.08) return '几乎同时'
  return d > 0 ? `晚 ${d.toFixed(1)} 年` : `早 ${(-d).toFixed(1)} 年`
}

export interface LifeEvent { date: string; what: string; kind: string; age: number }
export function eventsOf(src: string, ut: Date): LifeEvent[] {
  const k = caseById(src)
  if (!k) return []
  const out: LifeEvent[] = []
  for (const e of k.events) {
    const [y, m, d] = e.date.split('-').map(Number)
    if (!y || !m || !d) continue
    const age = ageAt(ut, new Date(Date.UTC(y, m - 1, d, 12)))
    if (age >= 0 && age < 120) out.push({ date: e.date, what: e.what, kind: e.kind, age })
  }
  return out.sort((a, b) => a.age - b.age)
}

/** 行运表按月切开再合并，避免一次算完时页面完全点不动。超过 24 个月则截断。 */
export async function transitWindow(c: Chart, t1: Date, t2: Date): Promise<{ rows: Transit[]; capped: boolean }> {
  if (t2.getTime() <= t1.getTime()) return { rows: [], capped: false }
  const MAX = 730 * DAY
  let capped = false
  let stop = t2.getTime()
  if (stop - t1.getTime() > MAX) { stop = t1.getTime() + MAX; capped = true }
  const seen = new Set<string>()
  const rows: Transit[] = []
  let a = t1.getTime()
  while (a < stop) {
    const b = Math.min(stop, a + 31 * DAY)
    const part = await transitList(c, new Date(a), new Date(b))
    for (const x of part) {
      const k = `${x.t.getTime()}|${x.body}|${x.target}|${x.aspect}`
      if (seen.has(k)) continue
      seen.add(k)
      rows.push(x)
    }
    if (b >= stop) break
    a = b
    await yieldThread()
  }
  rows.sort((x, y) => x.t.getTime() - y.t.getTime())
  return { rows, capped }
}

export interface Ingress { age: number; sign: number }
export async function moonIngresses(ut: Date): Promise<Ingress[]> {
  const t2 = new Date(ut.getTime() + 90 * DAY)
  const rows: Ingress[] = []
  await Promise.all(Array.from({ length: 12 }, (_, s) => findLonCrossings('moon', s * 30, ut, t2, 0.5).then((ts) => {
    for (const t of ts) {
      const age = (t.getTime() - ut.getTime()) / DAY
      if (age > 0.05 && age <= 90) rows.push({ age, sign: s + 1 })
    }
  })))
  return rows.sort((a, b) => a.age - b.age)
}
export function moonSignAt(startSign: number, ingresses: Ingress[], age: number) {
  let sign = startSign
  let since = 0
  let next: Ingress | null = null
  for (const g of ingresses) {
    if (g.age <= age) { sign = g.sign; since = g.age }
    else { next = g; break }
  }
  return { sign, since, next }
}

const PHASES = [
  { name: '新月', hint: '合相前后，一段的开始' },
  { name: '蛾眉', hint: '从新月走向上弦' },
  { name: '上弦', hint: '与太阳四分，向外推' },
  { name: '盈凸', hint: '从上弦走向满月' },
  { name: '满月', hint: '对分，事情铺开' },
  { name: '亏凸', hint: '从满月走向下弦' },
  { name: '下弦', hint: '又一次四分，往回收' },
  { name: '残月', hint: '从下弦走回下一次新月' },
]
export function phaseOf(sunLon: number, moonLon: number) {
  const elong = norm(moonLon - sunLon)
  const i = Math.floor(elong / 45) % 8
  return { elong, ...PHASES[i] }
}

export function resolveTarget(c: Chart, raw: unknown): number | null {
  if (raw == null || raw === '' || raw === 'auto') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return norm(raw)
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (t === 'asc' || t === '上升') return c.asc
  if (t === 'mc' || t === '天顶') return c.mc
  if ((BODIES as string[]).includes(t)) return c.pos[t as Body].lon
  const byName = BODIES.find((b) => BODY_NAME[b] === t)
  if (byName) return c.pos[byName].lon
  const n = Number(t)
  if (t !== '' && Number.isFinite(n)) return norm(n)
  return null
}

interface St { t: Date; lon: number; kind: '留逆' | '留顺' }
async function sampleBody(body: Mover, t1: Date, t2: Date, stepDays: number) {
  const out: { t: Date; lon: number; speed: number }[] = []
  let i = 0
  for (let ms = t1.getTime(); ms <= t2.getTime(); ms += stepDays * DAY) {
    const t = new Date(ms)
    const p = (await positionsAt(t, [body]))[body]
    out.push({ t, lon: p.lon, speed: p.speed })
    if (++i % 25 === 0) await yieldThread()
  }
  if (out.length && t2.getTime() - out[out.length - 1].t.getTime() > DAY) {
    const p = (await positionsAt(t2, [body]))[body]
    out.push({ t: t2, lon: p.lon, speed: p.speed })
  }
  return out
}
async function refineStation(body: Mover, t1: Date, t2: Date, s1: number): Promise<St> {
  let a = t1.getTime(), b = t2.getTime(), sa = s1
  for (let k = 0; k < 16; k++) {
    const m = (a + b) / 2
    const sm = (await positionsAt(new Date(m), [body]))[body].speed
    if (sm === 0 || Math.sign(sm) === Math.sign(sa)) { a = m; sa = sm }
    else b = m
  }
  const t = new Date((a + b) / 2)
  const p = (await positionsAt(t, [body]))[body]
  return { t, lon: p.lon, kind: s1 > 0 ? '留逆' : '留顺' }
}
async function stationsBetween(body: Mover, samples: { t: Date; lon: number; speed: number }[]) {
  const out: St[] = []
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i]
    if (a.speed === 0 || b.speed === 0 || Math.sign(a.speed) === Math.sign(b.speed)) continue
    out.push(await refineStation(body, a.t, b.t, a.speed))
  }
  return out
}

export interface TripleModel {
  target: number
  t1: number
  t2: number
  samples: { t: number; y: number }[]
  crossings: { t: number; direct: boolean }[]
  stations: { t: number; y: number; kind: '留逆' | '留顺' }[]
}
async function buildWindow(body: Mover, target: number, t1: Date, t2: Date): Promise<TripleModel> {
  const series = await sampleBody(body, t1, t2, 4)
  const ys = unwrapLons(series.map((s) => s.lon))
  const samples = series.map((s, i) => ({ t: s.t.getTime(), y: ys[i] }))
  const raw = await transitHits(body, norm(target), t1, t2)
  const crossings: TripleModel['crossings'] = []
  for (const t of raw) {
    const speed = (await positionsAt(t, [body]))[body].speed
    crossings.push({ t: t.getTime(), direct: speed >= 0 })
  }
  const stations = (await stationsBetween(body, series)).map((s) => ({ t: s.t.getTime(), y: alignDeg(s.lon, ys), kind: s.kind }))
  return { target: norm(target), t1: t1.getTime(), t2: t2.getTime(), samples, crossings, stations }
}
function clusterDates(ts: Date[], gapDays: number) {
  const groups: Date[][] = []
  for (const t of [...ts].sort((a, b) => a.getTime() - b.getTime())) {
    const g = groups[groups.length - 1]
    if (!g || t.getTime() - g[g.length - 1].getTime() > gapDays * DAY) groups.push([t])
    else g.push(t)
  }
  return groups
}
/** 从今天起寻找一次真实的三次过点；指定了黄经就改成围绕该度数的约 18 个月。 */
export async function findTripleWindow(body: Mover, from: Date, targetLon: number | null): Promise<TripleModel | null> {
  if (targetLon != null) {
    const target = norm(targetLon)
    const start = new Date(from.getTime() - 220 * DAY)
    const far = new Date(from.getTime() + 8 * 365.25 * DAY)
    const all = await transitHits(body, target, start, far)
    if (!all.length) return null
    const groups = clusterDates(all, 400)
    const prefer = groups.find((g) => g.length >= 3 && g[g.length - 1].getTime() >= from.getTime() - 30 * DAY)
      ?? groups.find((g) => g[g.length - 1].getTime() >= from.getTime())
      ?? groups[0]
    const mid = prefer[Math.floor((prefer.length - 1) / 2)]
    return buildWindow(body, target, new Date(mid.getTime() - 270 * DAY), new Date(mid.getTime() + 270 * DAY))
  }
  const rough = await sampleBody(body, new Date(from.getTime() - 40 * DAY), new Date(from.getTime() + 6 * 365.25 * DAY), 12)
  const stations = await stationsBetween(body, rough)
  const pairs: { retro: St; direct: St }[] = []
  for (let i = 0; i < stations.length - 1; i++) {
    if (stations[i].kind !== '留逆' || stations[i + 1].kind !== '留顺') continue
    const back = norm(stations[i].lon - stations[i + 1].lon)
    if (back < 0.4 || back > 25) continue
    if (stations[i + 1].t.getTime() < from.getTime() - 20 * DAY) continue
    pairs.push({ retro: stations[i], direct: stations[i + 1] })
  }
  for (const pair of pairs.slice(0, 4)) {
    const { mid } = retroMid(pair.retro.lon, pair.direct.lon)
    const midT = (pair.retro.t.getTime() + pair.direct.t.getTime()) / 2
    const model = await buildWindow(body, mid, new Date(midT - 270 * DAY), new Date(midT + 270 * DAY))
    if (model.crossings.length >= 3) return model
  }
  return null
}
export function yAt(samples: { t: number; y: number }[], t: number) {
  if (!samples.length) return 0
  if (t <= samples[0].t) return samples[0].y
  for (let i = 1; i < samples.length; i++) {
    if (t <= samples[i].t) {
      const span = samples[i].t - samples[i - 1].t
      const u = span ? (t - samples[i - 1].t) / span : 0
      return samples[i - 1].y + u * (samples[i].y - samples[i - 1].y)
    }
  }
  return samples[samples.length - 1].y
}

export interface JournalItem {
  id: string
  written: string
  due: string
  area: string
  nature: string
  technique: string
  criterion: string
  score?: '命中' | '部分' | '落空'
}
export function parseJournal(raw: string | undefined): JournalItem[] {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown
    if (!Array.isArray(v)) return []
    const scores = new Set(['命中', '部分', '落空'])
    const out: JournalItem[] = []
    for (const x of v) {
      if (!x || typeof x !== 'object') continue
      const o = x as Partial<JournalItem>
      if (typeof o.due !== 'string' || typeof o.criterion !== 'string') continue
      out.push({
        id: typeof o.id === 'string' ? o.id : `p${out.length}`,
        written: typeof o.written === 'string' ? o.written : o.due,
        due: o.due,
        area: typeof o.area === 'string' ? o.area : '',
        nature: typeof o.nature === 'string' ? o.nature : '',
        technique: typeof o.technique === 'string' ? o.technique : '',
        criterion: o.criterion,
        score: o.score && scores.has(o.score) ? o.score : undefined,
      })
    }
    return out
  } catch { return [] }
}
export function journalStats(items: { due: string; score?: string }[], today: string) {
  let hit = 0, part = 0, miss = 0, dueOpen = 0, waiting = 0
  for (const it of items) {
    if (it.score === '命中') hit++
    else if (it.score === '部分') part++
    else if (it.score === '落空') miss++
    else if (it.due <= today) dueOpen++
    else waiting++
  }
  return { hit, part, miss, dueOpen, waiting, scored: hit + part + miss }
}

/* ───────── 异步缓存 ───────── */
const mem = new Map<string, unknown>()
interface Pack<T> { key: string | null; scope: string; data: T | null; pending: boolean; failed: boolean }
function useAsync<T>(key: string | null, load: () => Promise<T>, scope = ''): { data: T | null; pending: boolean; failed: boolean } {
  const loadRef = useRef(load)
  loadRef.current = load
  const [pack, setPack] = useState<Pack<T>>({ key: null, scope: '', data: null, pending: false, failed: false })
  useEffect(() => {
    if (!key) { setPack({ key: null, scope, data: null, pending: false, failed: false }); return }
    if (mem.has(key)) { setPack({ key, scope, data: mem.get(key) as T, pending: false, failed: false }); return }
    let on = true
    setPack((prev) => ({ key, scope, data: prev.scope === scope ? prev.data : null, pending: true, failed: false }))
    loadRef.current().then(
      (data) => { mem.set(key, data); if (on) setPack({ key, scope, data, pending: false, failed: false }) },
      () => { if (on) setPack((prev) => ({ key, scope, data: prev.scope === scope ? prev.data : null, pending: false, failed: true })) },
    )
    return () => { on = false }
  }, [key, scope])
  if (key && mem.has(key)) return { data: mem.get(key) as T, pending: false, failed: false }
  if (pack.scope !== scope) return { data: null, pending: Boolean(key), failed: false }
  return { data: pack.data, pending: pack.pending || pack.key !== key, failed: pack.failed && pack.key === key }
}
function useDebounced<T>(value: T, ms = 200) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setD(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return d
}
function useSrc(src0?: string) {
  const [src, setSrc] = useState(src0 || 'einstein')
  useEffect(() => { if (src0) setSrc(src0) }, [src0])
  return { src, setSrc, ...useChartOf(src) }
}
function chartKey(c: Chart | null) {
  return c ? `${c.ut.toISOString()}|${c.lat.toFixed(2)}|${c.lon.toFixed(2)}` : ''
}

function Busy({ show, inline = false }: { show: boolean; inline?: boolean }) {
  if (!show) return null
  return inline ? <span style={{ color: GOLD }}>计算中…</span> : <div className="wg-cap">计算中…</div>
}
function Fail({ show }: { show: boolean }) {
  if (!show) return null
  return <div className="wg-cap">这一步没有算完。换一个案例，或稍后再试。</div>
}
function Read({ children }: { children: ReactNode }) {
  return <div className="wg-read"><span>{children}</span></div>
}
function SignMark({ lon }: { lon: number }) {
  const i = signIdx(lon)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
      <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
        <GlyphAt i={i} x={8} y={8} size={14} color={GOLD} width={8} />
      </svg>
      {fmtL(lon)}
    </span>
  )
}

interface Mark { age: number; color: string; lane: number; label: string }
function AgeTimeline({ age, marks, onPick }: { age: number; marks: Mark[]; onPick: (age: number) => void }) {
  const xOf = (a: number) => 36 + (clamp(a, 0, 90) / 90) * 312
  const lanes = [32, 62, 92, 122]
  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - b.left) / b.width) * 360
    onPick(clamp(((x - 36) / 312) * 90, 0, 90))
  }
  return (
    <svg className="wg-svg" viewBox="0 0 360 168" onPointerDown={pick} style={{ touchAction: 'manipulation' }}>
      {['木', '土', '天', '事'].map((name, i) => <text key={name} x={8} y={lanes[i] + 4} fontSize={12} fill={MUTED}>{name}</text>)}
      {lanes.map((y) => <line key={y} x1={36} y1={y} x2={348} y2={y} stroke={LINE} />)}
      <line x1={36} y1={148} x2={348} y2={148} stroke="rgba(246,241,228,0.35)" />
      {[0, 30, 60, 90].map((a) => <text key={a} x={xOf(a)} y={164} fontSize={10} fill={MUTED} textAnchor="middle">{a}</text>)}
      {marks.map((m, i) => {
        const x = xOf(m.age), y = lanes[m.lane]
        return m.lane === 3
          ? <line key={i} x1={x} y1={y - 8} x2={x} y2={y + 8} stroke={m.color} strokeWidth={2} />
          : <circle key={i} cx={x} cy={y} r={m.lane === 1 ? 5 : 3.5} fill={m.color} />
      })}
      <line x1={xOf(age)} y1={16} x2={xOf(age)} y2={144} stroke={GOLD} strokeWidth={1.2} />
    </svg>
  )
}
function MeanOrbit({ age, period, title, color }: { age: number; period: number; title: string; color: string }) {
  const turns = age / period
  const frac = ((turns % 1) + 1) % 1
  const ang = frac * Math.PI * 2 - Math.PI / 2
  const cx = 66, cy = 52, r = 36
  const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang)
  const near = Math.min(frac, 1 - frac) < 0.035
  return (
    <svg viewBox="0 0 132 128" style={{ width: '46%', height: 'auto' }} aria-label={title}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(246,241,228,0.28)" />
      <circle cx={cx} cy={cy - r} r={3.5} fill="none" stroke={color} />
      <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={1} />
      <circle cx={x} cy={y} r={5} fill={near ? GOLD : color} />
      <text x={cx} y={108} textAnchor="middle" fontSize={13} fill={INK}>{title}</text>
      <text x={cx} y={124} textAnchor="middle" fontSize={10} fill={MUTED}>{`第 ${turns.toFixed(2)} 圈`}</text>
    </svg>
  )
}

function useAge(chart: Chart | null, age0?: number) {
  const [age, setAge] = useState(() => (age0 != null ? clamp(age0, 0, 90) : 30))
  const id = chartKey(chart)
  useEffect(() => {
    if (!chart) return
    if (age0 != null) { setAge(clamp(age0, 0, 90)); return }
    const a = ageAt(chart.ut, new Date())
    if (a >= 0 && a <= 90) setAge(Math.round(a * 10) / 10)
    // 只在换盘时把光标放到当前年龄
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, age0])
  return [age, setAge] as const
}

/* ───────── 人生周期 ───────── */
function LifeCycles({ src: src0, age: age0 }: { src?: string; age?: number }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [age, setAge] = useAge(chart, age0)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setAge((a) => (a + dt * 3 >= 90 ? 0 : a + dt * 3)))
  const scope = chartKey(chart)
  const cyc = useAsync(scope ? `cyc|${scope}` : null, () => loadCycles(chart!), scope)
  const events = chart ? eventsOf(src, chart.ut) : []
  const marks: Mark[] = []
  if (cyc.data) {
    for (const h of cyc.data.jupiter) marks.push({ age: h.age, color: BODY_COLOR.jupiter, lane: 0, label: '木星回归' })
    for (const h of cyc.data.saturn) marks.push({ age: h.age, color: BODY_COLOR.saturn, lane: 1, label: '土星回归' })
    for (const g of cyc.data.uranus) for (const h of g.hits) marks.push({ age: h.age, color: BODY_COLOR.uranus, lane: 2, label: g.short })
  }
  for (const e of events) if (e.age <= 90) marks.push({ age: e.age, color: '#d9734f', lane: 3, label: e.what })
  const nearC = cyc.data ? nearbyCycles(age, cyc.data, 1.2)[0] : undefined
  const nearE = events.filter((e) => Math.abs(e.age - age) <= 1.2).sort((a, b) => Math.abs(a.age - age) - Math.abs(b.age - age))[0]
  return (
    <div className="wg">
      <Note>周期</Note>
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      {!chart && (src !== 'me' || birth) && <Busy show />}
      {chart && <>
        <div className="wg-btns">
          <PlayBtn playing={playing} set={setPlaying} />
          <span className="wg-read" style={{ marginTop: 0 }}><span>{`${age.toFixed(1)} 岁`}</span></span>
        </div>
        <Slider label="年龄" min={0} max={90} step={0.1} value={age} onChange={(v) => { setPlaying(false); setAge(v) }} fmt={(v) => `${v.toFixed(1)} 岁`} />
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
          <MeanOrbit age={age} period={JUPITER_MEAN} title="木星" color={BODY_COLOR.jupiter} />
          <MeanOrbit age={age} period={SATURN_MEAN} title="土星" color={BODY_COLOR.saturn} />
        </div>
        <Read>圆环按平均周期转：木星约 12 年一圈，土星约 29.5 年一圈。圆点回到顶点，就是示意里的一次回归。时间轴上的圆点是星历里的精确时刻，和平均周期会差几天到几个月。</Read>
        <Read>天王星平均约 84 年一圈，所以对分常常在 42 岁前后，两次四分在约 21 岁和约 63 岁。逆行会让同一次相位连过两三回。</Read>
        <AgeTimeline age={age} marks={marks} onPick={(a) => { setPlaying(false); setAge(a) }} />
        <div className="wg-read">
          <span style={{ color: BODY_COLOR.jupiter }}>木 回归</span>
          <span style={{ color: BODY_COLOR.saturn }}>土 回归</span>
          <span style={{ color: BODY_COLOR.uranus }}>天 四分或对分</span>
          <span style={{ color: '#d9734f' }}>事 案例事件</span>
        </div>
        <div className="wg-cap" style={{ textAlign: 'left' }}>
          {`光标 ${age.toFixed(1)} 岁。`}
          {nearC ? ` 附近是${nearC.label}（${nearC.age.toFixed(1)} 岁，${deltaText(nearC.delta)}）。` : ' 一年多以内没有木星回归、土星回归或天王星的四分、对分。'}
          {nearE ? ` 事件：${nearE.what}（${nearE.age.toFixed(1)} 岁）。` : ''}
        </div>
        <Busy show={cyc.pending && !cyc.data} />
        <Busy show={cyc.pending && !!cyc.data} inline />
        <Fail show={cyc.failed && !cyc.data} />
        {cyc.data && <CycleTable cyc={cyc.data} events={events} />}
        <Read>外行星行运是同一代人一起碰上的。它只标出时间，不能单独证明本命盘里有这件事。</Read>
      </>}
    </div>
  )
}
function CycleTable({ cyc, events }: { cyc: Cycles; events: LifeEvent[] }) {
  const blocks: { title: string; color: string; hits: CycleHit[] }[] = [
    ...clusterByAge(cyc.jupiter, 2.2).map((hits) => ({ title: '木星回归', color: BODY_COLOR.jupiter, hits })),
    ...clusterByAge(cyc.saturn, 2.2).map((hits) => ({ title: '土星回归', color: BODY_COLOR.saturn, hits })),
    ...cyc.uranus.flatMap((g) => clusterByAge(g.hits, 2.2).map((hits) => ({ title: g.short, color: BODY_COLOR.uranus, hits }))),
  ]
  blocks.sort((a, b) => a.hits[0].age - b.hits[0].age)
  return (
    <>
      <table className="wg-table">
        <thead><tr><th>周期</th><th>年龄与世界时日期</th></tr></thead>
        <tbody>
          {blocks.map((b, i) => (
            <tr key={i}>
              <td style={{ color: b.color }}>{b.title}{b.hits.length >= 3 ? '，三次过点' : ''}</td>
              <td>{b.hits.map((h) => `${h.age.toFixed(1)} 岁 · ${fmtDate(h.t)}`).join('；')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length > 0 && (
        <table className="wg-table">
          <thead><tr><th>事件</th><th>年龄</th><th>日期</th></tr></thead>
          <tbody>{events.map((e) => <tr key={e.date + e.what}><td>{e.what}<div style={{ color: MUTED }}>{e.kind}</div></td><td>{e.age.toFixed(1)}</td><td>{e.date}</td></tr>)}</tbody>
        </table>
      )}
      {events.length === 0 && <Read>这张盘没有预存的生平事件。周期照样列在上面。</Read>}
    </>
  )
}

/* ───────── 行运表 ───────── */
function TransitList({ src: src0, from, to, months = 3 }: { src?: string; from?: string; to?: string; months?: number }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [today] = useState(() => todayStr())
  const [a, setA] = useState(from ?? today)
  const [b, setB] = useState(to ?? isoAddMonths(from ?? today, months))
  const [day, setDay] = useState(from ?? today)
  const [body, setBody] = useState<'all' | Slow>('all')
  const aD = useDebounced(a, 200)
  const bD = useDebounced(b, 200)
  const dayD = useDebounced(day, 200)
  const scope = chartKey(chart)
  const spanOk = isoSpan(aD, bD) > 0
  const list = useAsync(
    chart && spanOk ? `tr|${scope}|${aD}|${bD}` : null,
    () => transitWindow(chart!, parseDay(aD, 0)!, parseDay(bD, 23)!),
    scope,
  )
  const sky = useAsync(
    dayD ? `sky|${dayD}` : null,
    () => positionsAt(parseNoon(dayD), SLOW),
    'sky',
  )
  useEffect(() => {
    if (day < a || day > b) setDay(a)
  }, [a, b, day])
  const rows = (list.data?.rows ?? []).filter((r) => body === 'all' || r.body === body)
  const span = Math.max(0, isoSpan(a, b))
  const outer = sky.data ? {
    name: '行运',
    pts: SLOW.map((id) => ({ lon: sky.data![id].lon, label: BODY_SHORT[id], color: BODY_COLOR[id] })),
  } : undefined
  return (
    <div className="wg">
      <Note>行运</Note>
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
        <label style={{ fontSize: 12, color: MUTED }}>开始<input type="date" value={a} onChange={(e) => setA(e.target.value)} style={{ width: '100%', minHeight: 32 }} /></label>
        <label style={{ fontSize: 12, color: MUTED }}>结束<input type="date" value={b} onChange={(e) => setB(e.target.value)} style={{ width: '100%', minHeight: 32 }} /></label>
      </div>
      {!spanOk && <Read>请把开始日期放在结束日期之前。</Read>}
      {list.data?.capped && <Read>窗口已按 24 个月截断，再长的表会把页面卡住。</Read>}
      <Read>日期是世界时。表里是火星到冥王星对本命行星、上升、天顶的精确相位。</Read>
      <Busy show={list.pending && !list.data} />
      <Fail show={list.failed && !list.data} />
      {!chart && (src !== 'me' || birth) && <Busy show />}
      {chart && <>
        <Slider label="星盘日期" min={0} max={Math.max(span, 0)} step={1} value={clamp(isoSpan(a, day), 0, Math.max(span, 0))} onChange={(i) => setDay(isoAddDays(a, i))} fmt={() => day} />
        <Busy show={sky.pending && !sky.data} />
        {sky.data && <Wheel c={chart} outer={outer} showAspects={false} />}
        <div className="wg-btns">
          <button type="button" className={`wg-btn ${body === 'all' ? 'on' : ''}`} style={tap} onClick={() => setBody('all')}>全部</button>
          {SLOW.map((id) => <button type="button" key={id} className={`wg-btn ${body === id ? 'on' : ''}`} style={tap} onClick={() => setBody(id)}>{BODY_NAME[id]}</button>)}
        </div>
        {list.pending && list.data && <div className="wg-cap">计算中…</div>}
        {list.data && <div style={{ maxHeight: 280, overflow: 'auto' }}>
          <table className="wg-table">
            <thead><tr><th>世界时</th><th>行运</th><th>相位</th><th>本命</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const on = Math.abs(isoSpan(fmtDate(r.t), day)) <= 2
                return (
                  <tr key={i} style={on ? { background: 'rgba(194,160,90,0.16)' } : undefined}>
                    <td>{fmtDate(r.t)}</td>
                    <td style={{ color: BODY_COLOR[r.body] }}>{BODY_NAME[r.body]}</td>
                    <td>{ASP_CN[r.aspect]}</td>
                    <td>{r.target === 'asc' ? '上升' : r.target === 'mc' ? '天顶' : BODY_NAME[r.target]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && !list.pending && <Read>这个窗口里没有符合条件的精确相位。</Read>}
        </div>}
        {list.data && <Read>{`共 ${rows.length} 次。外圈是 ${dayD} 世界时中午的行运行星，金底的行是离所选日期两天以内的相位。`}</Read>}
      </>}
    </div>
  )
}
function parseNoon(iso: string) {
  return parseDay(iso, 12) ?? new Date()
}

/* ───────── 三次过点 ───────── */
function targetSeed(raw: unknown): { mode: 'auto' | 'natal' | 'deg'; natalId: Body; deg: string } {
  if (typeof raw === 'number' && Number.isFinite(raw)) return { mode: 'deg', natalId: 'sun', deg: String(raw) }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if ((BODIES as string[]).includes(t)) return { mode: 'natal', natalId: t as Body, deg: '' }
    const named = BODIES.find((b) => BODY_NAME[b] === t)
    if (named) return { mode: 'natal', natalId: named, deg: '' }
    if (t !== '' && t !== 'auto' && Number.isFinite(Number(t))) return { mode: 'deg', natalId: 'sun', deg: t }
  }
  return { mode: 'auto', natalId: 'sun', deg: '' }
}
function TriplePass({ src: src0, body: body0 = 'saturn', target }: { src?: string; body?: string; target?: unknown }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [from] = useState(() => new Date())
  const seed = targetSeed(target)
  const initial = (SLOW as string[]).includes(body0) ? body0 as Slow : 'saturn'
  const [body, setBody] = useState<Slow>(initial)
  const [mode, setMode] = useState(seed.mode)
  const [natalId, setNatalId] = useState<Body>(seed.natalId)
  const [degText, setDegText] = useState(seed.deg)
  const degD = useDebounced(degText, 200)
  const [playing, setPlaying] = usePlaying(false)
  const degLon = degD.trim() === '' || !Number.isFinite(Number(degD)) ? null : norm(Number(degD))
  const natalLon = chart
    ? (seed.mode !== 'auto' && mode === seed.mode && natalId === seed.natalId && degText === seed.deg
      ? resolveTarget(chart, target)
      : null)
    : null
  const targetLon = mode === 'auto' ? null : mode === 'deg' ? degLon : (natalLon ?? (chart ? chart.pos[natalId].lon : null))
  const scope = chartKey(chart)
  const waitingDeg = mode === 'deg' && degLon == null
  const key = chart && !waitingDeg ? `tri|${scope}|${body}|${targetLon == null ? 'auto' : targetLon.toFixed(3)}|${fmtDate(from)}` : null
  const model = useAsync(key, () => findTripleWindow(body, from, targetLon), key ?? '')
  return (
    <div className="wg">
      <Note>过点</Note>
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      <Btns<Slow> items={SLOW.map((id) => [id, BODY_NAME[id]])} value={body} onChange={(v) => { setPlaying(false); setBody(v) }} />
      <Btns items={[['auto', '自动找三次'], ['natal', '对本命行星'], ['deg', '指定黄经']]} value={mode} onChange={setMode} />
      {mode === 'natal' && (
        <select value={natalId} onChange={(e) => setNatalId(e.target.value as Body)} style={{ marginTop: 8, minHeight: 32 }}>
          {BODIES.filter((b) => b !== 'node').map((b) => <option key={b} value={b}>{BODY_NAME[b]}</option>)}
        </select>
      )}
      {mode === 'deg' && (
        <div className="wg-row">
          <label>黄经</label>
          <input value={degText} inputMode="decimal" placeholder="0 到 360" onChange={(e) => setDegText(e.target.value)} style={{ flex: 1, minHeight: 32 }} />
        </div>
      )}
      <Read>外行星每年逆行一次。落在逆行圈里的度数会被顺行、逆行、再顺行连过三次；圈外的度数只过一次。默认从今天起找下一次真实的三次过点。</Read>
      {!chart && (src !== 'me' || birth) && <Busy show />}
      <Busy show={model.pending && !model.data} />
      <Fail show={model.failed && !model.data} />
      {model.data === null && !model.pending && key && <Read>这段时间里没有找到三次过点。可以换一颗行星，或指定一个黄经。</Read>}
      {model.data && <TripleGraph model={model.data} body={body} playing={playing} setPlaying={setPlaying} />}
    </div>
  )
}
function TripleGraph({ model, body, playing, setPlaying }: { model: TripleModel; body: Slow; playing: boolean; setPlaying: (v: boolean) => void }) {
  const [u, setU] = useState(0)
  useLoop(playing, (dt) => setU((v) => (v + dt / 14) % 1))
  useEffect(() => { setU(0); setPlaying(false) }, [model.t1, model.target, setPlaying])
  const ys = model.samples.map((s) => s.y)
  const targetY = alignDeg(model.target, ys)
  const all = [...ys, targetY, ...model.stations.map((s) => s.y)]
  let min = Math.min(...all), max = Math.max(...all)
  const pad = Math.max(0.8, (max - min) * 0.14)
  min -= pad; max += pad
  const L = 28, T = 22, W = 316, H = 148
  const xOf = (t: number) => L + ((t - model.t1) / (model.t2 - model.t1)) * W
  const yOf = (y: number) => T + ((max - y) / (max - min)) * H
  const pts = model.samples.map((s) => `${xOf(s.t).toFixed(1)},${yOf(s.y).toFixed(1)}`).join(' ')
  const t = model.t1 + u * (model.t2 - model.t1)
  const y = yAt(model.samples, t)
  const ahead = yAt(model.samples, t + 8 * DAY)
  const direct = ahead >= y
  return (
    <>
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <svg className="wg-svg" viewBox="0 0 360 210">
        <rect x={0} y={0} width={360} height={210} fill="#101528" rx={8} />
        <line x1={L} y1={yOf(targetY)} x2={L + W} y2={yOf(targetY)} stroke={GOLD} strokeDasharray="4 3" />
        <text x={L} y={yOf(targetY) - 4} fontSize={10} fill={GOLD}>目标</text>
        <polyline points={pts} fill="none" stroke={BODY_COLOR[body]} strokeWidth={2} />
        {model.stations.map((s, i) => (
          <g key={i}>
            <rect x={xOf(s.t) - 3.5} y={yOf(s.y) - 3.5} width={7} height={7} fill="#d9734f" transform={`rotate(45 ${xOf(s.t)} ${yOf(s.y)})`} />
            <text x={xOf(s.t)} y={14} textAnchor="middle" fontSize={10} fill="#d9734f">{s.kind}</text>
          </g>
        ))}
        {model.crossings.map((c, i) => (
          <g key={i}>
            <circle cx={xOf(c.t)} cy={yOf(targetY)} r={4} fill={INK} />
            <text x={xOf(c.t)} y={yOf(targetY) - 8} textAnchor="middle" fontSize={11} fill={INK}>{i + 1}</text>
          </g>
        ))}
        <circle cx={xOf(t)} cy={yOf(y)} r={6} fill={direct ? BODY_COLOR[body] : '#d9734f'} stroke={INK} />
        <text x={L} y={206} fontSize={10} fill={MUTED}>{fmtDate(new Date(model.t1))}</text>
        <text x={L + W} y={206} fontSize={10} fill={MUTED} textAnchor="end">{fmtDate(new Date(model.t2))}</text>
      </svg>
      <div className="wg-cap">
        {BODY_NAME[body]}{direct ? '顺行' : '逆行'} · {fmtDate(new Date(t))} · <SignMark lon={norm(y)} />
      </div>
      <Read>
        {`目标 ${fmtL(model.target)}。这个约 18 个月的窗口里经过 ${model.crossings.length} 次`}
        {model.crossings.length >= 3 ? '，是一次三次过点：前进、后退、再前进。' : '。这一次没有落在逆行圈里面，所以不是三次。'}
      </Read>
      <table className="wg-table">
        <thead><tr><th>次序</th><th>世界时</th><th>方向</th></tr></thead>
        <tbody>{model.crossings.map((c, i) => <tr key={i}><td>第 {i + 1} 次</td><td>{fmtDate(new Date(c.t))}</td><td>{c.direct ? '顺行经过' : '逆行经过'}</td></tr>)}</tbody>
      </table>
      {model.stations.length > 0 && (
        <table className="wg-table">
          <thead><tr><th>留驻</th><th>世界时</th><th>黄经</th></tr></thead>
          <tbody>{model.stations.map((s, i) => <tr key={i}><td>{s.kind}</td><td>{fmtDate(new Date(s.t))}</td><td><SignMark lon={norm(s.y)} /></td></tr>)}</tbody>
        </table>
      )}
    </>
  )
}

/* ───────── 月运落宫 ───────── */
function LunationHouses({ src: src0, months: months0 = 6, eclipses: eclipse0 = false }: { src?: string; months?: number; eclipses?: boolean }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [from] = useState(() => new Date())
  const [months, setMonths] = useState(clamp(months0 || 6, 1, 36))
  const [mode, setMode] = useState<'moon' | 'eclipse'>(eclipse0 ? 'eclipse' : 'moon')
  const monthsD = useDebounced(months, 200)
  const day = fmtDate(from)
  const lunKey = `lun|${mode}|${monthsD}|${day}`
  const sky = useAsync(
    lunKey,
    () => {
      const t2 = new Date(from.getTime() + monthsD * 30.436875 * DAY)
      return mode === 'eclipse' ? eclipses(from, t2) : lunations(from, t2)
    },
    lunKey,
  )
  const rows = useMemo(() => {
    if (!sky.data || !chart) return []
    return sky.data.map((e) => ({ ...e, house: wholeHouse(e.lon, chart.asc) }))
  }, [sky.data, chart])
  const counts = Array.from({ length: 12 }, (_, i) => rows.filter((r) => r.house === i + 1).length)
  return (
    <div className="wg">
      <Note>月运</Note>
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      <Btns items={[['moon', '新月与满月'], ['eclipse', '日月食']]} value={mode} onChange={setMode} />
      <Slider label="向前" min={1} max={36} step={1} value={months} onChange={setMonths} fmt={(v) => `${v} 个月`} />
      <Read>{mode === 'moon'
        ? '新月和满月是真实天象。这里用整宫：看它的星座从本命上升数起是第几宫。换成象限宫，同一个度数有时会落进另一宫。'
        : '日月食是靠近交点的朔望。宫位仍按本命整宫来数。食比普通的新月、满月少，月数太短时列表可能是空的。'}</Read>
      <Busy show={sky.pending && !sky.data} />
      <Fail show={sky.failed && !sky.data} />
      {!chart && (src !== 'me' || birth) && <Busy show />}
      {chart && sky.data && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4, marginTop: 8 }}>
          {counts.map((n, i) => (
            <div key={i} style={{ minHeight: 32, textAlign: 'center', borderRadius: 8, padding: '4px 0', fontSize: 12, lineHeight: 1.25, border: `1px solid ${LINE}`, background: n ? 'rgba(194,160,90,0.22)' : 'transparent' }}>
              <div>{i + 1}宫</div>
              <div>{n ? `${n}次` : '0'}</div>
            </div>
          ))}
        </div>
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          <table className="wg-table">
            <thead><tr><th>世界时</th><th>种类</th><th>黄经</th><th>整宫</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{fmtDate(r.t)}</td>
                  <td>{r.kind}</td>
                  <td><SignMark lon={r.lon} /></td>
                  <td>第 {r.house} 宫 · {ANGULARITY(r.house)}<div style={{ color: MUTED }}>{HOUSE_TOPICS[r.house - 1]}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Read>这段时间里没有{mode === 'eclipse' ? '日月食' : '新月或满月'}。可以把月数加大。</Read>}
      </>}
    </div>
  )
}

/* ───────── 太阳回归 ───────── */
function SolarReturnW({ src: src0, year: year0 }: { src?: string; year?: number }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [year, setYear] = useState(() => year0 ?? new Date().getUTCFullYear())
  const [where, setWhere] = useState<'birth' | 'city'>('birth')
  const [city, setCity] = useState(PLACES[0].name)
  const [showNatal, setShowNatal] = useState(true)
  const id = chartKey(chart)
  useEffect(() => {
    if (!chart || year0 != null) return
    const born = chart.ut.getUTCFullYear()
    const nowY = new Date().getUTCFullYear()
    setYear(nowY > born + 100 ? born + 30 : Math.max(nowY, born))
  }, [id, year0, chart])
  const place = where === 'city' ? (PLACES.find((p) => p.name === city) ?? PLACES[0]) : null
  const lat = place ? place.lat : chart?.lat
  const lon = place ? place.lon : chart?.lon
  const scope = chart ? `${chartKey(chart)}|${year}|${lat?.toFixed(2)}|${lon?.toFixed(2)}` : ''
  const sr = useAsync(
    chart && lat != null && lon != null ? `sr|${scope}` : null,
    () => solarReturn(chart!, year, lat, lon),
    scope || 'sr',
  )
  const born = chart?.ut.getUTCFullYear()
  return (
    <div className="wg">
      <Note>回归</Note>
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      {chart && <>
        <div className="wg-btns">
          <button type="button" className="wg-btn" style={tap} onClick={() => setYear((y) => Math.max(born ?? y, y - 1))}>上一年</button>
          <input type="number" value={year} min={born ?? 1} max={(born ?? year) + 120} onChange={(e) => setYear(Number(e.target.value) || year)} style={{ width: 88, minHeight: 32 }} />
          <button type="button" className="wg-btn" style={tap} onClick={() => setYear((y) => Math.min((born ?? y) + 120, y + 1))}>下一年</button>
        </div>
        <Btns items={[['birth', '出生地'], ['city', '自选城市']]} value={where} onChange={setWhere} />
        {where === 'city' && (
          <select value={city} onChange={(e) => setCity(e.target.value)} style={{ marginTop: 8, minHeight: 32 }}>
            {PLACES.map((p) => <option key={p.name}>{p.name}</option>)}
          </select>
        )}
        <Read>太阳回到本命同一黄经的时刻，全世界是同一个瞬间。地点改变的是地平线：上升、天顶和宫位会变。用出生地还是用那一年人在的城市，两派都有人坚持。</Read>
        <Busy show={sr.pending && !sr.data} />
        <Fail show={sr.failed} />
        {sr.data === null && !sr.pending && <Read>这一年没有找到太阳回归。换一年试试。</Read>}
        {sr.data && birth && <ReturnBody natal={chart} sr={sr.data} birth={birth} city={place} showNatal={showNatal} setShowNatal={setShowNatal} />}
      </>}
      {!chart && (src !== 'me' || birth) && <Busy show />}
    </div>
  )
}
function ReturnBody({ natal, sr, birth, city, showNatal, setShowNatal }: {
  natal: Chart; sr: Chart; birth: Birth; city: { name: string; tz: number } | null; showNatal: boolean; setShowNatal: (v: boolean) => void
}) {
  const ut = fmtWhen(sr.ut, 0)
  const local = fmtWhen(sr.ut, birth.tz)
  const cityClock = city ? fmtWhen(sr.ut, city.tz) : null
  const h = wholeHouse(sr.asc, natal.asc)
  const hm = wholeHouse(sr.mc, natal.asc)
  const sunGap = sep(sr.pos.sun.lon, natal.pos.sun.lon) * 60
  const houses = BODIES.filter((b) => b !== 'node' && [1, 4, 7, 10].includes(wholeHouse(sr.pos[b].lon, sr.asc)))
  const angles: [string, number][] = [['上升', sr.asc], ['天顶', sr.mc], ['下降', norm(sr.asc + 180)], ['天底', norm(sr.mc + 180)]]
  const close: string[] = []
  for (const b of BODIES) {
    if (b === 'node') continue
    let best: { name: string; orb: number } | null = null
    for (const [name, lon] of angles) {
      const orb = sep(sr.pos[b].lon, lon)
      if (orb <= 8 && (!best || orb < best.orb)) best = { name, orb }
    }
    if (best) close.push(`${BODY_NAME[b]}合${best.name}（${best.orb.toFixed(1)}°）`)
  }
  const outer = showNatal ? {
    pts: [
      { lon: natal.pos.sun.lon, label: '日', color: BODY_COLOR.sun },
      { lon: natal.pos.moon.lon, label: '月', color: BODY_COLOR.moon },
      { lon: natal.asc, label: '升', color: INK },
      { lon: natal.mc, label: '顶', color: INK },
    ],
  } : undefined
  return (
    <>
      <div className="wg-cap" style={{ textAlign: 'left' }}>{`回归时 ${ageAt(natal.ut, sr.ut).toFixed(1)} 岁`}</div>
      <Read>世界时：{ut.clock}</Read>
      <Read>出生地钟面（{local.zone}）：{local.clock}</Read>
      {cityClock && city && <Read>{city.name}的钟表（{cityClock.zone}）：{cityClock.clock}</Read>}
      <Read>回归太阳 <SignMark lon={sr.pos.sun.lon} />，与本命太阳相差 {sunGap.toFixed(1)} 角分。</Read>
      <Read>回归上升在 {SIGN_CN[signIdx(sr.asc) - 1]}，是本命第 {h} 宫（{HOUSE_TOPICS[h - 1]}）。回归天顶在 {SIGN_CN[signIdx(sr.mc) - 1]}，是本命第 {hm} 宫。</Read>
      <Wheel c={sr} outer={outer} showAspects={false} />
      <div className="wg-btns">
        <button type="button" className={`wg-btn ${showNatal ? 'on' : ''}`} style={tap} onClick={() => setShowNatal(!showNatal)}>{showNatal ? '外圈是本命日月与四轴' : '显示本命对照'}</button>
      </div>
      <Read>起盘地点：{city ? `${city.name}` : (birth.place || '出生地')}（{sr.lat.toFixed(1)}°, {sr.lon.toFixed(1)}°）。</Read>
      <Read>整宫角宫（1、4、7、10）里的行星：{houses.length ? houses.map((b) => BODY_NAME[b]).join('、') : '没有'}。</Read>
      <Read>与四轴合相在 8° 以内：{close.length ? close.join('、') : '没有'}。</Read>
    </>
  )
}

/* ───────── 次限推运 ───────── */
function Progressions({ src: src0, age: age0 }: { src?: string; age?: number }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [age, setAge] = useAge(chart, age0)
  const [angles, setAngles] = useState<'solarArc' | 'naibod'>('solarArc')
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setAge((a) => (a + dt * 2 >= 90 ? 0 : a + dt * 2)))
  const ageD = useDebounced(age, 200)
  const scope = chartKey(chart)
  const sky = useAsync(
    scope ? `pg|${scope}|${ageD.toFixed(2)}|${angles}` : null,
    () => progressed(chart!, ageD, angles).then((r) => ({ age: ageD, ...r })),
    scope,
  )
  const ing = useAsync(scope ? `ing|${scope}` : null, () => moonIngresses(chart!.ut), scope)
  const startSign = chart ? signIdx(chart.pos.moon.lon) : 1
  const at = ing.data && sky.data ? moonSignAt(startSign, ing.data, sky.data.age) : null
  const phase = sky.data ? phaseOf(sky.data.pos.sun.lon, sky.data.pos.moon.lon) : null
  const loopYears = useMemo(() => {
    const rows = ing.data
    if (!rows || rows.length < 13) return null
    const spans: number[] = []
    for (let i = 12; i < rows.length; i++) spans.push(rows[i].age - rows[i - 12].age)
    return spans.reduce((s, x) => s + x, 0) / spans.length
  }, [ing.data])
  return (
    <div className="wg">
      <Note>约定</Note>
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      {!chart && (src !== 'me' || birth) && <Busy show />}
      {chart && <>
        <DayYear age={age} playing={playing} />
        <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
        <Slider label="年龄" min={0} max={90} step={0.1} value={age} onChange={(v) => { setPlaying(false); setAge(v) }} fmt={(v) => `${v.toFixed(1)} 岁`} />
        <Read>次限是约定：出生后第 N 天的真实天空，用来代表第 N 岁。它不是那一岁天上的样子。推运月亮大约一年走 12° 到 13°，约 2.5 年换一个星座，约 27 到 28 年一圈。</Read>
        <Btns items={[['solarArc', '四轴：太阳弧'], ['naibod', '四轴：奈伯德']]} value={angles} onChange={setAngles} />
        <Read>四轴怎么推，各家不同。太阳和月亮不受这个开关影响。这里没有做「实际恒星时」那一派。</Read>
        <Busy show={sky.pending && !sky.data} />
        <Fail show={sky.failed && !sky.data} />
        {sky.data && phase && <>
          {sky.pending && <div className="wg-cap">计算中…</div>}
          <Read>取的是出生后第 {sky.data.age.toFixed(1)} 天，也就是世界时 {fmtDate(sky.data.date)} 的天空，用来代表 {sky.data.age.toFixed(1)} 岁。</Read>
          <table className="wg-table">
            <thead><tr><th></th><th>黄经</th></tr></thead>
            <tbody>
              <tr><td>推运太阳</td><td><SignMark lon={sky.data.pos.sun.lon} /></td></tr>
              <tr><td>推运月亮</td><td><SignMark lon={sky.data.pos.moon.lon} /></td></tr>
              <tr><td>推运上升</td><td><SignMark lon={sky.data.asc} /></td></tr>
              <tr><td>推运天顶</td><td><SignMark lon={sky.data.mc} /></td></tr>
            </tbody>
          </table>
          {at && (
            <Read>
              推运月亮在{SIGN_CN[at.sign - 1]}
              {at.next ? `，约 ${at.next.age.toFixed(1)} 岁进入${SIGN_CN[at.next.sign - 1]}。` : '，90 岁前不再换座。'}
              {loopYears ? ` 这张盘上它走完一圈大约 ${loopYears.toFixed(1)} 年。` : ''}
            </Read>
          )}
          <PhaseRow elong={phase.elong} name={phase.name} hint={phase.hint} />
          <Read>推运月亮比推运太阳大约每天快 12°，所以大约 30 岁才会再合相一次。这是鲁德海雅用来分段的月相周期，仍然是约定。</Read>
          <details>
            <summary className="wg-read" style={{ cursor: 'pointer' }}><span>推运月亮换座（0 到 90 岁）</span></summary>
            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              <table className="wg-table">
                <thead><tr><th>年龄</th><th>进入</th></tr></thead>
                <tbody>
                  {(ing.data ?? []).map((g, i) => {
                    const on = at && g.age === at.since
                    return <tr key={i} style={on ? { background: 'rgba(194,160,90,0.16)' } : undefined}><td>{g.age.toFixed(1)} 岁，出生后第 {g.age.toFixed(1)} 天</td><td>{SIGN_CN[g.sign - 1]}</td></tr>
                  })}
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary className="wg-read" style={{ cursor: 'pointer' }}><span>其他推运行星</span></summary>
            <table className="wg-table">
              <tbody>
                {BODIES.filter((b) => b !== 'sun' && b !== 'moon').map((b) => (
                  <tr key={b}><td>{BODY_NAME[b]}{sky.data!.pos[b].retro && b !== 'node' ? '（逆）' : ''}</td><td><SignMark lon={sky.data!.pos[b].lon} /></td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </>}
        <Busy show={ing.pending && !ing.data} />
      </>}
    </div>
  )
}
function DayYear({ age, playing }: { age: number; playing: boolean }) {
  const [m, setM] = useState(1)
  useLoop(playing, (dt) => setM((v) => (v + dt * 0.45 > 1 ? 0 : v + dt * 0.45)))
  const w = playing ? 36 + m * 208 : 244
  const label = playing && m < 0.45 ? '1 天' : '1 年'
  return (
    <svg className="wg-svg" viewBox="0 0 360 86">
      <rect x={16} y={12} width={36} height={28} rx={6} fill="none" stroke="#e2b34f" />
      <text x={34} y={31} textAnchor="middle" fontSize={12} fill={INK}>1 天</text>
      <line x1={56} y1={26} x2={92} y2={26} stroke={GOLD} />
      <text x={74} y={18} textAnchor="middle" fontSize={10} fill={GOLD}>约定</text>
      <rect x={96} y={12} width={w} height={28} rx={6} fill="rgba(194,160,90,0.16)" stroke={GOLD} />
      <text x={96 + w / 2} y={31} textAnchor="middle" fontSize={12} fill={INK}>{label}</text>
      <text x={180} y={68} textAnchor="middle" fontSize={14} fill={INK}>{`出生后第 ${age.toFixed(1)} 天 = ${age.toFixed(1)} 岁`}</text>
    </svg>
  )
}
function PhaseRow({ elong, name, hint }: { elong: number; name: string; hint: string }) {
  const cx = 28, cy = 28, r = 18
  const ang = (elong - 90) * Math.PI / 180
  const mx = cx + r * Math.cos(ang), my = cy + r * Math.sin(ang)
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
      <svg width={56} height={56} viewBox="0 0 56 56" aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={LINE} />
        <circle cx={cx - r} cy={cy} r={5} fill="#e2b34f" />
        <circle cx={mx} cy={my} r={4} fill="#dcd6c6" />
      </svg>
      <div>
        <div style={{ color: GOLD }}>{name}</div>
        <div style={{ color: MUTED, fontSize: 13 }}>日月距角 {elong.toFixed(0)}°。{hint}</div>
      </div>
    </div>
  )
}

/* ───────── 太阳弧 ───────── */
function SolarArcW({ src: src0, age: age0 }: { src?: string; age?: number }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [age, setAge] = useAge(chart, age0)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setAge((a) => (a + dt * 2 >= 90 ? 0 : a + dt * 2)))
  const ageD = useDebounced(age, 200)
  const scope = chartKey(chart)
  const arc = useAsync(
    scope ? `sa|${scope}|${ageD.toFixed(2)}` : null,
    () => solarArc(chart!, ageD).then((r) => ({ age: ageD, ...r })),
    scope,
  )
  const shown = arc.data ? norm(arc.data.arc + (age - arc.data.age) * NAIBOD) : null
  const natalMap = useMemo(() => {
    if (!chart) return null
    const n: Record<string, number> = {}
    for (const b of BODIES) if (b !== 'node') n[b] = chart.pos[b].lon
    n.asc = chart.asc
    n.mc = chart.mc
    return n
  }, [chart])
  const hitsNow = arc.data && natalMap ? saHits(
    Object.fromEntries(Object.entries({ ...arc.data.pts, asc: arc.data.asc, mc: arc.data.mc }).filter(([k]) => k !== 'node')),
    natalMap,
    1,
  ) : []
  const self = arc.data ? arcSelfAspect(arc.data.arc) : null
  const echo = arc.data ? arc.data.arc < 1 || arc.data.arc > 359 : false
  return (
    <div className="wg">
      <Note>平移</Note>
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      {!chart && (src !== 'me' || birth) && <Busy show />}
      {chart && <>
        <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
        <Slider label="年龄" min={0} max={90} step={0.1} value={age} onChange={(v) => { setPlaying(false); setAge(v) }} fmt={(v) => `${v.toFixed(1)} 岁`} />
        <Read>太阳弧不是另一张天空。先看次限太阳走了多少度，再让本命每一个点都加上同一段弧。盘的形状不变，只在黄道上平移。</Read>
        <Busy show={arc.pending && !arc.data} />
        <Fail show={arc.failed && !arc.data} />
        {shown != null && natalMap && (
          <>
            {arc.pending && <div className="wg-cap">计算中…</div>}
            <div className="wg-cap">太阳弧 {shown.toFixed(2)}°</div>
            <ArcRing natal={natalMap} arc={shown} />
            <Read>空心点是本命，实心点是加上同一段弧之后。每条线一样长，因为每个点走的度数相同。</Read>
            {echo && <Read>弧还不到 1°，几乎就是本命盘本身，下面不把本命相位算成太阳弧。</Read>}
            {self && !echo && <Read>太阳弧本身接近{self.name}（差 {self.dist.toFixed(2)}°）。这种「每个点同时与自己成相」不列入下表。</Read>}
            {!echo && <HitList hits={hitsNow} age={arc.data!.age} />}
          </>
        )}
      </>}
    </div>
  )
}
function ArcRing({ natal, arc }: { natal: Record<string, number>; arc: number }) {
  const ids = [...BODIES.filter((b) => b !== 'node'), 'asc', 'mc']
  const size = 340, cx = 170, cy = 170, R = 156
  const P = (lon: number, r: number) => wheel(cx, cy, r, lon)
  const directed = ids.map((id) => norm(natal[id] + arc))
  const order = directed.map((lon, i) => ({ i, lon })).sort((a, b) => a.lon - b.lon)
  const nudged = directed.slice()
  const seq = order.map((o) => o.lon)
  for (let k = 1; k < seq.length * 2; k++) {
    const i = k % seq.length
    const prev = (i + seq.length - 1) % seq.length
    if (norm(seq[i] - seq[prev]) < 9) seq[i] = seq[prev] + 9
  }
  order.forEach((o, i) => { nudged[o.i] = seq[i] })
  return (
    <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={R} fill="#101528" stroke="rgba(246,241,228,0.3)" />
      {Array.from({ length: 12 }, (_, k) => {
        const [x1, y1] = P(k * 30, R - 16), [x2, y2] = P(k * 30, R)
        const [gx, gy] = P(k * 30 + 15, R - 9)
        return <g key={k}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(246,241,228,0.25)" /><GlyphAt i={k + 1} x={gx} y={gy} size={12} color={GOLD} width={8} /></g>
      })}
      {ids.map((id, i) => {
        const color = pointColor(id)
        const [x1, y1] = P(natal[id], 78)
        const [x2, y2] = P(directed[i], 108)
        const [lx, ly] = P(nudged[i], 126)
        return (
          <g key={id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={id === 'sun' ? 2.2 : 1} opacity={0.85} />
            <circle cx={x1} cy={y1} r={3} fill="none" stroke={color} />
            <circle cx={x2} cy={y2} r={4.5} fill={color} />
            <text x={lx} y={ly + 3} fontSize={11} fill={color} textAnchor="middle">{pointShort(id)}</text>
          </g>
        )
      })}
    </svg>
  )
}
function HitList({ hits: rows, age }: { hits: SaHit[]; age: number }) {
  const shown = rows.slice(0, 30)
  return (
    <>
      <Read>下表是 {age.toFixed(1)} 岁、容许 1° 以内，太阳弧点与本命行星或四轴的相位。对分上升就是合下降，对分天顶就是合天底，不重复列。</Read>
      {shown.length === 0 && <Read>这一岁 1° 以内没有太阳弧相位。慢慢拖动年龄，进入 1° 时会列出来。</Read>}
      {shown.length > 0 && (
        <div style={{ maxHeight: 260, overflow: 'auto' }}>
          <table className="wg-table">
            <thead><tr><th>太阳弧</th><th>相位</th><th>本命</th><th>容许</th></tr></thead>
            <tbody>
              {shown.map((h, i) => (
                <tr key={i}>
                  <td>{pointName(h.from)}</td>
                  <td>{ASP_CN[h.aspect]}</td>
                  <td>{pointName(h.to)}</td>
                  <td>{h.orb < 1 ? `${Math.round(h.orb * 60)} 角分` : `${h.orb.toFixed(2)}°`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown.length && <Read>还有 {rows.length - shown.length} 条，只显示最紧的 30 条。</Read>}
    </>
  )
}

/* ───────── 预测日记 ───────── */
const AREAS = ['事业', '关系', '财务', '家庭', '健康', '迁移', '学习', '其他']
const TECHNIQUES = ['行运', '月运', '太阳回归', '推运', '太阳弧', '多种对照']
function PredictionJournal() {
  const store = useStore()
  const items = useMemo(() => parseJournal(store.notes[JOURNAL_KEY]), [store.notes])
  const today = todayStr()
  const stats = journalStats(items, today)
  const hitPct = stats.scored ? Math.round((100 * stats.hit) / stats.scored) : 0
  const [due, setDue] = useState('')
  const [area, setArea] = useState(AREAS[0])
  const [nature, setNature] = useState('')
  const [technique, setTechnique] = useState(TECHNIQUES[0])
  const [criterion, setCriterion] = useState('')
  const save = (next: JournalItem[]) => setNote(JOURNAL_KEY, JSON.stringify(next))
  const add = () => {
    const c = criterion.trim(), n = nature.trim()
    if (!due || !c || !n) return
    const row: JournalItem = { id: `p${Date.now().toString(36)}`, written: today, due, area, nature: n, technique, criterion: c }
    save([row, ...items])
    setCriterion(''); setNature(''); setDue('')
  }
  const patch = (id: string, score: JournalItem['score']) => save(items.map((it) => it.id === id ? { ...it, score } : it))
  const remove = (id: string) => save(items.filter((it) => it.id !== id))
  return (
    <div className="wg">
      <div className="wg-cap" style={{ textAlign: 'left' }}>预测日记</div>
      {items.length === 0 && (
        <Read>这里不放示例，免得照着例子写。三步：写下可检验的标准，到期揭晓，再做统计。一条记录要让别人判得了对错：哪一天之前、哪个领域、什么性质、用了哪种技术，以及怎样算命中、怎样算落空。</Read>
      )}
      {items.length > 0 && <Read>三步不变：写下可检验的标准，到期揭晓，再做统计。</Read>}
      <Read>已打分 {stats.scored} 条：命中 {stats.hit}，部分 {stats.part}，落空 {stats.miss}。还有 {stats.dueOpen} 条到期未打分，{stats.waiting} 条未到期。{stats.scored > 0 ? `命中占已打分的 ${hitPct}%。` : ''}三项里随便勾一项，命中大约是 33%。这只是很松的对照，说明不了技巧本身。</Read>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, color: MUTED }}>到期日<input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: '100%', minHeight: 32 }} /></label>
        <div className="wg-btns">{AREAS.map((x) => <button type="button" key={x} className={`wg-btn ${area === x ? 'on' : ''}`} style={tap} onClick={() => setArea(x)}>{x}</button>)}</div>
        <input value={nature} placeholder="性质，例如压力变大、有新的开始" onChange={(e) => setNature(e.target.value)} style={{ width: '100%', minHeight: 32, marginTop: 6 }} />
        <div className="wg-btns">{TECHNIQUES.map((x) => <button type="button" key={x} className={`wg-btn ${technique === x ? 'on' : ''}`} style={tap} onClick={() => setTechnique(x)}>{x}</button>)}</div>
        <textarea value={criterion} placeholder="可检验的标准，例如：6 月之前换工作。不要写「事业会有变化」。" onChange={(e) => setCriterion(e.target.value)} style={{ width: '100%', minHeight: 72, marginTop: 6, background: 'var(--night-2)', color: INK, border: `1px solid ${LINE}`, borderRadius: 8, padding: 8 }} />
        <div className="wg-btns">
          <button type="button" className="wg-btn on" style={tap} disabled={!due || !nature.trim() || !criterion.trim()} onClick={add}>写下</button>
          <span className="wg-read" style={{ marginTop: 0 }}><span>写下日期记为今天 {today}</span></span>
        </div>
      </div>
      {items.map((it) => <JournalCard key={it.id} item={it} today={today} onScore={(s) => patch(it.id, s)} onRemove={() => remove(it.id)} />)}
    </div>
  )
}
function JournalCard({ item, today, onScore, onRemove }: { item: JournalItem; today: string; onScore: (s: JournalItem['score']) => void; onRemove: () => void }) {
  const past = item.due <= today
  const [open, setOpen] = useState(false)
  const showBack = past && open
  const reduce = reduceMotion()
  const face = (back: boolean): CSSProperties => ({
    gridArea: '1 / 1',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    transform: back ? (showBack ? 'none' : 'rotateY(180deg)') : (showBack ? 'rotateY(180deg)' : 'none'),
    transition: reduce ? undefined : 'transform .45s',
    pointerEvents: back === showBack ? 'auto' : 'none',
    border: `1px solid ${past && !item.score ? '#d9734f' : LINE}`,
    borderRadius: 12,
    padding: 10,
    background: '#14182a',
  })
  return (
    <div style={{ display: 'grid', marginTop: 8, perspective: reduce ? undefined : 800 }}>
      <div style={face(false)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: MUTED }}>
          <span>{item.written} 写下</span>
          <span>到期 {item.due}</span>
        </div>
        <div style={{ marginTop: 4 }}>{item.area} · {item.technique}</div>
        <div style={{ marginTop: 4 }}>{item.nature}</div>
        <div style={{ marginTop: 4, color: GOLD }}>标准：{item.criterion}</div>
        {item.score && <div style={{ marginTop: 6 }}>已记为{item.score}</div>}
        <div className="wg-btns">
          {past ? <button type="button" className="wg-btn on" style={tap} onClick={() => setOpen(true)}>揭晓</button> : <span className="wg-read" style={{ marginTop: 0 }}><span>未到期，先不要打分</span></span>}
        </div>
      </div>
      <div style={face(true)}>
        <div className="wg-cap" style={{ textAlign: 'left' }}>揭晓</div>
        <Read>{item.criterion}</Read>
        <Read>对照当时写下的标准，而不是对照后来才想起来的解释。</Read>
        <div className="wg-btns">
          {(['命中', '部分', '落空'] as const).map((s) => (
            <button type="button" key={s} className={`wg-btn ${item.score === s ? 'on' : ''}`} style={tap} onClick={() => onScore(s)}>{s}</button>
          ))}
        </div>
        <div className="wg-btns">
          <button type="button" className="wg-btn" style={tap} onClick={() => setOpen(false)}>翻回去</button>
          <button type="button" className="wg-btn" style={tap} onClick={onRemove}>删除</button>
        </div>
      </div>
    </div>
  )
}

/* ───────── 回溯，不是证据 ───────── */
const banner: CSSProperties = {
  border: '1px solid #d9734f',
  background: 'rgba(217,115,79,0.16)',
  color: INK,
  borderRadius: 10,
  padding: '10px 12px',
  fontWeight: 700,
  textAlign: 'center',
}
function TimelineBack({ src: src0 }: { src?: string }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [age, setAge] = useAge(chart)
  const scope = chartKey(chart)
  const cyc = useAsync(scope ? `cyc|${scope}` : null, () => loadCycles(chart!), scope)
  const events = chart ? eventsOf(src, chart.ut) : []
  const marks: Mark[] = []
  if (cyc.data) {
    for (const h of cyc.data.jupiter) marks.push({ age: h.age, color: BODY_COLOR.jupiter, lane: 0, label: '木星回归' })
    for (const h of cyc.data.saturn) marks.push({ age: h.age, color: BODY_COLOR.saturn, lane: 1, label: '土星回归' })
    for (const g of cyc.data.uranus) for (const h of g.hits) marks.push({ age: h.age, color: BODY_COLOR.uranus, lane: 2, label: g.short })
  }
  for (const e of events) if (e.age <= 90) marks.push({ age: e.age, color: '#d9734f', lane: 3, label: e.what })
  return (
    <div className="wg">
      <div style={banner}>这是回溯，不是证据</div>
      <div className="wg-btns"><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      <Read>先知道发生了什么，再往时间轴上找周期，几乎总能对上一个。知道结果以后找证据，找得着并不说明当初预测得准。下面只帮助回忆。</Read>
      {!chart && (src !== 'me' || birth) && <Busy show />}
      {chart && <>
        <Slider label="年龄" min={0} max={90} step={0.1} value={age} onChange={setAge} fmt={(v) => `${v.toFixed(1)} 岁`} />
        <Busy show={cyc.pending && !cyc.data} />
        <Fail show={cyc.failed && !cyc.data} />
        {cyc.data && <>
          <AgeTimeline age={age} marks={marks} onPick={setAge} />
          <div className="wg-read">
            <span style={{ color: BODY_COLOR.jupiter }}>木星回归</span>
            <span style={{ color: BODY_COLOR.saturn }}>土星回归</span>
            <span style={{ color: BODY_COLOR.uranus }}>天王星四分或对分</span>
            <span style={{ color: '#d9734f' }}>事件</span>
          </div>
          {events.length === 0 && <Read>我的盘没有预存事件。若把往事对上这些周期，请记住最上面那句话。</Read>}
          {events.map((e) => {
            const near = nearbyCycles(e.age, cyc.data!, 1.5)
            return (
              <div key={e.date + e.what} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', borderTop: `1px solid ${LINE}`, padding: '8px 0' }}>
                <div style={{ flex: '1 1 55%' }}>
                  <div style={{ color: GOLD }}>{e.age.toFixed(1)} 岁 · {e.date}</div>
                  <div>{e.what}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>{e.kind}</div>
                </div>
                <div style={{ flex: '1 1 45%', fontSize: 13 }}>
                  {near.length === 0 && <span style={{ color: MUTED }}>前后一年半里没有木星回归、土星回归或天王星的四分、对分。</span>}
                  {near.map((n, i) => <div key={i}>{n.label} {n.age.toFixed(1)} 岁（{deltaText(n.delta)}）</div>)}
                </div>
              </div>
            )
          })}
        </>}
      </>}
    </div>
  )
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

export const W09: WidgetMap = {
  lifeCycles: (a) => <LifeCycles src={str(a.src)} age={num(a.age)} />,
  transitList: (a) => <TransitList src={str(a.src)} from={str(a.from)} to={str(a.to)} months={num(a.months) ?? 3} />,
  triplePass: (a) => <TriplePass src={str(a.src)} body={str(a.body) ?? 'saturn'} target={a.target} />,
  lunationHouses: (a) => <LunationHouses src={str(a.src)} months={num(a.months) ?? 6} eclipses={a.eclipses === true || a.eclipses === 'true'} />,
  solarReturn: (a) => <SolarReturnW src={str(a.src)} year={num(a.year)} />,
  progressions: (a) => <Progressions src={str(a.src)} age={num(a.age)} />,
  solarArc: (a) => <SolarArcW src={str(a.src)} age={num(a.age)} />,
  predictionJournal: () => <PredictionJournal />,
  timelineBack: (a) => <TimelineBack src={str(a.src)} />,
}
