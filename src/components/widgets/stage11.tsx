// 第 11 阶段：生时校正。滑块只重算上升 / 天顶；行运、太阳弧、本命位置预先算好。
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { reduceMotion, Slider } from './common'
import type { WidgetMap } from './common'
import { CasePicker, fmtL, MyBirthForm, NeedMine, SIGN_CN, useChartOf, Wheel } from './natal'
import { caseById } from '../../data/cases'
import type { CaseEvent } from '../../data/cases'
import { setNote, useStore } from '../../lib/store'
import { ageAt, NAIBOD, profection, solarArc } from '../../lib/timing'
import { ascDiff, ascFrom, BODY_NAME, CLASSICAL, mcFrom, MODERN, norm, positionsAt, sep, signIdx, signRuler, toEq } from '../../lib/natal'
import type { Birth, Body, Chart } from '../../lib/natal'

/** 平太阳时 1 小时对应的恒星时角（度）。RAMC 随之平移。 */
export const RAMC_PER_HOUR = 15.04107
const HOUR_MS = 3600000
const NATAL: Body[] = [...CLASSICAL, ...MODERN]
const OUTERS = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const
type Outer = typeof OUTERS[number]
type EventKind = CaseEvent['kind']
type Cert = '确定' | '大约' | '记不清'
type Method = 'transit' | 'solar' | 'direct' | 'prof'
type Angle = 'asc' | 'mc'
type Hard = 0 | 90 | 180

const METHODS: Method[] = ['transit', 'solar', 'direct', 'prof']
const METHOD_NAME: Record<Method, string> = { transit: '行运', solar: '太阳弧', direct: '主限', prof: '小限' }
const METHOD_SHORT: Record<Method, string> = { transit: '行', solar: '弧', direct: '限', prof: '小' }
const ASP_CN: Record<Hard, string> = { 0: '合', 90: '四分', 180: '对分' }
const ANG_CN: Record<Angle, string> = { asc: '上升', mc: '天顶' }
const KINDS: EventKind[] = ['迁居', '婚恋', '家庭', '事业', '健康', '荣誉', '挫折', '信仰']
const CERTS: Cert[] = ['确定', '大约', '记不清']
const CAUTION = '多种技法叠加时总能找到解释——计分只是练习，不是证明'

/** 事件类型对应的整宫。家庭里的子女出生更接近第 5 宫，这里按类型统一用第 4 宫，规则面板里写明。 */
export const EVENT_HOUSE: Record<EventKind, number> = {
  迁居: 4, 婚恋: 7, 家庭: 4, 事业: 10, 健康: 6, 荣誉: 10, 挫折: 12, 信仰: 9,
}
const HINT: Record<EventKind, { level: '高' | '中' | '低'; text: string }> = {
  迁居: { level: '高', text: '搬家、移民多有具体日子，常用来看第 4 宫和四轴。' },
  婚恋: { level: '高', text: '结婚、离婚通常有证件日期，传统上看第 7 宫。' },
  家庭: { level: '高', text: '父母去世、子女出生最常被引用，日期往往记得住。' },
  事业: { level: '中', text: '就任、离职、开业可用。自己挑的吉日不适合拿来反推出生时间。' },
  健康: { level: '中', text: '急病、手术、受伤日期清楚才用。拖很久的过程不适合。这里不做诊断。' },
  荣誉: { level: '低', text: '获奖、成名常常是一段过程，日期不如突然发生的事变干脆。' },
  挫折: { level: '中', text: '失业、破产、入狱等有明确日子就有用。只是心情低落则不宜。' },
  信仰: { level: '低', text: '受洗、出家等仪式日期可用。内心转变很难定在某一天。' },
}

export interface RectEventIn { date: string; what: string; kind: EventKind }
interface Parts { transit: number; solar: number; direct: number; prof: number }
interface Hit { method: Method; points: number; text: string }
export interface EvScore {
  date: string; what: string; kind: EventKind; age: number
  hits: Hit[]; near: string | null; parts: Parts; total: number
}
export interface ScorePack {
  hours: number; ramc: number; asc: number; mc: number
  events: EvScore[]; parts: Parts; total: number
}
interface PrepEvent {
  date: string; what: string; kind: EventKind; t: number; arc: number
  outers: { body: Outer; lon: number }[]
}
/** 黄道主限的一个促发点：本命行星，或它的四分、对分点。oa 为空表示该纬度永不升落。 */
interface DirPt { body: Body; asp: Hard; ra: number; oa: number | null }
export interface Prep {
  ut: number; ramc: number; eps: number; lat: number
  natal: Record<Body, number>
  dirs: DirPt[]
  events: PrepEvent[]
}
interface UserEvent { id: string; date: string; kind: EventKind; certainty: Cert; note?: string }
interface BlindSave { pick: number; revealed: boolean }

const emptyParts = (): Parts => ({ transit: 0, solar: 0, direct: 0, prof: 0 })
const addParts = (a: Parts, b: Parts) => { for (const m of METHODS) a[m] += b[m] }
const partsTotal = (p: Parts) => METHODS.reduce((s, m) => s + p[m], 0)

export function angDiff(from: number, to: number) {
  let d = norm(to - from)
  if (d > 180) d -= 360
  return d
}
export function anglesOf(base: { ramc: number; eps: number; lat: number }, hours: number) {
  const ramc = norm(base.ramc + hours * RAMC_PER_HOUR)
  return { ramc, asc: ascFrom(ramc, base.eps, base.lat), mc: mcFrom(ramc, base.eps) }
}
export function shiftClock(date: string, time: string, minutes: number) {
  const [y, mo, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const t = new Date(Date.UTC(y, mo - 1, d, hh || 0, (mm || 0) + Math.round(minutes), 0))
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`,
    time: `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`,
  }
}
function fmtMin(min: number) {
  if (Math.round(min) === 0) return '0 分'
  const n = Number.isInteger(min) ? String(min) : min.toFixed(1)
  return `${min > 0 ? '+' : ''}${n} 分`
}
function fix(n: number, d = 2) {
  const v = Math.abs(n) < 5 * 10 ** (-(d + 1)) ? 0 : n
  return v.toFixed(d)
}
function parseDay(date: string): number | null {
  const m = /^(\d{3,4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const t = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null
  return t.getTime()
}
function closestHard(a: number, b: number): { asp: Hard; orb: number } {
  const d = sep(a, b)
  const opts: { asp: Hard; orb: number }[] = [
    { asp: 0, orb: d }, { asp: 90, orb: Math.abs(d - 90) }, { asp: 180, orb: Math.abs(d - 180) },
  ]
  opts.sort((x, y) => x.orb - y.orb)
  return opts[0]
}
function hash32(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mix(x: number) {
  let s = x >>> 0
  s = Math.imul(s ^ (s >>> 16), 0x7feb352d) >>> 0
  s = Math.imul(s ^ (s >>> 15), 0x846ca68b) >>> 0
  return (s ^ (s >>> 16)) >>> 0
}
/**
 * 三个候选：记录时刻，以及两个绝对值在 60–150 分钟的平移。
 * 每个平移的正负由案例 id 哈希的固定比特决定；展示顺序用同一哈希打乱。
 * 不要按钟点排序——两种符号相反时，中间那个总会是记录时刻。
 */
export function blindOffsets(id: string): [number, number, number] {
  const h = hash32(id)
  const mag = (shift: number) => 60 + ((h >>> shift) % 91)
  const bit = (n: number) => ((h >>> n) & 1) === 1 ? 1 : -1
  const a = bit(1) * mag(8)
  let b = bit(4) * mag(17)
  if (b === a) {
    let m = Math.abs(a) + 23
    if (m > 150) m -= 91
    b = bit(4) * m
  }
  const order = [0, a, b]
  const j2 = mix(h) % 3
  const t2 = order[2]; order[2] = order[j2]; order[j2] = t2
  const j1 = mix(h ^ 0x9e3779b9) % 2
  const t1 = order[1]; order[1] = order[j1]; order[j1] = t1
  return [order[0], order[1], order[2]]
}

export async function prepareRectify(c: Chart, events: RectEventIn[]): Promise<Prep> {
  const natal = {} as Record<Body, number>
  for (const b of NATAL) natal[b] = c.pos[b].lon
  const aspectPts: [Hard, 1 | -1][] = [[0, 1], [90, 1], [90, -1], [180, 1]]
  const dirs: DirPt[] = []
  for (const body of NATAL) for (const [asp, sgn] of aspectPts) {
    const lon = norm(c.pos[body].lon + sgn * asp)
    const { ra, dec } = toEq(lon, 0, c.eps)
    const ad = ascDiff(dec, c.lat)
    dirs.push({ body, asp, ra, oa: ad == null ? null : norm(ra - ad) })
  }
  const rows = await Promise.all(events.map(async (ev) => {
    const t = parseDay(ev.date)
    if (t == null) return null
    const when = new Date(t)
    const age = ageAt(c.ut, when)
    const [pos, sa] = await Promise.all([
      positionsAt(when, [...OUTERS]),
      solarArc(c, Math.max(0, age)),
    ])
    const outers = OUTERS.map((body) => ({ body, lon: pos[body].lon }))
    return { date: ev.date, what: ev.what, kind: ev.kind, t, arc: sa.arc, outers }
  }))
  return {
    ut: c.ut.getTime(), ramc: c.ramc, eps: c.eps, lat: c.lat, natal, dirs,
    events: rows.filter((x): x is PrepEvent => x != null),
  }
}

function scoreEvent(prep: Prep, ev: PrepEvent, ang: { asc: number; mc: number; ramc: number }, birth: Date): EvScore {
  const age = ageAt(birth, new Date(ev.t))
  const parts = emptyParts()
  const hits: Hit[] = []
  const near = { rank: 99, text: '' }
  const watch = (rank: number, text: string) => {
    if (rank <= 4 && rank < near.rank) { near.rank = rank; near.text = text }
  }
  if (age < 0) {
    return { date: ev.date, what: ev.what, kind: ev.kind, age, hits, near: '这件事在出生之前，不参与打分。', parts, total: 0 }
  }
  const axes: Angle[] = ['asc', 'mc']
  for (const o of ev.outers) for (const axis of axes) {
    const c = closestHard(o.lon, ang[axis])
    const label = `${BODY_NAME[o.body]}${ASP_CN[c.asp]}${ANG_CN[axis]}`
    if (c.orb <= 2) {
      const points = c.asp === 0 ? 3 : 2
      parts.transit += points
      hits.push({ method: 'transit', points, text: `行运 · ${label}，差 ${fix(c.orb)}°，+${points}` })
    } else watch(c.orb / 2, `未中最近：行运 · ${label}，还差 ${fix(c.orb)}°`)
  }
  for (const b of NATAL) {
    const lon = norm(prep.natal[b] + ev.arc)
    for (const axis of axes) {
      const c = closestHard(lon, ang[axis])
      const label = `${BODY_NAME[b]}${ASP_CN[c.asp]}${ANG_CN[axis]}`
      if (c.orb <= 1) {
        parts.solar += 2
        hits.push({ method: 'solar', points: 2, text: `太阳弧 · ${label}，差 ${fix(c.orb)}°，+2` })
      } else watch(c.orb, `未中最近：太阳弧 · ${label}，还差 ${fix(c.orb)}°`)
    }
  }
  const oaAsc = norm(ang.ramc + 90)
  for (const p of prep.dirs) {
    const checks: [Angle, number][] = [['mc', norm(p.ra - ang.ramc) / NAIBOD]]
    if (p.oa != null) checks.push(['asc', norm(p.oa - oaAsc) / NAIBOD])
    for (const [axis, years] of checks) {
      if (years <= 0.05) continue
      const dy = Math.abs(years - age)
      const how = p.asp === 0 ? '合' : ASP_CN[p.asp]
      const label = `${BODY_NAME[p.body]}${how}${ANG_CN[axis]}`
      if (dy <= 1) {
        parts.direct += 2
        hits.push({ method: 'direct', points: 2, text: `主限 · ${label}，${fix(years, 1)} 岁（事件 ${fix(age, 1)} 岁），+2` })
      } else watch(dy, `未中最近：主限 · ${label} ${fix(years, 1)} 岁，相差 ${fix(dy, 1)} 年`)
    }
  }
  const ascSign = signIdx(ang.asc)
  const prof = profection(ascSign, age)
  const house = EVENT_HOUSE[ev.kind]
  const houseSign = ((ascSign - 1 + house - 1) % 12) + 1
  const lord = signRuler(houseSign)
  if (signIdx(prep.natal[lord]) === prof.sign) {
    parts.prof += 1
    hits.push({
      method: 'prof', points: 1,
      text: `小限 · 在${SIGN_CN[prof.sign - 1]}，年主${BODY_NAME[prof.lord]}；${ev.kind}的第 ${house} 宫主星${BODY_NAME[lord]}落在这一星座，+1`,
    })
  }
  hits.sort((a, b) => METHODS.indexOf(a.method) - METHODS.indexOf(b.method) || b.points - a.points)
  return {
    date: ev.date, what: ev.what, kind: ev.kind, age, hits,
    near: hits.length || near.rank > 4 ? null : near.text,
    parts, total: partsTotal(parts),
  }
}

/** 同步打分：调用前先 prepareRectify。hours 是相对记录时刻的小时。 */
export function scoreOffset(prep: Prep, hours: number): ScorePack {
  const ang = anglesOf(prep, hours)
  const birth = new Date(prep.ut + hours * HOUR_MS)
  const events = prep.events.map((ev) => scoreEvent(prep, ev, ang, birth))
  const parts = emptyParts()
  for (const e of events) addParts(parts, e.parts)
  return { hours, ...ang, events, parts, total: partsTotal(parts) }
}

const prepCache = new Map<string, Promise<Prep>>()
function cachedPrep(c: Chart, events: RectEventIn[], src: string) {
  const key = `${src}|${c.ut.getTime()}|${events.map((e) => e.date + e.kind + e.what).join(',')}`
  let p = prepCache.get(key)
  if (!p) {
    p = prepareRectify(c, events)
    prepCache.set(key, p)
    p.catch(() => prepCache.delete(key))
  }
  return p
}
function usePrep(src: string) {
  const base = useChartOf(src)
  const [prep, setPrep] = useState<Prep | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let ok = true
    setPrep(null)
    setErr('')
    const ev = caseById(src)?.events
    if (!base.chart || !ev?.length) return
    cachedPrep(base.chart, ev, src).then(
      (p) => { if (ok) setPrep(p) },
      () => { if (ok) setErr('星历没有算完。可以先看上升和天顶，分数稍后再出现。') },
    )
    return () => { ok = false }
  }, [base.chart, src])
  return { ...base, prep, err, events: caseById(src)?.events ?? [] }
}
function useSrc(src0: string) {
  const [src, setSrc] = useState(src0)
  useEffect(() => { setSrc(src0) }, [src0])
  return [src, setSrc] as const
}

function Rules() {
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontSize: 14, minHeight: 32, display: 'flex', alignItems: 'center' }}>计分规则</summary>
      <div style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(246,241,228,0.78)' }}>
        <p>四项都是教学用的启发式，用来练习「重大事件往往碰上四轴被触发，再由四轴反推时刻」。</p>
        <ol style={{ paddingLeft: '1.2em', margin: '0.4em 0' }}>
          <li>行运：事件当天的木星、土星、天王星、海王星、冥王星，与候选上升或天顶成合、四分或对分，容许 2°。合相 3 分，四分或对分 2 分。每颗星、每个轴各计一次。对分上升等于合下降，对分天顶等于合天底，所以另外两轴已经算在里面；正好落在下降或天底上，按对分记 2 分。</li>
          <li>太阳弧：出生后再过「与年龄相同的天数」，太阳多走的黄经，加到本命行星上。加完以后若与候选上升或天顶成合、四分或对分，容许 1°，记 2 分。行星和这段弧几乎不随钟点移动，变的是两轴，所以拖动时亮灭跟着轴走。每颗星、每个轴各计一次。北交点不参与。</li>
          <li>主限（奈伯德）：行星沿周日运动被带到上升或天顶，合、四分、对分都算。约 0.9856° 对应 1 年。到达岁数与事件年龄相差不超过 1 年，记 2 分。按黄道上的点，不计黄纬。四分上升和四分下降是同一次，只记上升；合天顶和对分天底也只记天顶。候选时刻只平移天顶的赤经，每小时 {RAMC_PER_HOUR}°，再重算上升和天顶。</li>
          <li>小限：从候选上升星座起，每满一岁前进一个星座。这一年的小限星座里若有该事件宫位的主星（看它的本命落座），记 1 分。迁居、家庭用第 4 宫，婚恋第 7 宫，健康第 6 宫，信仰第 9 宫，事业和荣誉第 10 宫，挫折第 12 宫。家庭里的子女出生更接近第 5 宫，为了能按类型打分，这里仍用第 4 宫。</li>
        </ol>
        <p>外行星黄经、太阳弧和本命行星位置都预先算好。拖动时只重算上升、天顶，以及随上升星座改变的宫主星和小限。月亮每小时大约 0.5°，滑块范围内会稍稍移动，计分仍用记录时刻的月亮。</p>
        <p>{CAUTION}</p>
      </div>
    </details>
  )
}
function Caution() {
  return <div className="wg-read"><span>{CAUTION}</span></div>
}
function riseWord(v: number) {
  if (v >= 1.15) return '快升，比平均更快'
  if (v <= 0.85) return '慢升，比平均更慢'
  return '接近平均'
}

function ScoreCards({ rows }: { rows: EvScore[] }) {
  const ease = reduceMotion() ? undefined : 'background 0.15s, border-color 0.15s'
  return rows.map((r) => {
    const on = r.total > 0
    return (
      <div key={`${r.date}-${r.what}`} style={{
        marginTop: 6, padding: '8px 10px', borderRadius: 10,
        border: `1px solid ${on ? 'rgba(194,160,90,0.85)' : 'rgba(246,241,228,0.12)'}`,
        background: on ? 'rgba(194,160,90,0.14)' : 'transparent',
        opacity: on ? 1 : 0.72, transition: ease,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <div style={{ fontSize: 14, lineHeight: 1.45 }}>{r.what}</div>
          <div style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{on ? `+${r.total}` : '0'}</div>
        </div>
        <div className="wg-read" style={{ marginTop: 2 }}>
          <span>{r.date}</span><span>{r.kind}</span>
          {r.age >= 0 && <span>{fix(r.age, 1)} 岁</span>}
        </div>
        <div className="wg-read" style={{ marginTop: 2 }}>
          {METHODS.map((m) => <span key={m}>{METHOD_NAME[m]} <b>{r.parts[m]}</b></span>)}
        </div>
        {r.hits.map((h, i) => <div key={i} style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 3 }}>{h.text}</div>)}
        {r.hits.length === 0 && r.near && <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 3, color: 'rgba(246,241,228,0.62)' }}>{r.near}</div>}
      </div>
    )
  })
}

function NeedChart({ src, birth, chart }: { src: string; birth: Birth | null; chart: Chart | null }) {
  if (src === 'me' && !birth) return <><NeedMine /><MyBirthForm /></>
  if (!chart) return <div className="wg-cap">正在计算星盘……</div>
  return null
}

/* ───────── ascSpeed ───────── */
function SpeedChart({ series, cursor, cursorV }: { series: { min: number; per4: number }[]; cursor: number; cursorV: number }) {
  const w = 360, h = 148, padL = 28, padR = 10, padT = 16, padB = 22
  const vals = series.map((p) => p.per4)
  const lo = Math.min(0.4, ...vals, cursorV)
  const hi = Math.max(1.8, ...vals, cursorV)
  const span = hi - lo || 1
  const X = (m: number) => padL + ((m + 180) / 360) * (w - padL - padR)
  const Y = (v: number) => padT + (1 - (v - lo) / span) * (h - padT - padB)
  const d = series.map((p, i) => `${i ? 'L' : 'M'}${X(p.min).toFixed(1)} ${Y(p.per4).toFixed(1)}`).join(' ')
  const y1 = Y(1), xc = X(cursor), yc = Y(cursorV)
  return (
    <svg className="wg-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="上升速度曲线">
      <line x1={padL} y1={y1} x2={w - padR} y2={y1} stroke="rgba(246,241,228,0.35)" strokeDasharray="4 3" />
      <text x={w - padR} y={y1 - 4} fontSize="10" fill="rgba(246,241,228,0.55)" textAnchor="end">平均 1°</text>
      <path d={d} fill="none" stroke="#c2a05a" strokeWidth="2" />
      <line x1={xc} y1={padT} x2={xc} y2={h - padB} stroke="#f6f1e4" strokeWidth="1" />
      <circle cx={xc} cy={yc} r="3.5" fill="#c2a05a" />
      <text x={padL} y={h - 4} fontSize="10" fill="rgba(246,241,228,0.45)">-3 小时</text>
      <text x={w - padR} y={h - 4} fontSize="10" fill="rgba(246,241,228,0.45)" textAnchor="end">+3 小时</text>
      <text x={4} y={Y(hi) + 4} fontSize="10" fill="rgba(246,241,228,0.45)">{hi.toFixed(1)}</text>
      <text x={4} y={Y(lo)} fontSize="10" fill="rgba(246,241,228,0.45)">{lo.toFixed(1)}</text>
    </svg>
  )
}
function AscSpeed({ src0 }: { src0: string }) {
  const [src, setSrc] = useSrc(src0)
  const { chart, birth } = useChartOf(src)
  const [min, setMin] = useState(0)
  useEffect(() => { setMin(0) }, [src])
  const series = useMemo(() => {
    if (!chart) return []
    const out: { min: number; per4: number; sign: number }[] = []
    for (let m = -180; m <= 180; m += 3) {
      const h = m / 60
      const a0 = anglesOf(chart, h).asc
      const a1 = anglesOf(chart, h + 4 / 60).asc
      out.push({ min: m, per4: angDiff(a0, a1), sign: signIdx(a0) })
    }
    return out
  }, [chart])
  const bands = useMemo(() => {
    const rows: { sign: number; per4: number; from: number; n: number }[] = []
    for (const p of series) {
      const last = rows[rows.length - 1]
      if (!last || last.sign !== p.sign) rows.push({ sign: p.sign, per4: p.per4, from: p.min, n: 1 })
      else { last.per4 += p.per4; last.n += 1 }
    }
    return rows.map((r) => ({ sign: r.sign, from: r.from, per4: r.per4 / r.n }))
  }, [series])
  const k = caseById(src)
  const gate = <NeedChart src={src} birth={birth} chart={chart} />
  const hours = min / 60
  const ang = chart ? anglesOf(chart, hours) : null
  const per4 = chart && ang ? angDiff(ang.asc, anglesOf(chart, hours + 4 / 60).asc) : 0
  const mc4 = chart && ang ? angDiff(ang.mc, anglesOf(chart, hours + 4 / 60).mc) : 0
  const clock = birth ? shiftClock(birth.date, birth.time, min) : null
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {gate || !chart || !ang || !birth || !clock ? gate : <>
        <Slider label="时刻" min={-180} max={180} step={1} value={min} onChange={setMin} fmt={fmtMin} />
        <div className="wg-read">
          <span>{clock.date === birth.date ? birth.date : clock.date} {clock.time}</span>
          <span>{min === 0 ? '记录时刻' : `相对记录 ${fmtMin(min)}`}</span>
        </div>
        <div className="wg-cap">上升在 <b>{SIGN_CN[signIdx(ang.asc) - 1]}</b>，每 4 分钟 {fix(per4)}°</div>
        <div className="wg-read"><span>上升 <b>{fmtL(ang.asc)}</b></span><span>天顶 <b>{fmtL(ang.mc)}</b></span></div>
        <SpeedChart series={series} cursor={min} cursorV={per4} />
        <div className="wg-read"><span>口诀 <b>4 分钟 ≈ 1°</b> 是上升转满一圈的平均速度（360° ÷ 24 小时）。这一段{riseWord(per4)}，同样 4 分钟走出 {fix(per4)}°。天顶黄经走出 {fix(mc4)}°，它背后的赤经稳定在约 1.00°。</span></div>
        {min !== 0 && <div className="wg-read"><span>相对记录时刻，上升黄经{angDiff(chart.asc, ang.asc) >= 0 ? '增加' : '减少'} {fix(Math.abs(angDiff(chart.asc, ang.asc)), 1)}°，天顶黄经{angDiff(chart.mc, ang.mc) >= 0 ? '增加' : '减少'} {fix(Math.abs(angDiff(chart.mc, ang.mc)), 1)}°。按平均速度，上升大约移动 {(min / 4).toFixed(1)}°。</span></div>}
        <div className="wg-read">
          {bands.map((b) => <span key={b.from}>{b.sign === signIdx(ang.asc) ? <b>{SIGN_CN[b.sign - 1]} {fix(b.per4)}°</b> : <>{SIGN_CN[b.sign - 1]} {fix(b.per4)}°</>}</span>)}
        </div>
        <div className="wg-read"><span>纬度 {chart.lat.toFixed(1)}°。北纬地区摩羯到双子升得快，巨蟹到射手升得慢；南纬相反。{Math.abs(chart.lat) < 8 ? '纬度很低时，各星座的差别会小很多。' : '曲线按这张盘的纬度计算。'}</span></div>
        {k && <div className="wg-read" style={{ fontSize: 11.5 }}><span>{k.birth.place} · {k.birth.date} {k.birth.time} {k.clock}</span></div>}
      </>}
    </div>
  )
}

/* ───────── eventTable ───────── */
function isKind(v: string): v is EventKind { return (KINDS as string[]).includes(v) }
function isCert(v: string): v is Cert { return (CERTS as string[]).includes(v) }
function parseUserEvents(raw: string | undefined): UserEvent[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown
    if (!Array.isArray(v)) return []
    const out: UserEvent[] = []
    for (const item of v) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (typeof o.id !== 'string' || typeof o.date !== 'string') continue
      if (typeof o.kind !== 'string' || !isKind(o.kind)) continue
      if (typeof o.certainty !== 'string' || !isCert(o.certainty)) continue
      const note = typeof o.note === 'string' && o.note.trim() ? o.note.trim().slice(0, 40) : undefined
      out.push({ id: o.id, date: o.date, kind: o.kind, certainty: o.certainty, note })
    }
    return out
  } catch { return [] }
}
function EventTable({ src0 }: { src0: string }) {
  const [src, setSrc] = useSrc(src0)
  const notes = useStore().notes
  const list = useMemo(() => parseUserEvents(notes['rect-events']), [notes])
  const save = (next: UserEvent[]) => setNote('rect-events', JSON.stringify(next))
  const [date, setDate] = useState('')
  const [kind, setKind] = useState<EventKind>('家庭')
  const [cert, setCert] = useState<Cert>('确定')
  const [note, setNoteText] = useState('')
  const k = caseById(src)
  const events = k?.events ?? []
  const add = () => {
    if (!parseDay(date)) return
    const row: UserEvent = { id: Math.random().toString(36).slice(2, 9), date, kind, certainty: cert }
    const t = note.trim().slice(0, 40)
    if (t) row.note = t
    save([...list, row])
    setDate(''); setNoteText('')
  }
  const levelColor = (level: '高' | '中' | '低') => level === '高' ? 'var(--gold)' : level === '中' ? 'var(--star)' : 'rgba(246,241,228,0.45)'
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      <div className="wg-cap" style={{ textAlign: 'left' }}>{k ? `${k.name}的事件` : '案例事件'}</div>
      {events.length === 0 && <div className="wg-read"><span>这个来源没有附带生命事件。下面可以记下自己的。</span></div>}
      {events.length > 0 && (
        <table className="wg-table">
          <thead><tr><th>日期</th><th>事件</th><th>用处</th></tr></thead>
          <tbody>
            {events.map((e) => {
              const h = HINT[e.kind]
              return (
                <tr key={`${e.date}-${e.what}`}>
                  <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>{e.date}</td>
                  <td style={{ verticalAlign: 'top' }}>{e.kind} · {e.what}</td>
                  <td style={{ verticalAlign: 'top' }}>
                    <b style={{ color: levelColor(h.level) }}>{h.level}</b>
                    <div style={{ fontSize: 12, lineHeight: 1.45, color: 'rgba(246,241,228,0.62)' }}>{h.text}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="wg-cap" style={{ textAlign: 'left' }}>我补充的事件</div>
      <div className="wg-read"><span>记在本机，换案例也不会丢。确定程度选「记不清」的，留着备忘，不要拿去卡精确度数。</span></div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="事件日期" />
        <select value={kind} onChange={(e) => { if (isKind(e.target.value)) setKind(e.target.value) }} aria-label="事件类型">
          {KINDS.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <div className="wg-btns" style={{ marginTop: 0 }}>
          {CERTS.map((name) => <button type="button" key={name} className={`wg-btn ${cert === name ? 'on' : ''}`} style={{ minHeight: 32 }} onClick={() => setCert(name)}>{name}</button>)}
        </div>
        <div className="wg-read" style={{ marginTop: 0 }}><span>用处{HINT[kind].level}：{HINT[kind].text}</span></div>
        <input value={note} maxLength={40} placeholder="一句话（可选）" onChange={(e) => setNoteText(e.target.value)} aria-label="事件简述" />
        <button type="button" className="wg-btn on" style={{ minHeight: 36 }} disabled={!date} onClick={add}>添加</button>
      </div>
      {list.length === 0 && <div className="wg-cap">还没有自己添加的事件。</div>}
      {list.map((ev) => (
        <div key={ev.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid rgba(246,241,228,0.1)', opacity: ev.certainty === '记不清' ? 0.6 : 1 }}>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
            <div>{ev.date} · {ev.kind} · {ev.certainty}</div>
            {ev.note && <div style={{ color: 'rgba(246,241,228,0.62)' }}>{ev.note}</div>}
          </div>
          <button type="button" className="wg-btn" style={{ minHeight: 32 }} onClick={() => save(list.filter((x) => x.id !== ev.id))}>删除</button>
        </div>
      ))}
    </div>
  )
}

/* ───────── rectifier ───────── */
function Rectifier({ src0, range }: { src0: string; range: number }) {
  const [src, setSrc] = useSrc(src0)
  const { chart, birth, prep, err, events } = usePrep(src)
  const span = Math.min(24, Math.max(0.5, Math.abs(range)))
  const [min, setMin] = useState(0)
  useEffect(() => { setMin(0) }, [src])
  const scored = useMemo(() => (prep ? scoreOffset(prep, min / 60) : null), [prep, min])
  const shown = chart && scored ? { ...chart, ramc: scored.ramc, asc: scored.asc, mc: scored.mc } : chart
  const clock = birth ? shiftClock(birth.date, birth.time, min) : null
  const lit = scored ? scored.events.filter((e) => e.total > 0).length : 0
  const gate = <NeedChart src={src} birth={birth} chart={chart} />
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {gate || !chart || !shown || !birth || !clock ? gate : <>
        <Slider label="时刻" min={Math.round(-span * 60)} max={Math.round(span * 60)} step={1} value={min} onChange={setMin} fmt={fmtMin} />
        <div className="wg-read">
          <span>{clock.date} {clock.time}</span>
          <span>{min === 0 ? '记录时刻' : `相对记录 ${fmtMin(min)}`}</span>
        </div>
        <div className="wg-read"><span>上升 <b>{fmtL(scored?.asc ?? shown.asc)}</b></span><span>天顶 <b>{fmtL(scored?.mc ?? shown.mc)}</b></span></div>
        <div className="wg-read"><span>上升大约 4 分钟走 1°。行运容许 2°、太阳弧容许 1°，加分的窗口常常只有几分钟到十几分钟。</span></div>
        <Wheel c={shown} showAspects={false} />
        {err && <div className="wg-read"><span>{err}</span></div>}
        {events.length === 0 && <div className="wg-cap">这个来源没有附带可打分的生命事件。</div>}
        {events.length > 0 && !prep && !err && <div className="wg-cap">计算中……</div>}
        {scored && <>
          <div className="wg-cap">合计 <b>{scored.total}</b> 分 · {lit} / {scored.events.length} 件亮起</div>
          {scored.total === 0 && <div className="wg-read"><span>这个时刻没有落进容许度。左右拖几分钟再看，轴在走，分数会在边缘突然出现。</span></div>}
          <ScoreCards rows={scored.events} />
        </>}
        <Rules />
        <Caution />
      </>}
    </div>
  )
}

/* ───────── scoreGrid ───────── */
function heat(total: number, max: number) {
  if (total <= 0) return { bg: 'rgba(246,241,228,0.04)', ink: 'rgba(246,241,228,0.78)' }
  const t = Math.min(1, total / max)
  return {
    bg: `rgba(194,160,90,${0.16 + 0.72 * t})`,
    ink: t > 0.55 ? 'var(--night)' : 'var(--star)',
  }
}
function ScoreGrid({ src0, offsets }: { src0: string; offsets: number[] }) {
  const [src, setSrc] = useSrc(src0)
  const { chart, birth, prep, err, events } = usePrep(src)
  const key = offsets.join(',')
  const cols = useMemo(() => key.split(',').filter(Boolean).map(Number), [key])
  const grid = useMemo(() => (prep ? cols.map((m) => ({ m, sc: scoreOffset(prep, m / 60) })) : null), [prep, cols])
  const maxCell = grid ? Math.max(4, ...grid.flatMap((g) => g.sc.events.map((e) => e.total))) : 4
  const gate = <NeedChart src={src} birth={birth} chart={chart} />
  const head = (m: number) => (m === 0 ? '记录' : fmtMin(m).replace(' ', ''))
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {gate || !chart ? gate : <>
        <div className="wg-read"><span>记录时刻 上升 <b>{fmtL(chart.asc)}</b> · 天顶 <b>{fmtL(chart.mc)}</b></span></div>
        <div className="wg-read"><span>每一列是一个候选时刻。格里的大字是合计，小字依次是行、弧、限、小。颜色越亮分数越高。</span></div>
        {err && <div className="wg-read"><span>{err}</span></div>}
        {events.length === 0 && <div className="wg-cap">这个来源没有附带可打分的生命事件。</div>}
        {events.length > 0 && !grid && !err && <div className="wg-cap">计算中……</div>}
        {grid && (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `92px repeat(${grid.length}, minmax(58px, 1fr))`, gap: 4, minWidth: 92 + grid.length * 62 }}>
              <div />
              {grid.map((g) => (
                <div key={g.m} style={{ fontSize: 11, textAlign: 'center', color: g.m === 0 ? 'var(--gold)' : 'rgba(246,241,228,0.7)', fontWeight: g.m === 0 ? 700 : 400 }}>{head(g.m)}</div>
              ))}
              {grid[0].sc.events.map((ev, i) => (
                <Row key={`${ev.date}-${ev.what}`} label={ev.what} sub={ev.date} cells={grid.map((g) => g.sc.events[i])} max={maxCell} />
              ))}
              <div style={{ fontSize: 12, alignSelf: 'center' }}>合计</div>
              {grid.map((g) => (
                <div key={`t-${g.m}`} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums', padding: '6px 0' }}>{g.sc.total}</div>
              ))}
            </div>
          </div>
        )}
        <Rules />
        <Caution />
      </>}
    </div>
  )
}
function Row({ label, sub, cells, max }: { label: string; sub: string; cells: EvScore[]; max: number }) {
  return (
    <>
      <div style={{ position: 'sticky', left: 0, background: 'var(--night)', fontSize: 12, lineHeight: 1.35, paddingRight: 4 }}>
        <div>{label}</div>
        <div style={{ color: 'rgba(246,241,228,0.45)', fontSize: 10 }}>{sub}</div>
      </div>
      {cells.map((c, i) => {
        const col = heat(c.total, max)
        return (
          <div key={i} style={{ background: col.bg, color: col.ink, borderRadius: 6, textAlign: 'center', padding: '4px 2px', minHeight: 44 }}>
            <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.total}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 9, lineHeight: 1.35 }}>
              {METHODS.map((m) => <span key={m}>{METHOD_SHORT[m]}{c.parts[m]}</span>)}
            </div>
          </div>
        )
      })}
    </>
  )
}

/* ───────── blindRectify ───────── */
const BLIND_TAG = ['候选甲', '候选乙', '候选丙']
function readBlind(raw: string | undefined, offsets: number[]): BlindSave | null {
  try {
    const v = JSON.parse(raw || 'null') as Partial<BlindSave> | null
    if (!v || typeof v.pick !== 'number' || !offsets.includes(v.pick)) return null
    return { pick: v.pick, revealed: Boolean(v.revealed) }
  } catch { return null }
}
function BlindRectify({ src0 }: { src0: string }) {
  const [src, setSrc] = useSrc(src0)
  const { chart, birth, prep, err, label } = usePrep(src)
  const notes = useStore().notes
  const offsets = useMemo(() => blindOffsets(src === 'me' ? 'me' : src), [src])
  const saved = useMemo(() => readBlind(notes[`blind-${src}`], offsets), [notes, src, offsets])
  const [peek, setPeek] = useState<{ src: string; min: number } | null>(null)
  const peekMin = peek && peek.src === src ? peek.min : null
  const shownMin = saved?.revealed ? (peekMin ?? saved.pick) : (saved?.pick ?? null)
  const packs = useMemo(() => (prep ? offsets.map((m) => ({ m, sc: scoreOffset(prep, m / 60) })) : null), [prep, offsets])
  const shown = packs?.find((p) => p.m === shownMin) ?? null
  const wheel = chart && shown ? { ...chart, ramc: shown.sc.ramc, asc: shown.sc.asc, mc: shown.sc.mc } : null
  const gate = <NeedChart src={src} birth={birth} chart={chart} />
  const save = (pick: number, revealed: boolean) => setNote(`blind-${src}`, JSON.stringify({ pick, revealed }))
  const k = caseById(src)
  const truePack = packs?.find((p) => p.m === 0)
  const pickPack = packs?.find((p) => p.m === saved?.pick)
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {gate || !chart || !birth ? gate : <>
        <div className="wg-read"><span>{label || '这张盘'}有三个候选时刻，其中一个是记录时刻，另外两个各错开大约 1 到 2.5 小时。先比较分数，再选定。揭晓之前不标出哪一个是记录。</span></div>
        {err && <div className="wg-read"><span>{err}</span></div>}
        {!k?.events?.length && <div className="wg-cap">这个来源没有附带可打分的生命事件。</div>}
        {(k?.events?.length ?? 0) > 0 && !prep && !err && <div className="wg-cap">计算中……</div>}
        {packs && offsets.map((m, i) => {
          const pack = packs[i]
          const on = shownMin === m
          const mine = saved?.pick === m
          const truth = saved?.revealed && m === 0
          const clock = shiftClock(birth.date, birth.time, m)
          return (
            <button type="button" key={m} onClick={() => saved?.revealed ? setPeek({ src, min: m }) : save(m, false)} style={{
              display: 'block', width: '100%', textAlign: 'left', marginTop: 8, padding: '8px 10px', minHeight: 44,
              borderRadius: 10, color: 'inherit', cursor: 'pointer',
              border: `1px solid ${on || truth ? 'rgba(194,160,90,0.9)' : 'rgba(246,241,228,0.16)'}`,
              background: truth ? 'rgba(194,160,90,0.16)' : on ? 'rgba(246,241,228,0.06)' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(246,241,228,0.55)' }}>{BLIND_TAG[i]}{mine && !saved?.revealed ? ' · 当前选择' : ''}{saved?.revealed && mine ? ' · 你的选择' : ''}{truth ? ' · 记录时刻' : ''}</div>
                  <div style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{clock.time}</div>
                  <div style={{ fontSize: 12, color: 'rgba(246,241,228,0.55)' }}>{clock.date}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{pack.sc.total}</div>
              </div>
              <div className="wg-read" style={{ marginTop: 4 }}>
                {METHODS.map((name) => <span key={name}>{METHOD_NAME[name]} <b>{pack.sc.parts[name]}</b></span>)}
              </div>
              <div className="wg-read" style={{ marginTop: 2 }}><span>上升 {fmtL(pack.sc.asc)}</span><span>天顶 {fmtL(pack.sc.mc)}</span></div>
            </button>
          )
        })}
        {packs && (
          <div className="wg-btns">
            <button type="button" className="wg-btn on" style={{ minHeight: 36, opacity: saved ? 1 : 0.4 }} disabled={!saved || saved.revealed} onClick={() => saved && save(saved.pick, true)}>揭晓</button>
            {saved?.revealed && <button type="button" className="wg-btn" style={{ minHeight: 36 }} onClick={() => { setNote(`blind-${src}`, ''); setPeek(null) }}>再试一次</button>}
          </div>
        )}
        {saved?.revealed && truePack && pickPack && (
          <div className="wg-read">
            <span>{saved.pick === 0 ? '你选中了记录时刻。' : `你选的时刻和记录相差 ${Math.abs(saved.pick)} 分钟。`}</span>
            <span>记录时刻 {truePack.sc.total} 分，你的选择 {pickPack.sc.total} 分。</span>
            {saved.pick !== 0 && pickPack.sc.total > truePack.sc.total && <span>分数更高的那个并不是记录时刻。技法叠多了，总会有一个时刻看起来更贴。</span>}
            {k && <span>记录是 {k.birth.date} {k.birth.time}（{k.clock}），{k.birth.place}。评级 {k.rating}。</span>}
          </div>
        )}
        {wheel && shown && <>
          <Wheel c={wheel} showAspects={false} />
          <ScoreCards rows={shown.sc.events} />
        </>}
        {!shown && prep && <div className="wg-read"><span>点一个候选，查看它的星盘和每件事件的明细。</span></div>}
        <Rules />
        <Caution />
      </>}
    </div>
  )
}

const strArg = (v: unknown, d = 'einstein') => (typeof v === 'string' && v.trim() ? v : d)
function numArg(v: unknown, d: number) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : d
}
function numList(v: unknown, d: number[]) {
  if (!Array.isArray(v) || v.length === 0) return d
  const out = v.map((x) => typeof x === 'number' ? x : Number(x)).filter((x) => Number.isFinite(x))
  return out.length ? out : d
}

export const W11: WidgetMap = {
  ascSpeed: (a) => <AscSpeed src0={strArg(a.src)} />,
  eventTable: (a) => <EventTable src0={strArg(a.src)} />,
  rectifier: (a) => <Rectifier src0={strArg(a.src)} range={numArg(a.range, 3)} />,
  scoreGrid: (a) => <ScoreGrid src0={strArg(a.src)} offsets={numList(a.offsets, [-90, 0, 75])} />,
  blindRectify: (a) => <BlindRectify src0={strArg(a.src)} />,
}

void (null as ReactNode)
