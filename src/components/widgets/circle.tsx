import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Btns, D2R, Note, PlayBtn, Slider, reduceMotion, useLoop, usePlaying, wheel } from './common'
import { GlyphAt } from '../Glyph'
import { SIGNS, TERMS, fmtDeg, norm360, signOf } from '../../data/zodiac'
import { ayanamsaAt } from '../../lib/astro'

/* ── 黄经刻度环（第 10–11 天）：从春分起刻度亮起；terms 时每 15° 冒节气名 ── */
export function RingWidget({ terms = false }: { terms?: boolean }) {
  const [lit, setLit] = useState(() => (reduceMotion() ? 360 : 0))
  const [lon, setLon] = useState(terms ? 45 : 130)
  const svgRef = useRef<SVGSVGElement>(null)
  useLoop(lit < 360, (dt) => setLit((l) => Math.min(360, l + dt * 150)))
  const cx = 170, cy = 170, R = 128
  const s = signOf(lon)
  const term = TERMS[Math.floor(norm360(lon) / 15)]
  const drag = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 340 - cx, y = ((e.clientY - r.top) / r.height) * 340 - cy
    setLon(Math.round(norm360(Math.atan2(y, -x) / D2R)))
  }
  const [px, py] = wheel(cx, cy, R, lon)
  return (
    <div className="wg">
      <Note>拖动金点</Note>
      <svg ref={svgRef} className="wg-svg" viewBox="0 0 340 340" onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag(e) }} onPointerMove={(e) => e.buttons && drag(e)}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(246,241,228,0.12)" strokeWidth={1} />
        {Array.from({ length: 72 }, (_, k) => {
          const a = k * 5
          const on = a <= lit
          const big = a % 30 === 0, mid = a % 15 === 0
          const [x1, y1] = wheel(cx, cy, R - (big ? 14 : mid ? 9 : 5), a), [x2, y2] = wheel(cx, cy, R, a)
          return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? (big ? '#c2a05a' : 'rgba(246,241,228,0.7)') : 'rgba(246,241,228,0.12)'} strokeWidth={big ? 2 : 1} />
        })}
        {SIGNS.map((sg) => {
          const a = (sg.i - 1) * 30
          if (a > lit) return null
          const [gx, gy] = wheel(cx, cy, R - 32, a + 15)
          return <motion.g key={sg.i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} style={{ transformOrigin: `${gx}px ${gy}px` }}>
            <GlyphAt i={sg.i} x={gx} y={gy} size={17} color={s.sign.i === sg.i ? '#c2a05a' : '#f6f1e4'} width={8} />
          </motion.g>
        })}
        {terms && TERMS.map((t, k) => {
          const a = k * 15
          if (a > lit) return null
          const [tx, ty] = wheel(cx, cy, R + 16, a)
          const zhong = k % 2 === 0
          return <motion.text key={t} x={tx} y={ty + 4} textAnchor="middle" fontSize="10.5" fill={zhong ? '#e6cf95' : 'rgba(246,241,228,0.55)'} fontWeight={zhong ? 700 : 400}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{t}</motion.text>
        })}
        {!terms && [[0, '春分 0°'], [90, '夏至 90°'], [180, '秋分 180°'], [270, '冬至 270°']].map(([a, t]) => {
          const [tx, ty] = wheel(cx, cy, R + 14, a as number)
          return (a as number) <= lit ? <text key={a} x={tx} y={ty + 4} textAnchor="middle" fontSize="11" fill="#8fb0d6">{t}</text> : null
        })}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#c2a05a" strokeWidth={1.2} />
        <circle cx={cx} cy={cy} r={3} fill="#c2a05a" />
        <circle cx={px} cy={py} r={9} fill="#c2a05a" stroke="#141a2e" strokeWidth={2} />
        <text x={cx} y={cy + 28} textAnchor="middle" fill="#f6f1e4" fontSize="13" fontFamily="var(--serif)">{s.sign.name} {Math.floor(s.deg)}°</text>
      </svg>
      <Slider label="黄经" value={lon} min={0} max={359} onChange={setLon} fmt={(v) => `${v}°`} />
      <div className="wg-cap">
        黄经 <b>{lon}°</b> = 第 {s.sign.i} 段的第 {Math.floor(s.deg)}° = <b>{s.sign.name} {Math.floor(s.deg)}°</b>
        {terms && <> · 节气 <b>{term}</b>{lon % 30 === 0 && '（中气 = 星座起点）'}</>}
      </div>
    </div>
  )
}

/* ── 月亮数一年（第 15 天） ── */
export function MoonYearWidget() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => setT((x) => Math.min(365.25, x + dt * 30)))
  useEffect(() => { if (t >= 365.25) setPlaying(false) }, [t, setPlaying])
  const cx = 150, cy = 150, Re = 95, Rm = 22
  const eA = (t / 365.25) * 360
  const synodic = 29.53
  const phase = ((t / synodic) * 360) % 360 // 0 = 新月
  const ex = cx + Re * Math.cos(eA * D2R), ey = cy - Re * Math.sin(eA * D2R)
  const mA = eA + 180 + phase
  const mx = ex + Rm * Math.cos(mA * D2R), my = ey - Rm * Math.sin(mA * D2R)
  const fulls = Math.floor((t + synodic / 2) / synodic)
  const frac = t / synodic
  return (
    <div className="wg">
      <Note>示意 · 不按比例</Note>
      <svg className="wg-svg" viewBox="0 0 340 300">
        <circle cx={cx} cy={cy} r={Re} fill="none" stroke="rgba(91,127,168,0.45)" strokeDasharray="3 4" />
        <circle cx={cx} cy={cy} r={15} fill="#e8b85c" />
        <circle cx={ex} cy={ey} r={Rm} fill="none" stroke="rgba(246,241,228,0.15)" />
        <circle cx={ex} cy={ey} r={7} fill="#5b7fa8" />
        <circle cx={mx} cy={my} r={4.5} fill={Math.abs(((phase + 180) % 360) - 180) > 165 ? '#fff6d6' : '#9aa3b8'} />
        {Array.from({ length: 13 }, (_, k) => {
          const on = k < fulls
          const x = 280 + (k % 2) * 26, y = 26 + Math.floor(k / 2) * 38
          const partial = k === 12 && t >= 365
          return (
            <g key={k}>
              <circle cx={x} cy={y} r={10} fill="none" stroke="rgba(246,241,228,0.25)" />
              {on && <motion.circle cx={x} cy={y} r={10} fill="#f5e6b8" initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ transformOrigin: `${x}px ${y}px` }} />}
              {partial && <path d={`M${x} ${y - 10} A10 10 0 0 1 ${x} ${y + 10}`} fill="rgba(245,230,184,0.4)" />}
              <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill={on ? '#141a2e' : 'rgba(246,241,228,0.4)'}>{k + 1}</text>
            </g>
          )
        })}
      </svg>
      <div className="wg-read"><span>第 <b>{Math.floor(t)}</b> 天</span><span>满月 <b>{fulls}</b> 次</span><span>月相周期数 <b>{frac.toFixed(2)}</b></span></div>
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /><button className="wg-btn" onClick={() => { setT(0); setPlaying(true) }}>重来</button></div>
      <div className="wg-cap">{t >= 365 ? <>一年 ≈ <b>12.37</b> 个月相周期 → 自然分成约 12 段。</> : '月亮每满一次，点亮一颗珠子……'}</div>
    </div>
  )
}

/* ── 切蛋糕：8、10、12 份（第 16 天） ── */
export function CakeWidget() {
  const [n, setN] = useState(12)
  const cx = 170, cy = 150, R = 115
  const polys: [number, string][] = [[2, '#e6cf95'], [3, '#c4633f'], [4, '#8fb0d6'], [6, '#8fbf9a']]
  const ok = polys.filter(([k]) => n % k === 0)
  const divisors = Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0)
  return (
    <div className="wg">
      <svg className="wg-svg" viewBox="0 0 340 290">
        <circle cx={cx} cy={cy} r={R} fill="rgba(246,241,228,0.05)" stroke="rgba(246,241,228,0.4)" />
        {Array.from({ length: n }, (_, k) => {
          const [x, y] = wheel(cx, cy, R, (k * 360) / n)
          return <line key={`${n}-${k}`} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(246,241,228,0.2)" />
        })}
        {ok.map(([k, col], j) => {
          const step = n / k
          const pts = Array.from({ length: k }, (_, m) => wheel(cx, cy, R, (m * step * 360) / n).join(',')).join(' ')
          return k === 2
            ? <motion.polyline key={`${n}-${k}`} points={pts} fill="none" stroke={col} strokeWidth={2.4} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: j * 0.3, duration: 0.6 }} />
            : <motion.polygon key={`${n}-${k}`} points={pts} fill="none" stroke={col} strokeWidth={2.4} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: j * 0.3, duration: 0.8 }} />
        })}
        {Array.from({ length: n }, (_, k) => { const [x, y] = wheel(cx, cy, R, (k * 360) / n); return <circle key={`p${n}-${k}`} cx={x} cy={y} r={3} fill="#f6f1e4" /> })}
        <text x="12" y="282" fontSize="11" fill="#e6cf95">━ 对分</text>
        <text x="72" y="282" fontSize="11" fill="#c4633f">━ 三角</text>
        <text x="132" y="282" fontSize="11" fill="#8fb0d6">━ 正方</text>
        <text x="192" y="282" fontSize="11" fill="#8fbf9a">━ 六边形</text>
      </svg>
      <Btns items={[[8, '切 8 份'], [10, '切 10 份'], [12, '切 12 份'], [24, '切 24 份']]} value={n} onChange={setN} />
      <div className="wg-read"><span>{n} 的约数：<b>{divisors.join('、')}</b></span></div>
      <div className="wg-cap">能画出 <b>{ok.length}</b> 种图形{ok.length < 4 && <>，缺了{polys.filter(([k]) => n % k).map(([k]) => ({ 2: '对分', 3: '三角', 4: '正方', 6: '六边形' } as Record<number, string>)[k]).join('、')}</>}。</div>
    </div>
  )
}

/** 天文星座在黄道上的范围（2000 年历元，黄经度数，近似） */
export const IAU: { name: string; from: number; to: number; oph?: boolean }[] = [
  { name: '双鱼', from: 351.6, to: 389.1 }, { name: '白羊', from: 29.1, to: 53.5 }, { name: '金牛', from: 53.5, to: 90.4 },
  { name: '双子', from: 90.4, to: 118.3 }, { name: '巨蟹', from: 118.3, to: 138.2 }, { name: '狮子', from: 138.2, to: 174.2 },
  { name: '处女', from: 174.2, to: 218.0 }, { name: '天秤', from: 218.0, to: 241.0 }, { name: '天蝎', from: 241.0, to: 247.7 },
  { name: '蛇夫', from: 247.7, to: 266.3, oph: true }, { name: '射手', from: 266.3, to: 299.7 }, { name: '摩羯', from: 299.7, to: 327.9 },
  { name: '水瓶', from: 327.9, to: 351.6 },
]
export function constellationAt(lon: number, year = 2000) {
  const shift = (year - 2000) * (50.29 / 3600)
  const l = norm360(lon - shift)
  return IAU.find((c) => (l >= c.from && l < c.to) || (l + 360 >= c.from && l + 360 < c.to))!
}

/* ── 星座与星宫叠图：蛇夫座之谜（第 17 天） ── */
export function SignsVsConstWidget() {
  const [grid, setGrid] = useState(true)
  const [lon, setLon] = useState(248)
  const cx = 170, cy = 170, R1 = 140, R2 = 112, R3 = 84
  const arc = (a0: number, a1: number, ro: number, ri: number) => {
    const [x0, y0] = wheel(cx, cy, ro, a0), [x1, y1] = wheel(cx, cy, ro, a1)
    const [i0x, i0y] = wheel(cx, cy, ri, a0), [i1x, i1y] = wheel(cx, cy, ri, a1)
    const large = a1 - a0 > 180 ? 1 : 0
    return `M${i0x} ${i0y} L${x0} ${y0} A${ro} ${ro} 0 ${large} 0 ${x1} ${y1} L${i1x} ${i1y} A${ri} ${ri} 0 ${large} 1 ${i0x} ${i0y}`
  }
  const c = constellationAt(lon)
  const s = signOf(lon)
  const [px, py] = wheel(cx, cy, R1 + 6, lon)
  return (
    <div className="wg">
      <Note>外圈：天文星座　内圈：星宫</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {IAU.map((k, j) => {
          const [tx, ty] = wheel(cx, cy, (R1 + R2) / 2, (k.from + k.to) / 2)
          return (
            <g key={k.name}>
              <path d={arc(k.from, k.to, R1, R2)} fill={k.oph ? 'rgba(176,68,47,0.55)' : j % 2 ? 'rgba(91,127,168,0.3)' : 'rgba(91,127,168,0.18)'} stroke="#141a2e" strokeWidth={1.5} />
              <text x={tx} y={ty + 4} textAnchor="middle" fontSize={k.to - k.from < 10 ? 8.5 : 11} fill="#f6f1e4">{k.name}</text>
            </g>
          )
        })}
        {grid && SIGNS.map((sg) => {
          const a0 = (sg.i - 1) * 30
          const [gx, gy] = wheel(cx, cy, (R2 + R3) / 2, a0 + 15)
          return (
            <motion.g key={sg.i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: sg.i * 0.05 }}>
              <path d={arc(a0, a0 + 30, R2 - 2, R3)} fill={sg.i % 2 ? 'rgba(194,160,90,0.22)' : 'rgba(194,160,90,0.1)'} stroke="#141a2e" strokeWidth={1.5} />
              <GlyphAt i={sg.i} x={gx} y={gy} size={14} color="#e6cf95" width={8} />
            </motion.g>
          )
        })}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#e8b85c" strokeWidth={1.5} />
        <circle cx={px} cy={py} r={8} fill="#e8b85c" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#f6f1e4" fontSize="12">太阳</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="11">黄经 {Math.round(lon)}°</text>
      </svg>
      <Slider label="太阳" value={lon} min={0} max={359} onChange={setLon} fmt={(v) => `${v}°`} />
      <div className="wg-btns"><button className={`wg-btn ${grid ? 'on' : ''}`} onClick={() => setGrid(!grid)}>{grid ? '隐藏' : '叠上'} 30° 星宫格子</button></div>
      <div className="wg-cap">天文星座：<b style={{ color: c.oph ? '#e88a72' : undefined }}>{c.name}座</b>（约 {Math.round(((c.to - c.from) * 365.25) / 360)} 天）　星宫：<b>{s.sign.name}宫</b>（每宫约 30 天）</div>
    </div>
  )
}

/* ── 岁差：春分点在星群间慢慢后退（第 18–19 天） ── */
export function PrecessionWidget() {
  const [year, setYear] = useState(2026)
  const [playing, setPlaying] = usePlaying(false)
  const [wob, setWob] = useState(0)
  useLoop(true, (dt) => setWob((w) => w + dt))
  useLoop(playing, (dt) => setYear((y) => (y >= 2500 ? -2000 : Math.round(y + dt * 300))))
  const shift = (year - 2000) * (50.29 / 3600)
  const W = 340, X0 = 20, X1 = 320
  const px = (lonInTropical: number) => X0 + ((norm360(lonInTropical + 60) / 360) * (X1 - X0)) // 窗口从 300° 到 300°
  const ay = ayanamsaAt(year)
  const vp = constellationAt(0, year)
  const axisAng = (wob * 40) % 360
  return (
    <div className="wg">
      <Note>示意 · 已放大</Note>
      <svg className="wg-svg" viewBox={`0 0 ${W} 230`}>
        <g transform="translate(60 70)">
          <ellipse cx="0" cy="38" rx="26" ry="5" fill="rgba(246,241,228,0.08)" />
          <motion.g style={{ originX: '0px', originY: '30px' }}>
            <line x1={0} y1={30} x2={12 * Math.cos(axisAng * D2R)} y2={-34 + 4 * Math.sin(axisAng * D2R)} stroke="#c2a05a" strokeWidth={2} />
            <ellipse cx={6 * Math.cos(axisAng * D2R)} cy={0} rx="22" ry="11" fill="#5b7fa8" stroke="#cfe0f2" />
          </motion.g>
          <ellipse cx="0" cy="-34" rx="12" ry="4" fill="none" stroke="rgba(194,160,90,0.5)" strokeDasharray="2 3" />
          <text x="-30" y="58" fill="rgba(246,241,228,0.6)" fontSize="10">地轴像陀螺一样摇头</text>
        </g>
        <text x="150" y="40" fill="#f6f1e4" fontSize="13" fontFamily="var(--serif)">公元 {year < 0 ? `前 ${-year}` : year} 年</text>
        <text x="150" y="62" fill="rgba(246,241,228,0.7)" fontSize="11">岁差值 ≈ <tspan fill="#c2a05a">{ay.toFixed(1)}°</tspan></text>
        <text x="150" y="80" fill="rgba(246,241,228,0.7)" fontSize="11">春分点在 <tspan fill="#c2a05a">{vp.name}座</tspan> 星群</text>
        {IAU.map((c) => {
          const a = c.from + shift, b = c.to + shift
          const segs: [number, number][] = []
          for (let k = -1; k <= 1; k++) segs.push([a + 360 * k, b + 360 * k])
          return segs.map(([s0, s1], k) => {
            const x0 = X0 + (((s0 + 60) / 360) * (X1 - X0)), x1 = X0 + (((s1 + 60) / 360) * (X1 - X0))
            if (x1 < X0 || x0 > X1) return null
            const cl0 = Math.max(X0, x0), cl1 = Math.min(X1, x1)
            return <g key={`${c.name}${k}`}>
              <rect x={cl0} y={120} width={cl1 - cl0} height={34} fill={c.oph ? 'rgba(176,68,47,0.45)' : 'rgba(91,127,168,0.28)'} stroke="#141a2e" />
              {cl1 - cl0 > 18 && <text x={(cl0 + cl1) / 2} y={141} textAnchor="middle" fontSize="10" fill="#f6f1e4">{c.name}</text>}
            </g>
          })
        })}
        {SIGNS.map((sg) => {
          const x0 = px((sg.i - 1) * 30), x1 = x0 + (X1 - X0) / 12
          return <g key={sg.i}><rect x={x0} y={160} width={x1 - x0} height={26} fill={sg.i % 2 ? 'rgba(194,160,90,0.25)' : 'rgba(194,160,90,0.12)'} stroke="#141a2e" />
            <GlyphAt i={sg.i} x={(x0 + x1) / 2} y={173} size={13} color="#e6cf95" width={8} /></g>
        })}
        <line x1={px(0)} y1={108} x2={px(0)} y2={196} stroke="#fff3cf" strokeWidth={2} />
        <text x={px(0)} y={104} textAnchor="middle" fill="#fff3cf" fontSize="11">春分点（白羊 0°）</text>
        <text x={X0} y={214} fill="rgba(246,241,228,0.55)" fontSize="10">上：天文星座（跟着星星）　下：回归星宫（跟着春分点）</text>
      </svg>
      <Slider label="年代" value={year} min={-2000} max={2500} step={10} onChange={(v) => { setPlaying(false); setYear(v) }} fmt={(v) => (v < 0 ? `前${-v}` : `${v}`)} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        {[-500, 150, 2026, 2500].map((y) => <button key={y} className={`wg-btn ${year === y ? 'on' : ''}`} onClick={() => { setPlaying(false); setYear(y) }}>{y < 0 ? `前${-y}` : y}</button>)}
      </div>
      <div className="wg-cap">约 <b>72 年退 1°</b>，2000 年退约 28°，几乎一整格。</div>
    </div>
  )
}

export const fmtLon2 = (l: number) => `${signOf(l).sign.name} ${fmtDeg(signOf(l).deg)}`
