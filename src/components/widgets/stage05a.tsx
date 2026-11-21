import { useEffect, useMemo, useState } from 'react'
import { GlyphAt } from '../Glyph'
import { PlanetAt } from '../PlanetGlyph'
import { ANGULARITY, HOUSE_TOPICS, JOY, PLANET, type Planet } from '../../data/classical'
import { SIGNS, fmtLon } from '../../data/zodiac'
import { eclToEq, OBLIQUITY } from '../../lib/astro'
import {
  BODY_NAME, CLASSICAL, HOUSE_SYSTEM_NAME, ascFrom, chartAt, cusps, houseOf, mcFrom, norm, wholeHouse,
  type Chart, type HouseSystem,
} from '../../lib/natal'
import { Btns, D2R, Note, PlayBtn, Slider, useLoop, usePlaying, wheel, type WidgetMap } from './common'

const EPS = OBLIQUITY
const SIGN_NAME = (lon: number) => SIGNS[Math.floor(norm(lon) / 30)].name

/** 折进 (−180°, 180°]，避免把"往回走几度"卷成将近 360°。 */
const fold180 = (d: number) => ((d + 180) % 360 + 360) % 360 - 180

/** 一个星座升起要多久（太阳时，小时）。
 *  星座里有永不升落的度数时返回 null。
 *  back：上升点扫过这段时黄经在减小（极圈内才会出现），不能把卷出来的大角当成升起用时。
 */
function risingHours(sign0: number, lat: number): { h: number; back: boolean } | null {
  const oa = (lon: number) => {
    const { ra, dec } = eclToEq(lon, 0, EPS)
    const x = Math.tan(lat * D2R) * Math.tan(dec * D2R)
    if (Math.abs(x) > 1) return null
    return ra - Math.asin(x) / D2R
  }
  const pts = [0, 7.5, 15, 22.5, 30].map((k) => oa(sign0 * 30 + k))
  if (pts.some((v) => v == null)) return null
  let total = 0
  let back = false
  for (let i = 1; i < pts.length; i++) {
    const d = fold180(pts[i]! - pts[i - 1]!)
    if (d < -0.02) back = true
    total += d
  }
  return { h: (Math.abs(total) / 15) * (23.934 / 24), back }
}

function skyPoint(cx: number, hy: number, r: number, side: 'N' | 'S', alt: number) {
  const a = Math.max(-5, Math.min(95, alt)) * D2R
  const x = cx + (side === 'S' ? 1 : -1) * r * Math.cos(a)
  const y = hy - r * Math.sin(a)
  return { x, y }
}

/* ── 地平线与子午线（第 169 天）── */
function HorizonWidget(args: Record<string, unknown>) {
  const [lat, setLat] = useState(Number(args.lat ?? 40))
  const [alt, setAlt] = useState(35)
  const cx = 170, hy = 198, R = 148
  const zen = skyPoint(cx, hy, R, 'N', 90)
  const eqSide = lat >= 0 ? 'S' : 'N'
  const eq = skyPoint(cx, hy, R, eqSide, 90 - Math.abs(lat))
  const star = skyPoint(cx, hy, R, 'S', alt)
  const elevated = lat >= 0
    ? { ...skyPoint(cx, hy, R, 'N', lat), name: '天北极', dx: -52 }
    : { ...skyPoint(cx, hy, R, 'S', -lat), name: '南天极', dx: 8 }
  return (
    <div className="wg">
      <Note>子午面 · 示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 236">
        <path d={`M ${cx - R} ${hy} A ${R} ${R} 0 0 1 ${cx + R} ${hy}`} fill="rgba(91,127,168,0.12)" stroke="#c2a05a" strokeDasharray="5 4" />
        <line x1={20} y1={hy} x2={320} y2={hy} stroke="rgba(246,241,228,0.55)" />
        <line x1={cx} y1={hy} x2={zen.x} y2={zen.y} stroke="rgba(246,241,228,0.28)" />
        <circle cx={zen.x} cy={zen.y} r={5} fill="#f6f1e4" />
        <circle cx={elevated.x} cy={elevated.y} r={5} fill="#c2a05a" />
        <circle cx={eq.x} cy={eq.y} r={4} fill="#5b7fa8" />
        <circle cx={star.x} cy={star.y} r={6} fill="#e2b34f" stroke="#141a2e" />
        <text x={24} y={hy + 16} fill="rgba(246,241,228,0.7)" fontSize="12">北</text>
        <text x={304} y={hy + 16} fill="rgba(246,241,228,0.7)" fontSize="12">南</text>
        <text x={zen.x + 8} y={zen.y + 4} fill="#f6f1e4" fontSize="12">头顶</text>
        <text x={elevated.x + elevated.dx} y={elevated.y - 8} fill="#c2a05a" fontSize="11">{elevated.name}</text>
        <text x={eq.x + 6} y={eq.y + 4} fill="#8fb0d6" fontSize="11">天赤道</text>
        <text x={Math.min(250, star.x + 8)} y={star.y - 8} fill="#e2b34f" fontSize="11">一颗星</text>
      </svg>
      <Slider label="纬度" value={lat} min={-66} max={66} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
      <Slider label="高度角" value={alt} min={0} max={90} step={1} onChange={setAlt} fmt={(v) => `${v}°`} />
      <div className="wg-read">
        <span>天北极高度 <b>{lat}°</b> = 纬度</span>
        <span>这颗星离地平线 <b>{alt}°</b></span>
      </div>
      <div className="wg-cap">
        金虚线是<b>子午线</b>：北点、头顶、南点在同一个大圆上。看得见的那一极，高度等于纬度的绝对值。
        {lat < 0 ? '南半球天北极在北地平线下面。' : '北极星离天北极不到 1°，所以看起来差不多这么高。'}
      </div>
    </div>
  )
}

/* ── 地平线扫过黄道：上升、四轴、恒星日、4 分钟（第 170–173、178 天）── */
function SweepWidget(args: Record<string, unknown>) {
  const mode = String(args.mode ?? 'asc')
  const [hour, setHour] = useState(Number(args.hour ?? 6))
  const [lat, setLat] = useState(Number(args.lat ?? 40))
  const [day, setDay] = useState(0)
  const [mins, setMins] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setHour((h) => (h + dt * 0.7) % 24))
  const ramc = norm(hour * 15 + day * 0.9856 + (mode === 'minute' ? mins * 0.25 : 0))
  const asc = ascFrom(ramc, EPS, lat)
  const mc = mcFrom(ramc, EPS)
  const dsc = norm(asc + 180), ic = norm(mc + 180)
  const base = ascFrom(norm(hour * 15), EPS, lat)
  let shift = asc - base
  if (shift > 180) shift -= 360
  if (shift < -180) shift += 360
  const qAsc = norm(ic - asc)
  const qNext = norm(dsc - ic)
  const cx = 170, cy = 118, R = 86
  const P = (lon: number, r = R) => wheel(cx, cy, r, lon)
  const axes: [number, string, string][] = [[asc, '上升', '#e2b34f'], [mc, '天顶', '#c2a05a'], [dsc, '下降', '#8fb0d6'], [ic, '天底', '#8aa9b8']]
  return (
    <div className="wg">
      <Note>几何 · ε 23.44°</Note>
      <svg className="wg-svg" viewBox="0 0 340 236">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(194,160,90,0.45)" />
        {SIGNS.map((s, i) => {
          const [x, y] = P(i * 30 + 15, R + 16)
          return <GlyphAt key={s.i} i={s.i} x={x} y={y} size={15} color="rgba(246,241,228,0.8)" width={8} />
        })}
        <line x1={P(asc)[0]} y1={P(asc)[1]} x2={P(dsc)[0]} y2={P(dsc)[1]} stroke="#5b7fa8" strokeWidth={2} />
        <line x1={P(mc)[0]} y1={P(mc)[1]} x2={P(ic)[0]} y2={P(ic)[1]} stroke="#c2a05a" strokeWidth={2} />
        {axes.map(([lon, name, color]) => {
          const [x, y] = P(lon)
          return (
            <g key={name}>
              <circle cx={x} cy={y} r={4.5} fill={color} />
              <text x={x + (x < cx ? -28 : 8)} y={y + (y < cy ? -6 : 12)} fill={color} fontSize="11">{name}</text>
            </g>
          )
        })}
      </svg>
      <Slider label="恒星时" value={hour} min={0} max={24} step={0.05} onChange={(v) => { setPlaying(false); setHour(v) }} fmt={(v) => `${Math.floor(v)}时${String(Math.round((v % 1) * 60)).padStart(2, '0')}分`} />
      <Slider label="纬度" value={lat} min={-66} max={66} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
      {mode === 'minute' && <Slider label="加减分" value={mins} min={-120} max={120} step={1} onChange={setMins} fmt={(v) => `${v > 0 ? '+' : ''}${v} 分`} />}
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        {mode === 'sidereal' && (
          <button className="wg-btn" onClick={() => setDay((d) => d + 1)}>同一钟点的下一天</button>
        )}
        {mode === 'sidereal' && day > 0 && <button className="wg-btn" onClick={() => setDay(0)}>回到今天</button>}
      </div>
      <div className="wg-read">
        <span>上升 <b>{fmtLon(asc)}</b></span>
        <span>天顶 <b>{fmtLon(mc)}</b></span>
        <span>下降 <b>{fmtLon(dsc)}</b></span>
        <span>天底 <b>{fmtLon(ic)}</b></span>
      </div>
      <div className="wg-cap">
        {mode === 'minute'
          ? <>钟点改了 <b>{mins}</b> 分，上升黄经动了 <b>{shift.toFixed(2)}°</b>（平均约每 4 分钟 1°，快升慢升时不是正好）。</>
          : mode === 'sidereal'
            ? <>过了 <b>{day}</b> 天、钟点不变，上升黄经动了 <b>{shift.toFixed(2)}°</b>。想保住原来的上升点，钟大约要提前 {day * 4} 分钟。</>
            : <>拖纬度：<b>天顶的黄经不动，上升点会动</b>。升到天底 {qAsc.toFixed(0)}°，旁边的象限 {qNext.toFixed(0)}°，加起来 180°，不是各占 90°。</>}
      </div>
    </div>
  )
}

/* ── 天顶不是头顶（第 171 天）── */
function ZenithWidget(args: Record<string, unknown>) {
  const [hour, setHour] = useState(Number(args.hour ?? 0))
  const [lat, setLat] = useState(Number(args.lat ?? 40))
  const mc = mcFrom(hour * 15, EPS)
  const dec = eclToEq(mc, 0, EPS).dec
  const zd = Math.abs(lat - dec)
  const alt = 90 - zd
  const cx = 170, hy = 200, R = 150
  const zen = { x: cx, y: hy - R }
  const side = dec <= lat ? 'S' : 'N'
  const dot = skyPoint(cx, hy, R, side, Math.max(0, alt))
  return (
    <div className="wg">
      <Note>子午面 · 几何</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <path d={`M ${cx - R} ${hy} A ${R} ${R} 0 0 1 ${cx + R} ${hy}`} fill="rgba(91,127,168,0.1)" />
        <line x1={24} y1={hy} x2={316} y2={hy} stroke="rgba(246,241,228,0.5)" />
        <line x1={cx} y1={hy} x2={zen.x} y2={zen.y} stroke="rgba(246,241,228,0.25)" />
        <circle cx={zen.x} cy={zen.y} r={5} fill="#f6f1e4" />
        <text x={zen.x + 8} y={zen.y + 4} fill="#f6f1e4" fontSize="12">头顶</text>
        {alt > 0 && (
          <g>
            <line x1={zen.x} y1={zen.y} x2={dot.x} y2={dot.y} stroke="#c2a05a" strokeWidth={2} />
            <circle cx={dot.x} cy={dot.y} r={6} fill="#c2a05a" />
            <text x={dot.x + (side === 'S' ? 8 : -46)} y={dot.y + 4} fill="#c2a05a" fontSize="12">天顶</text>
          </g>
        )}
        <text x={28} y={hy + 16} fill="rgba(246,241,228,0.65)" fontSize="12">北</text>
        <text x={300} y={hy + 16} fill="rgba(246,241,228,0.65)" fontSize="12">南</text>
      </svg>
      <Slider label="恒星时" value={hour} min={0} max={24} step={0.1} onChange={setHour} fmt={(v) => `${v.toFixed(1)} 时`} />
      <Slider label="纬度" value={lat} min={0} max={70} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
      <div className="wg-read">
        <span>黄道上的天顶 <b>{fmtLon(mc)}</b></span>
        <span>赤纬 <b>{dec.toFixed(1)}°</b></span>
        <span>离头顶 <b>{zd.toFixed(1)}°</b></span>
      </div>
      <div className="wg-cap">
        {alt <= 0
          ? '这个交点掉到地平线下面了。纬度太高、赤纬又偏南时，黄道上的天顶够不着地平线以上。'
          : <>头顶在正上方。占星的<b>天顶</b>在黄道上，沿子午线还差 {zd.toFixed(0)}°。
            {Math.abs(lat) > EPS
              ? `这个纬度最近也差约 ${Math.max(0, Math.abs(lat) - EPS).toFixed(0)}°（纬度减黄赤交角）。`
              : `纬度在 ±${EPS}° 以内，黄道有机会正好经过头顶。`}</>}
      </div>
    </div>
  )
}

/* ── 24 小时：上升星座何时切换（第 174 天）── */
function SignClockWidget(args: Record<string, unknown>) {
  const [lat, setLat] = useState(Number(args.lat ?? 40))
  const [hour, setHour] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setHour((h) => (h + dt * 1.2) % 24))
  const asc = ascFrom(hour * 15, EPS, lat)
  const rows = useMemo(() => SIGNS.map((s, i) => ({ s, r: risingHours(i, lat) })), [lat])
  const forward = rows.flatMap((row) => (row.r && !row.r.back ? [{ s: row.s, h: row.r.h }] : []))
  const fastest = forward.slice().sort((a, b) => a.h - b.h)[0]
  const slowest = forward.slice().sort((a, b) => b.h - a.h)[0]
  const anyBack = rows.some((row) => row.r?.back)
  return (
    <div className="wg">
      <Note>几何</Note>
      <div className="wg-read"><span>现在上升 <b>{fmtLon(asc)}</b></span><span>{SIGN_NAME(asc)}座</span></div>
      <svg className="wg-svg" viewBox="0 0 340 232">
        {rows.map((r, i) => {
          const w = !r.r || r.r.back ? 0 : Math.min(200, (r.r.h / 4) * 200)
          const hot = r.s === fastest?.s || r.s === slowest?.s
          const label = r.r == null ? '有度数不升起' : r.r.back ? `倒走 ${r.r.h.toFixed(2)} 时` : `${r.r.h.toFixed(2)} 小时`
          return (
            <g key={r.s.i}>
              <text x={8} y={16 + i * 18} fill="#f6f1e4" fontSize="11">{r.s.name}</text>
              <rect x={48} y={6 + i * 18} width={w} height={11} rx={2} fill={hot ? '#c2a05a' : '#5b7fa8'} opacity={0.85} />
              <text x={236} y={16 + i * 18} fill="rgba(246,241,228,0.75)" fontSize="11">{label}</text>
            </g>
          )
        })}
      </svg>
      <Slider label="恒星时" value={hour} min={0} max={24} step={0.02} onChange={(v) => { setPlaying(false); setHour(v) }} fmt={(v) => `${v.toFixed(2)} 时`} />
      <Slider label="纬度" value={lat} min={-75} max={75} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-cap">
        {fastest && slowest
          ? <>最快 <b>{fastest.s.name}</b> {fastest.h.toFixed(2)} 小时，最慢 <b>{slowest.s.name}</b> {slowest.h.toFixed(2)} 小时。
            {rows.some((r) => r.r == null) ? '有星座含着永不升起的度数，十二条加不齐。' : anyBack ? '' : '十二条加起来是一个恒星日。'}
            {anyBack ? '标成"倒走"的，是上升点黄经在减小，不是真的要升二十多个小时。' : ''}</>
          : '这个纬度上，有的星座含着永不升起的度数。'}
      </div>
    </div>
  )
}

/* ── 十二宫格子：主题、角续果、喜乐（第 179 天）── */
function TwelveWidget(args: Record<string, unknown>) {
  const [house, setHouse] = useState(Number(args.house ?? 1))
  const [layer, setLayer] = useState<'num' | 'topic' | 'joy'>('num')
  const cx = 170, cy = 124, R = 96
  const joyOf = (h: number) => (Object.entries(JOY) as [Planet, number][]).find(([, n]) => n === h)?.[0]
  const sector = (a0: number, a1: number) => {
    const span = norm(a1 - a0)
    let d = `M ${cx} ${cy}`
    for (let i = 0; i <= 10; i++) {
      const [x, y] = wheel(cx, cy, R, a0 + (span * i) / 10)
      d += ` L ${x} ${y}`
    }
    return d + ' Z'
  }
  const tone = (h: number) => (ANGULARITY(h) === '角宫' ? 'rgba(194,160,90,0.45)' : ANGULARITY(h) === '续宫' ? 'rgba(91,127,168,0.35)' : 'rgba(246,241,228,0.08)')
  return (
    <div className="wg">
      <Note>从上升起 · 逆时针</Note>
      <svg className="wg-svg" viewBox="0 0 340 250">
        {Array.from({ length: 12 }, (_, i) => {
          const h = i + 1
          const a0 = i * 30
          const a1 = a0 + 30
          const [lx, ly] = wheel(cx, cy, R * 0.62, a0 + 15)
          const joy = joyOf(h)
          const topic = HOUSE_TOPICS[h - 1].slice(0, 2)
          return (
            <g key={h} onClick={() => setHouse(h)}>
              <path d={sector(a0, a1)} fill={house === h ? 'rgba(194,160,90,0.55)' : tone(h)} stroke="rgba(246,241,228,0.25)" />
              <text x={lx} y={ly + 4} textAnchor="middle" fill="#f6f1e4" fontSize="13">{layer === 'topic' ? topic : h}</text>
              {layer === 'joy' && joy && <PlanetAt p={joy} x={lx} y={ly - 18} size={14} color={PLANET[joy].color} width={7} />}
            </g>
          )
        })}
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#c2a05a" fontSize="11">上升在左</text>
      </svg>
      <Btns items={[['num', '只看宫号'], ['topic', '传统主题'], ['joy', '喜乐']]} value={layer} onChange={setLayer} />
      <div className="wg-read">
        <span>第 <b>{house}</b> 宫</span>
        <span>{ANGULARITY(house)}</span>
        <span>{HOUSE_TOPICS[house - 1]}</span>
      </div>
      <div className="wg-cap">
        {joyOf(house) ? <>这是<b>{PLANET[joyOf(house)!].name}</b>的喜乐宫。</> : '这一宫没有古典七星的喜乐。'}
        主题和喜乐先看见就好，第 5 周才推导它们为什么是这样。
      </div>
    </div>
  )
}

/* ── 太阳顺时针穿宫；也可做 10 道练习（第 180–181 天）── */
const DRILL_HOURS = [0, 1, 3, 4, 6, 8, 10, 13, 18, 22]
function SunHouseWidget(args: Record<string, unknown>) {
  const drill = Boolean(args.drill)
  const [lat, setLat] = useState(Number(args.lat ?? 40))
  const [hour, setHour] = useState(8)
  const [sys, setSys] = useState<HouseSystem>('porphyry')
  const [playing, setPlaying] = usePlaying(false)
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  useLoop(!drill && playing, (dt) => setHour((h) => (h + dt * 0.8) % 24))
  const sunLon = 51.04
  const { ra } = eclToEq(sunLon, 0, EPS)
  const useHour = drill ? DRILL_HOURS[Math.min(step, 9)] : hour
  const ramc = norm(ra + (useHour - 12) * 15)
  const asc = ascFrom(ramc, EPS, lat)
  const mc = mcFrom(ramc, EPS)
  const cs = cusps({ asc, mc, ramc, eps: EPS, lat }, sys)
  const hsun = cs ? houseOf(sunLon, cs) : null
  const cx = 170, cy = 118, R = 84
  const at = (lon: number, r = R) => wheel(cx, cy, r, lon - asc)
  return (
    <div className="wg">
      <Note>{drill ? `练习 ${Math.min(step + 1, 10)} / 10` : '地方太阳时 · 几何'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 240">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(246,241,228,0.2)" />
        {cs && cs.map((c, i) => {
          const [x, y] = at(c)
          const mid = norm(c + norm(cs[(i + 1) % 12] - c) / 2)
          const [lx, ly] = at(mid, R * 0.62)
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(194,160,90,0.45)" />
              <text x={lx} y={ly + 4} textAnchor="middle" fill="#f6f1e4" fontSize="12">{i + 1}</text>
            </g>
          )
        })}
        {SIGNS.map((s, i) => {
          const [x, y] = at(i * 30 + 15, R + 16)
          return <GlyphAt key={s.i} i={s.i} x={x} y={y} size={14} color="rgba(246,241,228,0.75)" width={8} />
        })}
        {(() => { const [x, y] = at(sunLon, R * 0.78); return <circle cx={x} cy={y} r={7} fill="#e2b34f" /> })()}
        <text x={8} y={232} fill="rgba(246,241,228,0.55)" fontSize="11">金点是太阳。宫号逆时针增大，太阳随时间顺时针走。</text>
      </svg>
      {!drill && (
        <>
          <Slider label="太阳时" value={hour} min={0} max={24} step={0.05} onChange={(v) => { setPlaying(false); setHour(v) }} fmt={(v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`} />
          <Slider label="纬度" value={lat} min={0} max={60} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
          <Btns<HouseSystem> items={[['porphyry', '波菲利'], ['whole', '整宫'], ['equal', '等宫'], ['placidus', '普拉西度']]} value={sys} onChange={setSys} />
          <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
        </>
      )}
      {drill && step < 10 && (
        <div className="wg-btns">
          {Array.from({ length: 12 }, (_, i) => (
            <button key={i} className={`wg-btn ${picked === i + 1 ? 'on' : ''}`} onClick={() => {
              if (picked != null || hsun == null) return
              setPicked(i + 1)
              if (i + 1 === hsun) setScore((n) => n + 1)
            }}>{i + 1} 宫</button>
          ))}
        </div>
      )}
      <div className="wg-read">
        <span>{drill ? '题目时刻' : '时刻'} <b>{Math.floor(useHour)}:{String(Math.round((useHour % 1) * 60)).padStart(2, '0')}</b></span>
        <span>上升 <b>{fmtLon(asc)}</b></span>
        <span>太阳在 <b>{hsun == null ? '算不出' : `第 ${hsun} 宫`}</b></span>
        {drill && <span>得分 <b>{score}</b></span>}
      </div>
      {drill && picked != null && step < 10 && (
        <div className="wg-btns">
          <button className="wg-btn on" onClick={() => { setPicked(null); setStep((s) => s + 1) }}>{step >= 9 ? '看得分' : '下一题'}</button>
        </div>
      )}
      <div className="wg-cap">
        {drill && step >= 10
          ? <>10 道做完，对了 <b>{score}</b> 道。四个锚点不变：日出在上升，正午在天顶，日落在下降，午夜在天底。</>
          : <>太阳固定在金牛 21°（5 月中的样子）。正午附近看第 10 宫；把宫位制改成等宫，正午常常不在 10 宫。</>}
      </div>
    </div>
  )
}

/* ── 宫位制变形，纬度拖到极圈（第 183–187、192–193 天）── */
function SystemsWidget(args: Record<string, unknown>) {
  const init = String(args.sys ?? 'placidus')
  const start: HouseSystem = init === 'whole' || init === 'equal' || init === 'porphyry' || init === 'placidus' ? init : 'placidus'
  const [sys, setSys] = useState<HouseSystem>(start)
  const [lat, setLat] = useState(Number(args.lat ?? 40))
  const [hour, setHour] = useState(Number(args.hour ?? 8))
  const ramc = hour * 15
  const asc = ascFrom(ramc, EPS, lat)
  const mc = mcFrom(ramc, EPS)
  const cs = cusps({ asc, mc, ramc, eps: EPS, lat }, sys)
  const cx = 170, cy = 112, R = 86
  const at = (lon: number, r = R) => wheel(cx, cy, r, lon - asc)
  const sizes = cs ? cs.map((c, i) => norm(cs[(i + 1) % 12] - c)) : []
  const max = sizes.length ? Math.max(...sizes) : 0
  const min = sizes.length ? Math.min(...sizes) : 0
  const mcHouse = cs ? houseOf(mc, cs) : null
  const daySpan = useMemo(() => {
    if (sys === 'whole' || sys === 'equal') return null
    let lo = Infinity, hi = 0, missed = 0
    for (let h = 0; h < 24; h += 0.25) {
      const ramcH = h * 15
      const a = ascFrom(ramcH, EPS, lat)
      const m = mcFrom(ramcH, EPS)
      const all = cusps({ asc: a, mc: m, ramc: ramcH, eps: EPS, lat }, sys)
      if (!all) { missed++; continue }
      for (let i = 0; i < 12; i++) {
        const w = norm(all[(i + 1) % 12] - all[i])
        if (w < lo) lo = w
        if (w > hi) hi = w
      }
    }
    if (!Number.isFinite(lo)) return { fail: true as const }
    return { min: lo, max: hi, missed }
  }, [sys, lat])
  return (
    <div className="wg">
      <Note>几何</Note>
      <svg className="wg-svg" viewBox="0 0 340 228">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(246,241,228,0.2)" />
        {cs && cs.map((c, i) => {
          const [x, y] = at(c)
          const mid = norm(c + sizes[i] / 2)
          const [lx, ly] = at(mid, R * 0.58)
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={i % 3 === 0 ? '#c2a05a' : 'rgba(246,241,228,0.35)'} />
              <text x={lx} y={ly + 4} textAnchor="middle" fill="#f6f1e4" fontSize="12">{i + 1}</text>
            </g>
          )
        })}
        {(() => { const [x, y] = at(mc, R - 4); return <circle cx={x} cy={y} r={5} fill="#e2b34f" /> })()}
        {!cs && <text x={cx} y={cy} textAnchor="middle" fill="#c2a05a" fontSize="14">普拉西度算不出</text>}
      </svg>
      <Btns<HouseSystem> items={[['whole', '整宫'], ['equal', '等宫'], ['porphyry', '波菲利'], ['placidus', '普拉西度']]} value={sys} onChange={setSys} />
      <Slider label="纬度" value={lat} min={0} max={75} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
      <Slider label="恒星时" value={hour} min={0} max={24} step={0.1} onChange={setHour} fmt={(v) => `${v.toFixed(1)} 时`} />
      <div className="wg-read">
        <span>上升 <b>{fmtLon(asc)}</b></span>
        <span>天顶 <b>{fmtLon(mc)}</b></span>
        {cs
          ? <span>此刻宫宽 <b>{min.toFixed(0)}°–{max.toFixed(0)}°</b> · 天顶在第 {mcHouse} 宫</span>
          : <span>纬度 <b>{lat}°</b> 超过 66°，半弧没有定义</span>}
        {daySpan && !('fail' in daySpan) && <span>一天里 <b>{daySpan.min.toFixed(0)}°–{daySpan.max.toFixed(0)}°</b></span>}
      </div>
      <div className="wg-cap">金点是天顶。整宫、等宫每宫都是 30°，但天顶常常不在第 10 宫宫头上。"一天里"是把恒星时扫完的最窄和最宽，不是眼前这一张。北纬 60° 的普拉西度大约从 11° 到 80° 以上。超过 66° 程序拒绝普拉西度；极圈本身约 66.6°。</div>
    </div>
  )
}

/* ── 象限两种三等分（第 185–187 天）── */
function TrisectWidget(args: Record<string, unknown>) {
  const [lat, setLat] = useState(Number(args.lat ?? 40))
  const [hour, setHour] = useState(Number(args.hour ?? 8))
  const ramc = hour * 15
  const asc = ascFrom(ramc, EPS, lat)
  const mc = mcFrom(ramc, EPS)
  const span = norm(asc - mc)
  const por = [span / 3, (2 * span) / 3]
  const plac = cusps({ asc, mc, ramc, eps: EPS, lat }, 'placidus')
  const pla = plac ? [norm(plac[10] - mc), norm(plac[11] - mc)] : null
  const W = 300
  const xOf = (deg: number) => 20 + (deg / span) * W
  return (
    <div className="wg">
      <Note>从天顶到上升的这一象限</Note>
      <svg className="wg-svg" viewBox="0 0 340 150">
        <line x1={20} y1={48} x2={320} y2={48} stroke="rgba(246,241,228,0.35)" />
        <line x1={20} y1={96} x2={320} y2={96} stroke="rgba(246,241,228,0.35)" />
        <text x={20} y={28} fill="#c2a05a" fontSize="12">波菲利 · 黄道等分</text>
        <text x={20} y={128} fill="#8fb0d6" fontSize="12">普拉西度 · 时间等分</text>
        {[0, span].map((d, i) => (
          <g key={i}>
            <line x1={xOf(d)} y1={40} x2={xOf(d)} y2={104} stroke="rgba(246,241,228,0.4)" />
          </g>
        ))}
        {por.map((d, i) => <circle key={i} cx={xOf(d)} cy={48} r={6} fill="#c2a05a" />)}
        {pla
          ? pla.map((d, i) => <circle key={i} cx={xOf(Math.max(0, Math.min(span, d)))} cy={96} r={6} fill="#5b7fa8" />)
          : <text x={80} y={100} fill="#c2a05a" fontSize="13">这个纬度算不出</text>}
        <text x={4} y={44} fill="rgba(246,241,228,0.6)" fontSize="10">天顶</text>
        <text x={300} y={44} fill="rgba(246,241,228,0.6)" fontSize="10">上升</text>
      </svg>
      <Slider label="纬度" value={lat} min={0} max={70} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
      <Slider label="恒星时" value={hour} min={0} max={24} step={0.1} onChange={setHour} fmt={(v) => `${v.toFixed(1)} 时`} />
      <div className="wg-read">
        <span>这一象限 <b>{span.toFixed(0)}°</b></span>
        <span>上升 <b>{fmtLon(asc)}</b></span>
        <span>天顶 <b>{fmtLon(mc)}</b></span>
      </div>
      <div className="wg-cap">两条线上的点如果上下对齐，两种切法就一样。纬度一高，蓝点就离开金点——时间等分，落到黄道上并不等长。</div>
    </div>
  )
}

/* ── 同一张示例盘，三种宫位（第 188 天）── */
function CompareWidget(args: Record<string, unknown>) {
  const [chart, setChart] = useState<Chart | null>(null)
  const [failed, setFailed] = useState(false)
  const [who, setWho] = useState<(typeof CLASSICAL)[number]>('jupiter')
  useEffect(() => {
    let ok = true
    chartAt(new Date(Date.UTC(1990, 4, 12, 0, 30)), Number(args.lat ?? 39.9), Number(args.lon ?? 116.4))
      .then((c) => { if (ok) setChart(c) })
      .catch(() => { if (ok) setFailed(true) })
    return () => { ok = false }
  }, [args.lat, args.lon])
  if (failed) return <div className="wg"><div className="wg-cap">星历没有载入。</div></div>
  if (!chart) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const systems: HouseSystem[] = ['whole', 'equal', 'placidus']
  const packs = systems.map((sys) => ({ sys, cs: cusps(chart, sys) }))
  return (
    <div className="wg">
      <Note>示例盘 · 真实星历</Note>
      <div className="wg-read">
        <span>1990-05-12 08:30 北京</span>
        <span>上升 <b>{fmtLon(chart.asc)}</b></span>
        <span>天顶 <b>{fmtLon(chart.mc)}</b>（整宫第 {wholeHouse(chart.mc, chart.asc)} 宫）</span>
      </div>
      <table className="wg-table">
        <thead><tr><th>行星</th><th>位置</th><th>整宫</th><th>等宫</th><th>普拉西度</th></tr></thead>
        <tbody>
          {CLASSICAL.map((b) => {
            const lon = chart.pos[b].lon
            const hs = packs.map((p) => p.sys === 'whole' ? wholeHouse(lon, chart.asc) : p.cs ? houseOf(lon, p.cs) : null)
            const changed = new Set(hs).size > 1
            return (
              <tr key={b} style={b === who ? { outline: '1px solid rgba(194,160,90,0.7)' } : undefined}>
                <td style={{ color: changed ? '#e2b34f' : undefined }}>{BODY_NAME[b]}</td>
                <td>{fmtLon(lon)}</td>
                {hs.map((h, i) => <td key={i}>{h ?? '—'}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
      <Btns items={CLASSICAL.map((b) => [b, BODY_NAME[b]] as [typeof b, string])} value={who} onChange={setWho} />
      <div className="wg-cap">
        {BODY_NAME[who]} 在 {fmtLon(chart.pos[who].lon)}：
        整宫第 {wholeHouse(chart.pos[who].lon, chart.asc)} 宫，
        等宫第 {packs[1].cs ? houseOf(chart.pos[who].lon, packs[1].cs) : '—'} 宫，
        普拉西度第 {packs[2].cs ? houseOf(chart.pos[who].lon, packs[2].cs) : '—'} 宫。
        标黄的行星换了宫。上升点三种制式都一样。这是虚构例子，按东八区计算，不是真人，也不套 1990 年的夏令时。
      </div>
    </div>
  )
}

/* ── 雷氏与坎帕纳斯：先等分哪一个圆（第 190 天）── */
function SpaceWidget(args: Record<string, unknown>) {
  const [which, setWhich] = useState(String(args.which ?? 'regio') === 'campanus' ? 'campanus' : 'regio')
  const [lat, setLat] = useState(40)
  return (
    <div className="wg">
      <Note>示意 · 不是正式宫头</Note>
      <svg className="wg-svg" viewBox="0 0 340 210">
        {[100, 240].map((x, i) => (
          <g key={x} opacity={which === (i === 0 ? 'regio' : 'campanus') ? 1 : 0.35}>
            <circle cx={x} cy={78} r={52} fill="none" stroke={i === 0 ? '#5b7fa8' : '#c2a05a'} />
            {Array.from({ length: 12 }, (_, k) => {
              const a = (k / 12) * Math.PI * 2 - Math.PI / 2
              return <line key={k} x1={x + 46 * Math.cos(a)} y1={78 + 46 * Math.sin(a)} x2={x + 52 * Math.cos(a)} y2={78 + 52 * Math.sin(a)} stroke="#f6f1e4" />
            })}
            <text x={x} y={148} textAnchor="middle" fill="#f6f1e4" fontSize="12">{i === 0 ? '天赤道' : '卯酉圈'}</text>
          </g>
        ))}
        <text x={170} y={178} textAnchor="middle" fill="rgba(246,241,228,0.7)" fontSize="12">再投影到黄道</text>
        {Array.from({ length: 12 }, (_, k) => {
          const squeeze = 1 + (lat / 80) * (which === 'campanus' ? 1.4 : 1)
          const t = Math.pow((k + 0.5) / 12, squeeze)
          const x = 30 + t * 280
          return <circle key={k} cx={x} cy={196} r={3} fill={which === 'regio' ? '#5b7fa8' : '#c2a05a'} />
        })}
      </svg>
      <Btns items={[['regio', '雷氏 · 先分赤道'], ['campanus', '坎帕纳斯 · 先分卯酉圈']]} value={which} onChange={setWhich} />
      <Slider label="纬度" value={lat} min={0} max={70} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
      <div className="wg-cap">下面一排点只表示"投到黄道上会挤在一起"。疏密是示意图，本课引擎还没有接入这两种宫位的正式数值。</div>
    </div>
  )
}

/* ── 科赫：把天顶倒回它升起的时刻（第 191 天）── */
function KochWidget(args: Record<string, unknown>) {
  const [lat, setLat] = useState(Number(args.lat ?? 40))
  const [hour, setHour] = useState(8)
  const ramc = hour * 15
  const mc = mcFrom(ramc, EPS)
  const asc = ascFrom(ramc, EPS, lat)
  const found = useMemo(() => {
    for (let step = 1; step <= 2400; step++) {
      const r = norm(ramc - step * 0.15)
      const a = ascFrom(r, EPS, lat)
      if (Math.abs(((a - mc + 540) % 360) - 180) < 0.35) return r
    }
    return null
  }, [ramc, mc, lat])
  const span = found == null ? null : norm(ramc - found)
  const third = (k: number) => (found == null || span == null ? null : ascFrom(norm(found + (span * k) / 3), EPS, lat))
  return (
    <div className="wg">
      <Note>思路示意</Note>
      <div className="wg-read">
        <span>此刻天顶 <b>{fmtLon(mc)}</b></span>
        <span>此刻上升 <b>{fmtLon(asc)}</b></span>
      </div>
      <Slider label="纬度" value={lat} min={0} max={75} step={1} onChange={setLat} fmt={(v) => `${v}°`} />
      <Slider label="恒星时" value={hour} min={0} max={24} step={0.1} onChange={setHour} fmt={(v) => `${v.toFixed(1)} 时`} />
      {span == null || third(1) == null || third(2) == null ? (
        <div className="wg-cap">这个天顶度数在此纬度升不起来，半弧不存在，科赫和普拉西度一样没有定义。</div>
      ) : (
        <div className="wg-cap">
          天顶这度数大约 <b>{(span / 15).toFixed(1)}</b> 小时前在东方升起。时间三等分处的上升点大约是 {fmtLon(third(1)!)} 和 {fmtLon(third(2)!)}。正式科赫表用更严的半弧公式，度数会略有差别；极圈里同样会失败。
        </div>
      )}
    </div>
  )
}

/* ── 选一个默认宫位制，存在这台设备（第 195 天）── */
const PICK_KEY = 'xingxue-s5-house'
function PickWidget() {
  const [sys, setSys] = useState<HouseSystem>(() => {
    try {
      const s = localStorage.getItem(PICK_KEY)
      if (s === 'whole' || s === 'equal' || s === 'porphyry' || s === 'placidus') return s
    } catch { /* 存储不可用 */ }
    return 'whole'
  })
  const [why, setWhy] = useState(() => { try { return localStorage.getItem(PICK_KEY + '-why') ?? '' } catch { return '' } })
  const save = (next: HouseSystem, text: string) => {
    setSys(next); setWhy(text)
    try { localStorage.setItem(PICK_KEY, next); localStorage.setItem(PICK_KEY + '-why', text) } catch { /* 忽略 */ }
  }
  return (
    <div className="wg">
      <Note>只存在这台设备</Note>
      <Btns<HouseSystem> items={[['whole', '整宫'], ['equal', '等宫'], ['porphyry', '波菲利'], ['placidus', '普拉西度']]} value={sys} onChange={(v) => save(v, why)} />
      <div className="wg-row"><label>理由</label></div>
      <input value={why} placeholder="一句话：我选它，是因为…" onChange={(e) => save(sys, e.target.value)} style={{ width: '100%', marginTop: 6 }} />
      <div className="wg-cap">当前默认：<b>{HOUSE_SYSTEM_NAME[sys]}</b>。设置页还没有这个开关，所以先记在这里。上升点跟这个选择无关。</div>
    </div>
  )
}

export const W05A: WidgetMap = {
  's5-horizon': (a) => <HorizonWidget {...a} />,
  's5-sweep': (a) => <SweepWidget {...a} />,
  's5-zenith': (a) => <ZenithWidget {...a} />,
  's5-signclock': (a) => <SignClockWidget {...a} />,
  's5-twelve': (a) => <TwelveWidget {...a} />,
  's5-sunhouse': (a) => <SunHouseWidget {...a} />,
  's5-systems': (a) => <SystemsWidget {...a} />,
  's5-trisect': (a) => <TrisectWidget {...a} />,
  's5-compare': (a) => <CompareWidget {...a} />,
  's5-space': (a) => <SpaceWidget {...a} />,
  's5-koch': (a) => <KochWidget {...a} />,
  's5-pick': () => <PickWidget />,
}
