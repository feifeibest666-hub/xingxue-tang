// 第 10 阶段：年小限、法达、黄道释放、主限、界推进、统计陷阱
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { PlayBtn, Slider, seeded, useLoop, usePlaying, type WidgetMap } from './common'
import { CasePicker, MyBirthForm, NeedMine, SIGN_CN, Wheel, fmtL, useChartOf } from './natal'
import { Glyph, GlyphAt } from '../Glyph'
import { caseById } from '../../data/cases'
import { ANGULARITY, BOUNDS, DOMICILE, HOUSE_TOPICS, PLANET, boundAt, dignityOf, type Planet } from '../../data/classical'
import {
  BODY_COLOR, BODY_NAME, BODY_SHORT, CLASSICAL, MODERN, ascDiff, norm, signIdx, toEq, wholeHouse,
  type Chart,
} from '../../lib/natal'
import {
  FLORD_NAME, KEY_NAME, NAIBOD, TROPICAL_YEAR, ageAt, arcToYears, dateAtAge, directedAngles, directionsToAngles, firdaria, fmtDate, transitList, zodiacalReleasing,
  type Direction, type FLord, type Period, type Transit, type ZRPeriod,
} from '../../lib/timing'

const INK = '#f6f1e4'
const GOLD = '#c2a05a'
const MUTED = 'rgba(246,241,228,0.72)'
const LINE = 'rgba(246,241,228,0.16)'
const HIT_MEM = new Map<string, Transit[]>()

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const turn = (from: number, to: number) => {
  let d = norm(to - from)
  if (d > 180) d -= 360
  return d
}
export function fmtYr(a: number) {
  const r = Math.round(a * 10) / 10
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)
}
export function fmtDeg(x: number) {
  const neg = x < 0
  let v = Math.abs(x)
  let d = Math.floor(v + 1e-8)
  let m = Math.round((v - d) * 60)
  if (m === 60) { d += 1; m = 0 }
  return `${neg ? '-' : ''}${d}°${String(m).padStart(2, '0')}′`
}
function lordColor(lord: FLord) {
  if (lord === 'nnode') return BODY_COLOR.node
  if (lord === 'snode') return '#8a7048'
  return BODY_COLOR[lord]
}
function lordShort(lord: FLord) {
  if (lord === 'nnode') return '北'
  if (lord === 'snode') return '南'
  return BODY_SHORT[lord]
}
function promName(p: Direction['promissor']) {
  return p === 'fortune' ? '福点' : BODY_NAME[p]
}
const TGT: Record<Direction['target'], string> = { asc: '上升', mc: '天顶', dsc: '下降', ic: '天底' }
const ASP: Record<number, string> = { 0: '合', 60: '六分', 90: '四分', 120: '三分', 180: '对分' }

function str(v: unknown) { return typeof v === 'string' ? v : undefined }
function num(v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}
function flag(v: unknown) {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return undefined
}

/** 年小限，或打开月小限后的那一格。月界用一点余量，避免 1/12 的浮点把整月算丢。 */
export function activeProfection(ascSign: number, age: number, monthly: boolean) {
  const year = Math.floor(age + 1e-9)
  const months = monthly ? Math.min(11, Math.floor((age - year) * 12 + 1e-6)) : 0
  const sign = ((ascSign - 1 + year + months) % 12) + 1
  const house = ((year + months) % 12) + 1
  return { sign, house, lord: DOMICILE[sign - 1], month: months + 1, year }
}
export function firdAt(periods: Period[], age: number) {
  const a = clamp(age, 0, 74.999999)
  const major = periods.find((p) => a >= p.from && a < p.to) ?? periods[periods.length - 1]
  const sub = major.subs?.find((s) => a >= s.from && a < s.to)
  return { major, sub }
}

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const
export function monthEdges() {
  const e = [0]
  for (const d of MONTH_DAYS) e.push(e[e.length - 1] + d)
  return e
}
/** 窗口 [start, end) 盖到哪些公历月（平年 365 天，不绕回年初）。 */
export function monthsHitBy(spans: [number, number][]) {
  const e = monthEdges()
  const hit = Array(12).fill(false) as boolean[]
  for (const [start, end] of spans) {
    for (let m = 0; m < 12; m++) if (start < e[m + 1] && end > e[m]) hit[m] = true
  }
  return hit
}
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** 一年里随机放「技术种数乘每种窗口」个窗口。长度按周折成整天。 */
export function hitSim(techs: number, per: number, weeks: number, seed: number) {
  const len = Math.max(1, Math.round(weeks * 7))
  const rng = mulberry32(seed)
  const n = Math.max(0, Math.round(techs)) * Math.max(0, Math.round(per))
  const spans: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const start = Math.floor(rng() * 365)
    spans.push([start, Math.min(365, start + len)])
  }
  const months = monthsHitBy(spans)
  const count = months.filter(Boolean).length
  return { months, count, pct: (count / 12) * 100, spans }
}

export function boundSpan(lon: number) {
  const l = norm(lon)
  const s = Math.floor(l / 30)
  const d = l - s * 30
  let prev = 0
  for (const [lord, end] of BOUNDS[s]) {
    if (d < end) return { lord, sign: s + 1, from: prev, to: end }
    prev = end
  }
  const last = BOUNDS[s][BOUNDS[s].length - 1]
  return { lord: last[0], sign: s + 1, from: prev, to: 30 }
}

export interface DistSeg { lord: Planet; sign: number; from: number; to: number; lon0: number; lon1: number }
/** 上升按主限钥匙往前走，每进入新的埃及界就换一位分配者。 */
export function distributors(c: Chart, maxAge = 84, key: 'ptolemy' | 'naibod' = 'ptolemy'): DistSeg[] {
  const ascAt = (age: number) => directedAngles(c, age, key).asc
  const segs: DistSeg[] = []
  let age = 0
  let lon = ascAt(0)
  let lord = boundAt(lon)
  let sign = signIdx(lon)
  let from = 0
  let lon0 = lon
  let guard = 0
  while (age < maxAge - 1e-4 && guard < 8000) {
    guard++
    let step = Math.min(0.05, maxAge - age)
    let lon2 = ascAt(age + step)
    let splits = 0
    while (Number.isFinite(lon2) && Math.abs(turn(lon, lon2)) > 1.2 && step > 0.0004 && splits < 14) {
      step /= 2
      lon2 = ascAt(age + step)
      splits++
    }
    if (!Number.isFinite(lon2)) break
    if (boundAt(lon2) === lord && signIdx(lon2) === sign) {
      age += step
      lon = lon2
      continue
    }
    let lo = age
    let hi = age + step
    for (let k = 0; k < 32; k++) {
      const mid = (lo + hi) / 2
      const lm = ascAt(mid)
      if (boundAt(lm) === lord && signIdx(lm) === sign) lo = mid
      else hi = mid
    }
    if (!(hi > age + 1e-5)) hi = Math.min(maxAge, age + step)
    const lonHi = ascAt(hi)
    segs.push({ lord, sign, from, to: hi, lon0, lon1: lonHi })
    age = hi
    lon = lonHi
    lord = boundAt(lon)
    sign = signIdx(lon)
    from = age
    lon0 = lon
  }
  segs.push({ lord, sign, from, to: maxAge, lon0, lon1: ascAt(Math.max(from, maxAge)) })
  return segs.filter((s) => s.to - s.from > 1e-3)
}

export interface OaRow { name: string; ra: number; dec: number; ad: number | null; oa: number | null }
/** 黄纬取 0，和主限表（in zodiaco）用的是同一套数。上升斜升 = 天顶赤经 + 90°。 */
export function oaTable(c: Chart): { rows: OaRow[]; oaAsc: number } {
  const rows: OaRow[] = []
  const add = (name: string, lon: number) => {
    const { ra, dec } = toEq(lon, 0, c.eps)
    const ad = ascDiff(dec, c.lat)
    rows.push({ name, ra, dec, ad, oa: ad == null ? null : norm(ra - ad) })
  }
  for (const b of [...CLASSICAL, ...MODERN]) add(BODY_NAME[b], c.pos[b].lon)
  add('福点', c.fortune)
  return { rows, oaAsc: norm(c.ramc + 90) }
}

function useSrc(src0?: string) {
  const [src, setSrc] = useState(src0 || 'einstein')
  useEffect(() => { if (src0) setSrc(src0) }, [src0])
  return { src, setSrc, ...useChartOf(src) }
}
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}
function Read({ children }: { children: ReactNode }) {
  return <div className="wg-read"><span>{children}</span></div>
}
function Busy({ show }: { show: boolean }) {
  if (!show) return null
  return <div className="wg-cap">计算中…</div>
}
function Tap({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={`wg-btn ${on ? 'on' : ''}`} style={{ minHeight: 32 }} onClick={onClick}>{children}</button>
  )
}
function lordNatal(c: Chart, lord: Planet) {
  const lon = c.pos[lord].lon
  const house = wholeHouse(lon, c.asc)
  const dig = dignityOf(lord, lon, c.isDay).map((d) => d.name)
  const state = dig.length ? dig.join('、') : '没有本质尊贵'
  return `${PLANET[lord].name}在${fmtL(lon)}，第 ${house} 宫（${ANGULARITY(house)}），${state}${c.pos[lord].retro ? '，逆行' : ''}`
}
function lifeEvents(src: string, ut: Date) {
  const k = caseById(src)
  if (!k) return [] as { age: number; zr: number; what: string; date: string }[]
  return k.events.flatMap((e) => {
    const [y, m, d] = e.date.split('-').map(Number)
    if (!y || !m || !d) return []
    const age = ageAt(ut, new Date(Date.UTC(y, m - 1, d, 12)))
    if (age < 0 || age > 120) return []
    return [{ age, zr: (age * TROPICAL_YEAR) / 360, what: e.what, date: e.date }]
  })
}
function chartId(c: Chart | null) {
  return c ? `${c.ut.toISOString()}|${c.lat}|${c.lon}` : ''
}

function Shell({ src, setSrc, birth, chart, children }: {
  src: string; setSrc: (v: string) => void; birth: ReturnType<typeof useChartOf>['birth']; chart: Chart | null; children: ReactNode
}) {
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><div style={{ overflowX: 'auto' }}><MyBirthForm /></div></>}
      <Busy show={!chart && !(src === 'me' && !birth)} />
      {chart && children}
    </div>
  )
}

/* ───────── 年小限转盘 ───────── */
function SignPointer({ asc, sign, size }: { asc: number; sign: number; size: number }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 6
  const P = (lon: number, r: number) => {
    const t = ((lon - asc) * Math.PI) / 180
    return [cx - r * Math.cos(t), cy + r * Math.sin(t)] as const
  }
  const a0 = (sign - 1) * 30, a1 = sign * 30
  const mid = a0 + 15
  const outer = (lon: number) => P(lon, R - 2)
  const inner = (lon: number) => P(lon, R - 24)
  const [x0, y0] = inner(a0), [x1, y1] = outer(a0), [x2, y2] = outer(a1), [x3, y3] = inner(a1)
  const [tx, ty] = P(mid, R - 8)
  const [bx, by] = P(mid, R - 20)
  return (
    <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <path d={`M ${x0} ${y0} L ${x1} ${y1} A ${R - 2} ${R - 2} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${R - 24} ${R - 24} 0 0 0 ${x0} ${y0} Z`} fill="rgba(194,160,90,0.42)" />
      <line x1={bx} y1={by} x2={tx} y2={ty} stroke={GOLD} strokeWidth={2} />
      <circle cx={tx} cy={ty} r={4} fill={GOLD} />
    </svg>
  )
}

function ProfectionWheel({ src: src0, age: age0 }: { src?: string; age?: number }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [age, setAge] = useState(() => clamp(age0 ?? 0, 0, 90))
  const [monthly, setMonthly] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => { if (age0 != null) setAge(clamp(age0, 0, 90)) }, [age0])
  const size = 320
  const ascSign = chart ? signIdx(chart.asc) : 1
  const prof = activeProfection(ascSign, age, monthly)
  const rows = chart ? Array.from({ length: 61 }, (_, y) => activeProfection(ascSign, y, false)) : []
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      {chart && <>
        <Read>年主星就是这一格星座的守护星。指针每满一岁跳一个星座，十二年回到出生时的上升。</Read>
        <div style={{ position: 'relative' }}>
          <Wheel c={chart} sys="whole" size={size} lit={{ houses: [prof.house], bodies: [prof.lord] }} dimOthers />
          <SignPointer asc={chart.asc} sign={prof.sign} size={size} />
        </div>
        <Slider label="年龄" min={0} max={90} step={1 / 12} value={age} onChange={setAge} fmt={(v) => `${v.toFixed(2)} 岁`} />
        <div className="wg-btns">
          <Tap on={!monthly} onClick={() => setMonthly(false)}>年小限</Tap>
          <Tap on={monthly} onClick={() => setMonthly(true)}>月小限</Tap>
        </div>
        <div className="wg-cap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Glyph i={prof.sign} size={18} color={GOLD} width={7} />
          <span>{SIGN_CN[prof.sign - 1]} · 第 {prof.house} 宫 · 年主{PLANET[prof.lord].name}</span>
        </div>
        <Read>
          {monthly
            ? `月小限：满 ${prof.year} 岁后的第 ${prof.month} 个月。刚满岁的那个月仍是年小限的星座，再过约一个月才进一格。下一个生日会从新年的星座重新数。`
            : `满 ${prof.year} 岁这一年。传统上这一宫的题目是：${HOUSE_TOPICS[prof.house - 1]}。`}
        </Read>
        <Read>本命状态：{lordNatal(chart, prof.lord)}。本命状态只描述传统上的成色，不把这一年写成必定发生的事。</Read>
        <div className="wg-btns">
          <Tap on={open} onClick={() => setOpen((v) => !v)}>{open ? '收起 0–60 岁' : '展开 0–60 岁'}</Tap>
        </div>
        {open && (
          <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
            <table className="wg-table">
              <thead><tr><th>岁</th><th>星座</th><th>宫</th><th>年主</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} style={r.year === prof.year ? { background: 'rgba(194,160,90,0.18)' } : undefined}>
                    <td>{r.year}</td><td>{SIGN_CN[r.sign - 1]}</td><td>{r.house}</td><td>{PLANET[r.lord].name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>}
    </Shell>
  )
}

/* ───────── 法达彩带 ───────── */
function FirdariaRibbon({ src: src0, night }: { src?: string; night?: boolean }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [age, setAge] = useState(0)
  const [day, setDay] = useState(true)
  const [nodes, setNodes] = useState<'end' | 'mars'>('end')
  const [synced, setSynced] = useState('')
  const id = chartId(chart)
  const syncKey = `${id}|${night}`
  if (chart && synced !== syncKey) {
    setSynced(syncKey)
    setDay(night != null ? !night : chart.isDay)
  }
  const periods = useMemo(() => firdaria(day, !day && nodes === 'mars'), [day, nodes])
  const at = firdAt(periods, age)
  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - b.left) / Math.max(1, b.width)) * 360
    setAge(clamp(((x - 8) / 344) * 75, 0, 75))
  }
  const xOf = (a: number) => 8 + (clamp(a, 0, 75) / 75) * 344
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      {chart && <>
        <Read>法达把一生分成七星加两个交点，一共 75 年。上排是主期，下排是子期。子期从这段主星自己起，再按从慢到快的顺序走七段。交点不分小段。</Read>
        <svg className="wg-svg" viewBox="0 0 360 96" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e) }} onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e) }}>
          {periods.map((p) => {
            const x = xOf(p.from), w = Math.max(1, xOf(p.to) - x)
            const on = p === at.major
            return (
              <g key={`${p.lord}-${p.from}`}>
                <rect x={x} y={16} width={w} height={26} fill={lordColor(p.lord)} stroke={on ? INK : 'rgba(0,0,0,0.35)'} strokeWidth={on ? 1.6 : 0.4} />
                {w > 18 && <text x={x + w / 2} y={33} textAnchor="middle" fontSize={12} fill="#1c140c">{lordShort(p.lord)}</text>}
                {p.subs?.map((s) => {
                  const sx = xOf(s.from), sw = Math.max(0.8, xOf(s.to) - sx - 0.3)
                  const subOn = s === at.sub
                  return <rect key={`${s.lord}-${s.from}`} x={sx} y={48} width={sw} height={14} fill={lordColor(s.lord)} stroke={subOn ? INK : 'rgba(0,0,0,0.25)'} strokeWidth={subOn ? 1.2 : 0.3} />
                })}
              </g>
            )
          })}
          <line x1={xOf(age)} y1={8} x2={xOf(age)} y2={78} stroke={INK} strokeWidth={1.4} />
          {[0, 25, 50, 75].map((a) => <text key={a} x={xOf(a)} y={92} fontSize={10} fill={MUTED} textAnchor="middle">{a}</text>)}
        </svg>
        <Slider label="年龄" min={0} max={75} step={0.1} value={age} onChange={setAge} fmt={(v) => `${fmtYr(v)} 岁`} />
        <div className="wg-btns">
          <Tap on={day} onClick={() => setDay(true)}>日生</Tap>
          <Tap on={!day} onClick={() => setDay(false)}>夜生</Tap>
        </div>
        {!day && (
          <div className="wg-btns">
            <Tap on={nodes === 'end'} onClick={() => setNodes('end')}>交点在末尾</Tap>
            <Tap on={nodes === 'mars'} onClick={() => setNodes('mars')}>交点在火星后</Tap>
          </div>
        )}
        <div className="wg-cap">
          {fmtYr(age)} 岁 · 主期{FLORD_NAME[at.major.lord]}（{fmtYr(at.major.from)}–{fmtYr(at.major.to)}）
          {at.sub ? ` · 子期${FLORD_NAME[at.sub.lord]}（${fmtYr(at.sub.from)}–${fmtYr(at.sub.to)}）` : ' · 交点没有子期'}
        </div>
        <Read>
          {chart.isDay === day
            ? `按这张盘的${chart.isDay ? '日生' : '夜生'}排列。日生从太阳起，夜生从月亮起。`
            : `这张盘是${chart.isDay ? '日生' : '夜生'}，你正在看另一种排法。`}
          {!day && nodes === 'mars' ? ' 夜盘把交点放在火星后面，是博纳提的一种读法。' : ' 另一读法把两个交点放在七星全部走完之后。'}
        </Read>
      </>}
    </Shell>
  )
}

/* ───────── 黄道释放 ───────── */
function zrNow(periods: ZRPeriod[], day: number, level: number) {
  return periods.find((p) => p.level === level && day >= p.start && day < p.end)
}
function ZrTimeline({ src: src0, from: from0 }: { src?: string; from?: 'spirit' | 'fortune' }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [from, setFrom] = useState<'spirit' | 'fortune'>(from0 === 'spirit' ? 'spirit' : 'fortune')
  const [age, setAge] = useState(20)
  useEffect(() => { if (from0 === 'spirit' || from0 === 'fortune') setFrom(from0) }, [from0])
  const pack = useMemo(() => {
    if (!chart) return null
    const fortune = signIdx(chart.fortune)
    const spirit = signIdx(chart.spirit)
    const span = 96 * 360
    return {
      fortune, spirit,
      fortuneRows: zodiacalReleasing(fortune, span, 2, 360, fortune),
      spiritRows: zodiacalReleasing(spirit, span, 2, 360, fortune),
    }
  }, [chart])
  const rows = pack ? (from === 'spirit' ? pack.spiritRows : pack.fortuneRows) : []
  const day = age * 360
  const l1 = zrNow(rows, day, 1)
  const l2 = zrNow(rows, day, 2)
  const events = chart ? lifeEvents(src, chart.ut) : []
  const max = 90
  const xOf = (y: number) => 8 + (clamp(y, 0, max) / max) * 344
  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - b.left) / Math.max(1, b.width)) * 360
    setAge(clamp(((x - 8) / 344) * max, 0, max))
  }
  const bar = (list: ZRPeriod[], level: number, y: number, h: number) => list.filter((p) => p.level === level && p.start / 360 < max).map((p) => {
    const x = xOf(p.start / 360)
    const w = Math.max(0.8, xOf(p.end / 360) - x)
    const lord = DOMICILE[p.sign - 1]
    return (
      <g key={`${level}-${p.start}`}>
        <rect x={x} y={y} width={w} height={h} fill={BODY_COLOR[lord]} stroke={p.peak ? GOLD : 'rgba(0,0,0,0.35)'} strokeWidth={p.peak ? 1.5 : 0.3} />
        {level === 1 && w > 22 && <GlyphAt i={p.sign} x={x + w / 2} y={y + h / 2} size={14} color="#1c140c" width={8} />}
        {p.lb && <circle cx={x} cy={y + h / 2} r={3.2} fill={INK} />}
      </g>
    )
  })
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      {chart && pack && <>
        <Read>黄道释放从福点或精神点所在的星座出发，一格一格往前走。一岁按 360 天算（瓦伦斯），所以释放岁数比生日岁数稍快。摩羯这一格按 27 年，不按土星的 30 年。金边是巅峰：这一格相对福点落在第 1、4、7、10 个星座。白点是松绑：子层走完十二格，下一格跳到起点的对宫。</Read>
        <div className="wg-btns">
          <Tap on={from === 'fortune'} onClick={() => setFrom('fortune')}>从福点</Tap>
          <Tap on={from === 'spirit'} onClick={() => setFrom('spirit')}>从精神点</Tap>
        </div>
        <svg className="wg-svg" viewBox="0 0 360 128" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e) }} onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e) }}>
          <text x={4} y={28} fontSize={11} fill={MUTED}>1</text>
          <text x={4} y={56} fontSize={11} fill={MUTED}>2</text>
          {bar(rows, 1, 14, 22)}
          {bar(rows, 2, 42, 16)}
          {events.filter((e) => e.zr <= max).map((e) => <line key={e.date + e.what} x1={xOf(e.zr)} y1={66} x2={xOf(e.zr)} y2={82} stroke="#d9734f" strokeWidth={2} />)}
          <line x1={8} y1={90} x2={352} y2={90} stroke={LINE} />
          {[0, 30, 60, 90].map((a) => <text key={a} x={xOf(a)} y={104} fontSize={10} fill={MUTED} textAnchor="middle">{a}</text>)}
          <line x1={xOf(age)} y1={8} x2={xOf(age)} y2={90} stroke={GOLD} strokeWidth={1.3} />
        </svg>
        <Slider label="释放" min={0} max={max} step={0.1} value={age} onChange={setAge} fmt={(v) => `${fmtYr(v)} 年`} />
        <div className="wg-cap">
          {from === 'fortune' ? '福点' : '精神点'}在{SIGN_CN[(from === 'fortune' ? pack.fortune : pack.spirit) - 1]}
          {' · '}约实足 {fmtYr(age * 360 / TROPICAL_YEAR)} 岁
        </div>
        {l1 && <Read>第 1 层：{SIGN_CN[l1.sign - 1]}，主星{PLANET[DOMICILE[l1.sign - 1]].name}，{fmtYr(l1.start / 360)}–{fmtYr(l1.end / 360)} 释放年。{l1.peak ? `巅峰，相对福点是第 ${l1.peak} 个星座。` : '不是巅峰。'}</Read>}
        {l2 && <Read>第 2 层：{SIGN_CN[l2.sign - 1]}，主星{PLANET[DOMICILE[l2.sign - 1]].name}，{fmtYr(l2.start / 360)}–{fmtYr(l2.end / 360)}。{l2.lb ? '这一格是松绑之后跳到的对宫。' : ''}{l2.peak ? `巅峰，相对福点是第 ${l2.peak} 个星座。` : ''}</Read>}
        <Read>橙线是档案里的事件，按 360 天一岁标在带子上。对得上只说明日子落在某一格里，不是这套技法预测中了。</Read>
        {events.length === 0 && <Read>这张盘没有预存事件。</Read>}
        {events.map((e) => (
          <div key={e.date + e.what} style={{ borderTop: `1px solid ${LINE}`, padding: '6px 0', fontSize: 13 }}>
            <span style={{ color: GOLD }}>{fmtYr(e.zr)} 释放年</span>（实足 {fmtYr(e.age)} 岁）{e.what}
          </div>
        ))}
      </>}
    </Shell>
  )
}

/* ───────── 主限转盘 ───────── */
const PICKS: (Planet | 'fortune')[] = [...CLASSICAL, 'fortune']
function PrimaryDial({ src: src0 }: { src?: string }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const id = chartId(chart)
  const all = useMemo(() => (chart ? directionsToAngles(chart, 'ptolemy', 360) : []), [chart])
  const dirs = all.slice(0, 15)
  const allAsc = all.filter((d) => d.target === 'asc' && d.aspect === 0)
  const [sel, setSel] = useState<Planet | 'fortune'>('sun')
  const [turned, setTurned] = useState(0)
  const [playing, setPlaying] = usePlaying(true)
  const [seen, setSeen] = useState('')
  if (chart && seen !== id) {
    setSeen(id)
    const hit = allAsc.find((d) => PICKS.includes(d.promissor as Planet | 'fortune'))
    if (hit) setSel(hit.promissor as Planet | 'fortune')
    setTurned(0)
  }
  const arc = allAsc.find((d) => d.promissor === sel)?.arc ?? 0
  const arcRef = useRef(arc)
  const speedRef = useRef(12)
  arcRef.current = arc
  speedRef.current = Math.max(12, (arc || 12) / 9)
  useLoop(playing && arc > 0, (dt) => {
    setTurned((v) => Math.min(arcRef.current, v + dt * speedRef.current))
  })
  useEffect(() => {
    if (playing && arc > 0 && turned >= arc - 1e-4) setPlaying(false)
  }, [playing, turned, arc, setPlaying])
  const shown = Math.min(turned, arc)
  const left = Math.max(0, arc - shown)
  const stars = useMemo(() => seeded(14, 11), [])
  const P = (deg: number, r: number) => {
    const t = (deg * Math.PI) / 180
    return [180 - r * Math.cos(t), 96 + r * Math.sin(t)] as const
  }
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      {chart && <>
        <Read>图是示意：一颗星的斜升被周日运动转到上升的斜升。转过的弧换成两把钥匙下的岁数。托勒密把 1° 当成 1 年。奈伯德用太阳一天的平均行程，大约 0°59′，同样的弧会多算出一点岁数。下面的表是最先到达四轴的 15 次合相，黄纬按 0 算。</Read>
        <svg className="wg-svg" viewBox="0 0 360 200">
          <circle cx={180} cy={96} r={78} fill="#101528" stroke="rgba(246,241,228,0.3)" />
          {stars.map(([a, b], i) => {
            const [x, y] = P(norm(a * 360 - shown), 30 + b * 40)
            return <circle key={i} cx={x} cy={y} r={1.3} fill="rgba(246,241,228,0.45)" />
          })}
          <circle cx={180} cy={96} r={4} fill={GOLD} />
          {arc > 0 && (
            <path d={`M ${P(0, 78)[0]} ${P(0, 78)[1]} A 78 78 0 ${left > 180 ? 1 : 0} 1 ${P(left, 78)[0]} ${P(left, 78)[1]}`} fill="none" stroke="rgba(194,160,90,0.45)" strokeWidth={3} />
          )}
          <line x1={180 - 86} y1={96} x2={180 - 70} y2={96} stroke={INK} strokeWidth={2} />
          <text x={180 - 92} y={92} fontSize={11} fill={INK} textAnchor="end">上升</text>
          {arc > 0 && (() => {
            const [x, y] = P(left, 78)
            return <g><circle cx={x} cy={y} r={11} fill="#0c1020" stroke={sel === 'fortune' ? GOLD : BODY_COLOR[sel]} /><text x={x} y={y + 4} fontSize={12} fill={sel === 'fortune' ? GOLD : BODY_COLOR[sel]} textAnchor="middle">{sel === 'fortune' ? '福' : BODY_SHORT[sel]}</text></g>
          })()}
        </svg>
        <div className="wg-btns">
          <PlayBtn playing={playing} set={setPlaying} />
          <Tap on={false} onClick={() => { setTurned(0); setPlaying(true) }}>重来</Tap>
          {PICKS.map((p) => (
            <Tap key={p} on={sel === p} onClick={() => { setSel(p); setTurned(0) }}>{p === 'fortune' ? '福' : BODY_SHORT[p]}</Tap>
          ))}
        </div>
        <div className="wg-cap">
          {arc === 0 ? '这个点在这个纬度上升不到东边。' : `已转 ${shown.toFixed(1)}° → 托勒密 ${shown.toFixed(1)} 年，奈伯德 ${(shown / NAIBOD).toFixed(1)} 年`}
        </div>
        {arc > 0 && <Read>到达上升还差 {left.toFixed(1)}°。全程 {arc.toFixed(2)}°，托勒密 {arc.toFixed(2)} 年，奈伯德 {arcToYears(arc, 'naibod').toFixed(2)} 年。{KEY_NAME.naibod}</Read>}
        <div style={{ overflowX: 'auto' }}>
          <table className="wg-table">
            <thead><tr><th>星体</th><th>到达</th><th>弧</th><th>托勒密</th><th>奈伯德</th></tr></thead>
            <tbody>
              {dirs.map((d, i) => (
                <tr key={i} style={d.promissor === sel ? { background: 'rgba(194,160,90,0.16)' } : undefined}>
                  <td>{promName(d.promissor)}</td>
                  <td>{ASP[d.aspect] ?? '合'}{TGT[d.target]}</td>
                  <td>{d.arc.toFixed(1)}°</td>
                  <td>{d.years.toFixed(1)}</td>
                  <td>{arcToYears(d.arc, 'naibod').toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </Shell>
  )
}

/* ───────── 斜升表 ───────── */
function OaTable({ src: src0 }: { src?: string }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const pack = chart ? oaTable(chart) : null
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      {chart && pack && <>
        <Read>手算用的表。赤经、赤纬、上升差、斜升都按黄纬 0 计算，好跟主限的合相对上。上升差是赤纬和出生纬度算出来的修正。斜升 = 赤经 − 上升差。到上升的弧 = 行星斜升 − 上升斜升，不够减就加 360°。</Read>
        <Read>纬度 {chart.lat.toFixed(2)}° · 黄赤交角 {chart.eps.toFixed(2)}° · 天顶赤经 {fmtDeg(chart.ramc)} · 上升斜升 {fmtDeg(pack.oaAsc)}（= 天顶赤经 + 90°）</Read>
        <div style={{ overflowX: 'auto' }}>
          <table className="wg-table">
            <thead><tr><th>星体</th><th>赤经</th><th>赤纬</th><th>上升差</th><th>斜升</th></tr></thead>
            <tbody>
              {pack.rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{fmtDeg(r.ra)}</td>
                  <td>{fmtDeg(r.dec)}</td>
                  <td>{r.ad == null ? '不升落' : fmtDeg(r.ad)}</td>
                  <td>{r.oa == null ? '无' : fmtDeg(r.oa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </Shell>
  )
}

/* ───────── 主题和触发 ───────── */
function TechStack({ src: src0, age: age0 }: { src?: string; age?: number }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [age, setAge] = useState(() => clamp(age0 ?? 26, 0, 90))
  const [nodes, setNodes] = useState<'end' | 'mars'>('end')
  useEffect(() => { if (age0 != null) setAge(clamp(age0, 0, 90)) }, [age0])
  const year = Math.floor(age)
  const yearD = useDebounced(year, 280)
  const id = chartId(chart)
  const base = useMemo(() => {
    if (!chart) return null
    const fortune = signIdx(chart.fortune)
    const spirit = signIdx(chart.spirit)
    const span = 100 * 360
    return {
      fortune, spirit,
      zf: zodiacalReleasing(fortune, span, 2, 360, fortune),
      zs: zodiacalReleasing(spirit, span, 2, 360, fortune),
      dirs: directionsToAngles(chart, 'ptolemy', 100),
    }
  }, [chart])
  const prof = chart ? activeProfection(signIdx(chart.asc), age, false) : null
  const fird = chart ? firdaria(chart.isDay, !chart.isDay && nodes === 'mars') : null
  const [pack, setPack] = useState<{ key: string; rows: Transit[] } | null>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!chart) return
    const key = `${id}|${yearD}`
    const cached = HIT_MEM.get(key)
    if (cached) { setPack({ key, rows: cached }); setPending(false); setFailed(false); return }
    let on = true
    setPending(true)
    setFailed(false)
    const timer = window.setTimeout(() => {
      transitList(chart, dateAtAge(chart.ut, yearD), dateAtAge(chart.ut, yearD + 1), ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'], [...CLASSICAL, 'asc', 'mc'])
        .then((rows) => {
          const hard = rows.filter((r) => r.aspect === 0 || r.aspect === 90 || r.aspect === 180)
          HIT_MEM.set(key, hard)
          if (on) { setPack({ key, rows: hard }); setPending(false) }
        })
        .catch(() => { if (on) { setPending(false); setFailed(true) } })
    }, 20)
    return () => { on = false; window.clearTimeout(timer) }
  }, [chart, id, yearD])
  const tKey = chart ? `${id}|${yearD}` : ''
  const transits = pack && pack.key === tKey ? pack.rows : null
  const waiting = Boolean(chart) && !failed && (year !== yearD || pending || !transits)
  const dayCount = age * TROPICAL_YEAR
  const zf1 = base ? zrNow(base.zf, dayCount, 1) : undefined
  const zf2 = base ? zrNow(base.zf, dayCount, 2) : undefined
  const zs1 = base ? zrNow(base.zs, dayCount, 1) : undefined
  const zs2 = base ? zrNow(base.zs, dayCount, 2) : undefined
  const at = fird ? firdAt(fird, age) : null
  const naibodHits = base ? base.dirs.filter((d) => { const y = arcToYears(d.arc, 'naibod'); return y >= year && y < year + 1 }) : []
  const ptolemyHits = base ? base.dirs.filter((d) => d.years >= year && d.years < year + 1) : []
  const layer: CSSProperties = { borderLeft: `3px solid ${GOLD}`, paddingLeft: 8, marginTop: 8 }
  const zrLine = (title: string, a?: ZRPeriod, b?: ZRPeriod) => (
    <div>
      {title}：第 1 层 {a ? `${SIGN_CN[a.sign - 1]}·${PLANET[DOMICILE[a.sign - 1]].name}` : '无'}
      {a?.peak ? `（巅峰 ${a.peak}）` : ''}{a?.lb ? '（松绑）' : ''}
      {' · 第 2 层 '}{b ? `${SIGN_CN[b.sign - 1]}·${PLANET[DOMICILE[b.sign - 1]].name}` : '无'}
      {b?.peak ? `（巅峰 ${b.peak}）` : ''}{b?.lb ? '（松绑）' : ''}
    </div>
  )
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      {chart && base && prof && at && <>
        <Read>两层叠在一起看。主题是时间主星：小限、法达、黄道释放，说的是这一年传统上被点到的题目。触发是行运和主限，说的是这一岁里有哪些合、四分、对分正好走到。叠得上不是预言已经应验。</Read>
        <Slider label="年龄" min={0} max={90} step={0.1} value={age} onChange={setAge} fmt={(v) => `${fmtYr(v)} 岁`} />
        <div style={layer}>
          <div style={{ color: GOLD, fontSize: 13 }}>主题</div>
          <div>小限：{SIGN_CN[prof.sign - 1]}，第 {prof.house} 宫，年主{PLANET[prof.lord].name}。{lordNatal(chart, prof.lord)}</div>
          <div>法达：主期{FLORD_NAME[at.major.lord]}，{at.sub ? `子期${FLORD_NAME[at.sub.lord]}` : '交点没有子期'}。{chart.isDay ? '日生，交点在七星之后。' : '夜生。'}</div>
          {!chart.isDay && (
            <div className="wg-btns">
              <Tap on={nodes === 'end'} onClick={() => setNodes('end')}>交点在末尾</Tap>
              <Tap on={nodes === 'mars'} onClick={() => setNodes('mars')}>交点在火星后</Tap>
            </div>
          )}
          {zrLine('释放·福点', zf1, zf2)}
          {zrLine('释放·精神点', zs1, zs2)}
          <Read>释放按 360 天一岁换算到这个实足年龄。巅峰相对福点，松绑是子层跳到对宫。</Read>
        </div>
        <div style={{ ...layer, borderLeftColor: '#7fc4c0' }}>
          <div style={{ color: '#7fc4c0', fontSize: 13 }}>触发</div>
          <Busy show={waiting && !failed} />
          {failed && <Read>行运这一步没有算完。换一个年龄，或稍后再试。</Read>}
          {transits && !waiting && transits.length === 0 && <Read>满 {year} 岁这一年，木星、土星、天王星、海王星、冥王星没有合、四分或对分到本命七星和四轴。</Read>}
          {transits && !waiting && transits.slice(0, 8).map((r, i) => (
            <div key={i}>{fmtDate(r.t)} {BODY_NAME[r.body]}{ASP[r.aspect]}{r.target === 'asc' ? '上升' : r.target === 'mc' ? '天顶' : BODY_NAME[r.target]}</div>
          ))}
          {transits && !waiting && transits.length > 8 && <Read>还有 {transits.length - 8} 次，日期是世界时。</Read>}
          {transits && !waiting && transits.length > 0 && transits.length <= 8 && <Read>日期是世界时。只列合、四分、对分。</Read>}
          {naibodHits.length === 0 && <Read>奈伯德钥匙下，这一岁没有主限合到四轴。</Read>}
          {naibodHits.slice(0, 6).map((d, i) => (
            <div key={i}>主限·奈伯德 {promName(d.promissor)}{ASP[d.aspect] ?? '合'}{TGT[d.target]}，{arcToYears(d.arc, 'naibod').toFixed(1)} 岁</div>
          ))}
          <Read>若改用托勒密钥匙，这一岁有 {ptolemyHits.length} 次合到四轴。两把钥匙差一截，不能当成同一件事。</Read>
        </div>
      </>}
    </Shell>
  )
}

/* ───────── 统计陷阱 ───────── */
function HitSimWidget() {
  const [techs, setTechs] = useState(6)
  const [per, setPer] = useState(2)
  const [weeks, setWeeks] = useState(3)
  const [seed, setSeed] = useState(1)
  const sim = hitSim(techs, per, weeks, seed)
  return (
    <div className="wg">
      <Read>假设每种技术每年随机亮若干段「重要窗口」。下面数的是：12 个月里，有几个月至少被一段窗口盖住。窗口是掷出来的，不是这张盘的运势。技术越多、窗口越长，亮着的月份越多，这不说明预测更准。</Read>
      <Slider label="技术" min={1} max={8} step={1} value={techs} onChange={setTechs} fmt={(v) => `${v} 种`} />
      <Slider label="窗口" min={1} max={4} step={1} value={per} onChange={setPer} fmt={(v) => `每种 ${v}`} />
      <Slider label="周数" min={1} max={8} step={1} value={weeks} onChange={setWeeks} fmt={(v) => `${v} 周`} />
      <div className="wg-btns"><Tap on={false} onClick={() => setSeed((s) => (s + 1) >>> 0)}>再掷一次</Tap></div>
      <div className="wg-cap">{sim.count} / 12 个月至少碰上一次（{sim.pct.toFixed(0)}%）</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
        {sim.months.map((on, i) => (
          <div key={i} style={{ minHeight: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'rgba(194,160,90,0.88)' : 'rgba(246,241,228,0.06)', color: on ? '#1c140c' : MUTED, fontSize: 13 }}>{i + 1} 月</div>
        ))}
      </div>
    </div>
  )
}

/* ───────── 界推进 ───────── */
function Distributor({ src: src0 }: { src?: string }) {
  const { src, setSrc, chart, birth } = useSrc(src0)
  const [age, setAge] = useState(0)
  const segs = useMemo(() => (chart ? distributors(chart, 84, 'ptolemy') : []), [chart])
  const cur = segs.find((s) => age >= s.from && (age < s.to || s.to >= 84)) ?? segs[0]
  const span = cur ? boundSpan(cur.lon0) : null
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      {chart && cur && span && <>
        <Read>分配者就是上升正在走过的那一界的主星。界用埃及界。上升按托勒密主限往前转：赤经 1° 当成 1 年。岁数是近似的，因为上升在不同星座里走得有快有慢。</Read>
        <Slider label="年龄" min={0} max={84} step={0.1} value={age} onChange={setAge} fmt={(v) => `${fmtYr(v)} 岁`} />
        <div className="wg-cap">{fmtYr(age)} 岁 · 分配者{PLANET[cur.lord].name} · {SIGN_CN[span.sign - 1]} {span.from}°–{span.to}°</div>
        <Read>这一段大约 {fmtYr(cur.from)}–{fmtYr(cur.to)} 岁。分配者的本命状态：{lordNatal(chart, cur.lord)}</Read>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="wg-table">
            <thead><tr><th>岁</th><th>界</th><th>分配者</th></tr></thead>
            <tbody>
              {segs.map((s, i) => {
                const b = boundSpan(s.lon0)
                const on = s === cur
                return (
                  <tr key={i} style={on ? { background: 'rgba(194,160,90,0.18)' } : undefined}>
                    <td>{fmtYr(s.from)}–{fmtYr(s.to)}</td>
                    <td>{SIGN_CN[b.sign - 1]} {b.from}°–{b.to}°</td>
                    <td>{PLANET[s.lord].name}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </>}
    </Shell>
  )
}

export const W10: WidgetMap = {
  profectionWheel: (a) => <ProfectionWheel src={str(a.src)} age={num(a.age)} />,
  firdariaRibbon: (a) => <FirdariaRibbon src={str(a.src)} night={flag(a.night)} />,
  zrTimeline: (a) => <ZrTimeline src={str(a.src)} from={a.from === 'spirit' || a.from === 'fortune' ? a.from : undefined} />,
  primaryDial: (a) => <PrimaryDial src={str(a.src)} />,
  oaTable: (a) => <OaTable src={str(a.src)} />,
  techStack: (a) => <TechStack src={str(a.src)} age={num(a.age)} />,
  hitSim: () => <HitSimWidget />,
  distributor: (a) => <Distributor src={str(a.src)} />,
}
