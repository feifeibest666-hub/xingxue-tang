import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Btns, D2R, Note, PlayBtn, Slider, doyLabel, lonFromDoy, seeded, useLoop, usePlaying, wheel } from './common'
import { GlyphAt } from '../Glyph'
import { SIGNS, signOf, fmtDeg } from '../../data/zodiac'
import { dayLength, sunDecl } from '../../lib/astro'

/* ── 天球：距离变了，方向不变（第 2 天） ── */
export function SphereWidget() {
  const [k, setK] = useState(1)
  const [eclipse, setEclipse] = useState(false)
  const stars = useMemo(() => seeded(9, 11).map(([a, b]) => ({ ang: 18 + a * 144, base: 0.35 + b * 1.4 })), [])
  const ox = 170, oy = 205, R = 130
  const pt = (ang: number, r: number) => [ox + r * Math.cos(ang * D2R), oy - r * Math.sin(ang * D2R)] as const
  return (
    <div className="wg">
      <Note>示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 240">
        <defs><clipPath id="sph-clip"><rect x="0" y="0" width="340" height="205" /></clipPath></defs>
        <path d={`M${ox - R} ${oy} A${R} ${R} 0 0 1 ${ox + R} ${oy}`} fill="rgba(91,127,168,0.08)" stroke="rgba(246,241,228,0.35)" strokeDasharray="3 4" />
        <line x1="10" y1={oy} x2="330" y2={oy} stroke="rgba(246,241,228,0.5)" />
        <g clipPath="url(#sph-clip)">
          {!eclipse && stars.map((s, i) => {
            const [x, y] = pt(s.ang, Math.min(400, s.base * R * k))
            const [px, py] = pt(s.ang, R)
            return (
              <g key={i}>
                <line x1={ox} y1={oy} x2={x} y2={y} stroke="rgba(194,160,90,0.35)" strokeDasharray="2 4" />
                <motion.circle cx={x} cy={y} r={3} fill="#f6f1e4" animate={{ cx: x, cy: y }} transition={{ duration: 0.3 }} />
                <circle cx={px} cy={py} r={4.5} fill="#c2a05a" />
              </g>
            )
          })}
          {eclipse && (() => {
            const ang = 62
            const [mx, my] = pt(ang, R * 0.42), [sx, sy] = pt(ang, R * 1.6 * k), [px, py] = pt(ang, R)
            return (
              <g>
                <line x1={ox} y1={oy} x2={sx} y2={sy} stroke="rgba(194,160,90,0.5)" strokeDasharray="2 4" />
                <circle cx={sx} cy={sy} r={30 * Math.min(1.4, k)} fill="#e8b85c" opacity={0.85} />
                <circle cx={mx} cy={my} r={6} fill="#9aa3b8" />
                <circle cx={px} cy={py} r={7} fill="#141a2e" stroke="#c2a05a" strokeWidth={2.5} />
                <text x={mx + 10} y={my + 4} fill="#f6f1e4" fontSize="11">月亮 38 万公里</text>
                <text x={Math.min(250, sx - 20)} y={Math.max(14, sy - 36)} fill="#f6f1e4" fontSize="11">太阳 1.5 亿公里</text>
              </g>
            )
          })()}
        </g>
        <g transform={`translate(${ox} ${oy})`}>
          <circle cx="0" cy="-17" r="4" fill="#f6f1e4" />
          <line x1="0" y1="-13" x2="0" y2="-4" stroke="#f6f1e4" strokeWidth="2" />
          <line x1="-5" y1="0" x2="0" y2="-5" stroke="#f6f1e4" strokeWidth="2" /><line x1="5" y1="0" x2="0" y2="-5" stroke="#f6f1e4" strokeWidth="2" />
        </g>
        <text x="12" y="228" fill="rgba(246,241,228,0.6)" fontSize="11">● 白点 = 真实位置　● 金点 = 投影到"天球"上的位置</text>
      </svg>
      <Slider label="距离" value={k} min={0.4} max={2.4} step={0.01} onChange={setK} fmt={(v) => `× ${v.toFixed(1)}`} />
      <Btns items={[[false, '满天星星'], [true, '日食时的日月']]} value={eclipse} onChange={setEclipse} />
      <div className="wg-cap">拖动距离：白点远近在变，<b>金点一动不动</b>——天球只记方向。</div>
    </div>
  )
}

/* ── 天球自转：满天星绕北极星转（第 3 天） ── */
export function DiurnalWidget() {
  const [h, setH] = useState(0)
  const [lat, setLat] = useState(40)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => setH((x) => (x + dt * 1.6) % 24))
  const stars = useMemo(() => seeded(70, 5).map(([a, b, c]) => ({ p: 4 + a * 86, th: b * 360, m: c })), [])
  const W = 340, H = 250, hy = 215, k = 2.2
  const poleY = hy - lat * k, cx = W / 2
  const rot = -h * 15.04
  return (
    <div className="wg">
      <Note>面向正北 · 示意</Note>
      <svg className="wg-svg" viewBox={`0 0 ${W} ${H}`}>
        <defs><clipPath id="dn-clip"><rect x="0" y="0" width={W} height={hy} /></clipPath></defs>
        <g clipPath="url(#dn-clip)">
          <circle cx={cx} cy={poleY} r={lat * k} fill="rgba(194,160,90,0.07)" stroke="rgba(194,160,90,0.4)" strokeDasharray="3 4" />
          <g transform={`rotate(${rot} ${cx} ${poleY})`}>
            {stars.map((s, i) => {
              const x = cx + s.p * k * Math.cos(s.th * D2R), y = poleY + s.p * k * Math.sin(s.th * D2R)
              const circ = s.p < lat
              return <circle key={i} cx={x} cy={y} r={s.m > 0.85 ? 2.4 : 1.4} fill={circ ? '#e6cf95' : '#f6f1e4'} opacity={0.9} />
            })}
          </g>
          <circle cx={cx} cy={poleY} r={4} fill="#fff" />
          <text x={cx + 8} y={poleY - 6} fill="#f6f1e4" fontSize="11">北极星</text>
        </g>
        <rect x="0" y={hy} width={W} height={H - hy} fill="#0d1222" />
        <line x1="0" y1={hy} x2={W} y2={hy} stroke="rgba(246,241,228,0.6)" />
        <text x={cx} y={hy + 22} textAnchor="middle" fill="rgba(246,241,228,0.75)" fontSize="12">北</text>
        <text x={14} y={hy + 22} fill="rgba(246,241,228,0.5)" fontSize="11">西</text>
        <text x={W - 26} y={hy + 22} fill="rgba(246,241,228,0.5)" fontSize="11">东</text>
        <line x1={cx + 60} y1={hy} x2={cx + 60} y2={poleY} stroke="rgba(91,127,168,0.6)" strokeDasharray="2 3" />
        <text x={cx + 64} y={(hy + poleY) / 2} fill="#8fb0d6" fontSize="11">高 {lat}°</text>
      </svg>
      <Slider label="时间" value={h} min={0} max={24} step={0.05} onChange={(v) => { setPlaying(false); setH(v) }} fmt={(v) => `${Math.floor(v)} 小时`} />
      <Slider label="纬度" value={lat} min={0} max={90} onChange={setLat} fmt={(v) => `北纬 ${v}°`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-cap">金色虚线圈里的星<b>永不落下</b>（拱极星）；北极星高度 = 纬度。</div>
    </div>
  )
}

/* ── 公转投影出黄道（第 4–5 天） ── */
export function OrbitWidget({ close = false }: { close?: boolean }) {
  const [doy, setDoy] = useState(79)
  const [start] = useState(79)
  const [playing, setPlaying] = usePlaying()
  const [maxDoy, setMax] = useState(79)
  useLoop(playing, (dt) => setDoy((d) => { const n = d + dt * 40; setMax((m) => Math.max(m, n)); return n > start + 365.25 ? start + 365.25 : n }))
  if (playing && doy >= start + 365.25) setTimeout(() => setPlaying(false), 0)
  const cx = 170, cy = 170, Re = 72, Rz = 140
  const lon = lonFromDoy(doy % 365.25)
  const [ex, ey] = wheel(cx, cy, Re, lon + 180)
  const [zx, zy] = wheel(cx, cy, Rz - 16, lon)
  const [nx, ny] = wheel(cx, cy, Rz - 16, lon + 180)
  const swept = Math.min(360, ((maxDoy - start) * 360) / 365.25)
  const arc = (a0: number, a1: number, r: number) => {
    const pts: string[] = []
    for (let a = a0; a <= a1; a += 2) { const [x, y] = wheel(cx, cy, r, a); pts.push(`${x.toFixed(1)},${y.toFixed(1)}`) }
    return pts.join(' ')
  }
  const s = signOf(lon)
  return (
    <div className="wg">
      <Note>俯视 · 比例示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        <circle cx={cx} cy={cy} r={Rz} fill="none" stroke="rgba(246,241,228,0.15)" />
        <circle cx={cx} cy={cy} r={Rz - 32} fill="none" stroke="rgba(246,241,228,0.1)" />
        {SIGNS.map((sg) => {
          const [gx, gy] = wheel(cx, cy, Rz - 16, sg.i * 30 - 15)
          const [lx1, ly1] = wheel(cx, cy, Rz - 32, (sg.i - 1) * 30), [lx2, ly2] = wheel(cx, cy, Rz, (sg.i - 1) * 30)
          return <g key={sg.i}><line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="rgba(246,241,228,0.15)" />
            <GlyphAt i={sg.i} x={gx} y={gy} size={15} color={sg.i === s.sign.i ? '#c2a05a' : 'rgba(246,241,228,0.55)'} width={8} /></g>
        })}
        {swept > 1 && <polyline points={arc(lonFromDoy(start), lonFromDoy(start) + swept, Rz + 5)} fill="none" stroke="#c2a05a" strokeWidth={3} strokeLinecap="round" />}
        {close && swept >= 359 && <text x={cx} y={22} textAnchor="middle" fill="#c2a05a" fontSize="13" fontWeight="700">金色的圈 = 黄道</text>}
        <circle cx={cx} cy={cy} r={Re} fill="none" stroke="rgba(91,127,168,0.5)" strokeDasharray="3 4" />
        <line x1={ex} y1={ey} x2={zx} y2={zy} stroke="#c2a05a" strokeWidth={1.4} />
        <line x1={ex} y1={ey} x2={nx} y2={ny} stroke="rgba(143,176,214,0.6)" strokeDasharray="3 4" />
        <circle cx={cx} cy={cy} r={16} fill="#e8b85c" />
        <circle cx={cx} cy={cy} r={24} fill="rgba(232,184,92,0.18)" />
        <circle cx={ex} cy={ey} r={8} fill="#5b7fa8" stroke="#cfe0f2" strokeWidth={1.5} />
        <circle cx={zx} cy={zy} r={13} fill="none" stroke="#c2a05a" strokeWidth={1.5} />
      </svg>
      <div className="wg-read"><span>日期 <b>{doyLabel(doy % 365.25)}</b></span><span>太阳看起来在 <b>{s.sign.name}</b> 方向</span><span>黄经 <b>{Math.round(lon)}°</b></span></div>
      <Slider label="日期" value={doy} min={start} max={start + 365} step={0.5} onChange={(v) => { setPlaying(false); setDoy(v); setMax((m) => Math.max(m, v)) }} fmt={(v) => doyLabel(v % 365.25)} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /><button className="wg-btn" onClick={() => { setDoy(start); setMax(start); setPlaying(true) }}>重来</button></div>
      <div className="wg-cap">金线：从地球穿过太阳，指向的星座就是"太阳所在"。蓝虚线：<b>半夜正南方</b>，在太阳对面。</div>
    </div>
  )
}

/* ── 两个大圆相交：天赤道与黄道（第 5、9 天） ── */
export function TwoCirclesWidget({ seasons = false }: { seasons?: boolean }) {
  const [eps, setEps] = useState(23.4)
  const [spin, setSpin] = useState(30)
  const [sunT, setSunT] = useState(0)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => { setSpin((s) => (s + dt * 12) % 360); if (seasons) setSunT((t) => (t + dt * 30) % 360) })
  const R = 120, cx = 170, cy = 150, view = 20 * D2R
  const proj = (x: number, y: number, z: number) => {
    const c = Math.cos(spin * D2R), s = Math.sin(spin * D2R)
    const x1 = x * c + z * s, z1 = -x * s + z * c
    const y2 = y * Math.cos(view) - z1 * Math.sin(view), z2 = y * Math.sin(view) + z1 * Math.cos(view)
    return [cx + x1 * R, cy - y2 * R, z2] as const
  }
  const e = eps * D2R
  const ecl = (t: number) => proj(Math.cos(t), Math.sin(t) * Math.sin(e), Math.sin(t) * Math.cos(e))
  const equ = (t: number) => proj(Math.cos(t), 0, Math.sin(t))
  const segs = (f: (t: number) => readonly [number, number, number]) => {
    const front: string[] = [], back: string[] = []
    let cur: string[] = [], curFront: boolean | null = null
    for (let a = 0; a <= 360; a += 3) {
      const [x, y, z] = f(a * D2R)
      const isF = z >= 0
      if (curFront !== null && isF !== curFront) { (curFront ? front : back).push(cur.join(' ')); cur = [cur[cur.length - 1]] }
      cur.push(`${x.toFixed(1)},${y.toFixed(1)}`); curFront = isF
    }
    ;(curFront ? front : back).push(cur.join(' '))
    return { front, back }
  }
  const E = segs(ecl), Q = segs(equ)
  const pts = [
    { t: 0, name: '春分点' }, { t: 180, name: '秋分点' },
    ...(seasons ? [{ t: 90, name: '夏至点' }, { t: 270, name: '冬至点' }] : []),
  ]
  const [px, py] = proj(0, 1, 0)
  const sun = ecl(sunT * D2R)
  return (
    <div className="wg">
      <Note>透明天球</Note>
      <svg className="wg-svg" viewBox="0 0 340 300">
        <circle cx={cx} cy={cy} r={R} fill="rgba(91,127,168,0.06)" stroke="rgba(246,241,228,0.25)" />
        {Q.back.map((p, i) => <polyline key={`qb${i}`} points={p} fill="none" stroke="#5b7fa8" strokeWidth={1.5} strokeDasharray="3 4" opacity={0.6} />)}
        {E.back.map((p, i) => <polyline key={`eb${i}`} points={p} fill="none" stroke="#c2a05a" strokeWidth={1.5} strokeDasharray="3 4" opacity={0.6} />)}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="rgba(246,241,228,0.4)" strokeDasharray="2 3" />
        <text x={px + 6} y={py - 4} fill="rgba(246,241,228,0.7)" fontSize="11">天北极</text>
        <circle cx={cx} cy={cy} r={6} fill="#5b7fa8" stroke="#cfe0f2" />
        {Q.front.map((p, i) => <polyline key={`qf${i}`} points={p} fill="none" stroke="#7fa3cc" strokeWidth={2.4} />)}
        {E.front.map((p, i) => <polyline key={`ef${i}`} points={p} fill="none" stroke="#d8b46a" strokeWidth={2.6} />)}
        {pts.map((p) => {
          const [x, y, z] = ecl(p.t * D2R)
          const node = p.t % 180 === 0
          return (
            <g key={p.t} opacity={z >= 0 ? 1 : 0.45}>
              {node && <motion.circle cx={x} cy={y} r={10} fill="rgba(255,236,180,0.25)" animate={{ r: [8, 14, 8] }} transition={{ repeat: Infinity, duration: 2 }} />}
              <circle cx={x} cy={y} r={4.5} fill={node ? '#fff3cf' : '#d8b46a'} />
              <text x={x + 8} y={y - 8} fill="#f6f1e4" fontSize="12">{p.name}</text>
            </g>
          )
        })}
        {seasons && <circle cx={sun[0]} cy={sun[1]} r={7} fill="#e8b85c" opacity={sun[2] >= 0 ? 1 : 0.5} />}
        <text x="12" y="290" fill="#d8b46a" fontSize="12">━ 黄道（太阳的路）</text>
        <text x="150" y="290" fill="#7fa3cc" fontSize="12">━ 天赤道（地球赤道的延伸）</text>
      </svg>
      <Slider label="倾角" value={eps} min={0} max={45} step={0.1} onChange={setEps} fmt={(v) => `${v.toFixed(1)}°`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /><button className="wg-btn" onClick={() => setEps(23.4)}>真实值 23.4°</button></div>
      <div className="wg-cap">{eps < 0.5 ? '倾角为 0：两个圆重合，没有交点，也就没有季节。' : <>两圆都过球心 → 交点<b>一定正对着</b>。</>}</div>
    </div>
  )
}

/* ── 地轴倾角滑块：季节来自倾斜（第 8 天） ── */
export function TiltWidget() {
  const [tilt, setTilt] = useState(23.4)
  const [lat, setLat] = useState(40)
  const sumAlt = Math.min(90, 90 - lat + tilt), winAlt = Math.max(0, 90 - lat - tilt)
  const sumDay = dayLength(lat, tilt), winDay = dayLength(lat, -tilt)
  const gx = 170, gy = 190
  const ray = (alt: number, col: string, label: string) => {
    const r = 150, x = gx - r * Math.cos(alt * D2R), y = gy - r * Math.sin(alt * D2R)
    return (
      <g>
        <line x1={x} y1={y} x2={gx} y2={gy} stroke={col} strokeWidth={2} strokeDasharray="5 4" />
        <circle cx={x} cy={y} r={11} fill={col} />
        <text x={x + 14} y={y + 4} fill={col} fontSize="12">{label} {alt.toFixed(1)}°</text>
      </g>
    )
  }
  return (
    <div className="wg">
      <Note>正午太阳高度</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <path d={`M${gx - 150} ${gy} A150 150 0 0 1 ${gx + 150} ${gy}`} fill="none" stroke="rgba(246,241,228,0.12)" />
        {ray(sumAlt, '#e8b85c', '夏至')}
        {ray(winAlt, '#8fb0d6', '冬至')}
        <rect x="0" y={gy} width="340" height="40" fill="#0d1222" />
        <line x1="10" y1={gy} x2="330" y2={gy} stroke="rgba(246,241,228,0.5)" />
        <circle cx={gx} cy={gy - 3} r={3} fill="#f6f1e4" />
        <text x={gx + 6} y={gy + 18} fill="rgba(246,241,228,0.6)" fontSize="11">你站在北纬 {lat}°（朝南看）</text>
      </svg>
      <div className="wg-read">
        <span>夏至昼长 <b>{sumDay.toFixed(1)} 小时</b></span><span>冬至昼长 <b>{winDay.toFixed(1)} 小时</b></span>
      </div>
      <Slider label="倾角" value={tilt} min={0} max={60} step={0.1} onChange={setTilt} fmt={(v) => `${v.toFixed(1)}°`} />
      <Slider label="纬度" value={lat} min={0} max={66} onChange={setLat} fmt={(v) => `${v}°`} />
      <div className="wg-btns">{[0, 23.4, 60].map((v) => <button key={v} className={`wg-btn ${tilt === v ? 'on' : ''}`} onClick={() => setTilt(v)}>{v}°</button>)}</div>
      <div className="wg-cap">{tilt < 1 ? <>倾角 0°：冬夏一样高、一样长——<b>季节消失</b>。</> : tilt > 45 ? <>倾角很大：冬夏差别<b>极端</b>。</> : <>夏天太阳<b>更高</b>、白天<b>更长</b>，两者叠加 = 热。</>}</div>
    </div>
  )
}

/* ── 手电筒照地面：斜射能量被摊薄（第 8 天） ── */
export function FlashlightWidget() {
  const [alt, setAlt] = useState(73.4)
  const gx = 170, gy = 180, w = 46
  const len = w / Math.sin(alt * D2R)
  const dx = Math.cos(alt * D2R), dy = Math.sin(alt * D2R)
  const L = 150
  const p1 = [gx - len / 2, gy], p2 = [gx + len / 2, gy]
  const s1 = [p1[0] - dx * L, gy - dy * L], s2 = [p2[0] - dx * L, gy - dy * L]
  const intensity = Math.sin(alt * D2R)
  return (
    <div className="wg">
      <Note>同一束光</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        <polygon points={`${s1[0]},${s1[1]} ${s2[0]},${s2[1]} ${p2[0]},${p2[1]} ${p1[0]},${p1[1]}`} fill="rgba(232,184,92,0.22)" />
        <line x1={s1[0]} y1={s1[1]} x2={p1[0]} y2={p1[1]} stroke="#e8b85c" />
        <line x1={s2[0]} y1={s2[1]} x2={p2[0]} y2={p2[1]} stroke="#e8b85c" />
        <line x1={s1[0]} y1={s1[1]} x2={s2[0]} y2={s2[1]} stroke="#e8b85c" strokeWidth={6} strokeLinecap="round" />
        <text x={Math.min(s1[0], s2[0])} y={Math.min(s1[1], s2[1]) - 10} fill="#e8b85c" fontSize="11">阳光（宽度不变）</text>
        <rect x="0" y={gy} width="340" height="40" fill="#0d1222" />
        <rect x={p1[0]} y={gy - 3} width={len} height={6} rx={3} fill="#f5d27a" opacity={0.25 + 0.75 * intensity} />
        <text x="12" y="210" fill="rgba(246,241,228,0.65)" fontSize="11">光斑长 {len.toFixed(0)}（直照时 {w}）</text>
        <text x="200" y="210" fill="#e8b85c" fontSize="11">每块地分到 {(intensity * 100).toFixed(0)}%</text>
      </svg>
      <Slider label="太阳高度" value={alt} min={10} max={90} step={0.1} onChange={setAlt} fmt={(v) => `${v.toFixed(1)}°`} />
      <div className="wg-btns">
        <button className={`wg-btn ${alt === 73.4 ? 'on' : ''}`} onClick={() => setAlt(73.4)}>北京夏至 73.4°</button>
        <button className={`wg-btn ${alt === 26.6 ? 'on' : ''}`} onClick={() => setAlt(26.6)}>北京冬至 26.6°</button>
      </div>
      <div className="wg-cap">斜照时，同样的光摊在 <b>{(1 / intensity).toFixed(1)} 倍</b>的面积上。</div>
    </div>
  )
}

/* ── 秋千停顿：二至时太阳南北移动几乎停住（第 9 天） ── */
export function SwingWidget() {
  const [doy, setDoy] = useState(0)
  const [playing, setPlaying] = usePlaying()
  useLoop(playing, (dt) => setDoy((d) => (d + dt * 30) % 365))
  const lon = lonFromDoy(doy)
  const dec = sunDecl(lon)
  const speed = Math.abs(sunDecl(lonFromDoy(doy + 1)) - dec)
  const X0 = 30, X1 = 320, Y0 = 70, k = 1.6
  const x = (d: number) => X0 + ((X1 - X0) * d) / 365
  const yDec = (v: number) => Y0 - v * k
  const yDay = (hrs: number) => 210 - (hrs - 8) * 9
  const decPts = Array.from({ length: 74 }, (_, i) => `${x(i * 5).toFixed(1)},${yDec(sunDecl(lonFromDoy(i * 5))).toFixed(1)}`).join(' ')
  const dayPts = Array.from({ length: 74 }, (_, i) => `${x(i * 5).toFixed(1)},${yDay(dayLength(40, sunDecl(lonFromDoy(i * 5)))).toFixed(1)}`).join(' ')
  const marks = [[79, '春分'], [172, '夏至'], [266, '秋分'], [356, '冬至']] as const
  const sw = Math.max(-1, Math.min(1, dec / 23.44)) * 38
  return (
    <div className="wg">
      <Note>北纬 40°</Note>
      <svg className="wg-svg" viewBox="0 0 340 250">
        <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke="rgba(91,127,168,0.5)" strokeDasharray="3 4" />
        <text x={X0} y={Y0 - 44} fill="#d8b46a" fontSize="11">太阳赤纬（南北位置）</text>
        <text x={X1 - 34} y={Y0 + 14} fill="#7fa3cc" fontSize="10">天赤道</text>
        <polyline points={decPts} fill="none" stroke="#d8b46a" strokeWidth={2} />
        <text x={X0} y={128} fill="#8fb0d6" fontSize="11">昼长</text>
        <polyline points={dayPts} fill="none" stroke="#8fb0d6" strokeWidth={2} />
        {marks.map(([d, n]) => <g key={n}><line x1={x(d)} y1={22} x2={x(d)} y2={228} stroke="rgba(246,241,228,0.12)" /><text x={x(d)} y={244} textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="11">{n}</text></g>)}
        <line x1={x(doy)} y1={20} x2={x(doy)} y2={228} stroke="rgba(194,160,90,0.5)" />
        <circle cx={x(doy)} cy={yDec(dec)} r={6} fill="#e8b85c" />
        <circle cx={x(doy)} cy={yDay(dayLength(40, dec))} r={5} fill="#8fb0d6" />
        <g transform="translate(290 150)">
          <line x1="0" y1="-40" x2={sw} y2={0} stroke="rgba(246,241,228,0.5)" />
          <circle cx={sw} cy={0} r={7} fill="#e8b85c" />
        </g>
      </svg>
      <div className="wg-read"><span><b>{doyLabel(doy)}</b></span><span>赤纬 <b>{dec >= 0 ? '北' : '南'} {Math.abs(dec).toFixed(1)}°</b></span><span>昼长 <b>{dayLength(40, dec).toFixed(1)} 时</b></span><span>每天移动 <b>{speed.toFixed(2)}°</b></span></div>
      <Slider label="日期" value={doy} min={0} max={364} onChange={(v) => { setPlaying(false); setDoy(v) }} fmt={doyLabel} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-cap">{speed < 0.08 ? <>到头了，<b>停住</b>——这就是"至"。</> : speed > 0.35 ? <>经过"最低点"，<b>变化最快</b>——二分前后。</> : '太阳像荡秋千，在南北之间来回。'}</div>
    </div>
  )
}

/* ── 南北半球：同一个星座，不同的季节（第 12 天） ── */
export function HemiWidget() {
  const [south, setSouth] = useState(false)
  const N = ['春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬', '冬', '冬']
  const S = ['秋', '秋', '秋', '冬', '冬', '冬', '春', '春', '春', '夏', '夏', '夏']
  const col: Record<string, string> = { 春: '#8fbf9a', 夏: '#e8b85c', 秋: '#c4633f', 冬: '#8fb0d6' }
  const cx = 170, cy = 150, R = 118
  return (
    <div className="wg">
      <svg className="wg-svg" viewBox="0 0 340 300">
        {SIGNS.map((sg) => {
          const se = (south ? S : N)[sg.i - 1]
          const a0 = (sg.i - 1) * 30, a1 = sg.i * 30
          const [x0, y0] = wheel(cx, cy, R, a0), [x1, y1] = wheel(cx, cy, R, a1)
          const [i0x, i0y] = wheel(cx, cy, 64, a0), [i1x, i1y] = wheel(cx, cy, 64, a1)
          const [gx, gy] = wheel(cx, cy, R - 20, a0 + 15), [tx, ty] = wheel(cx, cy, 80, a0 + 15)
          return (
            <g key={sg.i}>
              <motion.path d={`M${i0x} ${i0y} L${x0} ${y0} A${R} ${R} 0 0 0 ${x1} ${y1} L${i1x} ${i1y} A64 64 0 0 1 ${i0x} ${i0y}`}
                animate={{ fill: col[se] }} transition={{ duration: 0.6, delay: sg.i * 0.03 }} opacity={0.35} stroke="rgba(246,241,228,0.2)" />
              <GlyphAt i={sg.i} x={gx} y={gy} size={16} color="#f6f1e4" width={8} />
              <text x={tx} y={ty + 4} textAnchor="middle" fill="#f6f1e4" fontSize="12">{se}</text>
            </g>
          )
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#c2a05a" fontSize="15" fontFamily="var(--serif)">{south ? '南半球' : '北半球'}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="11">当地季节</text>
      </svg>
      <Btns items={[[false, '北半球（北京）'], [true, '南半球（悉尼）']]} value={south} onChange={setSouth} />
      <div className="wg-cap">星座的位置<b>不变</b>，变的只是当地天气。白羊在悉尼是{south ? <b>初秋</b> : '……点一下南半球看看'}。</div>
    </div>
  )
}

export const fmtLonShort = (l: number) => { const s = signOf(l); return `${s.sign.name} ${fmtDeg(s.deg)}` }
