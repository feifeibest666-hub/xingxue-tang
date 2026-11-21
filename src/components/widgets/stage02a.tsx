import { useEffect, useId, useMemo, useState } from 'react'
import { PlanetAt, PlanetGlyph } from '../PlanetGlyph'
import { GlyphAt } from '../Glyph'
import { MOTION, PLANET, type Planet } from '../../data/classical'
import { SIGNS, fmtDeg, fmtLon, norm360, signOf } from '../../data/zodiac'
import { loadAstro } from '../../lib/astro'
import { positionsSync, sep, type Body } from '../../lib/natal'
import { Btns, D2R, Note, PlayBtn, Slider, doyLabel, lonFromDoy, seeded, useLoop, usePlaying, wheel, type WidgetMap } from './common'
import { SkySimWidget } from './tools'

type AE = Awaited<ReturnType<typeof loadAstro>>

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const circ = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }
const hypot = (x: number, y: number) => Math.hypot(x, y)

/** 亮面比例。夹角 0° = 新月。太阳很远，相位角 ≈ 180° − 夹角，所以是 (1 − cos E) / 2 */
export const litFraction = (elong: number) => (1 - Math.cos((((elong % 360) + 360) % 360) * D2R)) / 2

const PHASES: { at: number; name: string }[] = [
  { at: 0, name: '新月' }, { at: 45, name: '峨眉月' }, { at: 90, name: '上弦' }, { at: 135, name: '盈凸月' },
  { at: 180, name: '满月' }, { at: 225, name: '亏凸月' }, { at: 270, name: '下弦' }, { at: 315, name: '残月' },
]
export const phaseName = (elong: number) => {
  const x = norm360(elong)
  let best = PHASES[0], bd = 999
  for (const p of PHASES) {
    const d = Math.min(Math.abs(x - p.at), 360 - Math.abs(x - p.at))
    if (d < bd) { bd = d; best = p }
  }
  return best.name
}

/** 北半球面向南方时，增光亮在右边。夹角 0 新月、180 满月 */
function moonLitPath(cx: number, cy: number, r: number, elong: number) {
  const e = norm360(elong)
  if (e < 0.4 || e > 359.6) return ''
  const right = e <= 180
  const rx = Math.max(0.8, Math.abs(Math.cos(e * D2R)) * r)
  const sweepOuter = right ? 1 : 0
  const sweepBack = e < 90 ? 0 : e <= 180 ? 1 : e <= 270 ? 0 : 1
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweepOuter} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${sweepBack} ${cx} ${cy - r} Z`
}

function MoonFace({ cx, cy, r, elong }: { cx: number; cy: number; r: number; elong: number }) {
  const d = moonLitPath(cx, cy, r, elong)
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1b2236" stroke="rgba(246,241,228,0.45)" strokeWidth={1.2} />
      {d && <path d={d} fill="#f3ead2" />}
    </g>
  )
}

function arcPts(cx: number, cy: number, r: number, a0: number, sweep: number) {
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / 4))
  const pts: string[] = []
  for (let i = 0; i <= n; i++) {
    const [x, y] = wheel(cx, cy, r, a0 + (sweep * i) / n)
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

const fmtBJ = (t: Date) => {
  const x = new Date(t.getTime() + 8 * 3600000)
  return `${x.getUTCFullYear()} 年 ${x.getUTCMonth() + 1} 月 ${x.getUTCDate()} 日`
}
const bjYear = (t = new Date()) => new Date(t.getTime() + 8 * 3600000).getUTCFullYear()
const signedEl = (body: number, sun: number) => {
  const d = norm360(body - sun)
  return d > 180 ? d - 360 : d
}

/* ── 七颗游星 vs 不动的恒星（第 43 天） ── */
function Wanderers() {
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => setDay((d) => (d + dt * 4) % 80))
  const stars = useMemo(() => seeded(18, 7).map(([a, b, c]) => ({ x: 16 + a * 308, y: 18 + b * 150, r: 0.8 + c * 1.6 })), [])
  const sun = norm360(30 + day * 0.986)
  const rows: { p: Planet; lon: number }[] = [
    { p: 'moon', lon: norm360(200 + day * 13.176) },
    { p: 'sun', lon: sun },
    { p: 'mercury', lon: norm360(sun + 22 * Math.sin((2 * Math.PI * day) / 115.88)) },
    { p: 'venus', lon: norm360(sun + 46 * Math.sin((2 * Math.PI * day) / 583.9)) },
    { p: 'mars', lon: norm360(120 + day * 0.52) },
    { p: 'jupiter', lon: norm360(250 + day * 0.083) },
    { p: 'saturn', lon: norm360(310 + day * 0.034) },
  ]
  const xOf = (lon: number) => 18 + (norm360(lon) / 360) * 304
  return (
    <div className="wg">
      <Note>示意 · 先不画逆行</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#f6f1e4" opacity={0.75} />)}
        <line x1={16} y1={178} x2={324} y2={178} stroke="rgba(194,160,90,0.55)" />
        <text x={170} y={206} textAnchor="middle" fill="rgba(246,241,228,0.55)" fontSize="11">黄道（大家共用的一条窄路）</text>
        {rows.map((b, i) => {
          const x = xOf(b.lon)
          const y = 168
          return (
            <g key={b.p}>
              <line x1={x} y1={y - 10} x2={x} y2={28 + (i % 5) * 8} stroke={PLANET[b.p].color} strokeOpacity={0.35} />
              <circle cx={x} cy={y} r={b.p === 'sun' ? 7 : 4.5} fill={PLANET[b.p].color} />
              <PlanetAt p={b.p} x={x} y={46 + (i % 4) * 22} size={15} color={PLANET[b.p].color} />
            </g>
          )
        })}
      </svg>
      <Slider label="过了几天" value={day} min={0} max={80} step={0.1} onChange={(v) => { setPlaying(false); setDay(v) }} fmt={(v) => `${v.toFixed(0)} 天`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-cap">背景的星不动。线上七个点在动——古人因此把它们都叫<b>行星</b>（游走的星）。</div>
    </div>
  )
}

/* ── 日心 / 地心是两张图（第 44 天） ── */
function TwoViews() {
  const [t, setT] = useState(200)
  const [helio, setHelio] = useState(false)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => setT((x) => (x + dt * 30) % 780))
  const Te = 365.25, Tm = 686.98, am = 1.52
  const ae = (360 * t) / Te, amars = (360 * t) / Tm
  const ex = Math.cos(ae * D2R), ey = Math.sin(ae * D2R)
  const mx = am * Math.cos(amars * D2R), my = am * Math.sin(amars * D2R)
  const vsx = -ex, vsy = -ey, vmx = mx - ex, vmy = my - ey
  const el = Math.acos(clamp((vsx * vmx + vsy * vmy) / (hypot(vsx, vsy) * hypot(vmx, vmy)), -1, 1)) / D2R
  const cx = 170, cy = 118
  const sky = (deg: number, r: number) => [cx + r * Math.sin(deg * D2R), cy - r * Math.cos(deg * D2R)] as const
  const wedge = Array.from({ length: 24 }, (_, i) => sky((el * i) / 23, 48).map((v) => v.toFixed(1)).join(',')).join(' ')
  return (
    <div className="wg">
      <Note>{helio ? '俯视太阳系 · 示意' : '站在地球上看 · 示意'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        {helio ? (
          <g>
            <circle cx={cx} cy={cy} r={36} fill="none" stroke="rgba(91,127,168,0.7)" />
            <circle cx={cx} cy={cy} r={36 * am} fill="none" stroke="rgba(217,115,79,0.45)" />
            <circle cx={cx} cy={cy} r={11} fill="#e8b85c" />
            <circle cx={cx + ex * 36} cy={cy - ey * 36} r={6} fill="#5b7fa8" />
            <circle cx={cx + mx * 36} cy={cy - my * 36} r={5} fill="#d9734f" />
            <text x={cx + ex * 36 + 8} y={cy - ey * 36} fill="#9eb6d4" fontSize="11">地球</text>
            <text x={cx + mx * 36 + 8} y={cy - my * 36} fill="#e7a08a" fontSize="11">火星</text>
          </g>
        ) : (
          <g>
            <circle cx={cx} cy={cy} r={78} fill="none" stroke="rgba(246,241,228,0.2)" />
            <circle cx={cx} cy={cy} r={5} fill="#5b7fa8" />
            <text x={cx} y={cy + 18} textAnchor="middle" fill="#9eb6d4" fontSize="11">你在这里</text>
            {(() => {
              const [sx, sy] = sky(0, 78)
              const [px, py] = sky(el, 78)
              return (
                <g>
                  <polyline points={wedge} fill="none" stroke="#c2a05a" strokeWidth={2} />
                  <circle cx={sx} cy={sy} r={10} fill="#e8b85c" />
                  <circle cx={px} cy={py} r={6} fill="#d9734f" />
                  <text x={sx + 12} y={sy + 4} fill="#f6f1e4" fontSize="11">太阳</text>
                  <text x={px + 10} y={py + 4} fill="#f6f1e4" fontSize="11">火星</text>
                </g>
              )
            })()}
          </g>
        )}
      </svg>
      <div className="wg-read"><span>太阳和火星的夹角 <b>{el.toFixed(0)}°</b></span><span>{el > 150 ? '接近正对面（冲）' : el < 20 ? '几乎跟太阳叠在一起（合）' : '中间的某个角度'}</span></div>
      <Slider label="时间" value={t} min={0} max={780} step={1} onChange={(v) => { setPlaying(false); setT(v) }} fmt={(v) => `${Math.round(v)} 天`} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <Btns items={[[false, '站在地球上看'], [true, '站在太阳上看']]} value={helio} onChange={setHelio} />
      </div>
      <div className="wg-cap">{helio ? '这张图适合看谁绕着谁转。它不直接回答"今晚火星在我的哪一边"。' : '占星要的是这张：从你脚下看出去，太阳和火星差多少度。'}</div>
    </div>
  )
}

/* ── 太阳：一年大约走一圈（第 45 天） ── */
function SunBeat() {
  const [doy, setDoy] = useState(79)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setDoy((d) => (d + dt * 40) % 365))
  const lon = lonFromDoy(doy)
  const s = signOf(lon)
  const season = ['春', '夏', '秋', '冬'][Math.floor(norm360(lon) / 90)]
  const cx = 170, cy = 118, r = 78
  const [x, y] = wheel(cx, cy, r - 8, lon)
  return (
    <div className="wg">
      <Note>北半球季节 · 示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(246,241,228,0.25)" />
        {SIGNS.map((sg) => {
          const [gx, gy] = wheel(cx, cy, r + 16, sg.i * 30 - 15)
          return <GlyphAt key={sg.i} i={sg.i} x={gx} y={gy} size={13} color={sg.i === s.sign.i ? '#c2a05a' : 'rgba(246,241,228,0.4)'} width={8} />
        })}
        {lon > 2 && <polyline points={arcPts(cx, cy, r - 8, 0, lon)} fill="none" stroke="#c2a05a" strokeWidth={2.5} />}
        <PlanetAt p="sun" x={x} y={y} size={22} color="#e8b85c" />
      </svg>
      <div className="wg-read">
        <span>{doyLabel(doy)}</span>
        <span>黄经 <b>{lon.toFixed(0)}°</b></span>
        <span><b>{s.sign.name}</b> {fmtDeg(s.deg)}</span>
        <span>北半球 <b>{season}</b></span>
      </div>
      <Slider label="日期" value={doy} min={0} max={365} step={0.5} onChange={(v) => { setPlaying(false); setDoy(v) }} fmt={(v) => doyLabel(v)} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-cap">每天大约 <b>1°</b>。1 月初略快（约 1.02°），7 月初略慢（约 0.95°），从不倒退。</div>
    </div>
  )
}

/* ── 月亮追太阳：两种"月"（第 46 天） ── */
function MoonRace() {
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => setDay((d) => (d + dt * 3) % 40))
  const sun = norm360(day * 0.9856)
  const moon = norm360(day * 13.176)
  const gap = norm360(moon - sun)
  const cx = 170, cy = 112, r = 74
  const [sx, sy] = wheel(cx, cy, r, sun)
  const [mx, my] = wheel(cx, cy, r, moon)
  const mark = day < 26.5 ? '月亮还在追' : day < 28.6 ? '过了恒星月：回到了原来的星星，太阳已经往前走了' : day < 31 ? '追上太阳了：又一次新月（朔望月）' : '下一个月开始了'
  return (
    <div className="wg">
      <Note>平均速度 · 示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(246,241,228,0.25)" />
        <circle cx={wheel(cx, cy, r, 0)[0]} cy={wheel(cx, cy, r, 0)[1]} r={3} fill="#f6f1e4" />
        <text x={wheel(cx, cy, r, 0)[0] - 8} y={wheel(cx, cy, r, 0)[1] - 8} fill="rgba(246,241,228,0.6)" fontSize="10">出发的星</text>
        <PlanetAt p="sun" x={sx} y={sy} size={20} color="#e8b85c" />
        <PlanetAt p="moon" x={mx} y={my} size={18} color="#e4e0d4" />
      </svg>
      <div className="wg-read"><span>第 <b>{day.toFixed(1)}</b> 天</span><span>日月夹角 <b>{gap.toFixed(0)}°</b></span></div>
      <Slider label="天数" value={day} min={0} max={40} step={0.1} onChange={(v) => { setPlaying(false); setDay(v) }} fmt={(v) => `${v.toFixed(1)} 天`} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <button className="wg-btn" onClick={() => { setPlaying(false); setDay(27.3) }}>恒星月 27.3</button>
        <button className="wg-btn" onClick={() => { setPlaying(false); setDay(29.5) }}>朔望月 29.5</button>
      </div>
      <div className="wg-cap">{mark}</div>
    </div>
  )
}

/* ── 月相 = 夹角（第 47、48 天） ── */
function MoonPhase({ live = false }: { live?: boolean }) {
  const [e, setE] = useState(90)
  const [playing, setPlaying] = usePlaying(false)
  const [note, setNote] = useState('')
  useLoop(playing, (dt) => setE((x) => (x + dt * 36) % 360))
  const load = () => {
    setPlaying(false)
    positionsSyncLoad().then((p) => {
      if (!p) return
      setE(norm360(p.moon.lon - p.sun.lon))
      setNote(`星历 · ${fmtBJ(new Date())} · 月亮 ${fmtLon(p.moon.lon)} · 太阳 ${fmtLon(p.sun.lon)}`)
    })
  }
  useEffect(() => { if (live) load() }, [live])
  const name = phaseName(e)
  const lit = litFraction(e)
  const cx = 118, cy = 108, r = 72
  const [sx, sy] = wheel(cx, cy, r, 0)
  const [mx, my] = wheel(cx, cy, r, e)
  const wax = norm360(e) <= 180
  return (
    <div className="wg">
      <Note>北半球朝南看 · 左右</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(246,241,228,0.2)" />
        {norm360(e) > 2 && <polyline points={arcPts(cx, cy, 40, 0, Math.min(norm360(e), 359))} fill="none" stroke="#c2a05a" strokeWidth={2} />}
        <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="rgba(232,184,92,0.5)" />
        <line x1={cx} y1={cy} x2={mx} y2={my} stroke="rgba(228,224,212,0.5)" />
        <circle cx={cx} cy={cy} r={3} fill="#9eb6d4" />
        <PlanetAt p="sun" x={sx} y={sy} size={20} color="#e8b85c" />
        <circle cx={mx} cy={my} r={5} fill="#e4e0d4" />
        <MoonFace cx={268} cy={108} r={42} elong={e} />
        <text x={268} y={168} textAnchor="middle" fill="#f6f1e4" fontSize="13">{name}</text>
      </svg>
      <div className="wg-read">
        <span>夹角 <b>{norm360(e).toFixed(0)}°</b></span>
        <span>亮面 <b>{Math.round(lit * 100)}%</b></span>
        <span>{wax ? '增光（还在变亮）' : '减光（开始变暗）'}</span>
      </div>
      {note && <div className="wg-read"><span>{note}</span></div>}
      <Slider label="夹角" value={norm360(e)} min={0} max={360} step={1} onChange={(v) => { setPlaying(false); setE(v); setNote('') }} fmt={(v) => `${Math.round(v)}°`} />
      <Btns items={PHASES.map((p) => [p.at, p.name] as [number, string])} value={PHASES.reduce((b, p) => (circ(norm360(e), p.at) < circ(norm360(e), b) ? p.at : b), 0)} onChange={(v) => { setPlaying(false); setE(v); setNote('') }} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <button className="wg-btn" onClick={load}>今晚的月亮</button>
      </div>
      <div className="wg-cap">亮面 = (1 − cos 夹角) / 2。0° 新月，90° 上弦，180° 满月，270° 下弦。</div>
    </div>
  )
}

async function positionsSyncLoad(t = new Date(), bodies?: Body[]) {
  const A = await loadAstro()
  return positionsSync(A, t, bodies)
}

/* ── 亮的一半永远朝向太阳（第 50 天） ── */
function BorrowedLight() {
  const uid = useId().replace(/:/g, '')
  const [ang, setAng] = useState(90)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setAng((a) => (a + dt * 28) % 360))
  const ex = 214, ey = 112, R = 62
  const a = ang * D2R
  const mx = ex - Math.cos(a) * R
  const my = ey - Math.sin(a) * R
  return (
    <div className="wg">
      <Note>示意 · 太阳在很远的左边</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <defs>
          <clipPath id={`moon-${uid}`}><circle cx={mx} cy={my} r={13} /></clipPath>
        </defs>
        <circle cx={28} cy={112} r={18} fill="#e8b85c" />
        <text x={28} y={148} textAnchor="middle" fill="#e8b85c" fontSize="11">太阳</text>
        <circle cx={ex} cy={ey} r={R} fill="none" stroke="rgba(246,241,228,0.2)" />
        <circle cx={ex} cy={ey} r={8} fill="#5b7fa8" />
        <text x={ex} y={ey + 22} textAnchor="middle" fill="#9eb6d4" fontSize="11">地球</text>
        <line x1={46} y1={112} x2={mx - 16} y2={my} stroke="rgba(232,184,92,0.35)" strokeDasharray="3 3" />
        <g clipPath={`url(#moon-${uid})`}>
          <circle cx={mx} cy={my} r={13} fill="#2a3148" />
          <rect x={mx - 13} y={my - 13} width={13} height={26} fill="#f3ead2" />
        </g>
        <MoonFace cx={316} cy={48} r={22} elong={ang} />
        <text x={316} y={82} textAnchor="middle" fill="rgba(246,241,228,0.7)" fontSize="10">你看到的</text>
      </svg>
      <div className="wg-read"><span>夹角 <b>{Math.round(ang)}°</b></span><span><b>{phaseName(ang)}</b></span><span>亮面 {Math.round(litFraction(ang) * 100)}%</span></div>
      <Slider label="月亮转到" value={ang} min={0} max={360} step={1} onChange={(v) => { setPlaying(false); setAng(v) }} fmt={(v) => phaseName(v)} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /><button className="wg-btn" onClick={() => setAng(0)}>新月</button><button className="wg-btn" onClick={() => setAng(180)}>满月</button></div>
      <div className="wg-cap">月亮自己不发光。朝向太阳的那一半永远是亮的，你看到多少，只看它转到了哪一边。</div>
    </div>
  )
}

/* ── 增光 / 减光（第 51 天） ── */
function WaxWane() {
  const [e, setE] = useState(60)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setE((x) => (x + dt * 40) % 360))
  const pts = Array.from({ length: 73 }, (_, i) => {
    const a = i * 5
    const x = 28 + (a / 360) * 290
    const y = 150 - litFraction(a) * 110
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const x = 28 + (norm360(e) / 360) * 290
  const y = 150 - litFraction(e) * 110
  return (
    <div className="wg">
      <Note>亮面比例</Note>
      <svg className="wg-svg" viewBox="0 0 340 200">
        <line x1={28} y1={150} x2={318} y2={150} stroke="rgba(246,241,228,0.25)" />
        <line x1={28 + 145} y1={30} x2={28 + 145} y2={156} stroke="rgba(246,241,228,0.25)" strokeDasharray="3 3" />
        <text x={100} y={24} textAnchor="middle" fill="#c2a05a" fontSize="12">增光</text>
        <text x={246} y={24} textAnchor="middle" fill="#8fb0d6" fontSize="12">减光</text>
        <text x={28} y={172} fill="rgba(246,241,228,0.5)" fontSize="10">新月</text>
        <text x={158} y={172} textAnchor="middle" fill="rgba(246,241,228,0.5)" fontSize="10">满月</text>
        <text x={318} y={172} textAnchor="end" fill="rgba(246,241,228,0.5)" fontSize="10">又到新月</text>
        <polyline points={pts} fill="none" stroke="#f6f1e4" strokeWidth={2} />
        <circle cx={x} cy={y} r={5} fill="#c2a05a" />
      </svg>
      <div className="wg-read"><span>夹角 <b>{Math.round(norm360(e))}°</b></span><span>亮面 <b>{Math.round(litFraction(e) * 100)}%</b></span><span>{norm360(e) <= 180 ? '传统叫增光，主增长' : '传统叫减光，主消退'}</span></div>
      <Slider label="夹角" value={norm360(e)} min={0} max={360} onChange={(v) => { setPlaying(false); setE(v) }} fmt={(v) => `${v}°`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-cap">曲线是几何。把左半边叫"吉利的增长"，是后来的<b>用法</b>，不是曲线自己说的。</div>
    </div>
  )
}

/* ── 水星金星的绳子：最大距角（第 52、57 天） ── */
const LEASH = [
  { id: 'mp', name: '水星近日', r: 0.307, hint: '轨道最近太阳的时候' },
  { id: 'mm', name: '水星平均', r: 0.387, hint: '圆轨道粗算' },
  { id: 'ma', name: '水星远日', r: 0.467, hint: '能拉到最远的时候' },
  { id: 'v', name: '金星', r: 0.723, hint: '金星轨道几乎是圆的' },
] as const

function MercuryLeash({ initial = 'mm' }: { initial?: string }) {
  const [id, setId] = useState(initial)
  const [th, setTh] = useState(70)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => setTh((x) => (x + dt * 40) % 360))
  const spec = LEASH.find((x) => x.id === id) ?? LEASH[1]
  const r = spec.r
  const maxEl = (Math.asin(r) / D2R)
  const cx = 128, cy = 118, Re = 86
  const Rp = Re * r
  const ex = cx + Re, ey = cy
  const px = cx + Rp * Math.cos(th * D2R), py = cy - Rp * Math.sin(th * D2R)
  const vsx = cx - ex, vsy = cy - ey, vpx = px - ex, vpy = py - ey
  const el = Math.acos(clamp((vsx * vpx + vsy * vpy) / (hypot(vsx, vsy) * hypot(vpx, vpy) || 1), -1, 1)) / D2R
  const phi = Math.acos(clamp(r, -1, 1))
  const tans = [phi, -phi].map((p) => [cx + Rp * Math.cos(p), cy - Rp * Math.sin(p)] as const)
  const taut = maxEl - el < 1.2
  return (
    <div className="wg">
      <Note>俯视 · 圆轨道</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <circle cx={cx} cy={cy} r={Re} fill="none" stroke="rgba(91,127,168,0.45)" />
        <circle cx={cx} cy={cy} r={Rp} fill="none" stroke="rgba(194,160,90,0.7)" />
        <circle cx={cx} cy={cy} r={10} fill="#e8b85c" />
        {tans.map(([x, y], i) => <line key={i} x1={ex} y1={ey} x2={x} y2={y} stroke="rgba(194,160,90,0.85)" strokeDasharray="4 3" />)}
        <line x1={ex} y1={ey} x2={px} y2={py} stroke={taut ? '#f6f1e4' : '#c2a05a'} strokeWidth={taut ? 2.4 : 1.4} />
        <circle cx={ex} cy={ey} r={6} fill="#5b7fa8" />
        <circle cx={px} cy={py} r={5} fill="#f6f1e4" />
        <text x={ex + 8} y={ey + 14} fill="#9eb6d4" fontSize="11">地球</text>
        <text x={cx - 14} y={cy + 24} fill="#e8b85c" fontSize="11">太阳</text>
      </svg>
      <div className="wg-read"><span>现在的距角 <b>{el.toFixed(1)}°</b></span><span>绳子拉直 <b>{maxEl.toFixed(1)}°</b></span><span>{taut ? '拉直了，不能再远' : spec.hint}</span></div>
      <Slider label="行星转到" value={th} min={0} max={360} onChange={(v) => { setPlaying(false); setTh(v) }} fmt={(v) => `${Math.round(v)}°`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <Btns items={LEASH.map((x) => [x.id, x.name] as [string, string])} value={id} onChange={setId} />
      <div className="wg-cap">两条虚线是切线，也就是绳子的极限。最大距角 = arcsin(内侧半径)。水星在大约 18° 和 28° 之间变。金星这条虚线大约 46°；实测的大距大约在 45° 到 47° 之间。</div>
    </div>
  )
}

/* ── 超车：逆行（第 53 天） ── */
function Overtake() {
  const [inner, setInner] = useState(true)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = usePlaying()
  const Tp = inner ? 87.97 : 686.98
  const rp = inner ? 0.387 : 1.524
  const span = inner ? 116 : 780
  useLoop(playing, (dt) => setT((x) => (x + dt * (span / 16)) % span))
  const Te = 365.25
  const pos = (time: number) => {
    const ae = 2 * Math.PI * time / Te, ap = 2 * Math.PI * time / Tp
    const ex = Math.cos(ae), ey = Math.sin(ae)
    const px = rp * Math.cos(ap), py = rp * Math.sin(ap)
    return { ex, ey, px, py, vx: px - ex, vy: py - ey }
  }
  const lonOf = (time: number) => {
    const { vx, vy } = pos(time)
    return Math.atan2(vy, vx) / D2R
  }
  const now = pos(t)
  const lon = lonOf(t)
  const lon2 = lonOf(t + 0.4)
  let dlon = lon2 - lon
  if (dlon > 180) dlon -= 360
  if (dlon < -180) dlon += 360
  const retro = dlon < 0
  const el = Math.acos(clamp(((-now.ex) * now.vx + (-now.ey) * now.vy) / (hypot(now.ex, now.ey) * hypot(now.vx, now.vy) || 1), -1, 1)) / D2R
  const cx = 170, cy = 118, k = inner ? 70 : 48
  const to = (x: number, y: number) => [cx + x * k, cy - y * k] as const
  const [ex, ey] = to(now.ex, now.ey)
  const [px, py] = to(now.px, now.py)
  const hit = rayCircle(now.ex, now.ey, now.vx, now.vy, inner ? 2.35 : 3.15)
  const [hx, hy] = hit ? to(hit[0], hit[1]) : [px, py]
  const trail = Array.from({ length: 28 }, (_, i) => {
    const tt = t - i * (span / 180)
    const L = lonOf(tt)
    const rad = inner ? 2.35 : 3.15
    return to(rad * Math.cos(L * D2R), rad * Math.sin(L * D2R))
  })
  return (
    <div className="wg">
      <Note>圆轨道 · 示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 240">
        <circle cx={cx} cy={cy} r={(inner ? 2.35 : 3.15) * k} fill="none" stroke="rgba(246,241,228,0.18)" />
        <circle cx={cx} cy={cy} r={k} fill="none" stroke="rgba(91,127,168,0.55)" />
        <circle cx={cx} cy={cy} r={rp * k} fill="none" stroke={inner ? 'rgba(143,176,214,0.7)' : 'rgba(217,115,79,0.55)'} />
        <circle cx={cx} cy={cy} r={8} fill="#e8b85c" />
        <polyline points={trail.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke={retro ? '#d9734f' : '#c2a05a'} strokeWidth={2} />
        <line x1={ex} y1={ey} x2={hx} y2={hy} stroke="rgba(246,241,228,0.55)" />
        <circle cx={ex} cy={ey} r={5} fill="#5b7fa8" />
        <circle cx={px} cy={py} r={4.5} fill={inner ? '#9fbccb' : '#d9734f'} />
        <circle cx={hx} cy={hy} r={4} fill={retro ? '#d9734f' : '#c2a05a'} />
      </svg>
      <div className="wg-read">
        <span>视运动 <b>{retro ? '逆行' : '顺行'}</b></span>
        <span>和太阳的夹角 <b>{el.toFixed(0)}°</b></span>
      </div>
      <Slider label="时间" value={t} min={0} max={span} step={0.2} onChange={(v) => { setPlaying(false); setT(v) }} fmt={(v) => `${Math.round(v)} 天`} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <Btns<boolean> items={[[true, '水星（内）'], [false, '火星（外）']]} value={inner} onChange={(v) => { setInner(v); setT(0) }} />
      </div>
      <div className="wg-cap">{inner
        ? (retro ? '这一段夹着下合。刚转成逆行时距角还有十几度；正中间经过太阳前面，才接近 0°。' : '水星还在旁边跑，视线照常往前。逆行发生在下合前后，不是整段都贴着太阳。')
        : (retro ? '这次是地球更快，从火星旁边超过去。外行星在冲日附近逆行。' : '火星看起来在顺行。等到地球超车时，外圈的点会倒退。')}</div>
    </div>
  )
}

function rayCircle(ex: number, ey: number, dx: number, dy: number, R: number): [number, number] | null {
  const a = dx * dx + dy * dy
  if (a < 1e-9) return null
  const b = 2 * (ex * dx + ey * dy)
  const c = ex * ex + ey * ey - R * R
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const s = Math.max((-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a))
  return [ex + s * dx, ey + s * dy]
}

/* ── 金星五瓣花（第 57 天） ── */
function VenusPentagram() {
  const [year, setYear] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setYear((y) => Math.min(8, y + dt * 0.45)))
  useEffect(() => { if (year >= 8 && playing) setPlaying(false) }, [year, playing])
  const geo = useMemo(() => {
    const Te = 365.256, Tv = 224.701, a = 0.723
    const pts: { x: number; y: number; t: number; d: number }[] = []
    for (let t = 0; t <= 8 * Te; t += 3) {
      const ae = 2 * Math.PI * t / Te, av = 2 * Math.PI * t / Tv
      const x = a * Math.cos(av) - Math.cos(ae)
      const y = a * Math.sin(av) - Math.sin(ae)
      pts.push({ x, y, t, d: Math.hypot(x, y) })
    }
    const mins: number[] = pts[0].d < 0.4 ? [0] : []
    for (let i = 2; i < pts.length - 2; i++) {
      const p = pts[i]
      if (p.d < 0.45 && p.d <= pts[i - 1].d && p.d <= pts[i + 1].d && p.d < pts[i - 2].d && p.d < pts[i + 2].d) mins.push(i)
    }
    return { pts, mins }
  }, [])
  const cx = 170, cy = 118, k = 100 / 1.75
  const xy = (p: { x: number; y: number }) => [cx + p.x * k, cy - p.y * k] as const
  const n = Math.max(2, Math.floor((year / 8) * (geo.pts.length - 1)))
  const line = geo.pts.slice(0, n + 1).map((p) => xy(p).map((v) => v.toFixed(1)).join(',')).join(' ')
  const ghost = geo.pts.map((p) => xy(p).map((v) => v.toFixed(1)).join(',')).join(' ')
  const dot = xy(geo.pts[n])
  const tips = geo.mins.map((i) => geo.pts[i])
  return (
    <div className="wg">
      <Note>圆轨道 · 地心</Note>
      <svg className="wg-svg" viewBox="0 0 340 240">
        <circle cx={cx} cy={cy} r={k} fill="none" stroke="rgba(91,127,168,0.35)" strokeDasharray="3 3" />
        <polyline points={ghost} fill="none" stroke="rgba(194,160,90,0.18)" strokeWidth={1.2} />
        <polyline points={line} fill="none" stroke="#c2a05a" strokeWidth={1.6} />
        {tips.length >= 2 && year > 7.2 && (
          <polygon points={tips.map((p) => xy(p).map((v) => v.toFixed(1)).join(',')).join(' ')} fill="none" stroke="#8fb0d6" strokeWidth={1.2} />
        )}
        {tips.map((p, i) => {
          const [x, y] = xy(p)
          const on = p.t / (365.256 * 8) <= year + 0.02
          return <circle key={i} cx={x} cy={y} r={on ? 3.5 : 2} fill={on ? '#f6f1e4' : 'rgba(246,241,228,0.25)'} />
        })}
        <circle cx={cx} cy={cy} r={4} fill="#5b7fa8" />
        <circle cx={dot[0]} cy={dot[1]} r={4} fill="#e6c49a" />
        <text x={cx + 6} y={cy - 6} fill="#9eb6d4" fontSize="10">地球</text>
      </svg>
      <div className="wg-read"><span>第 <b>{year.toFixed(1)}</b> 年</span><span>下合 <b>{tips.filter((p) => p.t <= year * 365.256 + 5).length}</b> / 5 次</span></div>
      <Slider label="年" value={year} min={0} max={8} step={0.02} onChange={(v) => { setPlaying(false); setYear(v) }} fmt={(v) => `${v.toFixed(1)} 年`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /><button className="wg-btn" onClick={() => { setYear(0); setPlaying(true) }}>重画</button></div>
      <div className="wg-cap">八年里金星相对地球走出五瓣。五次下合相隔约 144°，连起来是一颗五角星（蓝线）。8 年并不正好等于 5 个会合周期，花瓣每八年再挪大约 2°。</div>
    </div>
  )
}

/* ── 晨星 / 昏星（第 58 天） ── */
function MorningEvening() {
  const [el, setEl] = useState(-32)
  const [dawn, setDawn] = useState(true)
  const alt = dawn ? -el : el
  const glare = Math.abs(el) < 8
  const up = alt > 3 && !glare
  const name = el < -3 ? '晨星 · 启明' : el > 3 ? '昏星 · 长庚' : '太靠近太阳'
  const hy = 150
  const vy = hy - clamp(alt, -40, 50) * 1.5
  return (
    <div className="wg">
      <Note>{dawn ? '黎明 · 面向东方' : '黄昏 · 面向西方'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        <rect x={0} y={0} width={340} height={hy} fill="#1b2744" />
        <rect x={0} y={hy} width={340} height={70} fill="#12182a" />
        <line x1={0} y1={hy} x2={340} y2={hy} stroke="rgba(246,241,228,0.45)" />
        <circle cx={170} cy={hy + 16} r={16} fill="#e8b85c" opacity={0.9} />
        <text x={170} y={hy + 42} textAnchor="middle" fill="#e8b85c" fontSize="11">太阳在地平线上</text>
        <circle cx={170} cy={vy} r={5} fill="#fff1c9" opacity={vy > hy ? 0.35 : 1} />
        {up && <text x={184} y={vy + 4} fill="#fff1c9" fontSize="12">{name}</text>}
        <text x={16} y={20} fill="rgba(246,241,228,0.55)" fontSize="11">{dawn ? '东' : '西'}</text>
      </svg>
      <div className="wg-read">
        <span>距角 <b>{el > 0 ? '东' : '西'} {Math.abs(el).toFixed(0)}°</b></span>
        <span><b>{name}</b></span>
        <span>{glare ? '淹没在阳光里' : up ? '看得见' : '在地平线下面'}</span>
      </div>
      <Slider label="相对太阳" value={el} min={-47} max={47} step={1} onChange={setEl} fmt={(v) => `${v > 0 ? '东' : '西'} ${Math.abs(v)}°`} />
      <Btns items={[[true, '看黎明'], [false, '看黄昏']]} value={dawn} onChange={setDawn} />
      <div className="wg-cap">{el < 0
        ? '在太阳西边：比太阳早升起，黎明时出现在东方。'
        : '在太阳东边：比太阳晚落下，黄昏时留在西方。'}同一颗金星。水星也分晨星和昏星。拉丁文旧名 Lucifer 与 Hesperus 都指金星。</div>
    </div>
  )
}

/* ── 谁更亮（第 59 天） ── */
function Brightness() {
  const [mars, setMars] = useState(1)
  const mag = (m: number) => m
  const marsMag = 1.6 + mars * (-2.9 - 1.6)
  const rows: { name: string; m: number; color: string }[] = [
    { name: '金星（最亮时）', m: mag(-4.6), color: '#e6c49a' },
    { name: '木星', m: mag(-2.5), color: '#cfa56a' },
    { name: '火星（拖滑块）', m: marsMag, color: '#d9734f' },
    { name: '土星', m: mag(0.7), color: '#a7a291' },
  ]
  const w = (m: number) => clamp((2 - m) * 28, 8, 250)
  return (
    <div className="wg">
      <Note>视星等 · 越小越亮</Note>
      <svg className="wg-svg" viewBox="0 0 340 168">
        {rows.map((r, i) => (
          <g key={r.name}>
            <text x={8} y={28 + i * 38} fill="#f6f1e4" fontSize="12">{r.name}</text>
            <rect x={118} y={16 + i * 38} width={w(r.m)} height={14} rx={7} fill={r.color} />
            <text x={124 + w(r.m)} y={28 + i * 38} fill="rgba(246,241,228,0.7)" fontSize="11">{r.m.toFixed(1)}</text>
          </g>
        ))}
      </svg>
      <Slider label="火星近远" value={mars} min={0} max={1} step={0.01} onChange={setMars} fmt={(v) => (v > 0.85 ? '冲日' : v < 0.15 ? '合日' : '中间')} />
      <div className="wg-cap">视星等每小 5 等，亮度大约 ×100。金星能到 −4.6，是夜空里除了日月最亮的一点。火星从合日到冲日可以差到大约 5 等。</div>
    </div>
  )
}

/* ── 内行星到不了 180°（第 60 天） ── */
function InnerOuter() {
  const [key, setKey] = useState<'mercury' | 'venus' | 'mars'>('venus')
  const [t, setT] = useState(0.35)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => setT((x) => (x + dt * 0.12) % 1))
  const inner = key !== 'mars'
  const max = key === 'mercury' ? 28 : key === 'venus' ? 47 : 180
  const el = inner ? Math.abs(Math.sin(t * Math.PI * 2)) * max : Math.abs(Math.sin(t * Math.PI)) * 180
  const opp = !inner && el > 165
  const cx = 170, cy = 150, r = 108
  const ang = 180 - el
  const x = cx + r * Math.cos(ang * D2R), y = cy - r * Math.sin(ang * D2R)
  return (
    <div className="wg">
      <Note>从地球看和太阳的夹角</Note>
      <svg className="wg-svg" viewBox="0 0 340 200">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="rgba(91,127,168,0.08)" stroke="rgba(246,241,228,0.35)" />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="rgba(246,241,228,0.25)" />
        {[0, 47, 90, 180].map((d) => {
          const a = 180 - d
          const [x1, y1] = [cx + (r - 8) * Math.cos(a * D2R), cy - (r - 8) * Math.sin(a * D2R)]
          const [x2, y2] = [cx + r * Math.cos(a * D2R), cy - r * Math.sin(a * D2R)]
          return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(246,241,228,0.45)" />
        })}
        <text x={cx - r} y={cy + 16} textAnchor="middle" fill="rgba(246,241,228,0.55)" fontSize="10">合 0°</text>
        <text x={cx} y={cy - r - 6} textAnchor="middle" fill="rgba(246,241,228,0.55)" fontSize="10">90°</text>
        <text x={cx + r} y={cy + 16} textAnchor="middle" fill="rgba(246,241,228,0.55)" fontSize="10">冲 180°</text>
        <line x1={cx} y1={cy} x2={x} y2={y} stroke="#c2a05a" strokeWidth={2} />
        <circle cx={x} cy={y} r={6} fill={key === 'mars' ? '#d9734f' : '#e6c49a'} />
        <circle cx={cx} cy={cy} r={4} fill="#5b7fa8" />
      </svg>
      <div className="wg-read"><span>夹角 <b>{el.toFixed(0)}°</b></span><span>{opp ? '冲日 · 整夜可见' : key === 'mercury' ? '示意用上限 28°，近日约 18°' : key === 'venus' ? '大距大约 45° 到 47°' : '可以跑到太阳对面'}</span></div>
      <Slider label="时间" value={t} min={0} max={1} step={0.001} onChange={(v) => { setPlaying(false); setT(v) }} fmt={() => `${el.toFixed(0)}°`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <Btns items={[['mercury', '水星'], ['venus', '金星'], ['mars', '火星']]} value={key} onChange={setKey} />
      <div className="wg-cap">{key === 'mercury'
        ? '针头用的是远日上限约 28°。近日可以缩到大约 18°，两种都碰不到右边的"冲"。'
        : key === 'venus'
          ? '金星的大距大约在 45° 到 47°，针头停在半路，碰不到"冲"。'
          : '火星能走到 180°：太阳落下，它升起，亮一整夜。'}</div>
    </div>
  )
}

/* ── 冲日亮度（第 61、62 天） ── */
function Opposition() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = usePlaying()
  const Te = 365.25, Tp = 686.98, rp = 1.524
  const S = 1 / (1 / Te - 1 / Tp)
  useLoop(playing, (dt) => setT((x) => (x + dt * 36) % S))
  const ae = 2 * Math.PI * t / Te, ap = 2 * Math.PI * t / Tp
  const ex = Math.cos(ae), ey = Math.sin(ae)
  const px = rp * Math.cos(ap), py = rp * Math.sin(ap)
  const dx = px - ex, dy = py - ey
  const dist = hypot(dx, dy)
  const vsx = -ex, vsy = -ey
  const el = Math.acos(clamp((vsx * dx + vsy * dy) / (dist || 1), -1, 1)) / D2R
  const sunx = -px, suny = -py
  const earthx = ex - px, earthy = ey - py
  const chi = Math.acos(clamp((sunx * earthx + suny * earthy) / (hypot(sunx, suny) * hypot(earthx, earthy) || 1), -1, 1)) / D2R
  const mag = -1.52 + 5 * Math.log10(dist * rp) + 0.016 * chi
  const magConj = -1.52 + 5 * Math.log10((rp + 1) * rp)
  const ratio = Math.pow(10, -0.4 * (mag - magConj))
  const retro = (() => {
    const lon = (tt: number) => {
      const a1 = 2 * Math.PI * tt / Te, a2 = 2 * Math.PI * tt / Tp
      const vx = rp * Math.cos(a2) - Math.cos(a1), vy = rp * Math.sin(a2) - Math.sin(a1)
      return Math.atan2(vy, vx)
    }
    let d = lon(t + 0.5) - lon(t)
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    return d < 0
  })()
  const cx = 170, cy = 116, k = 52
  const hidden = el < 18
  const rad = 3 + 11 * Math.sqrt(clamp(ratio, 0.2, 30) / 23)
  return (
    <div className="wg">
      <Note>圆轨道 · 示意星等</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <circle cx={cx} cy={cy} r={k} fill="none" stroke="rgba(91,127,168,0.5)" />
        <circle cx={cx} cy={cy} r={k * rp} fill="none" stroke="rgba(217,115,79,0.4)" />
        <circle cx={cx} cy={cy} r={9} fill="#e8b85c" />
        <circle cx={cx + ex * k} cy={cy - ey * k} r={5} fill="#5b7fa8" />
        <circle cx={cx + px * k} cy={cy - py * k} r={rad + 8} fill="#d9734f" opacity={hidden ? 0.08 : 0.2} />
        <circle cx={cx + px * k} cy={cy - py * k} r={rad} fill="#d9734f" opacity={hidden ? 0.25 : 1} />
        <text x={16} y={20} fill="#f6f1e4" fontSize="13">视星等 {mag.toFixed(1)}</text>
        <text x={16} y={38} fill="rgba(246,241,228,0.7)" fontSize="12">约为合日亮度的 {ratio.toFixed(0)} 倍</text>
      </svg>
      <div className="wg-read">
        <span>夹角 <b>{el.toFixed(0)}°</b></span>
        <span>距离 <b>{dist.toFixed(2)}</b> 天文单位</span>
        <span>{retro ? '正在逆行' : '顺行'}</span>
        <span>{hidden ? '太靠近太阳，看不见' : el > 160 ? '冲日 · 整夜最亮' : '看得见'}</span>
      </div>
      <Slider label="会合周期" value={t} min={0} max={S} step={1} onChange={(v) => { setPlaying(false); setT(v) }} fmt={(v) => `${Math.round(v)} 天`} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <button className="wg-btn" onClick={() => { setPlaying(false); setT(0) }}>跳到冲日</button>
        <button className="wg-btn" onClick={() => { setPlaying(false); setT(S / 2) }}>跳到合日</button>
      </div>
      <div className="wg-cap">t = 0 时地球夹在太阳和火星中间：最近、最亮、逆行、整夜可见。圆轨道大约差二十多倍；火星轨道扁，最近的冲日可以到一百倍左右。真实逆行约 60–80 天。</div>
    </div>
  )
}

/* ── 木星一年大约一宫；土星两年半一宫 ── */
function SlowWalk({ body }: { body: 'jupiter' | 'saturn' }) {
  const jup = body === 'jupiter'
  const [year, setYear] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  const max = jup ? 12 : 30
  useLoop(playing, (dt) => setYear((y) => (y + dt * (max / 12)) % max))
  const per = jup ? 11.86 : 29.46
  const lon = norm360((year * 360) / per)
  const ghost = norm360(year * 30)
  const cx = 170, cy = 118, r = 74
  const [x, y] = wheel(cx, cy, r - 6, lon)
  const [gx, gy] = wheel(cx, cy, r - 22, ghost)
  const ahead = norm360(lon - ghost)
  const showAhead = ahead < 180 ? ahead : ahead - 360
  return (
    <div className="wg">
      <Note>{jup ? '岁星 · 示意' : '最外一圈 · 示意'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(246,241,228,0.25)" />
        {SIGNS.map((sg) => {
          const [ix, iy] = wheel(cx, cy, r + 16, sg.i * 30 - 15)
          return <GlyphAt key={sg.i} i={sg.i} x={ix} y={iy} size={13} color="rgba(246,241,228,0.5)" width={8} />
        })}
        {jup && <circle cx={gx} cy={gy} r={4} fill="none" stroke="#8fb0d6" />}
        <PlanetAt p={body} x={x} y={y} size={20} color={PLANET[body].color} />
      </svg>
      <div className="wg-read">
        <span>第 <b>{year.toFixed(1)}</b> 年</span>
        <span>在 <b>{signOf(lon).sign.name}</b> {fmtDeg(signOf(lon).deg)}</span>
        {jup && <span>比"正好 30°/年"超前 <b>{showAhead.toFixed(1)}°</b></span>}
      </div>
      <Slider label="年" value={year} min={0} max={max} step={0.02} onChange={(v) => { setPlaying(false); setYear(v) }} fmt={(v) => `${v.toFixed(1)} 年`} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        {jup && <button className="wg-btn" onClick={() => { setPlaying(false); setYear(12) }}>第 12 年</button>}
      </div>
      <div className="wg-cap">{jup
        ? '金点约 30.4°/年，蓝圈是假装正好 30°/年。第 12 年大约超前 4°；照这个速度，约 86 年多走整整一个星座，岁星纪年就会错一格。'
        : '土星约 29.5 年一圈，每个星座大约 2 年半。它是肉眼能当行星跟踪的最外一颗。'}</div>
    </div>
  )
}

/* ── 七颗的象征从运动来（第 70 天，也可单看一颗） ── */
const SYMBOLS: { p: Planet; motion: string; mean: string }[] = [
  { p: 'sun', motion: '每天约 1°，定季节和昼夜，从不逆行', mean: '传统：生命力、核心、权威' },
  { p: 'moon', motion: '借太阳的光，每天约 13°，和潮汐有关', mean: '传统：身体、日常、母亲。情绪是后来的说法' },
  { p: 'mercury', motion: '离太阳最远约 18° 到 28°，一年逆行 3 到 4 次，每次约三周', mean: '传统：信使、交流、商业；中性' },
  { p: 'venus', motion: '最亮，大距约 45° 到 47°，八年会合五次', mean: '传统：美、爱、价值；小吉是后来的等级' },
  { p: 'mars', motion: '红色，冲日时又近又亮，亮度剧变', mean: '传统：冲突、勇气、切割；小凶是后来的等级' },
  { p: 'jupiter', motion: '约 11.9 年一圈，亮而且稳', mean: '传统：扩张、恩惠；大吉是后来的等级' },
  { p: 'saturn', motion: '约 29.5 年一圈，最慢、较暗、最外', mean: '传统：时间、限制、结构；大凶是后来的等级' },
]

function SymbolMap({ focus = '' }: { focus?: string }) {
  const [cur, setCur] = useState<Planet>((SYMBOLS.some((s) => s.p === focus) ? focus : 'sun') as Planet)
  const row = SYMBOLS.find((s) => s.p === cur)!
  return (
    <div className="wg">
      <Note>传统读法 · 不是测量</Note>
      <div className="wg-btns">
        {SYMBOLS.map((s) => (
          <button key={s.p} className={`wg-btn ${s.p === cur ? 'on' : ''}`} onClick={() => setCur(s.p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PlanetGlyph p={s.p} size={16} color={s.p === cur ? '#141a2e' : PLANET[s.p].color} width={7} />
            {PLANET[s.p].name}
          </button>
        ))}
      </div>
      <div className="wg-read" style={{ marginTop: 10 }}><span>运动 <b>{row.motion}</b></span></div>
      <div className="wg-cap">{row.mean}。吉凶是性质，不是判决书。</div>
    </div>
  )
}

/* ── 实践：水逆、冲日、木土现在在哪 ── */
function LivePlanets({ mode }: { mode: 'mercury' | 'mars' | 'giants' }) {
  const [A, setA] = useState<AE | null>(null)
  const [year, setYear] = useState(() => bjYear())
  useEffect(() => { loadAstro().then(setA) }, [])
  if (!A) return <div className="wg"><div className="wg-cap">正在载入星历……</div></div>
  if (mode === 'mercury') return <MercuryYear A={A} year={year} setYear={setYear} />
  if (mode === 'mars') return <MarsOpp A={A} />
  return <GiantsNow A={A} />
}

function MercuryYear({ A, year, setYear }: { A: AE; year: number; setYear: (n: number) => void }) {
  const segs = useMemo(() => mercuryRetros(A, year), [A, year])
  return (
    <div className="wg">
      <Note>星历 · 留的时刻误差约数小时</Note>
      <div className="wg-row"><label>年份</label><input type="number" value={year} min={1900} max={2100} onChange={(e) => setYear(Number(e.target.value) || year)} /></div>
      <table className="wg-table">
        <thead><tr><th>开始（转逆）</th><th>结束（转顺）</th><th>天数</th></tr></thead>
        <tbody>
          {segs.map((s, i) => (
            <tr key={i}>
              <td>{fmtBJ(s.start)}<br />{s.startEl >= 0 ? `东 ${s.startEl.toFixed(0)}° 昏星` : `西 ${Math.abs(s.startEl).toFixed(0)}° 晨星`}</td>
              <td>{fmtBJ(s.end)}<br />{s.endEl >= 0 ? `东 ${s.endEl.toFixed(0)}° 昏星` : `西 ${Math.abs(s.endEl).toFixed(0)}° 晨星`}</td>
              <td>{Math.round((s.end.getTime() - s.start.getTime()) / 86400000)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {segs.length === 0 && <div className="wg-cap">这一年没有算到逆行。</div>}
      <div className="wg-cap">每次都从太阳东边（昏星）开始倒退，经过下合，到太阳西边（昏星变晨星）才转回顺行。一年 {segs.length} 次。</div>
    </div>
  )
}

function mercuryRetros(A: AE, year: number) {
  const t0 = Date.UTC(year - 1, 11, 1, 4)
  const days: { t: number; retro: boolean; el: number }[] = []
  for (let d = 0; d <= 430; d += 1) {
    const t = t0 + d * 86400000
    const p = positionsSync(A, new Date(t), ['sun', 'mercury'])
    days.push({ t, retro: p.mercury.retro, el: signedEl(p.mercury.lon, p.sun.lon) })
  }
  const raw: { a: number; b: number }[] = []
  for (let i = 1; i < days.length; i++) {
    if (!days[i - 1].retro && days[i].retro) raw.push({ a: days[i - 1].t, b: days[i].t })
  }
  const out: { start: Date; end: Date; startEl: number; endEl: number }[] = []
  const y0 = Date.UTC(year, 0, 1), y1 = Date.UTC(year + 1, 0, 1)
  for (const seg of raw) {
    const start = refineRetro(A, seg.a, seg.b, true)
    let endT = seg.b + 40 * 86400000
    for (let t = seg.b; t < seg.b + 40 * 86400000; t += 86400000) {
      const p = positionsSync(A, new Date(t), ['mercury'])
      if (!p.mercury.retro) { endT = t; break }
    }
    const end = refineRetro(A, endT - 86400000, endT, false)
    if (end.getTime() < y0 || start.getTime() > y1) continue
    const ps = positionsSync(A, start, ['sun', 'mercury'])
    const pe = positionsSync(A, end, ['sun', 'mercury'])
    out.push({
      start, end,
      startEl: signedEl(ps.mercury.lon, ps.sun.lon),
      endEl: signedEl(pe.mercury.lon, pe.sun.lon),
    })
  }
  return out
}

function refineRetro(A: AE, tFalse: number, tTrue: number, wantRetro: boolean) {
  let a = tFalse, b = tTrue
  for (let i = 0; i < 16; i++) {
    const m = (a + b) / 2
    const retro = positionsSync(A, new Date(m), ['mercury']).mercury.retro
    if (retro === wantRetro) b = m
    else a = m
  }
  return new Date(wantRetro ? b : a)
}

function MarsOpp({ A }: { A: AE }) {
  const hit = useMemo(() => nextMarsOpp(A, new Date()), [A])
  if (!hit) return <div className="wg"><div className="wg-cap">未来三年里没有找到冲日。</div></div>
  return (
    <div className="wg">
      <Note>从今天往后找 · 星历</Note>
      <div className="wg-read"><span>下一次冲日 <b>{fmtBJ(hit.when)}</b></span></div>
      <div className="wg-read"><span>火星 <b>{fmtLon(hit.lon)}</b></span><span>和太阳夹角 <b>{hit.sep.toFixed(1)}°</b></span></div>
      <div className="wg-read"><span>当天 {hit.retro ? '正在逆行' : '不是逆行（看一下是不是算偏了）'}</span><span>距离 <b>{hit.au.toFixed(2)}</b> 天文单位</span></div>
      <div className="wg-read"><span>这次逆行大约 <b>{fmtBJ(hit.retroStart)}</b> 到 <b>{fmtBJ(hit.retroEnd)}</b></span></div>
      <div className="wg-cap">冲日 = 太阳和火星一东一西。太阳落下时火星升起，所以整夜看得见，也离地球比较近。到天空模拟器里把日期调到这一天、时间调到半夜，火星应在南边附近。</div>
    </div>
  )
}

function nextMarsOpp(A: AE, from: Date) {
  const start = from.getTime()
  const seps: number[] = []
  for (let i = 0; i <= 800; i++) seps.push(sepAt(A, start + i * 86400000))
  let bestI = -1
  for (let i = 1; i < 800; i++) {
    if (seps[i] > 170 && seps[i] >= seps[i - 1] && seps[i] >= seps[i + 1]) { bestI = i; break }
  }
  if (bestI < 0) return null
  let a = start + (bestI - 1) * 86400000, b = start + (bestI + 1) * 86400000
  for (let k = 0; k < 12; k++) {
    const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3
    const s1 = sepAt(A, m1), s2 = sepAt(A, m2)
    if (s1 < s2) a = m1
    else b = m2
  }
  const when = new Date((a + b) / 2)
  const p = positionsSync(A, when, ['sun', 'mars'])
  const v = A.GeoVector(A.Body.Mars, when, true)
  const au = Math.hypot(v.x, v.y, v.z)
  let rs = when.getTime(), re = when.getTime()
  for (let i = 1; i < 80; i++) {
    const t = when.getTime() - i * 86400000
    if (!positionsSync(A, new Date(t), ['mars']).mars.retro) break
    rs = t
  }
  for (let i = 1; i < 80; i++) {
    const t = when.getTime() + i * 86400000
    if (!positionsSync(A, new Date(t), ['mars']).mars.retro) break
    re = t
  }
  return { when, lon: p.mars.lon, sep: sep(p.mars.lon, p.sun.lon), retro: p.mars.retro, au, retroStart: new Date(rs), retroEnd: new Date(re) }
}
function sepAt(A: AE, ms: number) {
  const p = positionsSync(A, new Date(ms), ['sun', 'mars'])
  return sep(p.mars.lon, p.sun.lon)
}

function GiantsNow({ A }: { A: AE }) {
  const rows = useMemo(() => (['jupiter', 'saturn'] as const).map((b) => planetIngress(A, b, new Date())), [A])
  return (
    <div className="wg">
      <Note>星历 · 北京时间附近</Note>
      {rows.map((r) => (
        <div key={r.body} style={{ padding: '8px 0', borderTop: '1px solid rgba(246,241,228,0.1)' }}>
          <div className="wg-read"><span style={{ color: PLANET[r.body].color }}><b>{PLANET[r.body].name}</b></span><span>{fmtLon(r.lon)}</span><span>速度 <b>{r.speed.toFixed(3)}°/天</b> {r.retro ? '逆行' : '顺行'}</span></div>
          <div className="wg-read"><span>本星座还剩 <b>{r.left.toFixed(1)}°</b></span><span>按平均 {MOTION[r.body].daily}°/天粗算 <b>{Math.round(r.left / MOTION[r.body].daily)} 天</b></span></div>
          <div className="wg-read"><span>星历：下一次进入下一星座 <b>{r.forward ? fmtBJ(r.forward) : '三年内没有'}</b></span></div>
          {r.back && <div className="wg-read"><span>逆行会先退回上一个星座：<b>{fmtBJ(r.back)}</b></span></div>}
        </div>
      ))}
      <div className="wg-cap">粗算用的是多年平均速度，已经把逆行"摊"进每一天。真要跨过前面那条边界时如果先碰上逆行，日子会差几个月。以星历那一行为准。</div>
    </div>
  )
}

function planetIngress(A: AE, body: 'jupiter' | 'saturn', from: Date) {
  const p0 = positionsSync(A, from, [body])[body]
  const s0 = Math.floor(norm360(p0.lon) / 30)
  const find = (target: number) => {
    let hi = -1
    for (let d = 1; d <= 1400; d += 2) {
      const s = Math.floor(norm360(positionsSync(A, new Date(from.getTime() + d * 86400000), [body])[body].lon) / 30)
      if (s === target) { hi = d; break }
    }
    if (hi < 0) return null
    let a = from.getTime() + (hi - 2) * 86400000
    let b = from.getTime() + hi * 86400000
    for (let i = 0; i < 16; i++) {
      const m = (a + b) / 2
      const s = Math.floor(norm360(positionsSync(A, new Date(m), [body])[body].lon) / 30)
      if (s === target) b = m
      else a = m
    }
    return new Date(b)
  }
  const deg = signOf(p0.lon).deg
  const forward = find((s0 + 1) % 12)
  const backRaw = find((s0 + 11) % 12)
  const back = backRaw && (!forward || backRaw.getTime() < forward.getTime()) ? backRaw : null
  return {
    body, lon: p0.lon, speed: p0.speed, retro: p0.retro, left: 30 - deg,
    forward, back,
  }
}

export const W02A: WidgetMap = {
  's2-wanderers': () => <Wanderers />,
  's2-twoViews': () => <TwoViews />,
  's2-sunBeat': () => <SunBeat />,
  's2-moonRace': () => <MoonRace />,
  's2-moonPhase': (a) => <MoonPhase live={Boolean(a.live)} />,
  's2-borrowedLight': () => <BorrowedLight />,
  's2-waxWane': () => <WaxWane />,
  's2-mercuryLeash': (a) => <MercuryLeash initial={String(a.planet ?? 'mm')} />,
  's2-overtake': () => <Overtake />,
  's2-venusPentagram': () => <VenusPentagram />,
  's2-morningEvening': () => <MorningEvening />,
  's2-brightness': () => <Brightness />,
  's2-innerOuter': () => <InnerOuter />,
  's2-opposition': () => <Opposition />,
  's2-jupiterWalk': () => <SlowWalk body="jupiter" />,
  's2-saturnWalk': () => <SlowWalk body="saturn" />,
  's2-symbolMap': (a) => <SymbolMap focus={String(a.focus ?? '')} />,
  's2-livePlanets': (a) => <LivePlanets mode={(a.mode as 'mercury' | 'mars' | 'giants') || 'mercury'} />,
  'sim': () => <SkySimWidget />,
}
