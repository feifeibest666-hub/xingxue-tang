// 第 8 阶段：外行星轨道、星座表、海王星发现示意、90° 盘、谐波、中点、赤纬、月宿、流派地图
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Btns, Note, PlayBtn, Slider, reduceMotion, useLoop, usePlaying, wheel, type WidgetMap } from './common'
import { CasePicker, MyBirthForm, NeedMine, SIGN_CN, fmtL, useChartOf, useMyBirth } from './natal'
import { GlyphAt } from '../Glyph'
import { ayanamsaAt } from '../../lib/astro'
import {
  BODY_COLOR, BODY_NAME, BODY_SHORT, chartAt, norm, positionsAt, sep, signIdx,
  type Body, type Chart,
} from '../../lib/natal'
import { setNote, useStore } from '../../lib/store'

const INK = '#f6f1e4'
const GOLD = '#c2a05a'
const MUTED = 'rgba(246,241,228,0.72)'
const LINE = 'rgba(246,241,228,0.16)'
const NIGHT = '#101528'
const tap = { minHeight: 32 }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const num = (v: unknown, d: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : d
}
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

export const OUTER_PERIOD = { uranus: 84, neptune: 165, pluto: 248 } as const
export const yearsPerSign = (period: number) => period / 12
export function fmtPerSign(period: number) {
  const y = yearsPerSign(period)
  if (Math.abs(y - Math.round(y)) < 1e-9) return String(Math.round(y))
  const t = (Math.round(y * 100) / 100).toFixed(2)
  return t.replace(/0$/, '').replace(/\.$/, '')
}
export const perihelionAu = (au: number, e: number) => au * (1 - e)

interface Orbit {
  id: string; name: string; au: number; e: number; period: number; color: string; outer?: boolean; ellipse?: boolean
}
export const ORBITS: Orbit[] = [
  { id: 'mercury', name: '水星', au: 0.387, e: 0.206, period: 0.241, color: BODY_COLOR.mercury },
  { id: 'venus', name: '金星', au: 0.723, e: 0.007, period: 0.615, color: BODY_COLOR.venus },
  { id: 'earth', name: '地球', au: 1, e: 0.017, period: 1, color: '#8aa9b8' },
  { id: 'mars', name: '火星', au: 1.524, e: 0.093, period: 1.881, color: BODY_COLOR.mars },
  { id: 'jupiter', name: '木星', au: 5.204, e: 0.049, period: 11.86, color: BODY_COLOR.jupiter },
  { id: 'saturn', name: '土星', au: 9.583, e: 0.054, period: 29.46, color: BODY_COLOR.saturn },
  { id: 'uranus', name: '天王星', au: 19.19, e: 0.047, period: OUTER_PERIOD.uranus, color: BODY_COLOR.uranus, outer: true },
  { id: 'neptune', name: '海王星', au: 30.07, e: 0.009, period: OUTER_PERIOD.neptune, color: BODY_COLOR.neptune, outer: true },
  { id: 'pluto', name: '冥王星', au: 39.48, e: 0.249, period: OUTER_PERIOD.pluto, color: BODY_COLOR.pluto, outer: true, ellipse: true },
]

const OUTERS = ['uranus', 'neptune', 'pluto'] as const
export interface OuterSignRow { year: number; jan: number[]; jul: number[] }
const SIGN_CACHE = new Map<string, OuterSignRow[]>()
const SIGN_FLIGHT = new Map<string, Promise<OuterSignRow[]>>()

export function yearSpan(from: number, to: number): [number, number] {
  let a = Number.isFinite(from) ? Math.round(from) : 1900
  let b = Number.isFinite(to) ? Math.round(to) : 2030
  if (a > b) [a, b] = [b, a]
  if (b - a > 200) b = a + 200
  return [a, b]
}

/** 每年 1 月 1 日与 7 月 1 日（世界时 0 点）的天王、海王、冥王黄经 */
export async function outerSignRows(from: number, to: number): Promise<OuterSignRow[]> {
  const [a, b] = yearSpan(from, to)
  const key = `${a}:${b}`
  const hit = SIGN_CACHE.get(key)
  if (hit) return hit
  const flight = SIGN_FLIGHT.get(key)
  if (flight) return flight
  const job = (async () => {
    const rows: OuterSignRow[] = []
    for (let y = a; y <= b; y++) {
      const jan = await positionsAt(new Date(Date.UTC(y, 0, 1)), [...OUTERS])
      const jul = await positionsAt(new Date(Date.UTC(y, 6, 1)), [...OUTERS])
      rows.push({ year: y, jan: OUTERS.map((id) => jan[id].lon), jul: OUTERS.map((id) => jul[id].lon) })
      if ((y - a) % 3 === 2) await new Promise((r) => setTimeout(r, 0))
    }
    SIGN_CACHE.set(key, rows)
    SIGN_FLIGHT.delete(key)
    return rows
  })()
  SIGN_FLIGHT.set(key, job)
  return job
}

export const YEARS_KEY = 'outer-years'
export function parseYears(raw: string | undefined): number[] {
  try {
    const a = JSON.parse(raw ?? '[]')
    if (!Array.isArray(a)) return []
    const ys = a.map(Number).filter((y) => Number.isInteger(y) && y >= 1800 && y <= 2100)
    return [...new Set(ys)].sort((p, q) => p - q)
  } catch { return [] }
}

/** 示意残差：正值 = 观测跑在预测前面。先正后负，不是实测表。 */
export function uranusDrift(year: number) {
  const t = clamp((year - 1781) / (1846 - 1781), 0, 1)
  return Math.sin(t * Math.PI) * (1 - t) * 90 - t * t * 55
}

export const POINT_IDS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc'] as const
export function pointName(id: string) {
  if (id === 'asc') return '上升'
  if (id === 'mc') return '天顶'
  return BODY_NAME[id as Body] ?? id
}
export function pointShort(id: string) {
  if (id === 'asc') return '升'
  if (id === 'mc') return '顶'
  return BODY_SHORT[id as Body] ?? id
}
export function pointColor(id: string) {
  if (id === 'asc' || id === 'mc') return INK
  return BODY_COLOR[id as Body] ?? GOLD
}
export function chartPoints(c: Chart) {
  return POINT_IDS.map((id) => ({ id, lon: id === 'asc' ? c.asc : id === 'mc' ? c.mc : c.pos[id as Body].lon }))
}

/** 90° 盘上的位置：黄经除以 90 的余数 */
export const dial90 = (lon: number) => norm(lon) % 90
/** 折叠动画：fold = 0 是 360° 盘，fold = 1 是 90° 盘 */
export function foldLon(lon: number, fold: number) {
  const full = norm(lon)
  const folded = (full % 90) * 4
  let delta = folded - full
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return norm(full + delta * clamp(fold, 0, 1))
}
export type HardKind = '合刑冲' | '半刑'
/** 1.5° 以内：盘上重合是合、四分或对分；盘上相差约 45° 是 45° 或 135° */
export function hardKind(a: number, b: number, orb = 1.5): HardKind | null {
  const d = Math.abs(dial90(a) - dial90(b))
  if (Math.min(d, 90 - d) <= orb) return '合刑冲'
  if (Math.abs(d - 45) <= orb) return '半刑'
  return null
}
export interface PairHit { a: string; b: string; orb: number; kind?: HardKind }
export function hardPairs(pts: { id: string; lon: number }[], orb = 1.5): (PairHit & { kind: HardKind })[] {
  const out: (PairHit & { kind: HardKind })[] = []
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const kind = hardKind(pts[i].lon, pts[j].lon, orb)
    if (!kind) continue
    const d = Math.abs(dial90(pts[i].lon) - dial90(pts[j].lon))
    const dialOrb = kind === '合刑冲' ? Math.min(d, 90 - d) : Math.abs(d - 45)
    out.push({ a: pts[i].id, b: pts[j].id, kind, orb: dialOrb })
  }
  return out.sort((p, q) => p.orb - q.orb || p.a.localeCompare(q.a))
}

export const harmonicLon = (lon: number, n: number) => norm(lon * n)
export function conjunctions(pts: { id: string; lon: number }[], orb = 3): PairHit[] {
  const out: PairHit[] = []
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = sep(pts[i].lon, pts[j].lon)
    if (d <= orb) out.push({ a: pts[i].id, b: pts[j].id, orb: d })
  }
  return out.sort((p, q) => p.orb - q.orb || p.a.localeCompare(q.a))
}

/** 较短弧的中点。350° 与 10° 的中点是 0°，不是 180°。 */
export function directMid(a: number, b: number) {
  const d = norm(b - a)
  const raw = norm(a + d / 2)
  return d <= 180 ? raw : norm(raw + 180)
}
export type MidKind = '正中点' | '对冲' | '九十盘'
export interface MidHit { a: string; b: string; c: string; kind: MidKind; orb: number; mid: number }
export function midpointStructures(pts: { id: string; lon: number }[], orb = 1.5): MidHit[] {
  const out: MidHit[] = []
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const mid = directMid(pts[i].lon, pts[j].lon)
    for (let k = 0; k < pts.length; k++) {
      if (k === i || k === j) continue
      const lon = pts[k].lon
      const dMid = sep(lon, mid)
      if (dMid <= orb) { out.push({ a: pts[k].id, b: pts[i].id, c: pts[j].id, kind: '正中点', orb: dMid, mid }); continue }
      const dOpp = sep(lon, norm(mid + 180))
      if (dOpp <= orb) { out.push({ a: pts[k].id, b: pts[i].id, c: pts[j].id, kind: '对冲', orb: dOpp, mid }); continue }
      const folded = norm(lon - mid) % 90
      const dDial = Math.min(folded, 90 - folded)
      if (dDial <= orb) out.push({ a: pts[k].id, b: pts[i].id, c: pts[j].id, kind: '九十盘', orb: dDial, mid })
    }
  }
  return out.sort((p, q) => p.orb - q.orb || p.kind.localeCompare(q.kind) || p.a.localeCompare(q.a))
}

export const isOob = (dec: number, eps: number) => Math.abs(dec) > eps + 1e-6
export function fmtDec(dec: number) {
  return `${dec >= 0 ? '北' : '南'} ${Math.abs(dec).toFixed(1)}°`
}
const DEC_IDS: Body[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']

export const NAK_WIDTH = 360 / 27
export const NAK_NAME = [
  '阿湿尼', '婆罗泥', '基栗底迦', '罗睺尼', '弥伽尸罗', '阿陀罗', '布拿婆苏', '布沙', '阿沙离',
  '摩伽', '前半月', '后半月', '哈斯塔', '质多罗', '斯瓦提', '毗舍佉', '阿奴罗陀', '杰斯塔',
  '慕罗', '前沙茶', '后沙茶', '室罗伐拿', '陀尼史塔', '百医', '前跋', '后跋', '雷瓦提',
]
export const nakshatraIndex = (sidLon: number) => {
  const i = Math.floor((norm(sidLon) * 27) / 360 + 1e-9)
  return i >= 27 ? 0 : i
}
export function siderealLon(trop: number, year: number) {
  return norm(trop - ayanamsaAt(year))
}

/** 汉代赤道宿度（古度）。沿天赤道量，宽窄不等，合计 365。 */
export const XIU: [string, number][] = [
  ['角', 12], ['亢', 9], ['氐', 15], ['房', 5], ['心', 5], ['尾', 18], ['箕', 11],
  ['斗', 26], ['牛', 8], ['女', 12], ['虚', 10], ['危', 17], ['室', 16], ['壁', 9],
  ['奎', 16], ['娄', 12], ['胃', 14], ['昴', 11], ['毕', 16], ['觜', 2], ['参', 9],
  ['井', 33], ['鬼', 4], ['柳', 15], ['星', 7], ['张', 18], ['翼', 18], ['轸', 17],
]
export const XIU_SUM = XIU.reduce((s, x) => s + x[1], 0)

export const SCHOOLS: { id: string; y: number; label: string; branch: '主线' | '现代' | '技术' | '古典'; name: string; tech: string; critique: string }[] = [
  { id: 'lilly', y: 1647, label: '1647', branch: '主线', name: '利利', tech: '用宫位、相位和行运，一步步写本命盘。', critique: '规则很全，后人容易把它当成唯一传统。' },
  { id: 'decline', y: 1700, label: '17 世纪末', branch: '主线', name: '学院里的衰落', tech: '占星被移出大学，不再算正经学问。', critique: '学院不教了，民间算命并没有一起消失。' },
  { id: 'leo', y: 1900, label: '1890–1910', branch: '现代', name: '神智学与艾伦·里奥', tech: '少写具体事件，改写性格和灵性。', critique: '星座性格好记，也容易说成十二种人。' },
  { id: 'hamburg', y: 1923, label: '1920–1940', branch: '技术', name: '汉堡学派与宇宙生物学', tech: '用中点和 90° 盘，把硬相位叠在一起。', critique: '几何很严，中点代表什么仍是后来的约定。' },
  { id: 'column', y: 1930, label: '1930', branch: '现代', name: '太阳星座专栏', tech: '从公主的出生盘，变成只写太阳星座。', critique: '好读，也把整张盘收成十二句话。' },
  { id: 'rudhyar', y: 1936, label: '1936', branch: '现代', name: '鲁德海尔的人本占星', tech: '把星盘写成潜能，不写成判决。', critique: '很尊重人，也更难用一件事来证伪。' },
  { id: 'greene', y: 1976, label: '1970 年代', branch: '现代', name: '莉兹·格林的心理占星', tech: '用心理学里的原型，讲土星和关系。', critique: '故事可以很深，也容易把什么都收成心理。' },
  { id: 'addey', y: 1976.5, label: '1976', branch: '技术', name: '阿迪的谐波', tech: '黄经乘以整数，看那一层新的合相。', critique: '乘法是几何，层数的含义是他的理论。' },
  { id: 'green', y: 1985, label: '1985', branch: '现代', name: '演化占星', tech: '把冥王星和月亮交点讲成灵魂课题。', critique: '故事动人，出生之后的事无法把它证伪。' },
  { id: 'hindsight', y: 1993, label: '1993', branch: '古典', name: '事后瞥见计划', tech: '把希腊文、阿拉伯文和拉丁文的原典译出来。', critique: '原典回来了，更老并不等于更真。' },
  { id: 'revival', y: 2009, label: '2000 年代', branch: '古典', name: '布伦南、乔治、戴克斯', tech: '用整宫和传统尊贵，重新讲本命盘。', critique: '规则重新可学，也别只信一家译本。' },
]
const BRANCH_COLOR: Record<string, string> = { 主线: INK, 现代: '#7f9fe0', 技术: '#7fc4c0', 古典: GOLD }

interface TodaySky { eps: number; moon: number; year: number; dec: Record<string, number> }
let todayMemo: TodaySky | null = null
let todayFlight: Promise<TodaySky> | null = null
function loadToday() {
  todayFlight ??= chartAt(new Date(), 0, 0).then((c) => {
    const dec: Record<string, number> = {}
    for (const id of DEC_IDS) dec[id] = c.pos[id].dec
    todayMemo = { eps: c.eps, moon: c.pos.moon.lon, year: c.ut.getUTCFullYear(), dec }
    return todayMemo
  })
  return todayFlight
}

function useSrc(src0?: string) {
  const [src, setSrc] = useState(src0 || 'einstein')
  useEffect(() => { if (src0) setSrc(src0) }, [src0])
  return { src, setSrc, ...useChartOf(src) }
}
function useApproach(target: number, seconds: number) {
  const reduce = reduceMotion()
  const [v, setV] = useState(target)
  const goal = useRef(target)
  goal.current = target
  const moving = !reduce && Math.abs(v - target) > 0.004
  useEffect(() => { if (reduce) setV(target) }, [reduce, target])
  useLoop(moving, (dt) => {
    setV((cur) => {
      const step = dt / seconds
      const g = goal.current
      if (Math.abs(g - cur) <= step) return g
      return cur + Math.sign(g - cur) * step
    })
  })
  return reduce ? target : v
}
function useToday() {
  const [sky, setSky] = useState<TodaySky | null>(todayMemo)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let on = true
    loadToday().then((s) => { if (on) setSky(s) }).catch(() => { if (on) setFailed(true) })
    return () => { on = false }
  }, [])
  return { sky: todayMemo ?? sky, failed }
}
function Read({ children }: { children: ReactNode }) {
  return <div className="wg-read"><span>{children}</span></div>
}
function Busy({ show }: { show: boolean }) {
  if (!show) return null
  return <div className="wg-cap">计算中…</div>
}
function Shell({ src, setSrc, birth, chart, children }: {
  src: string; setSrc: (v: string) => void; birth: ReturnType<typeof useChartOf>['birth']; chart: Chart | null; children: ReactNode
}) {
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      <Busy show={!chart && !(src === 'me' && !birth)} />
      {chart && children}
    </div>
  )
}
function ringPoint(cx: number, cy: number, r: number, lon: number) {
  return wheel(cx, cy, r, lon)
}

/* ───────── 外行星轨道比例尺 ───────── */
function orbitRadius(au: number, mode: 'far' | 'log', maxAu: number, rMax: number) {
  if (mode === 'log') {
    const lo = Math.log10(0.3), hi = Math.log10(52)
    return 18 + (Math.log10(Math.max(au, 0.3)) - lo) / (hi - lo) * (rMax - 18)
  }
  return (au / maxAu) * rMax
}
function OuterOrbits() {
  const [mode, setMode] = useState<'far' | 'log'>('far')
  const [maxAu, setMaxAu] = useState(11)
  const [spin, setSpin] = useState(0)
  const [playing, setPlaying] = usePlaying(true)
  useLoop(playing, (dt) => setSpin((s) => s + dt * 0.35))
  const size = 340, cx = size / 2, cy = size / 2, rMax = size / 2 - 28
  const rOf = (au: number) => orbitRadius(au, mode, maxAu, rMax)
  const visible = ORBITS.filter((o) => rOf(o.au * (o.ellipse ? 1 - o.e : 1)) <= rMax + 1)
  const hiddenOut = ORBITS.filter((o) => o.outer && !visible.includes(o))
  return (
    <div className="wg">
      <Note>俯视</Note>
      <Btns items={[['far', '按距离拉远'], ['log', '对数尺']]} value={mode} onChange={setMode} />
      {mode === 'far' && <Slider label="最远" min={8} max={52} step={1} value={maxAu} onChange={setMaxAu} fmt={(v) => `${v}`} />}
      <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`} style={{ fontFamily: 'inherit' }} role="img" aria-label="从水星到冥王星的轨道比例">
        <circle cx={cx} cy={cy} r={rMax + 16} fill={NIGHT} />
        <circle cx={cx} cy={cy} r={7} fill={GOLD} />
        <text x={cx} y={cy - 12} fontSize={11} fill={GOLD} textAnchor="middle">日</text>
        {visible.map((o) => {
          const near = o.ellipse ? o.au * (1 - o.e) : o.au
          if (rOf(near) > rMax + 1) return null
          const rx = rOf(o.au)
          const ry = o.ellipse && mode === 'far' ? rOf(o.au * Math.sqrt(1 - o.e * o.e)) : rx
          const focus = o.ellipse && mode === 'far' ? rx * o.e : 0
          const theta = spin / Math.sqrt(o.period)
          const dx = focus + rx * Math.cos(theta)
          const dy = -ry * Math.sin(theta)
          const labelR = Math.min(rMax - 14, Math.max(rx, ry) + 12)
          const slot = o.id === 'uranus' ? -0.9 : o.id === 'neptune' ? 0.75 : 1.7
          return (
            <g key={o.id}>
              {o.ellipse && mode === 'far'
                ? <ellipse cx={cx + focus} cy={cy} rx={rx} ry={ry} fill="none" stroke={o.color} strokeWidth={o.outer ? 1.6 : 1} opacity={0.9} />
                : <circle cx={cx} cy={cy} r={rx} fill="none" stroke={o.color} strokeWidth={o.outer ? 1.6 : 1} opacity={0.85} />}
              <circle cx={cx + dx} cy={cy + dy} r={3.2} fill={o.color} />
              {o.outer && labelR > 30 && (
                <text x={cx + Math.cos(slot) * labelR} y={cy - Math.sin(slot) * labelR} fontSize={11} fill={o.color} textAnchor="middle">{o.name.slice(0, 1)}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="wg-btns" style={{ marginTop: 0 }}><PlayBtn playing={playing} set={setPlaying} /></div>
      {hiddenOut.length > 0 && <div className="wg-cap">土星外面还有 {hiddenOut.length} 圈，把「最远」往右拉。</div>}
      {hiddenOut.length === 0 && <div className="wg-cap">三圈都进来了。</div>}
      <Read>星座各占 30°，所以每星座年数 = 周期 ÷ 12。天王星 {OUTER_PERIOD.uranus} 年，每星座 {fmtPerSign(OUTER_PERIOD.uranus)} 年；海王星 {OUTER_PERIOD.neptune} 年，每星座 {fmtPerSign(OUTER_PERIOD.neptune)} 年；冥王星 {OUTER_PERIOD.pluto} 年，每星座 {fmtPerSign(OUTER_PERIOD.pluto)} 年。</Read>
      <Read>距离以日地距离为 1。选「按距离拉远」时，冥王星画成椭圆，近日点会跑进海王星轨道内侧。水星其实也很扁，这里只把冥王星画扁。点的快慢按周期示意，不是当天的方位。</Read>
    </div>
  )
}

/* ───────── 外行星星座表 ───────── */
function SignName({ lon }: { lon: number }) {
  const i = signIdx(lon)
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>{SIGN_CN[i - 1]}</span>
}
function OuterSigns({ from = 1900, to = 2030 }: { from?: number; to?: number }) {
  const [a, b] = yearSpan(from, to)
  const mine = useMyBirth()
  const notes = useStore().notes
  const saved = useMemo(() => parseYears(notes[YEARS_KEY]), [notes])
  const mineY = mine?.date ? Number(mine.date.slice(0, 4)) : null
  const hot = useMemo(() => new Set(mineY ? [mineY, ...saved] : saved), [mineY, saved])
  const [rows, setRows] = useState<OuterSignRow[] | null>(() => SIGN_CACHE.get(`${a}:${b}`) ?? null)
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState('')
  useEffect(() => {
    let on = true
    setFailed(false)
    const hit = SIGN_CACHE.get(`${a}:${b}`)
    if (hit) { setRows(hit); return }
    setRows(null)
    outerSignRows(a, b).then((r) => { if (on) setRows(r) }).catch(() => { if (on) setFailed(true) })
    return () => { on = false }
  }, [a, b])
  const add = () => {
    const y = Number(draft)
    if (!Number.isInteger(y) || y < 1800 || y > 2100) return
    setNote(YEARS_KEY, JSON.stringify(parseYears(JSON.stringify([...saved, y]))))
    setDraft('')
  }
  const drop = (y: number) => setNote(YEARS_KEY, JSON.stringify(saved.filter((n) => n !== y)))
  return (
    <div className="wg">
      <Read>每年两行位置：1 月 1 日和 7 月 1 日，世界时零点。天王、海王、冥王换座很慢，同龄人常常相同。</Read>
      <div className="wg-btns" style={{ alignItems: 'center' }}>
        <input aria-label="家人出生年" inputMode="numeric" placeholder="家人出生年" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: 120, minHeight: 32 }} />
        <button type="button" className="wg-btn" style={tap} onClick={add}>加入</button>
        {saved.map((y) => <button type="button" key={y} className="wg-btn" style={tap} onClick={() => drop(y)}>{y} 去掉</button>)}
      </div>
      {mineY && <Read>你保存的出生年是 {mineY}{hot.has(mineY) ? '，表里会用金色标出。' : '。'}</Read>}
      {!mineY && <Read>还没保存自己的出生年。填过出生资料后，那一年会亮起来。</Read>}
      {mineY != null && (mineY < a || mineY > b) && <Read>你的出生年不在 {a}–{b} 这张表里。</Read>}
      <Busy show={!rows && !failed} />
      {failed && <Read>这张表没算出来。</Read>}
      {rows && (
        <div style={{ overflow: 'auto', maxHeight: 420 }}>
          <table className="wg-table">
            <thead>
              <tr><th rowSpan={2}>年</th><th colSpan={3}>1 月 1 日</th><th colSpan={3}>7 月 1 日</th></tr>
              <tr>{OUTERS.map((id) => <th key={`a${id}`}>{BODY_SHORT[id]}</th>)}{OUTERS.map((id) => <th key={`b${id}`}>{BODY_SHORT[id]}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} id={`oy-${r.year}`} style={hot.has(r.year) ? { background: 'rgba(194,160,90,0.2)' } : undefined}>
                  <td>{r.year}</td>
                  {r.jan.map((lon, i) => <td key={`j${i}`}><SignName lon={lon} /></td>)}
                  {r.jul.map((lon, i) => <td key={`u${i}`}><SignName lon={lon} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(a !== Math.round(from) || b !== Math.round(to)) && <Read>表的范围已收成 {a} 到 {b}。</Read>}
    </div>
  )
}

/* ───────── 海王星：预测被看不见的引力拉开 ───────── */
function NeptunePull() {
  const [added, setAdded] = useState(false)
  const mix = useApproach(added ? 1 : 0, 0.7)
  const [year, setYear] = useState(1822)
  const [playing, setPlaying] = usePlaying(true)
  useLoop(playing, (dt) => setYear((y) => (y + dt * 9 > 1846 ? 1781 : y + dt * 9)))
  const w = 340, h = 210, left = 36, right = 12
  const xOf = (y: number) => left + ((y - 1781) / (1846 - 1781)) * (w - left - right)
  const yOf = (v: number) => h / 2 - v * 0.9
  const samples = Array.from({ length: 66 }, (_, i) => 1781 + (i / 65) * 65)
  const line = (fn: (y: number) => number) => samples.map((y, i) => `${i ? 'L' : 'M'}${xOf(y).toFixed(1)} ${yOf(fn(y)).toFixed(1)}`).join(' ')
  const drift = uranusDrift(year)
  const gap = drift * (1 - mix)
  const word = Math.abs(gap) < 3 ? '两条线重合' : gap > 0 ? '超前' : '落后'
  return (
    <div className="wg">
      <Note>示意</Note>
      <svg className="wg-svg" viewBox={`0 0 ${w} ${h}`} style={{ fontFamily: 'inherit' }} role="img" aria-label="天王星先超前、再落后的示意">
        <rect x={0} y={0} width={w} height={h} fill={NIGHT} rx={8} />
        <line x1={left} y1={h / 2} x2={w - right} y2={h / 2} stroke={LINE} />
        <text x={left} y={16} fontSize={11} fill={MUTED}>超前</text>
        <text x={w - 8} y={h - 22} fontSize={11} fill={MUTED} textAnchor="end">落后</text>
        <text x={left} y={h - 8} fontSize={10} fill={MUTED}>1781</text>
        <text x={w - right} y={h - 8} fontSize={10} fill={MUTED} textAnchor="end">1846</text>
        <path d={line((y) => uranusDrift(y))} fill="none" stroke={GOLD} strokeWidth={2} />
        <path d={line((y) => uranusDrift(y) * mix)} fill="none" stroke="#7f9fe0" strokeWidth={2} strokeDasharray="5 4" />
        <circle cx={xOf(year)} cy={yOf(drift)} r={5} fill={GOLD} />
      </svg>
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <button type="button" className={`wg-btn ${added ? 'on' : ''}`} style={tap} onClick={() => setAdded((v) => !v)}>{added ? '已加上那颗看不见的行星' : '加上那颗看不见的行星'}</button>
      </div>
      <div className="wg-cap">{Math.round(year)} 年 · 观测相对预测：{word}</div>
      <Read>金线是观测，虚线是只按已知行星算出的预测。历史上它先跑到前面，再落到后面。</Read>
      <Read>1846 年，勒维耶和亚当斯各自算出位置。伽勒在预言点大约 1° 以内找到了海王星。这张图只表达「先超前，再落后」，不是当年的实测表。</Read>
    </div>
  )
}

/* ───────── 90° 盘 ───────── */
function DialMarks({ cx, cy, r, fold, busy = [] }: { cx: number; cy: number; r: number; fold: number; busy?: number[] }) {
  return (
    <g>
      {Array.from({ length: 12 }, (_, k) => {
        const [x1, y1] = ringPoint(cx, cy, r - 14, k * 30)
        const [x2, y2] = ringPoint(cx, cy, r, k * 30)
        const [gx, gy] = ringPoint(cx, cy, r - 8, k * 30 + 15)
        return (
          <g key={k} opacity={1 - fold}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} />
            <GlyphAt i={k + 1} x={gx} y={gy} size={12} color={GOLD} width={8} />
          </g>
        )
      })}
      {[0, 15, 30, 45, 60, 75].map((deg) => {
        const at = deg * 4
        const [x1, y1] = ringPoint(cx, cy, r - 10, at)
        const [x2, y2] = ringPoint(cx, cy, r, at)
        const [tx, ty] = ringPoint(cx, cy, r - 22, at)
        return (
          <g key={deg} opacity={fold}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={deg % 45 === 0 ? 1.6 : 1} />
            {!busy.some((a) => sep(a, at) < 18) && <text x={tx} y={ty + 3} fontSize={10} fill={INK} textAnchor="middle">{deg}°</text>}
          </g>
        )
      })}
    </g>
  )
}
function PointDots({ pts, cx, cy, r, atOf, inset = 48 }: { pts: { id: string; lon: number }[]; cx: number; cy: number; r: number; atOf: (lon: number) => number; inset?: number }) {
  const placed = pts.map((p, i) => ({ ...p, at: atOf(p.lon), i }))
  return (
    <g>
      {placed.map((p) => {
        const near = placed.filter((q) => q.i < p.i && sep(q.at, p.at) < 10).length
        const [x, y] = ringPoint(cx, cy, Math.max(28, r - inset - near * 16), p.at)
        return (
          <g key={p.id}>
            <circle cx={x} cy={y} r={9} fill="#0c1020" stroke={pointColor(p.id)} />
            <text x={x} y={y + 3.5} fontSize={10} fill={pointColor(p.id)} textAnchor="middle">{pointShort(p.id)}</text>
          </g>
        )
      })}
    </g>
  )
}
function Dial90({ src: src0 }: { src?: string }) {
  const { src, setSrc, birth, chart } = useSrc(src0)
  const [mode, setMode] = useState<'360' | '90'>('360')
  const fold = useApproach(mode === '90' ? 1 : 0, 0.75)
  const pts = chart ? chartPoints(chart) : []
  const pairs = useMemo(() => hardPairs(pts), [chart]) // eslint-disable-line react-hooks/exhaustive-deps
  const size = 330, cx = size / 2, cy = size / 2, R = size / 2 - 8
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      <Btns items={[['360', '360° 盘'], ['90', '90° 盘']]} value={mode} onChange={setMode} />
      <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`} style={{ fontFamily: 'inherit' }} role="img" aria-label="九十度盘折叠">
        <circle cx={cx} cy={cy} r={R} fill={NIGHT} stroke="rgba(246,241,228,0.3)" />
        <DialMarks cx={cx} cy={cy} r={R} fold={fold} busy={pts.map((p) => foldLon(p.lon, fold))} />
        {fold > 0.92 && pairs.map((p) => {
          const pa = pts.find((x) => x.id === p.a)!, pb = pts.find((x) => x.id === p.b)!
          const [x1, y1] = ringPoint(cx, cy, R * 0.42, foldLon(pa.lon, 1))
          const [x2, y2] = ringPoint(cx, cy, R * 0.42, foldLon(pb.lon, 1))
          return <line key={`${p.a}-${p.b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.kind === '合刑冲' ? '#d9734f' : '#7fb0d6'} strokeWidth={1.4} opacity={0.85} />
        })}
        <PointDots pts={pts} cx={cx} cy={cy} r={R} atOf={(lon) => foldLon(lon, fold)} />
      </svg>
      <Read>把整圈折成 90°。相差 0°、90°、180° 的会叠在一起（暖色）。相差 45° 或 135° 的，落在盘子对面（冷色）。容许 1.5°。</Read>
      {pairs.length === 0 && <Read>这张盘上没有 1.5° 以内的硬相位。</Read>}
      <div style={{ maxHeight: 220, overflow: 'auto' }}>
        {pairs.map((p) => (
          <div key={`${p.a}-${p.b}`} className="wg-read" style={{ marginTop: 2 }}>
            <span>{pointName(p.a)} 与 {pointName(p.b)} · {p.kind} · 盘上差 {p.orb.toFixed(1)}°</span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* ───────── 谐波 ───────── */
function Harmonic({ src: src0, n: n0 = 1 }: { src?: string; n?: number }) {
  const { src, setSrc, birth, chart } = useSrc(src0)
  const [n, setN] = useState(() => clamp(Math.round(n0) || 1, 1, 12))
  const pts = chart ? chartPoints(chart) : []
  const harm = useMemo(() => pts.map((p) => ({ ...p, lon: harmonicLon(p.lon, n) })), [chart, n]) // eslint-disable-line react-hooks/exhaustive-deps
  const hits = useMemo(() => conjunctions(harm, 3), [harm])
  const size = 320, cx = size / 2, cy = size / 2, R = size / 2 - 8
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      <Slider label="倍数" min={1} max={12} step={1} value={n} onChange={setN} fmt={(v) => `×${v}`} />
      <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`} style={{ fontFamily: 'inherit' }} role="img" aria-label={`第 ${n} 谐波`}>
        <circle cx={cx} cy={cy} r={R} fill={NIGHT} stroke="rgba(246,241,228,0.3)" />
        {Array.from({ length: 12 }, (_, k) => {
          const [x1, y1] = ringPoint(cx, cy, R - 16, k * 30)
          const [x2, y2] = ringPoint(cx, cy, R, k * 30)
          const [gx, gy] = ringPoint(cx, cy, R - 8, k * 30 + 15)
          return <g key={k}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} /><GlyphAt i={k + 1} x={gx} y={gy} size={12} color={GOLD} width={8} /></g>
        })}
        {hits.map((h) => {
          const pa = harm.find((p) => p.id === h.a)!, pb = harm.find((p) => p.id === h.b)!
          const [x1, y1] = ringPoint(cx, cy, R * 0.38, pa.lon)
          const [x2, y2] = ringPoint(cx, cy, R * 0.38, pb.lon)
          return <line key={`${h.a}-${h.b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth={1.5} />
        })}
        <PointDots pts={harm} cx={cx} cy={cy} r={R} atOf={(lon) => lon} />
      </svg>
      <div className="wg-cap">第 {n} 层：黄经 × {n}，再回到 360° 里</div>
      <Read>乘完之后相距 3° 以内，算这一层的合相。倍数是几何；这一层「代表什么」是后来的理论。</Read>
      {hits.length === 0 && <Read>这一层没有 3° 以内的合相。</Read>}
      {hits.map((h) => (
        <div key={`${h.a}-${h.b}`} className="wg-read" style={{ marginTop: 2 }}>
          <span>{pointName(h.a)} 与 {pointName(h.b)} 相合，差 {h.orb.toFixed(1)}°</span>
        </div>
      ))}
    </Shell>
  )
}

/* ───────── 中点 ───────── */
function Midpoints({ src: src0 }: { src?: string }) {
  const { src, setSrc, birth, chart } = useSrc(src0)
  const pts = chart ? chartPoints(chart) : []
  const hits = useMemo(() => midpointStructures(pts, 1.5), [chart]) // eslint-disable-line react-hooks/exhaustive-deps
  const size = 280, cx = size / 2, cy = size / 2, R = size / 2 - 6
  const groups: MidKind[] = ['正中点', '对冲', '九十盘']
  return (
    <Shell src={src} setSrc={setSrc} birth={birth} chart={chart}>
      <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`} style={{ fontFamily: 'inherit' }} role="img" aria-label="中点的九十度盘">
        <circle cx={cx} cy={cy} r={R} fill={NIGHT} stroke="rgba(246,241,228,0.3)" />
        {[0, 45].map((deg) => {
          const [x1, y1] = ringPoint(cx, cy, R - 8, deg * 4)
          const [x2, y2] = ringPoint(cx, cy, R, deg * 4)
          const at = deg * 4
          const [tx, ty] = ringPoint(cx, cy, R - 14, at)
          const crowded = pts.some((p) => sep(foldLon(p.lon, 1), at) < 16)
          return <g key={deg}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} />{!crowded && <text x={tx} y={ty} fontSize={10} fill={MUTED} textAnchor="middle">{deg}°</text>}</g>
        })}
        <PointDots pts={pts} cx={cx} cy={cy} r={R} atOf={(lon) => foldLon(lon, 1)} />
      </svg>
      <Read>正中点是两颗星较短弧的中点。对冲是它对面 180°。90° 盘上，相差 90° 的也会叠进同一组。容许 1.5°。古典七星、三颗外行星，加上上升和天顶。</Read>
      {hits.length === 0 && <Read>这张盘上没有 1.5° 以内的中点结构。</Read>}
      {groups.map((kind) => {
        const list = hits.filter((h) => h.kind === kind)
        if (!list.length) return null
        return (
          <div key={kind}>
            <div className="wg-cap" style={{ textAlign: 'left' }}>{kind} · {list.length} 组</div>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {list.map((h) => (
                <div key={`${h.kind}-${h.a}-${h.b}-${h.c}`} className="wg-read" style={{ marginTop: 2 }}>
                  <span>{pointShort(h.a)} = {pointShort(h.b)} / {pointShort(h.c)} · {fmtL(h.mid)} · {h.orb.toFixed(1)}°</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </Shell>
  )
}

/* ───────── 赤纬与出界 ───────── */
function DecBars({ rows, eps }: { rows: { id: string; dec: number }[]; eps: number }) {
  const w = 360, label = 28, right = 104, mid = label + (w - label - right) / 2
  const half = mid - label - 8
  const limit = 32
  const x = (dec: number) => mid + (dec / limit) * half
  const h = 16 + rows.length * 24
  return (
    <svg className="wg-svg" viewBox={`0 0 ${w} ${h}`} style={{ fontFamily: 'inherit' }} role="img" aria-label="行星赤纬">
      <line x1={x(0)} y1={8} x2={x(0)} y2={h - 6} stroke={LINE} />
      {[-eps, eps].map((d) => (
        <g key={d}>
          <line x1={x(d)} y1={8} x2={x(d)} y2={h - 6} stroke={GOLD} strokeDasharray="3 3" />
        </g>
      ))}
      <text x={x(eps) + 2} y={12} fontSize={9} fill={GOLD}>+{eps.toFixed(2)}°</text>
      {rows.map((r, i) => {
        const y = 22 + i * 24
        const oob = isOob(r.dec, eps)
        const x1 = x(0), x2 = x(r.dec)
        return (
          <g key={r.id}>
            <text x={4} y={y + 4} fontSize={12} fill={pointColor(r.id)}>{pointShort(r.id)}</text>
            <line x1={Math.min(x1, x2)} y1={y} x2={Math.max(x1, x2)} y2={y} stroke={oob ? '#d9734f' : pointColor(r.id)} strokeWidth={6} strokeLinecap="round" />
            <text x={w - 4} y={y + 4} fontSize={11} fill={oob ? '#d9734f' : MUTED} textAnchor="end">{fmtDec(r.dec)}{oob ? ' 出界' : ''}</text>
          </g>
        )
      })}
    </svg>
  )
}
function Declination({ src: src0 }: { src?: string }) {
  const { src, setSrc, birth, chart } = useSrc(src0)
  const [mode, setMode] = useState<'case' | 'today'>('case')
  const { sky, failed } = useToday()
  const rows = mode === 'today'
    ? (sky ? DEC_IDS.map((id) => ({ id, dec: sky.dec[id] })) : null)
    : (chart ? DEC_IDS.map((id) => ({ id, dec: chart.pos[id].dec })) : null)
  const eps = mode === 'today' ? sky?.eps : chart?.eps
  const need = mode === 'case' && src === 'me' && !birth
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}>
        <CasePicker value={src} onChange={setSrc} />
        <Btns items={[['case', '这张盘'], ['today', '今天']]} value={mode} onChange={setMode} />
      </div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      <Busy show={!need && (!rows || eps == null) && !failed} />
      {failed && mode === 'today' && <Read>今天的位置没算出来。</Read>}
      {rows && eps != null && (
        <>
          <DecBars rows={rows} eps={eps} />
          <Read>赤纬是离天赤道多少度，正值在北。虚线是这一天的黄赤交角，大约 {eps.toFixed(2)}°（常记成 23.44°）。绝对值比它还大，叫做出界。</Read>
          <Read>出界是几何事实。它象征「不受约束」，是后来加上的说法，这里不把它当成事实。</Read>
        </>
      )}
    </div>
  )
}

/* ───────── 二十七宿 ───────── */
function slicePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = ringPoint(cx, cy, r, a0)
  const [x1, y1] = ringPoint(cx, cy, r, a1)
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`
}
function Nakshatra() {
  const [src, setSrc] = useState('einstein')
  const { chart, birth } = useChartOf(src)
  const { sky, failed } = useToday()
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  const acc = useRef(0)
  useLoop(playing, (dt) => {
    acc.current += dt
    if (acc.current < 0.75) return
    acc.current = 0
    setDay((d) => (d + 1) % 27)
  })
  const todaySid = sky ? siderealLon(sky.moon, sky.year) : null
  const caseSid = chart ? siderealLon(chart.pos.moon.lon, chart.ut.getUTCFullYear()) : null
  const playSid = todaySid == null ? null : norm(todaySid + day * NAK_WIDTH)
  const size = 330, cx = size / 2, cy = size / 2, R = size / 2 - 8
  const mark = (lon: number, rr: number, text: string, color: string) => {
    const [x, y] = ringPoint(cx, cy, rr, lon)
    return <g><circle cx={x} cy={y} r={8} fill="#0c1020" stroke={color} /><text x={x} y={y + 3} fontSize={9} fill={color} textAnchor="middle">{text}</text></g>
  }
  const focus = playSid == null ? 0 : nakshatraIndex(playSid)
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /></div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      <Busy show={!sky && !failed} />
      {failed && <Read>今天的月亮没算出来。</Read>}
      {sky && todaySid != null && (
        <>
          <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`} style={{ fontFamily: 'inherit' }} role="img" aria-label="二十七宿">
            <circle cx={cx} cy={cy} r={R} fill={NIGHT} />
            {Array.from({ length: 27 }, (_, i) => {
              const a0 = i * NAK_WIDTH, a1 = (i + 1) * NAK_WIDTH
              const on = i === focus
              const [tx, ty] = ringPoint(cx, cy, R - 28, a0 + NAK_WIDTH / 2)
              return (
                <g key={i}>
                  <path d={slicePath(cx, cy, R - 16, a0, a1)} fill={on ? 'rgba(194,160,90,0.28)' : i % 2 ? 'rgba(246,241,228,0.04)' : 'transparent'} stroke={LINE} />
                  <text x={tx} y={ty + 3} fontSize={8} fill={on ? GOLD : MUTED} textAnchor="middle">{i + 1}</text>
                </g>
              )
            })}
            {mark(todaySid, R * 0.46, '今', '#7fc4c0')}
            {caseSid != null && mark(caseSid, R * 0.34, '案', GOLD)}
            {playSid != null && mark(playSid, R * 0.56, '走', INK)}
          </svg>
          <div className="wg-btns">
            <PlayBtn playing={playing} set={setPlaying} />
            <button type="button" className="wg-btn" style={tap} onClick={() => setDay((d) => (d + 1) % 27)}>下一日</button>
            <button type="button" className="wg-btn" style={tap} onClick={() => setDay(0)}>回到今天</button>
          </div>
          <div className="wg-cap">第 {day} 日 · 第 {focus + 1} 宿 {NAK_NAME[focus]}</div>
          <Read>月宿把恒星黄道等分成 27 份，每份 13°20′，大约是月亮走一天。这里用拉希里岁差：回归黄经减去岁差值。播放时每天正好走一宿，真实的月亮一天大约 13°，有时会在同一宿多停一会儿。</Read>
          <Read>今 = 今天的月亮（第 {nakshatraIndex(todaySid) + 1} 宿 {NAK_NAME[nakshatraIndex(todaySid)]}）。{caseSid == null ? '案例的月亮还在算。' : `案 = 这张盘的月亮（第 ${nakshatraIndex(caseSid) + 1} 宿 ${NAK_NAME[nakshatraIndex(caseSid)]}）。`}</Read>
          <div style={{ display: 'flex', height: 16, width: '100%', borderRadius: 4, overflow: 'hidden', marginTop: 8 }} aria-hidden>
            {XIU.map(([name, w], i) => <div key={name} title={`${name} ${w}`} style={{ width: `${(w / XIU_SUM) * 100}%`, background: i % 2 ? 'rgba(127,156,224,0.85)' : 'rgba(194,160,90,0.85)' }} />)}
          </div>
          <Read>上条是中国二十八宿，沿天赤道量，宽窄不等（汉代古度合计 {XIU_SUM}）。最窄是觜宿 2 度，最宽是井宿 33 度。月宿是黄道上的 27 等份，两套不是同一把尺子。</Read>
        </>
      )}
    </div>
  )
}

/* ───────── 流派地图 ───────── */
function SchoolMap() {
  const [id, setId] = useState<string | null>(null)
  return (
    <div className="wg">
      <Read>1600 到 2020。点一个名字，看它的核心做法，和一句批评。</Read>
      <div className="wg-btns">
        {(['主线', '现代', '技术', '古典'] as const).map((b) => (
          <span key={b} className="wg-read" style={{ marginTop: 0 }}><span style={{ color: BRANCH_COLOR[b] }}>● {b}</span></span>
        ))}
      </div>
      <div style={{ borderLeft: '2px solid rgba(246,241,228,0.28)', margin: '8px 0 0 8px', paddingLeft: 10, display: 'grid', gap: 6 }}>
        {SCHOOLS.map((n) => {
          const on = id === n.id
          const side = n.branch === '现代' || n.branch === '技术'
          return (
            <div key={n.id} style={{ marginLeft: side ? 16 : 0 }}>
              <button type="button" className={`wg-btn ${on ? 'on' : ''}`} style={{ ...tap, textAlign: 'left', borderColor: BRANCH_COLOR[n.branch] }} onClick={() => setId(on ? null : n.id)}>
                {n.label} · {n.name}
              </button>
              {on && (
                <>
                  <Read>核心做法：{n.tech}</Read>
                  <Read>一句批评：{n.critique}</Read>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const W08: WidgetMap = {
  outerOrbits: () => <OuterOrbits />,
  outerSigns: (a) => <OuterSigns from={num(a.from, 1900)} to={num(a.to, 2030)} />,
  neptunePull: () => <NeptunePull />,
  dial90: (a) => <Dial90 src={str(a.src)} />,
  harmonic: (a) => <Harmonic src={str(a.src)} n={num(a.n, 1)} />,
  midpoints: (a) => <Midpoints src={str(a.src)} />,
  declination: (a) => <Declination src={str(a.src)} />,
  nakshatra: () => <Nakshatra />,
  schoolMap: () => <SchoolMap />,
}
