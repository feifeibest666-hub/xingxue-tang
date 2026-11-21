import { useEffect, useState } from 'react'
import { Btns, D2R, Note, PlayBtn, Slider, lonFromDoy, seeded, useLoop, usePlaying, wheel, type WidgetMap } from './common'
import { PlanetAt, PlanetGlyph } from '../PlanetGlyph'
import { CHALDEAN, MOTION, PLANET, WEEKDAY, type Planet } from '../../data/classical'
import { fmtLon } from '../../data/zodiac'
import { dayLength, eqToHor, sunDecl } from '../../lib/astro'
import { chartAt, positionsAt, type Pos } from '../../lib/natal'

const CLASSICAL: Planet[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']
const WEEK_NAME = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function bjParts(offsetDays: number) {
  const bj = new Date(Date.now() + offsetDays * 86400000 + 8 * 3600000)
  const y = bj.getUTCFullYear(), m = bj.getUTCMonth(), d = bj.getUTCDate()
  const start = Date.UTC(y, 0, 1)
  const cur = Date.UTC(y, m, d)
  return { y, m, d, doy: Math.round((cur - start) / 86400000), wd: new Date(cur).getUTCDay(), label: `${m + 1} 月 ${d} 日` }
}

const wrap360 = (x: number) => ((x % 360) + 360) % 360
function signedElong(planet: number, sun: number) {
  return ((wrap360(planet - sun) + 540) % 360) - 180
}
function fmtArc(deg: number) {
  const sign = deg < 0 ? '-' : ''
  const a = Math.abs(deg)
  let D = Math.floor(a + 1e-9)
  let M = Math.round((a - D) * 60)
  if (M === 60) { D += 1; M = 0 }
  return `${sign}${D}°${String(M).padStart(2, '0')}′`
}
function fmtClock(h: number) {
  let x = ((h % 24) + 24) % 24
  let H = Math.floor(x)
  let M = Math.round((x - H) * 60)
  if (M === 60) { H += 1; M = 0 }
  if (H === 24) H = 0
  return `${H}:${String(M).padStart(2, '0')}`
}
function chaldeanFrom(p: Planet, steps: number) {
  const i = CHALDEAN.indexOf(p)
  return CHALDEAN[((i + steps) % 7 + 7) % 7]
}
function azName(az: number) {
  const n = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return n[Math.round(wrap360(az) / 45) % 8]
}

type Mode = 'in' | 'out'
function place(mode: Mode, s: number) {
  const we = 1
  const wp = mode === 'out' ? 0.53 : 4.15
  const inner = mode === 'in'
  const rel = inner ? wp - we : we - wp
  const E = s * 360 * (we / rel)
  const P = inner ? E + 360 * s : E + 180 - 360 * s
  const rP = inner ? Math.sin(28 * D2R) : 1.52
  const ex = Math.cos(E * D2R), ey = Math.sin(E * D2R)
  const px = Math.cos(P * D2R) * rP, py = Math.sin(P * D2R) * rP
  const lon = wrap360(Math.atan2(py - ey, px - ex) / D2R)
  const el = signedElong(lon, wrap360(E + 180))
  return { ex, ey, px, py, rP, el, lon }
}

function orbitAt(mode: Mode, sRaw: number) {
  const s = ((sRaw % 1) + 1) % 1
  const here = place(mode, s)
  const prev = place(mode, s - 0.003)
  let d = here.lon - prev.lon
  d = ((d + 540) % 360) - 180
  const station = Math.abs(d) < 0.12
  const retro = d < 0 && !station
  return { ...here, retro, station }
}

function rayHit(ex: number, ey: number, px: number, py: number, R: number) {
  const dx = px - ex, dy = py - ey
  const a = dx * dx + dy * dy
  const b = 2 * (ex * dx + ey * dy)
  const c = ex * ex + ey * ey - R * R
  const t = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a)
  return [ex + dx * t, ey + dy * t] as const
}

function phaseLabel(mode: Mode, el: number, retro: boolean, station: boolean) {
  if (station) return '留：视线正要掉头'
  if (mode === 'out' && Math.abs(Math.abs(el) - 180) < 16) return '冲日附近'
  if (mode === 'out' && Math.abs(el) < 14) return '合日附近，淹没在太阳光里'
  if (mode === 'in' && Math.abs(el) < 8 && retro) return '下合附近'
  if (mode === 'in' && Math.abs(el) < 8) return '上合附近'
  return el < 0 ? '晨星：在太阳西边' : '昏星：在太阳东边'
}

function OrbitScene({ mode, s }: { mode: Mode; s: number }) {
  const o = orbitAt(mode, s)
  const cx = 118, cy = 112, sc = 44, R = 2.42
  const X = (x: number, y: number) => [cx + x * sc, cy - y * sc] as const
  const stars = seeded(28, 9).map(([a], i) => {
    const ang = a * 360 + i * 3
    return X(R * Math.cos(ang * D2R), R * Math.sin(ang * D2R))
  })
  const [hx, hy] = rayHit(o.ex, o.ey, o.px, o.py, R)
  const [sx, sy] = X(0, 0)
  const [ex, ey] = X(o.ex, o.ey)
  const [px, py] = X(o.px, o.py)
  const [qx, qy] = X(hx, hy)
  const ring = (r: number) => {
    const [x, y] = X(r, 0)
    return <circle cx={sx} cy={sy} r={Math.hypot(x - sx, y - sy)} fill="none" stroke="rgba(246,241,228,0.18)" />
  }
  return (
    <svg className="wg-svg" viewBox="0 0 340 230">
      <circle cx={sx} cy={sy} r={R * sc} fill="rgba(91,127,168,0.05)" stroke="rgba(246,241,228,0.16)" />
      {stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.3} fill="#f6f1e4" opacity={0.75} />)}
      {ring(1)}
      {ring(o.rP)}
      <line x1={ex} y1={ey} x2={qx} y2={qy} stroke={o.retro ? '#c4633f' : '#c2a05a'} strokeDasharray="3 3" />
      <circle cx={qx} cy={qy} r={4.5} fill={o.retro ? '#c4633f' : '#c2a05a'} />
      <circle cx={sx} cy={sy} r={7} fill="#e2b34f" />
      <text x={sx + 9} y={sy - 8} fill="#f6f1e4" fontSize="11">太阳</text>
      <circle cx={ex} cy={ey} r={5} fill="#8fb0d6" />
      <text x={ex + 7} y={ey + 4} fill="#d5e4f5" fontSize="11">地球</text>
      <circle cx={px} cy={py} r={5} fill={mode === 'out' ? PLANET.mars.color : PLANET.mercury.color} />
      <text x={px + 7} y={py + 4} fill="#f6f1e4" fontSize="11">{mode === 'out' ? '火星' : '水星'}</text>
      <text x={176} y={22} fill="rgba(246,241,228,0.55)" fontSize="11">外圈是远处的恒星</text>
      <text x={176} y={40} fill={o.retro ? '#e7a090' : '#e6cf95'} fontSize="13">{o.retro ? '金点在往回走' : o.station ? '金点停住' : '金点在向前走'}</text>
      <text x={176} y={64} fill="rgba(246,241,228,0.8)" fontSize="12">距角 {fmtArc(o.el)}</text>
      <text x={176} y={84} fill="rgba(246,241,228,0.8)" fontSize="12">{o.retro ? '逆行' : o.station ? '留' : '顺行'}</text>
      <text x={176} y={112} fill="#f6f1e4" fontSize="12">{phaseLabel(mode, o.el, o.retro, o.station)}</text>
    </svg>
  )
}

function RetroWidget() {
  const [mode, setMode] = useState<Mode>('out')
  const [s, setS] = useState(0.42)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setS((x) => (x + dt * 0.045) % 1))
  return (
    <div className="wg">
      <Note>圆轨道示意</Note>
      <OrbitScene mode={mode} s={s} />
      <Slider label="会合" value={s} min={0} max={1} step={0.002} onChange={(v) => { setPlaying(false); setS(v) }} fmt={(v) => `${Math.round(v * 100)}%`} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <Btns<Mode> items={[['out', '外行星 · 火星'], ['in', '内行星 · 水星']]} value={mode} onChange={(v) => { setMode(v); setS(v === 'out' ? 0.42 : 0.95) }} />
      </div>
      <div className="wg-cap">{mode === 'out' ? '地球从内侧超过慢行星，冲日前后金点倒退。' : '水星从太阳前面超过地球，下合前后金点倒退。'}日月不会这样倒退。</div>
    </div>
  )
}

function lonMars(t: number) { return 0.5 * t - 32.4 * Math.sin(t / 40) }
function spdMars(t: number) { return 0.5 - 0.81 * Math.cos(t / 40) }

function StationWidget() {
  const [t, setT] = useState(-50)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setT((x) => (x > 80 ? -80 : x + dt * 16)))
  const xOf = (tt: number) => 40 + ((tt + 80) / 160) * 270
  const yOf = (lon: number) => 156 - ((lon + 16) / 48) * 124
  const pts = Array.from({ length: 81 }, (_, i) => {
    const tt = -80 + i * 2
    return `${xOf(tt)},${yOf(lonMars(tt))}`
  }).join(' ')
  const spd = spdMars(t)
  const kind = Math.abs(spd) < 0.06 ? '留' : spd < 0 ? '逆行' : '顺行'
  return (
    <div className="wg">
      <Note>火星量级 · 示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 210">
        <line x1={40} y1={156} x2={318} y2={156} stroke="rgba(246,241,228,0.35)" />
        <line x1={40} y1={20} x2={40} y2={156} stroke="rgba(246,241,228,0.35)" />
        <text x={148} y={176} fill="rgba(246,241,228,0.55)" fontSize="11">时间 →</text>
        <text x={8} y={16} fill="rgba(246,241,228,0.55)" fontSize="11">黄经</text>
        {[-36.2, 36.2].map((tt) => (
          <g key={tt}>
            <line x1={xOf(tt)} y1={28} x2={xOf(tt)} y2={156} stroke="rgba(194,160,90,0.55)" strokeDasharray="3 3" />
            <text x={xOf(tt) - 8} y={24} fill="#e6cf95" fontSize="12">留</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke="#d7c49a" strokeWidth={2} />
        <circle cx={xOf(t)} cy={yOf(lonMars(t))} r={5.5} fill={spd < 0 ? '#c4633f' : '#c2a05a'} />
      </svg>
      <Slider label="时间" value={t} min={-80} max={80} step={0.5} onChange={(v) => { setPlaying(false); setT(v) }} fmt={(v) => `${v > 0 ? '+' : ''}${Math.round(v)} 天`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-read"><span>视速度 <b>{spd.toFixed(2)}°/天</b></span><span>状态 <b>{kind}</b></span></div>
      <div className="wg-cap">曲线往上是顺行，中间往下是逆行。斜率变成零的两处，就是两次留。</div>
    </div>
  )
}

function SpeedsWidget() {
  const [days, setDays] = useState(10)
  const [moonSpd, setMoon] = useState(13.2)
  const [mode, setMode] = useState<'mean' | 'moon'>('mean')
  const rows: Planet[] = ['moon', 'sun', 'mercury', 'mars', 'jupiter', 'saturn']
  return (
    <div className="wg">
      <Note>{mode === 'mean' ? '平均速度' : '只改月亮'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        {rows.map((p, i) => {
          const y = 22 + i * 34
          const daily = p === 'moon' && mode === 'moon' ? moonSpd : MOTION[p].daily
          const moved = daily * (mode === 'moon' ? 1 : days)
          const laps = Math.floor(moved / 30)
          const w = Math.max(2, Math.min(168, (moved % 30) / 30 * 168))
          const slow = p === 'moon' && mode === 'moon' && moonSpd < 13.0
          const fast = p === 'moon' && mode === 'moon' && moonSpd > 13.4
          return (
            <g key={p}>
              <PlanetAt p={p} x={18} y={y} size={18} color={PLANET[p].color} />
              <text x={34} y={y + 4} fill="#f6f1e4" fontSize="12">{PLANET[p].name}</text>
              <rect x={78} y={y - 6} width={168} height={10} rx={5} fill="rgba(246,241,228,0.08)" />
              <rect x={78} y={y - 6} width={w} height={10} rx={5} fill={slow ? '#7f9fe0' : fast ? '#c4633f' : PLANET[p].color} />
              <text x={254} y={y + 4} fill="#e6cf95" fontSize="11">{mode === 'moon' ? `${daily.toFixed(1)}°/天` : laps > 0 ? `${laps} 宫又 ${fmtArc(moved % 30)}` : fmtArc(moved)}</text>
            </g>
          )
        })}
      </svg>
      {mode === 'mean'
        ? <Slider label="天数" value={days} min={1} max={30} onChange={setDays} fmt={(v) => `${v} 天`} />
        : <Slider label="月速" value={moonSpd} min={11.5} max={15.5} step={0.1} onChange={setMoon} fmt={(v) => `${v.toFixed(1)}°`} />}
      <Btns items={[['mean', '大家的平均速度'], ['moon', '只给月亮变速']] as ['mean' | 'moon', string][]} value={mode} onChange={setMode} />
      <div className="wg-cap">{mode === 'mean'
        ? `横条是一个星座（30°）。月亮 ${days} 天能跑好几宫，土星几乎不动。`
        : moonSpd < 13 ? '比月亮自己的平均（约 13.2°）慢，传统叫“慢”。它依然比土星快得多。' : moonSpd > 13.4 ? '比月亮自己的平均快，传统叫“快”。' : '接近月亮自己的平均速度。'}</div>
    </div>
  )
}

const ORDER_ROWS: { p: Planet; modern: string; ancient: string }[] = [
  { p: 'saturn', modern: '29.5 年', ancient: '约 30 年' },
  { p: 'jupiter', modern: '11.9 年', ancient: '约 12 年' },
  { p: 'mars', modern: '1.88 年', ancient: '约 2 年' },
  { p: 'sun', modern: '1 年', ancient: '1 年' },
  { p: 'venus', modern: '225 天', ancient: '跟着太阳，排在水星外' },
  { p: 'mercury', modern: '88 天', ancient: '跟着太阳，来回更快' },
  { p: 'moon', modern: '27.3 天', ancient: '约 27 天' },
]

function ChaldeanWidget() {
  const [modern, setModern] = useState(false)
  const [cur, setCur] = useState<Planet>('saturn')
  const row = ORDER_ROWS.find((r) => r.p === cur)!
  return (
    <div className="wg">
      <Note>{modern ? '现代恒星周期' : '古代排法'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        {ORDER_ROWS.map((r, i) => {
          const rad = 108 - i * 13
          const on = r.p === cur
          return (
            <g key={r.p} onClick={() => setCur(r.p)}>
              <circle cx={120} cy={116} r={rad} fill="none" stroke={on ? PLANET[r.p].color : 'rgba(246,241,228,0.16)'} strokeWidth={on ? 2.4 : 1} />
              <PlanetAt p={r.p} x={120 - rad} y={116} size={on ? 18 : 12} color={PLANET[r.p].color} />
            </g>
          )
        })}
        <text x={214} y={78} fill="#f6f1e4" fontSize="16">{PLANET[cur].name}</text>
        <text x={214} y={102} fill="#e6cf95" fontSize="13">{modern ? row.modern : row.ancient}</text>
        <text x={214} y={126} fill="rgba(246,241,228,0.7)" fontSize="12">{modern ? '绕太阳一圈' : '古人用来排队的周期'}</text>
        <text x={214} y={156} fill="rgba(246,241,228,0.55)" fontSize="11">点一层轨道</text>
      </svg>
      <Btns items={[[false, '古代估计'], [true, '现代恒星周期']]} value={modern} onChange={setModern} />
      <div className="wg-cap">{modern
        ? '由慢到快仍然是土木火日金水月。金星 225 天、水星 88 天是日心周期，古代还没有这套数字。'
        : '金星和水星的平均黄经都跟着太阳走，单靠“一年”分不出先后。会合更慢、距角更大的金星，被排在外面。'}</div>
    </div>
  )
}

const VISIT = [0, 3, 6, 2, 5, 1, 4]
const visitShort = (i: number) => PLANET[CHALDEAN[VISIT[i % 7]]].short

function HeptagramWidget() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setStep((x) => (x + dt * 0.55) % 7))
  const cx = 128, cy = 112, r = 78
  const pt = (i: number, rad = r) => {
    const [x, y] = wheel(cx, cy, rad, 270 + i * (360 / 7))
    return [x, y] as const
  }
  const seg = (i: number) => {
    const a = VISIT[i % 7], b = VISIT[(i + 1) % 7]
    const [x1, y1] = pt(a), [x2, y2] = pt(b)
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }
  const n = Math.floor(step)
  const frac = step - n
  return (
    <div className="wg">
      <Note>每跳 3 颗</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(246,241,228,0.15)" />
        {CHALDEAN.map((p, i) => {
          const [x, y] = pt(i)
          const [lx, ly] = pt(i, r + 22)
          const on = VISIT[n % 7] === i
          return (
            <g key={p}>
              <circle cx={x} cy={y} r={on ? 12 : 8} fill={on ? PLANET[p].color : '#141a2e'} stroke={PLANET[p].color} />
              <text x={lx} y={ly + 4} textAnchor="middle" fill={on ? '#e6cf95' : 'rgba(246,241,228,0.75)'} fontSize="13">{PLANET[p].short}</text>
            </g>
          )
        })}
        {Array.from({ length: n }, (_, i) => <path key={i} d={seg(i)} stroke="#c2a05a" strokeWidth={1.6} fill="none" />)}
        {n < 7 && (() => {
          const a = VISIT[n % 7], b = VISIT[(n + 1) % 7]
          const [x1, y1] = pt(a), [x2, y2] = pt(b)
          return <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * frac} y2={y1 + (y2 - y1) * frac} stroke="#e6cf95" strokeWidth={2} />
        })()}
        <text x={236} y={48} fill="rgba(246,241,228,0.55)" fontSize="11">圆周 = 迦勒底</text>
        <text x={236} y={70} fill="#e6cf95" fontSize="13">笔尖 {visitShort(n)}</text>
        <text x={236} y={96} fill="rgba(246,241,228,0.8)" fontSize="12">{Array.from({ length: n + 1 }, (_, i) => visitShort(i)).join(' → ')}</text>
      </svg>
      <Slider label="跳" value={step} min={0} max={6.99} step={0.01} onChange={(v) => { setPlaying(false); setStep(v) }} fmt={() => visitShort(n)} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-cap">圆周从慢到快，起点是土星。每次跳 3 颗：土是星期六，下一站是星期日的太阳。</div>
    </div>
  )
}

function PlanetHoursWidget() {
  const [off, setOff] = useState(0)
  const [lat, setLat] = useState(40)
  const [night, setNight] = useState(false)
  const { doy, wd, label } = bjParts(off)
  const decl = sunDecl(lonFromDoy(doy))
  const dayH = dayLength(lat, decl)
  const odd = dayH < 1 || dayH > 23
  const len = odd ? 1 : (night ? (24 - dayH) / 12 : dayH / 12)
  const start = odd ? 0 : night ? 12 + dayH / 2 : 12 - dayH / 2
  const ruler0 = WEEKDAY[wd]
  const hours = Array.from({ length: 12 }, (_, i) => chaldeanFrom(ruler0, (night ? 12 : 0) + i))
  const tomorrow = WEEKDAY[(wd + 1) % 7]
  const cx = 120, cy = 108, r0 = 46, r1 = 86
  const polar = (deg: number, rad: number) => {
    const t = deg * D2R
    return [cx + rad * Math.sin(t), cy - rad * Math.cos(t)] as const
  }
  return (
    <div className="wg">
      <Note>太阳时 · 示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        {hours.map((p, i) => {
          const a0 = i * 30, a1 = (i + 1) * 30
          const outer = [0, 0.5, 1].map((k) => polar(a0 + (a1 - a0) * k, r1))
          const inner = [1, 0.5, 0].map((k) => polar(a0 + (a1 - a0) * k, r0))
          const d = `M ${outer[0][0]} ${outer[0][1]} ` + [...outer.slice(1), ...inner].map(([x, y]) => `L ${x} ${y}`).join(' ') + ' Z'
          const [gx, gy] = polar(a0 + 15, (r0 + r1) / 2)
          return (
            <g key={i}>
              <path d={d} fill={PLANET[p].color} opacity={0.35} stroke="rgba(246,241,228,0.2)" />
              <PlanetAt p={p} x={gx} y={gy} size={15} color="#f6f1e4" width={8} />
            </g>
          )
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#e6cf95" fontSize="13">{WEEK_NAME[wd].slice(2)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(246,241,228,0.7)" fontSize="11">{night ? '夜 12 时' : '昼 12 时'}</text>
        <text x={214} y={46} fill="#f6f1e4" fontSize="13">{label}</text>
        <text x={214} y={68} fill="#e6cf95" fontSize="13">{WEEK_NAME[wd]} · {PLANET[ruler0].name}</text>
        <text x={214} y={92} fill="rgba(246,241,228,0.75)" fontSize="12">{odd ? '极昼或极夜' : `昼长 ${dayH.toFixed(1)} 小时`}</text>
        <text x={214} y={114} fill="rgba(246,241,228,0.75)" fontSize="12">{odd ? '十二等分用不上' : `每段 ${Math.round(len * 60)} 分钟`}</text>
        <text x={214} y={144} fill="rgba(246,241,228,0.75)" fontSize="12">明日第 1 时</text>
        <text x={214} y={166} fill="#e6cf95" fontSize="13">{PLANET[tomorrow].name}</text>
      </svg>
      <Slider label="日期" value={off} min={-20} max={40} onChange={setOff} fmt={() => label} />
      <Slider label="纬度" value={lat} min={20} max={55} onChange={setLat} fmt={(v) => `北纬 ${v}°`} />
      <Btns items={[[false, '白天 12 时'], [true, '夜晚 12 时']]} value={night} onChange={setNight} />
      <div className="wg-read">
        {hours.slice(0, 4).map((p, i) => <span key={i}>第 {i + 1} 时 <b>{PLANET[p].short}</b> {odd ? '' : fmtClock(start + i * len)}</span>)}
      </div>
      <div className="wg-cap">第 1 时的行星就是星期的名字。走到明天要经过 24 时，24÷7 余 3，所以跳到{PLANET[tomorrow].name}。</div>
    </div>
  )
}

const OUT_PHASES: [number, string, string][] = [
  [0.02, '合日', '和外行星同在太阳那个方向，淹没在光里。'],
  [0.22, '晨星 · 东出', '到了太阳西边。黎明前先从东方升起。名字里的“东”，是升起的地平线，不是“在太阳东边”。'],
  [0.454, '留', '冲日前视速度降到零，随后改成逆行。'],
  [0.5, '冲日', '跑到太阳正对面，整夜可见，这段通常在逆行。'],
  [0.78, '昏星', '到了太阳东边。日落后还留在西边天上，最后一次看见叫西入。'],
]
const IN_PHASES: [number, string, string][] = [
  [0.5, '上合', '在太阳背后，顺行，看不见。'],
  [0.72, '昏星', '跑到太阳东边，黄昏出现在西方。'],
  [0.84, '东大距', '黄昏时离太阳最远，大约就是最大距角。'],
  [0, '下合', '从太阳和地球中间经过，逆行，又看不见。内行星的逆行在这里。'],
  [0.16, '晨星 · 西大距', '改到太阳西边，黎明前出现。离太阳最远的清晨叫西大距。'],
]

function PhasesWidget() {
  const [mode, setMode] = useState<Mode>('out')
  const phases = mode === 'out' ? OUT_PHASES : IN_PHASES
  const [i, setI] = useState(0)
  const safe = Math.min(i, phases.length - 1)
  const [s, name, text] = phases[safe]
  return (
    <div className="wg">
      <Note>一个会合周期</Note>
      <OrbitScene mode={mode} s={s} />
      <Btns<Mode> items={[['out', '外行星'], ['in', '内行星']]} value={mode} onChange={(v) => { setMode(v); setI(0) }} />
      <Btns items={phases.map((p, k) => [k, p[1]] as [number, string])} value={safe} onChange={setI} />
      <div className="wg-cap"><b>{name}</b>　{text}</div>
    </div>
  )
}

function solarWord(p: Planet, el: number) {
  const a = Math.abs(el)
  if (a <= 17 / 60) return '日核'
  if (a <= 8.5) return '焦伤'
  if (a <= 15) return '光束下'
  if (a >= 165 && p !== 'mercury' && p !== 'venus') return p === 'moon' ? '满月前后' : '冲日附近'
  return el >= 0 ? '昏星' : '晨星'
}

function VisibilityWidget({ days = 0, max = 90 }: { days?: number; max?: number }) {
  const [off, setOff] = useState(days)
  const [pos, setPos] = useState<Record<string, Pos> | null>(null)
  useEffect(() => {
    let cancel = false
    const t = new Date(Date.now() + off * 86400000)
    const id = setTimeout(() => {
      positionsAt(t, CLASSICAL).then((p) => { if (!cancel) setPos(p as Record<string, Pos>) }).catch(() => { if (!cancel) setPos(null) })
    }, 40)
    return () => { cancel = true; clearTimeout(id) }
  }, [off])
  const cx = 118, cy = 112, R = 86
  const wedge = (a0: number, a1: number) => {
    const pts: (readonly [number, number])[] = [[cx, cy]]
    for (let a = a0; a <= a1; a += 2) pts.push(wheel(cx, cy, R, a))
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ') + ' Z'
  }
  const { label } = bjParts(off)
  return (
    <div className="wg">
      <Note>距太阳的角度</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(246,241,228,0.2)" />
        <path d={wedge(-15, 15)} fill="rgba(91,127,168,0.18)" />
        <path d={wedge(-8.5, 8.5)} fill="rgba(196,99,63,0.22)" />
        <text x={cx - R - 2} y={cy + 28} fill="rgba(246,241,228,0.45)" fontSize="10">光束</text>
        {pos && CLASSICAL.filter((p) => p !== 'sun').map((p, i) => {
          const el = signedElong(pos[p].lon, pos.sun.lon)
          const [x, y] = wheel(cx, cy, R - 8 - (i % 3) * 7, el)
          return (
            <g key={p}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={PLANET[p].color} strokeOpacity={0.35} />
              <PlanetAt p={p} x={x} y={y} size={16} color={PLANET[p].color} />
            </g>
          )
        })}
        {(() => { const [x, y] = wheel(cx, cy, R, 0); return <circle cx={x} cy={y} r={7} fill="#e2b34f" /> })()}
        <text x={214} y={36} fill="rgba(246,241,228,0.55)" fontSize="11">下弧 · 东 · 昏星</text>
        <text x={214} y={54} fill="rgba(246,241,228,0.55)" fontSize="11">上弧 · 西 · 晨星</text>
        <text x={214} y={84} fill="#f6f1e4" fontSize="13">{label}</text>
        <text x={214} y={108} fill="rgba(246,241,228,0.7)" fontSize="11">阴影 = 离太阳 15° 以内</text>
        <text x={214} y={126} fill="rgba(246,241,228,0.7)" fontSize="11">更深 = 8.5° 焦伤</text>
        <text x={214} y={144} fill="rgba(246,241,228,0.7)" fontSize="11">日核 17′ 窄到画不出</text>
      </svg>
      <Slider label="日期" value={off} min={-15} max={max} onChange={setOff} fmt={() => label} />
      <div className="wg-cap">浅阴影 15° 是希腊化常见的光束下。深阴影 8.5° 是焦伤。利利的光束外缘约 17°，这张图不画。日核 17′ 只写在字里，而且是后来的反转。</div>
      <div className="wg-read">
        {!pos && <span>计算中…</span>}
        {pos && CLASSICAL.filter((p) => p !== 'sun').map((p) => {
          const el = signedElong(pos[p].lon, pos.sun.lon)
          return <span key={p}>{PLANET[p].short} <b>{solarWord(p, el)}</b> {fmtArc(Math.abs(el))}{pos[p].retro ? ' 逆' : ''}</span>
        })}
      </div>
    </div>
  )
}

function HeliacalWidget() {
  const [evening, setEvening] = useState(false)
  const [el, setEl] = useState(6)
  const [limit, setLimit] = useState(12)
  const visible = el >= limit
  const name = evening ? (visible ? '还看得见' : '已经沉进暮光') : (visible ? '已经从晨光里出来' : '还藏在晨光里')
  const event = evening ? '把距角收到阈值以下的最后一次，叫偕日落' : '距角第一次超过阈值，叫偕日升'
  return (
    <div className="wg">
      <Note>距角示意 · 不是预报</Note>
      <svg className="wg-svg" viewBox="0 0 340 200">
        <rect x={0} y={0} width={340} height={120} fill={evening ? 'rgba(196,99,63,0.08)' : 'rgba(91,127,168,0.1)'} />
        <line x1={0} y1={120} x2={340} y2={120} stroke="rgba(246,241,228,0.55)" />
        <text x={16} y={140} fill="rgba(246,241,228,0.6)" fontSize="12">{evening ? '西方地平线 · 黄昏' : '东方地平线 · 黎明'}</text>
        <circle cx={evening ? 230 : 110} cy={148} r={16} fill="#e2b34f" opacity={0.85} />
        <text x={evening ? 214 : 94} y={178} fill="#e6cf95" fontSize="11">太阳在地下</text>
        {visible && <circle cx={evening ? 168 : 172} cy={78} r={6} fill="#f6f1e4" />}
        {visible && <text x={evening ? 148 : 182} y={74} fill="#f6f1e4" fontSize="12">行星</text>}
        {!visible && <text x={150} y={70} fill="rgba(246,241,228,0.45)" fontSize="12">还看不见</text>}
      </svg>
      <Slider label="距角" value={el} min={0} max={30} step={0.5} onChange={setEl} fmt={(v) => `${v.toFixed(0)}°`} />
      <Btns items={[[false, '清晨 · 东边升起'], [true, '黄昏 · 西边落下']]} value={evening} onChange={setEvening} />
      <Btns items={[[8, '示意 · 金 8°'], [12, '示意 · 火 12°'], [15, '示意 · 土 15°']] as [number, string][]} value={limit} onChange={setLimit} />
      <div className="wg-cap"><b>{name}</b>。{event}。8°、12°、15° 是课堂示意，不是一张通用的能见度表。越亮的行星，可以离太阳更近还被看见。</div>
    </div>
  )
}

const QUAL: Record<Planet, { x: number; y: number; line: string; kind: string }> = {
  mars: { x: 262, y: 46, line: '热而且干，两边都过分', kind: '小凶' },
  sun: { x: 228, y: 78, line: '热而干，但是发光体，不归进吉凶', kind: '发光体' },
  saturn: { x: 258, y: 168, line: '主要为冷，也偏干，冷得过分', kind: '大凶' },
  jupiter: { x: 108, y: 64, line: '温和的热，加上湿', kind: '大吉' },
  venus: { x: 86, y: 118, line: '主要为湿，略暖，也温和', kind: '小吉' },
  moon: { x: 78, y: 176, line: '主要为湿，略带一点暖', kind: '发光体' },
  mercury: { x: 170, y: 112, line: '干湿都可能，看它旁边是谁', kind: '中性' },
}

function QualitiesWidget() {
  const [p, setP] = useState<Planet>('jupiter')
  return (
    <div className="wg">
      <Note>四性 · 后世分档</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        <text x={170} y={18} textAnchor="middle" fill="#e7a090" fontSize="13">热</text>
        <text x={170} y={208} textAnchor="middle" fill="#9fb4d4" fontSize="13">冷</text>
        <text x={18} y={114} fill="#8fb0d6" fontSize="13">湿</text>
        <text x={308} y={114} fill="#d7c49a" fontSize="13">干</text>
        <line x1={170} y1={28} x2={170} y2={190} stroke="rgba(246,241,228,0.12)" />
        <line x1={36} y1={110} x2={300} y2={110} stroke="rgba(246,241,228,0.12)" />
        {(Object.keys(QUAL) as Planet[]).map((k) => (
          <g key={k} onClick={() => setP(k)}>
            <circle cx={QUAL[k].x} cy={QUAL[k].y} r={16} fill={k === p ? 'rgba(194,160,90,0.2)' : 'transparent'} />
            <PlanetAt p={k} x={QUAL[k].x} y={QUAL[k].y} size={k === p ? 26 : 18} color={PLANET[k].color} />
          </g>
        ))}
      </svg>
      <Btns items={(Object.keys(QUAL) as Planet[]).map((k) => [k, PLANET[k].short])} value={p} onChange={setP} />
      <div className="wg-cap"><b>{PLANET[p].name}</b>　{QUAL[p].line}　后世课本称{QUAL[p].kind}。冷热是托勒密的四性。大吉、小吉、大凶、小凶是后来的分档，不是温度，也不是物理性质。</div>
    </div>
  )
}

function SectWidget() {
  const [morning, setMorning] = useState(true)
  const day: Planet[] = ['sun', 'jupiter', 'saturn']
  const night: Planet[] = ['moon', 'venus', 'mars']
  const Team = ({ title, ps, extra }: { title: string; ps: Planet[]; extra?: Planet }) => (
    <div style={{ border: '1px solid rgba(246,241,228,0.16)', borderRadius: 12, padding: 8 }}>
      <div className="wg-cap" style={{ marginTop: 0 }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
        {ps.map((p) => <div key={p} style={{ textAlign: 'center' }}><PlanetGlyph p={p} size={28} color={PLANET[p].color} /><div style={{ fontSize: 12 }}>{PLANET[p].short}</div></div>)}
        {extra && <div style={{ textAlign: 'center' }}><PlanetGlyph p={extra} size={28} color={PLANET[extra].color} /><div style={{ fontSize: 12 }}>水</div></div>}
      </div>
    </div>
  )
  return (
    <div className="wg">
      <Note>调和过分</Note>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Team title="昼：日、木、土" ps={day} extra={morning ? 'mercury' : undefined} />
        <Team title="夜：月、金、火" ps={night} extra={morning ? undefined : 'mercury'} />
      </div>
      <Btns items={[[true, '水星是晨星 → 算昼'], [false, '水星是昏星 → 算夜']]} value={morning} onChange={setMorning} />
      <div className="wg-cap">土星太冷，配给有太阳的白天；火星太热太干，配给有月亮的夜晚。火星是阳性，却站在夜里——阳阴和昼夜不是同一把尺子。</div>
    </div>
  )
}

function LightsWidget() {
  const [who, setWho] = useState<'sun' | 'moon' | 'five'>('sun')
  const line = who === 'sun'
    ? '太阳自己发光，所以有白天。传统把它叫发光体。'
    : who === 'moon'
      ? '月亮的光是反射的，月相就是证据。传统仍把它和太阳一起叫发光体：一个管白天，一个管黑夜。'
      : '五颗行星在物理上也反射太阳光。传统不叫发光体，叫游星。金星再亮，也变不成白天。'
  return (
    <div className="wg">
      <Note>谁在发光</Note>
      <svg className="wg-svg" viewBox="0 0 340 200">
        <circle cx={78} cy={78} r={26} fill="#e2b34f" opacity={who === 'sun' ? 1 : 0.35} />
        <text x={78} y={122} textAnchor="middle" fill={who === 'sun' ? '#e6cf95' : 'rgba(246,241,228,0.45)'} fontSize="13">太阳 · 自己发光</text>
        <circle cx={190} cy={78} r={22} fill="none" stroke="#dcd6c6" strokeWidth={6} opacity={who === 'moon' ? 1 : 0.35} />
        <path d="M190 56 A22 22 0 1 0 190 100 A16 16 0 1 1 190 56 Z" fill="#dcd6c6" opacity={who === 'moon' ? 1 : 0.35} />
        <line x1={104} y1={78} x2={164} y2={78} stroke="rgba(226,179,79,0.7)" strokeDasharray="3 3" />
        <text x={190} y={122} textAnchor="middle" fill={who === 'moon' ? '#e6cf95' : 'rgba(246,241,228,0.45)'} fontSize="13">月亮 · 反射</text>
        {(['mercury', 'venus', 'mars', 'jupiter', 'saturn'] as Planet[]).map((p, i) => (
          <g key={p} opacity={who === 'five' ? 1 : 0.35}>
            <PlanetAt p={p} x={36 + i * 64} y={164} size={22} color={PLANET[p].color} />
          </g>
        ))}
      </svg>
      <Btns items={[['sun', '太阳'], ['moon', '月亮'], ['five', '五颗游星']]} value={who} onChange={setWho} />
      <div className="wg-cap">{line}</div>
    </div>
  )
}

const CORR = [
  { tag: '天文', text: '肉眼看是红色的；冲日时特别亮，平时暗很多。' },
  { tag: '传统', text: '托勒密：热而且干，而且两边都过分。' },
  { tag: '推导', text: '过分的热像烧、像急；干而锐像切开、分开。' },
  { tag: '传统', text: '顺着往外推：刀、铁、军人、外科、发烧、铁锈、红色。' },
]

function CorrespondWidget() {
  const [n, setN] = useState(1)
  return (
    <div className="wg">
      <Note>从核心往外推</Note>
      <svg className="wg-svg" viewBox="0 0 340 168">
        <circle cx={170} cy={84} r={28} fill="rgba(196,99,63,0.15)" stroke={PLANET.mars.color} />
        <PlanetAt p="mars" x={170} y={84} size={32} color={PLANET.mars.color} />
        {CORR.slice(0, n).map((c, i) => {
          const ang = -140 + i * 48
          const [x, y] = [170 + 78 * Math.cos(ang * D2R), 84 + 52 * Math.sin(ang * D2R)]
          return <text key={c.tag + i} x={x} y={y} textAnchor="middle" fill="#f6f1e4" fontSize="12">{c.tag}</text>
        })}
      </svg>
      <Slider label="推出" value={n} min={1} max={4} step={1} onChange={setN} fmt={(v) => `第 ${v} 步`} />
      <div className="wg-cap"><b>{CORR[n - 1].tag}</b>　{CORR[n - 1].text}指不回前面几步的类象，先丢掉。</div>
    </div>
  )
}

const AGES: { p: Planet; from: number; to: number; why: string }[] = [
  { p: 'moon', from: 0, to: 4, why: '4 年。托勒密把它对应哺乳、身体长得最快的一段。为什么恰好是 4，没有像金星那样的周期证明。' },
  { p: 'mercury', from: 4, to: 14, why: '10 年。学说话、学技艺的年纪。年数是他给定的，不是一条干净的天文公式。' },
  { p: 'venus', from: 14, to: 22, why: '8 年。5 次金星会合约 8 年，金星回到相近的位置。' },
  { p: 'sun', from: 22, to: 41, why: '19 年。长度和默冬章一样。默冬章是月相回到同一日期的历法周期，不是为了占星年龄发明的。' },
  { p: 'mars', from: 41, to: 56, why: '15 年。古书给出的就是这个数。7 次会合大约也是 15 年，那是数字巧合，不是原文的推导。' },
  { p: 'jupiter', from: 56, to: 68, why: '约 12 年。木星绕黄道大约 11.86 年，表上取成 12。这是传统取整。' },
  { p: 'saturn', from: 68, to: 90, why: '68 岁以后直到终老。最慢、最远的那一圈。图上只画到 90。' },
]

function AgesWidget() {
  const [age, setAge] = useState(30)
  const cur = AGES.find((a) => age >= a.from && (age < a.to || a.p === 'saturn')) ?? AGES[0]
  const xOf = (yr: number) => 16 + (yr / 90) * 308
  return (
    <div className="wg">
      <Note>传统分段 · 不是天文</Note>
      <svg className="wg-svg" viewBox="0 0 340 120">
        {AGES.map((a) => (
          <g key={a.p}>
            <rect x={xOf(a.from)} y={36} width={Math.max(2, xOf(a.to) - xOf(a.from) - 1)} height={28} fill={PLANET[a.p].color} opacity={a.p === cur.p ? 0.95 : 0.35} />
            <PlanetAt p={a.p} x={(xOf(a.from) + xOf(a.to)) / 2} y={50} size={16} color="#141a2e" />
          </g>
        ))}
        <line x1={xOf(age)} y1={28} x2={xOf(age)} y2={72} stroke="#f6f1e4" />
        {[0, 4, 14, 22, 41, 56, 68, 90].map((yr) => <text key={yr} x={xOf(yr)} y={96} textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="10">{yr}</text>)}
      </svg>
      <Slider label="岁数" value={age} min={0} max={90} onChange={setAge} fmt={(v) => `${v} 岁`} />
      <div className="wg-cap"><b>{age} 岁 · {PLANET[cur.p].name}</b>　{cur.why}</div>
    </div>
  )
}

const FIVE: { p: Planet; west: string; cn: string; elem: string; see: string }[] = [
  { p: 'mercury', west: '信使、往来、思维', cn: '辰星', elem: '水', see: '贴着太阳，只在晨昏出现' },
  { p: 'venus', west: '明亮、和谐、价值', cn: '太白', elem: '金', see: '最亮，发白' },
  { p: 'mars', west: '热、切割、冲突', cn: '荧惑', elem: '火', see: '红色，亮度大起大落，路径古怪' },
  { p: 'jupiter', west: '扩张、恩惠、保护', cn: '岁星', elem: '木', see: '亮而稳，大约 12 年一周' },
  { p: 'saturn', west: '冷、边界、延迟', cn: '填星', elem: '土', see: '最慢最暗，大约 30 年一周' },
]

function FiveWidget() {
  const [i, setI] = useState(2)
  const f = FIVE[i]
  return (
    <div className="wg">
      <Note>同一颗星</Note>
      <svg className="wg-svg" viewBox="0 0 340 150">
        <PlanetAt p={f.p} x={170} y={46} size={36} color={PLANET[f.p].color} />
        <text x={70} y={100} textAnchor="middle" fill="#e6cf95" fontSize="14">西方 · {PLANET[f.p].name}</text>
        <text x={70} y={122} textAnchor="middle" fill="rgba(246,241,228,0.8)" fontSize="12">{f.west}</text>
        <text x={270} y={100} textAnchor="middle" fill="#e6cf95" fontSize="14">中国 · {f.cn}</text>
        <text x={270} y={122} textAnchor="middle" fill="rgba(246,241,228,0.8)" fontSize="12">五行属{f.elem}</text>
      </svg>
      <Btns items={FIVE.map((row, k) => [k, PLANET[row.p].name] as [number, string])} value={i} onChange={setI} />
      <div className="wg-cap">两边都看见的是：{f.see}。名字和吉凶是各自的传统。</div>
    </div>
  )
}

const MAGS: { name: string; mag: number; color: string }[] = [
  { name: '金星', mag: -4.4, color: PLANET.venus.color },
  { name: '木星', mag: -2.2, color: PLANET.jupiter.color },
  { name: '火星', mag: -1, color: PLANET.mars.color },
  { name: '水星', mag: 0, color: PLANET.mercury.color },
  { name: '土星', mag: 0.7, color: '#c4c0b0' },
  { name: '天王星', mag: 5.7, color: '#7fc4c0' },
  { name: '海王星', mag: 7.8, color: '#7f9fe0' },
  { name: '冥王星', mag: 14, color: '#b08ab8' },
]

function TenWidget() {
  const [i, setI] = useState(0)
  const yOf = (mag: number) => 22 + ((mag + 5) / 20) * 176
  const m = MAGS[i]
  const eye = m.mag <= 3 ? '城市里通常看得见。' : m.mag <= 6 ? '只在暗夜的边缘，城市里看不见。' : '在肉眼下面，要望远镜。'
  const seven = i < 5 ? '它在古典七星里。' : '它不在古典七星里，行星时和星期没有它的位子。'
  return (
    <div className="wg">
      <Note>典型亮度 · 星等</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <line x1={78} y1={yOf(-5)} x2={78} y2={yOf(15)} stroke="rgba(246,241,228,0.3)" />
        <line x1={70} y1={yOf(3)} x2={250} y2={yOf(3)} stroke="rgba(194,160,90,0.45)" strokeDasharray="3 3" />
        <line x1={70} y1={yOf(6)} x2={250} y2={yOf(6)} stroke="rgba(143,176,214,0.55)" strokeDasharray="3 3" />
        <text x={254} y={yOf(3) + 4} fill="#e6cf95" fontSize="10">城市约 3 等</text>
        <text x={254} y={yOf(6) + 4} fill="#8fb0d6" fontSize="10">暗夜约 6 等</text>
        {MAGS.map((row, k) => (
          <g key={row.name} onClick={() => setI(k)}>
            <circle cx={78} cy={yOf(row.mag)} r={k === i ? 7 : 4.5} fill={row.color} />
            <text x={92} y={yOf(row.mag) + 4} fill={k === i ? '#e6cf95' : '#f6f1e4'} fontSize="12">{row.name} {row.mag > 0 ? '+' : ''}{row.mag}</text>
          </g>
        ))}
        <text x={16} y={16} fill="rgba(246,241,228,0.45)" fontSize="10">亮</text>
        <text x={16} y={214} fill="rgba(246,241,228,0.45)" fontSize="10">暗</text>
      </svg>
      <Btns items={MAGS.map((row, k) => [k, row.name] as [number, string])} value={i} onChange={setI} />
      <div className="wg-cap">{m.name}约 {m.mag > 0 ? '+' : ''}{m.mag} 等，是典型值，不是每一夜的合同。数字越小越亮。{eye}{seven}火星冲日时可以比图上的 -1 更亮。</div>
    </div>
  )
}

function TonightWidget() {
  const [off, setOff] = useState(0)
  const [hour, setHour] = useState(19.5)
  const [rows, setRows] = useState<{ p: Planet; alt: number; az: number; pos: Pos; el: number }[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let cancel = false
    const { y, m, d } = bjParts(off)
    const hh = Math.floor(hour), mm = Math.round((hour - hh) * 60)
    const ut = new Date(Date.UTC(y, m, d, hh - 8, mm))
    chartAt(ut, 39.9, 116.4).then((c) => {
      if (cancel) return
      const list = CLASSICAL.map((p) => {
        const pos = c.pos[p]
        const h = eqToHor(pos.ra, pos.dec, 39.9, c.ramc)
        return { p, alt: h.alt, az: h.az, pos, el: signedElong(pos.lon, c.pos.sun.lon) }
      })
      setRows(list)
      setErr('')
    }).catch(() => { if (!cancel) setErr('这次没算出来') })
    return () => { cancel = true }
  }, [off, hour])
  const { label } = bjParts(off)
  const cx = 170, hy = 150
  const sky = (az: number, alt: number) => {
    const t = (az - 180) * D2R
    return [cx + Math.sin(t) * (92 - alt) * 1.15, hy - Math.max(0, alt) * 1.35] as const
  }
  const sun = rows?.find((r) => r.p === 'sun')
  return (
    <div className="wg">
      <Note>北京 · 北纬 40°</Note>
      <svg className="wg-svg" viewBox="0 0 340 200">
        <path d="M40 150 A130 130 0 0 1 300 150" fill="rgba(91,127,168,0.08)" stroke="rgba(246,241,228,0.35)" />
        <line x1={24} y1={150} x2={316} y2={150} stroke="rgba(246,241,228,0.45)" />
        <text x={28} y={166} fill="rgba(246,241,228,0.5)" fontSize="11">东</text>
        <text x={164} y={166} fill="rgba(246,241,228,0.5)" fontSize="11">南</text>
        <text x={300} y={166} fill="rgba(246,241,228,0.5)" fontSize="11">西</text>
        {rows?.filter((r) => r.p !== 'sun' && r.alt > 0 && Math.cos((r.az - 180) * D2R) > 0).map((r) => {
          const [x, y] = sky(r.az, r.alt)
          return <PlanetAt key={r.p} p={r.p} x={x} y={y} size={18} color={PLANET[r.p].color} />
        })}
        <text x={170} y={24} textAnchor="middle" fill="#e6cf95" fontSize="13">{label} {fmtClock(hour)}{sun && sun.alt > -6 ? ' · 天还亮' : ''}</text>
      </svg>
      <Slider label="日期" value={off} min={-10} max={20} onChange={setOff} fmt={() => label} />
      <Slider label="钟点" value={hour} min={17} max={23} step={0.25} onChange={setHour} fmt={(v) => fmtClock(v)} />
      {err && <div className="wg-cap">{err}</div>}
      <div className="wg-read">
        {!rows && <span>计算中…</span>}
        {rows?.filter((r) => r.p !== 'sun').map((r) => (
          <span key={r.p}>{PLANET[r.p].name} <b>{r.alt > 0 ? `${azName(r.az)} ${r.alt.toFixed(0)}°` : '未升起'}</b> {fmtLon(r.pos.lon)} {r.pos.retro ? '逆' : '顺'} {solarWord(r.p, r.el)}</span>
        ))}
      </div>
      <div className="wg-cap">面向南方。北侧的星不画在弧上，但写在下面。钟点是北京时间的近似，高度够用来认星，不是观测预报。</div>
    </div>
  )
}

export const W02B: WidgetMap = {
  's2b-retrograde': () => <RetroWidget />,
  's2b-station': () => <StationWidget />,
  's2b-speeds': () => <SpeedsWidget />,
  's2b-chaldean': () => <ChaldeanWidget />,
  's2b-heptagram': () => <HeptagramWidget />,
  's2b-planetHours': () => <PlanetHoursWidget />,
  's2b-phases': () => <PhasesWidget />,
  's2b-visibility': (a) => <VisibilityWidget days={Number(a.days ?? 0)} max={Number(a.max ?? 90)} />,
  's2b-heliacal': () => <HeliacalWidget />,
  's2b-qualities': () => <QualitiesWidget />,
  's2b-sect': () => <SectWidget />,
  's2b-lights': () => <LightsWidget />,
  's2b-correspond': () => <CorrespondWidget />,
  's2b-ages': () => <AgesWidget />,
  's2b-five': () => <FiveWidget />,
  's2b-ten': () => <TenWidget />,
  's2b-tonight': () => <TonightWidget />,
}
