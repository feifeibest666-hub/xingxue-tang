import { useEffect, useState, type PointerEvent } from 'react'
import type { WidgetMap } from './common'
import { Btns, D2R, Note, PlayBtn, Slider, useLoop, usePlaying, wheel } from './common'
import { GlyphAt } from '../Glyph'
import { PlanetAt } from '../PlanetGlyph'
import { ELEMENT_COLOR, SIGNS, element, modality, polarity } from '../../data/zodiac'
import { BENEFIC, ORB, PLANET, type Planet } from '../../data/classical'
import { aspects, computeChart, type Chart } from '../../lib/natal'
import { dayLength, sunDecl } from '../../lib/astro'

const CX = 170
const CY = 170
const norm = (x: number) => ((x % 360) + 360) % 360
const ang = (a: number, b: number) => { const d = norm(a - b); return d > 180 ? 360 - d : d }
const signAt = (lon: number) => Math.floor(norm(lon) / 30) + 1
const signName = (i: number) => SIGNS[((i - 1) % 12 + 12) % 12].name
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1)

const MAJ = [
  { name: '合', deg: 0, n: 1 },
  { name: '六分', deg: 60, n: 6 },
  { name: '四分', deg: 90, n: 4 },
  { name: '三分', deg: 120, n: 3 },
  { name: '对分', deg: 180, n: 2 },
] as const

function nearest(d: number) {
  let best: (typeof MAJ)[number] = MAJ[0]
  let off = 999
  for (const a of MAJ) {
    const o = Math.abs(d - a.deg)
    if (o < off) { off = o; best = a }
  }
  return { name: best.name, deg: best.deg, n: best.n, off }
}

function ring(r = 124) {
  return (
    <>
      <circle cx={CX} cy={CY} r={r} fill="none" stroke="rgba(246,241,228,0.18)" />
      {SIGNS.map((s) => {
        const [x, y] = wheel(CX, CY, r, (s.i - 1) * 30)
        const [gx, gy] = wheel(CX, CY, r + 18, (s.i - 1) * 30 + 15)
        return (
          <g key={s.i}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(246,241,228,0.07)" />
            <GlyphAt i={s.i} x={gx} y={gy} size={14} color={ELEMENT_COLOR[element(s.i)]} width={8} />
          </g>
        )
      })}
    </>
  )
}

function dot(lon: number, r: number, color: string) {
  const [x, y] = wheel(CX, CY, r, lon)
  return <circle cx={x} cy={y} r={7} fill={color} stroke="#141824" strokeWidth={2} />
}

function poly(base: number, n: number, r: number) {
  if (n < 2) return ''
  const pts = Array.from({ length: n }, (_, k) => wheel(CX, CY, r, base + (k * 360) / n))
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z'
}

function arc(lon0: number, lon1: number, r: number) {
  const [x0, y0] = wheel(CX, CY, r, lon0)
  const [x1, y1] = wheel(CX, CY, r, lon1)
  const sweep = norm(lon1 - lon0)
  const large = sweep > 180 ? 1 : 0
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
}

function fromEvent(e: PointerEvent<SVGSVGElement>) {
  const svg = e.currentTarget
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return 0
  const p = pt.matrixTransform(ctm.inverse())
  let lon = Math.atan2(p.y - CY, CX - p.x) / D2R
  if (lon < 0) lon += 360
  return lon
}

const SEV: Planet[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']

function SnapWidget() {
  const [a, setA] = useState(10)
  const [b, setB] = useState(130)
  const [drag, setDrag] = useState(false)
  const d = ang(a, b)
  const near = nearest(d)
  const snapped = near.off <= 4
  const show = snapped ? near.deg : d
  const move = (e: PointerEvent<SVGSVGElement>) => { if (drag) setB(fromEvent(e)) }
  return (
    <div className="wg">
      <Note>{snapped ? '吸住' : '自由'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340"
        onPointerDown={(e) => { setDrag(true); (e.target as Element).setPointerCapture?.(e.pointerId); setB(fromEvent(e)) }}
        onPointerMove={move} onPointerUp={() => setDrag(false)}>
        {ring()}
        {snapped && near.n >= 2 && <path d={poly(a, near.n, 96)} fill="rgba(194,160,90,0.12)" stroke="#c2a05a" strokeWidth={2} />}
        {snapped && near.n === 1 && <circle cx={CX} cy={CY} r={18} fill="none" stroke="#c2a05a" />}
        <line {...linePts(a, b, 96)} stroke={snapped ? '#c2a05a' : 'rgba(246,241,228,0.45)'} strokeWidth={2} />
        {dot(a, 96, '#d9a441')}
        {dot(b, 96, '#8fb0d6')}
      </svg>
      <Slider label="甲" value={a} min={0} max={359} onChange={setA} fmt={(v) => `${v}°`} />
      <div className="wg-read"><span>最短角距 <b>{fmt1(show)}°</b></span>{snapped && <span>靠近 <b>{near.name}</b></span>}</div>
      <div className="wg-cap">金色是甲，蓝色是乙。离 0°、60°、90°、120°、180° 在 4° 以内就吸住，并画出对应的图形。</div>
    </div>
  )
}

function linePts(a: number, b: number, r: number) {
  const [x1, y1] = wheel(CX, CY, r, a)
  const [x2, y2] = wheel(CX, CY, r, b)
  return { x1, y1, x2, y2 }
}

function DivideWidget({ n0 = 6 }: { n0?: number }) {
  const [n, setN] = useState(n0)
  const step = 360 / n
  const hit = Math.abs(step % 30) < 0.05 || Math.abs((step % 30) - 30) < 0.05
  return (
    <div className="wg">
      <Note>{hit ? '落在边界' : '落在座内'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        <path d={poly(0, n, 100)} fill="rgba(194,160,90,0.08)" stroke="#c2a05a" strokeWidth={2} />
        {Array.from({ length: n }, (_, k) => dot((k * 360) / n, 100, hit ? '#c2a05a' : '#e88a72'))}
      </svg>
      <Slider label="等分" value={n} min={2} max={8} onChange={setN} fmt={(v) => `${v} 份`} />
      <div className="wg-read"><span>每一份 <b>{fmt1(step)}°</b></span><span>{hit ? '顶点在星座边界上' : '顶点不在边界上'}</span></div>
      <div className="wg-cap">{n === 5 ? '5 份是 72°。12 不能被 5 整除，五个点都躲开了星座边界。' : '2、3、4、6 份的顶点落在边界上。8 份的 45° 落在座的中间。'}</div>
    </div>
  )
}

const GAPS = [
  { name: '合', g: 0 }, { name: '六分', g: 2 }, { name: '四分', g: 3 }, { name: '三分', g: 4 }, { name: '对分', g: 6 },
]

function NatureWidget() {
  const [s, setS] = useState(1)
  const [gi, setGi] = useState(4)
  const g = GAPS[gi]
  const fore = ((s - 1 + g.g) % 12) + 1
  const back = ((s - 1 - g.g + 12) % 12) + 1
  const other = g.g === 0 ? s : fore
  const share = [
    element(s) === element(other) ? '元素相同' : '元素不同',
    polarity(s) === polarity(other) ? '极性相同' : '极性相反',
    modality(s) === modality(other) ? '模式相同' : '模式不同',
  ]
  return (
    <div className="wg">
      <Note>{g.name}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        {SIGNS.map((sg) => {
          const on = sg.i === s || (g.g > 0 && (sg.i === fore || sg.i === back))
          if (!on) return null
          const [x, y] = wheel(CX, CY, 100, (sg.i - 1) * 30 + 15)
          return <circle key={sg.i} cx={x} cy={y} r={16} fill={sg.i === s ? 'rgba(194,160,90,0.35)' : 'rgba(91,127,168,0.35)'} stroke="#f6f1e4" />
        })}
      </svg>
      <Slider label="起点" value={s} min={1} max={12} onChange={setS} fmt={(v) => signName(v)} />
      <Btns items={GAPS.map((x, i) => [i, x.name] as [number, string])} value={gi} onChange={setGi} />
      <div className="wg-cap">{signName(s)} 的{g.name}：{g.g === 0 ? '就在这座，三把尺子全相同。' : `${signName(fore)} 与 ${signName(back)}。${share.join('，')}。`}</div>
    </div>
  )
}

function FuseWidget() {
  const [a, setA] = useState<Planet>('venus')
  const [b, setB] = useState<Planet>('jupiter')
  const [s, setS] = useState(2)
  const ka = BENEFIC[a]
  const kb = BENEFIC[b]
  const both = (x: string) => ka === x && kb === x
  const line = both('吉') ? '两颗吉星挤在一起，传统句子偏顺。'
    : both('凶') ? '两颗凶星挤在一起，传统句子偏难。'
    : (ka === '发光体' || kb === '发光体') ? '有发光体。传统会另眼看，不套用普通的加强。'
    : '一吉一凶（或有水星）：两套功能绑在同一处，要分别点名。'
  return (
    <div className="wg">
      <Note>同一座</Note>
      <div className="wg-read"><span>{signName(s)}</span><span>角距 <b>0°</b></span></div>
      <Btns items={SEV.map((p) => [p, PLANET[p].short] as [Planet, string])} value={a} onChange={setA} />
      <Btns items={SEV.map((p) => [p, PLANET[p].short] as [Planet, string])} value={b} onChange={setB} />
      <Slider label="星座" value={s} min={1} max={12} onChange={setS} fmt={(v) => signName(v)} />
      <svg className="wg-svg" viewBox="0 0 340 120">
        <circle cx={120} cy={60} r={28} fill="rgba(194,160,90,0.15)" stroke="#c2a05a" />
        <circle cx={220} cy={60} r={28} fill="rgba(194,160,90,0.15)" stroke="#c2a05a" />
        <PlanetAt p={a} x={120} y={60} size={36} color={PLANET[a].color} />
        <PlanetAt p={b} x={220} y={60} size={36} color={PLANET[b].color} />
      </svg>
      <div className="wg-cap">{PLANET[a].name}与{PLANET[b].name}同处{signName(s)}。{line}角度没有变。</div>
    </div>
  )
}

const PAIRS: [number, number, string][] = [
  [10, 130, '120°，精确三分'],
  [350, 20, '30°，跨过 0°。不是五个相位'],
  [5, 185, '180°，精确对分'],
  [80, 170, '90°，精确四分'],
  [15, 75, '60°，精确六分'],
  [200, 200, '0°，精确合相'],
  [355, 5, '10°，跨过 0°。先只报角距'],
  [100, 250, '150°，不是五个相位'],
  [40, 155, '115°，离 120° 还差 5°'],
  [0, 72, '72°，五等分，不是六分'],
]

function GapWidget() {
  const [i, setI] = useState(0)
  const [x, y, note] = PAIRS[i]
  const raw = norm(y - x)
  const short = raw > 180 ? 360 - raw : raw
  return (
    <div className="wg">
      <Note>第 {i + 1} / 10 组</Note>
      <div className="wg-read"><span>{x}° 与 {y}°</span><span>顺向差 <b>{raw}°</b></span><span>最短 <b>{short}°</b></span></div>
      <svg className="wg-svg" viewBox="0 0 340 220">
        {ring(78)}
        {dot(x, 78, '#d9a441')}
        {dot(y, 78, '#8fb0d6')}
      </svg>
      <div className="wg-btns">
        <button className="wg-btn" onClick={() => setI((n) => (n + 9) % 10)}>上一组</button>
        <button className="wg-btn" onClick={() => setI((n) => (n + 1) % 10)}>下一组</button>
      </div>
      <div className="wg-cap">{note}。大于 180° 的那段丢掉。</div>
    </div>
  )
}

const SEE: Record<number, string> = { 0: '同宫', 2: '六分', 3: '四分', 4: '三分', 6: '对分' }

function AversionWidget({ mode = 'sign' }: { mode?: string }) {
  const [s, setS] = useState(1)
  const [degMode, setDegMode] = useState(mode === 'degree')
  const [a, setA] = useState(29)
  const [b, setB] = useState(122)
  const gap = (i: number) => { const d = Math.abs(s - i) % 12; return Math.min(d, 12 - d) }
  const sa = signAt(a)
  const sb = signAt(b)
  const sg = Math.min(Math.abs(sa - sb), 12 - Math.abs(sa - sb))
  const d = ang(a, b)
  const near = nearest(d)
  return (
    <div className="wg">
      <Note>{degMode ? '度数' : '整座'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {SIGNS.map((sg0) => {
          const g = gap(sg0.i)
          const bad = g === 1 || g === 5
          const [x0, y0] = wheel(CX, CY, 148, (sg0.i - 1) * 30)
          const [x1, y1] = wheel(CX, CY, 148, sg0.i * 30)
          const [ix, iy] = wheel(CX, CY, 78, (sg0.i - 1) * 30 + 15)
          return (
            <g key={sg0.i} onClick={() => setS(sg0.i)}>
              <path d={`M${wheel(CX, CY, 78, (sg0.i - 1) * 30).join(' ')} L${x0} ${y0} A148 148 0 0 1 ${x1} ${y1} L${wheel(CX, CY, 78, sg0.i * 30).join(' ')} A78 78 0 0 0 ${wheel(CX, CY, 78, (sg0.i - 1) * 30).join(' ')}`}
                fill={sg0.i === s ? 'rgba(194,160,90,0.35)' : bad ? 'rgba(232,138,114,0.28)' : 'rgba(143,191,154,0.18)'} stroke="rgba(246,241,228,0.2)" />
              <GlyphAt i={sg0.i} x={ix} y={iy} size={16} color="#f6f1e4" />
            </g>
          )
        })}
        {degMode && <>
          {dot(a, 110, '#d9a441')}
          {dot(b, 110, '#8fb0d6')}
        </>}
      </svg>
      <div className="wg-btns">
        <button className={`wg-btn ${degMode ? '' : 'on'}`} onClick={() => setDegMode(false)}>整座</button>
        <button className={`wg-btn ${degMode ? 'on' : ''}`} onClick={() => setDegMode(true)}>度数</button>
      </div>
      {degMode ? <>
        <Slider label="甲" value={a} min={0} max={359} onChange={setA} fmt={(v) => `${v}°`} />
        <Slider label="乙" value={b} min={0} max={359} onChange={setB} fmt={(v) => `${v}°`} />
        <div className="wg-cap">整宫：{SEE[sg] ?? '不合意'}（隔 {sg} 座）。度数：{fmt1(d)}°，离{near.name}还差 {fmt1(near.off)}°。</div>
      </> : <div className="wg-cap">{signName(s)}：绿色看得见，赭色是不合意。点别的座，第 2、6、8、12 会跟着转。</div>}
    </div>
  )
}

const ASPECT_ORB: Record<string, number> = { 合: 8, 六分: 5, 四分: 7, 三分: 7, 对分: 8 }

function OrbWidget({ system = 'moiety' }: { system?: string }) {
  const [sys, setSys] = useState(system === 'aspect' ? 'aspect' : 'moiety')
  const [a, setA] = useState<Planet>('sun')
  const [b, setB] = useState<Planet>('saturn')
  const [lon, setLon] = useState(10)
  const allow = (name: string) => sys === 'moiety'
    ? (ORB[a] + ORB[b]) / 2
    : ASPECT_ORB[name] + ((a === 'sun' || a === 'moon' || b === 'sun' || b === 'moon') ? 2 : 0)
  const d = ang(0, lon)
  const near = nearest(d)
  const ok = near.off <= allow(near.name) + 1e-6
  return (
    <div className="wg">
      <Note>{sys === 'moiety' ? '光体' : '按相位'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        {MAJ.filter((m) => m.deg > 0).flatMap((m) => [m.deg, 360 - m.deg]).concat([0]).map((deg) => {
          const name = nearest(Math.min(deg, 360 - deg)).name
          const w = allow(deg === 0 ? '合' : name)
          return <path key={`${deg}-${w}`} d={arc(norm(deg - w), norm(deg + w), 104)} stroke="rgba(194,160,90,0.55)" strokeWidth={10} fill="none" />
        })}
        {dot(0, 104, PLANET[a].color)}
        {dot(lon, 104, PLANET[b].color)}
      </svg>
      <Btns items={[['moiety', '光体'], ['aspect', '按相位']] as [string, string][]} value={sys} onChange={setSys} />
      <Btns items={SEV.map((p) => [p, PLANET[p].short] as [Planet, string])} value={a} onChange={setA} />
      <Btns items={SEV.map((p) => [p, PLANET[p].short] as [Planet, string])} value={b} onChange={setB} />
      <Slider label="乙的黄经" value={lon} min={0} max={359} onChange={setLon} fmt={(v) => `${v}°`} />
      <div className="wg-cap">甲固定在 0°。当前角距 {fmt1(d)}°，离{near.name}差 {fmt1(near.off)}°。这套规则{ok ? '算有相位' : '不算'}（容许 {fmt1(allow(near.name))}°）。</div>
    </div>
  )
}

function closing(a: number, sa: number, b: number, sb: number) {
  const now = nearest(ang(a, b))
  const later = nearest(ang(norm(a + sa * 0.05), norm(b + sb * 0.05)))
  const rate = (now.off - later.off) / 0.05
  return { ...now, rate, applying: rate > 0.02 }
}

function ChaseWidget({ preset = 'direct' }: { preset?: string }) {
  const [which, setWhich] = useState(preset === 'retro' ? 'retro' : 'direct')
  const [playing, setPlaying] = usePlaying(false)
  const [t, setT] = useState(0)
  useLoop(playing, (dt) => setT((x) => x + dt * 0.12))
  const scene = which === 'retro'
    ? { a: '火星', b: '木星', lonA: norm(140 - 0.4 * t), lonB: norm(18 + 0.1 * t), sa: -0.4, sb: 0.1 }
    : which === 'sep'
      ? { a: '月亮', b: '火星', lonA: norm(16 + 13 * t), lonB: norm(10 + 0.5 * t), sa: 13, sb: 0.5 }
      : { a: '月亮', b: '土星', lonA: norm(8 + 13.2 * t), lonB: norm(100 + 0.03 * t), sa: 13.2, sb: 0.03 }
  const c = closing(scene.lonA, scene.sa, scene.lonB, scene.sb)
  const eta = c.applying && c.rate > 0 ? c.off / c.rate : null
  return (
    <div className="wg">
      <Note>{c.applying ? '入相' : '出相'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 300">
        {ring(100)}
        {dot(scene.lonA, 100, '#d9a441')}
        {dot(scene.lonB, 100, '#8fb0d6')}
      </svg>
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <button className="wg-btn" onClick={() => setT(0)}>回到起点</button>
      </div>
      <Btns items={[['direct', '月亮追四分'], ['sep', '合相已过'], ['retro', '火星逆行']] as [string, string][]} value={which} onChange={(v) => { setWhich(v); setT(0) }} />
      <div className="wg-read">
        <span>{scene.a} {fmt1(scene.lonA)}°</span>
        <span>{scene.b} {fmt1(scene.lonB)}°</span>
        <span>离{c.name} <b>{fmt1(c.off)}°</b></span>
      </div>
      <div className="wg-cap">{c.applying ? `角距在缩小。按现在的速度，约 ${eta === null ? '—' : fmt1(eta)} 天完成。速度一变就要重算。` : '角距在变大。这一个精确相位不会按当前速度再完成。'}</div>
    </div>
  )
}

function HandWidget({ mode = 'both' }: { mode?: string }) {
  const [s, setS] = useState(1)
  const [only, setOnly] = useState(mode === 'overcome')
  const base = (s - 1) * 30 + 15
  const rays = [
    { g: 2, dex: false }, { g: 3, dex: false }, { g: 4, dex: false },
    { g: 2, dex: true }, { g: 3, dex: true }, { g: 4, dex: true },
  ]
  return (
    <div className="wg">
      <Note>{only ? '压制' : '左右'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        {rays.filter((r) => !only || (r.dex && r.g === 3)).map((r) => {
          const lon = base + (r.dex ? -r.g : r.g) * 30
          const color = r.dex ? '#c2a05a' : '#8fb0d6'
          return <line key={`${r.g}-${r.dex}`} {...linePts(base, lon, 108)} stroke={color} strokeWidth={only ? 3 : 1.6} />
        })}
        {!only && <line {...linePts(base, base + 180, 108)} stroke="#f6f1e4" strokeWidth={1.4} />}
        {dot(base, 108, '#f6f1e4')}
      </svg>
      <Slider label="从这座看" value={s} min={1} max={12} onChange={setS} fmt={(v) => signName(v)} />
      <div className="wg-btns">
        <button className={`wg-btn ${only ? '' : 'on'}`} onClick={() => setOnly(false)}>左右都看</button>
        <button className={`wg-btn ${only ? 'on' : ''}`} onClick={() => setOnly(true)}>只留压制</button>
      </div>
      <div className="wg-cap">{only
        ? `${signName(((s - 1 - 3 + 12) % 12) + 1)} 是${signName(s)}的第 10 座，右旋四分，传统叫压制。`
        : '金色逆着黄道，是右旋。蓝色顺着黄道，是左旋。白线是对分，不再分左右。'}</div>
    </div>
  )
}

function onShortArc(a: number, b: number, p: number) {
  const ab = ang(a, b)
  const ap = ang(a, p)
  const pb = ang(p, b)
  return ap > 0.4 && pb > 0.4 && Math.abs(ap + pb - ab) < 0.8
}

function SiegeWidget({ preset = 'free' }: { preset?: string }) {
  const lesson = preset === 'lesson'
  const [sat, setSat] = useState(lesson ? 280 : 280)
  const [mars, setMars] = useState(lesson ? 340 : 340)
  const [moon, setMoon] = useState(lesson ? 310 : 310)
  const short = ang(sat, mars)
  const onShort = onShortArc(sat, mars, moon)
  const start = norm(mars - sat) <= 180 ? sat : mars
  return (
    <div className="wg">
      <Note>{onShort ? '短弧上' : '在长弧上'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        <path d={arc(start, norm(start + short), 104)} stroke="rgba(232,138,114,0.7)" strokeWidth={8} fill="none" />
        {dot(sat, 104, PLANET.saturn.color)}
        {dot(mars, 104, PLANET.mars.color)}
        {dot(moon, 104, PLANET.moon.color)}
      </svg>
      <Slider label="土星" value={sat} min={0} max={359} onChange={setSat} fmt={(v) => `${v}°`} />
      <Slider label="火星" value={mars} min={0} max={359} onChange={setMars} fmt={(v) => `${v}°`} />
      <Slider label="月亮" value={moon} min={0} max={359} onChange={setMoon} fmt={(v) => `${v}°`} />
      <div className="wg-cap">{onShort
        ? `月亮在两颗凶星的短弧上（约 ${fmt1(short)}°），这段里没有别人。这是星体围攻的形状。`
        : '月亮在长弧那一侧。长弧上通常还有别的行星，不把单独一个人叫作被夹住。'}</div>
    </div>
  )
}

function RaysWidget() {
  const [a, setA] = useState(10)
  const [b, setB] = useState(100)
  const targets = [0, 60, -60, 90, -90, 120, -120, 180].map((d) => norm(a + d))
  const hit = targets.find((t) => ang(b, t) <= 3)
  const same = signAt(a) !== signAt(b) && targets.some((t) => signAt(t) === signAt(b))
  return (
    <div className="wg">
      <Note>{hit != null ? '击中' : same ? '只在整座' : '未中'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        {targets.map((t) => <line key={t} {...linePts(a, t, 108)} stroke="rgba(194,160,90,0.45)" strokeWidth={1.4} />)}
        {dot(a, 108, '#f6f1e4')}
        {dot(b, 108, '#8fb0d6')}
      </svg>
      <Slider label="射出的星" value={a} min={0} max={359} onChange={setA} fmt={(v) => `${v}°`} />
      <Slider label="另一颗" value={b} min={0} max={359} onChange={setB} fmt={(v) => `${v}°`} />
      <div className="wg-cap">{hit != null ? `另一颗离某条光线 ${fmt1(ang(b, hit))}° 以内，度数规则算击中。` : same ? '它和某条光线在同一座，但离精确度数超过 3°。整座算射到这座，度数不算击中。' : '七条光线：左右六分、四分、三分，加一条对分。合相不在其中。'}</div>
    </div>
  )
}

const TONES: [string, string, string][] = [
  ['木星三分', '吉化', '吉星的三分在窄清单里。'],
  ['金星六分', '吉化', '吉星的六分在窄清单里。'],
  ['与木星合', '吉化', '与吉星身体相合。'],
  ['金星四分', '两边都不是', '吉星的四分不自动改名叫扶助。'],
  ['火星对分', '凶化', '凶星的对分。'],
  ['与土星合', '凶化', '与凶星身体相合。'],
  ['土星在第 10 座', '凶化', '被凶星压制。'],
  ['夹在火土之间', '凶化', '星体围攻。'],
  ['只是落在摩羯', '本课不收', '那是尊贵。窄清单不并进来。'],
]

function ToneWidget() {
  const [i, setI] = useState(0)
  const [name, kind, why] = TONES[i]
  return (
    <div className="wg">
      <Note>{kind}</Note>
      <Btns items={TONES.map((t, k) => [k, t[0]] as [number, string])} value={i} onChange={setI} />
      <div className="wg-cap">{name}：按本课窄清单是「{kind}」。{why}</div>
    </div>
  )
}

const SKY: { p: Planet; lon: number }[] = [
  { p: 'saturn', lon: 42 }, { p: 'jupiter', lon: 102 }, { p: 'mars', lon: 170 },
  { p: 'venus', lon: 220 }, { p: 'sun', lon: 288 }, { p: 'mercury', lon: 305 },
]

function aspectPoints(target: number) {
  const out: { lon: number; name: string }[] = []
  for (const m of MAJ) {
    if (m.deg === 0) out.push({ lon: target, name: m.name })
    else if (m.deg === 180) out.push({ lon: norm(target + 180), name: m.name })
    else {
      out.push({ lon: norm(target + m.deg), name: m.name })
      out.push({ lon: norm(target - m.deg), name: m.name })
    }
  }
  return out
}

function MoonWidget({ mode = 'run' }: { mode?: string }) {
  const [moon, setMoon] = useState(mode === 'void' ? 27 : 10)
  let next: { dist: number; name: string; who: string; at: number } | null = null
  let prev: { dist: number; name: string; who: string } | null = null
  for (const s of SKY) {
    for (const pt of aspectPoints(s.lon)) {
      const fore = norm(pt.lon - moon)
      const back = norm(moon - pt.lon)
      if (fore > 0.2 && fore < 50 && (!next || fore < next.dist)) next = { dist: fore, name: pt.name, who: PLANET[s.p].name, at: pt.lon }
      if (back > 0.2 && back < 50 && (!prev || back < prev.dist)) prev = { dist: back, name: pt.name, who: PLANET[s.p].name }
    }
  }
  const rem = 30 - (norm(moon) % 30)
  const vacant = !next || next.dist > rem + 0.05
  return (
    <div className="wg">
      <Note>{vacant ? '空亡' : '还有下一站'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        {SKY.map((s) => dot(s.lon, 104, PLANET[s.p].color))}
        {dot(moon, 104, '#f6f1e4')}
      </svg>
      <Slider label="月亮" value={moon} min={0} max={359} onChange={setMoon} fmt={(v) => `${signName(signAt(v))} ${fmt1(v % 30)}°`} />
      <div className="wg-cap">
        {prev ? `刚离开${prev.who}的${prev.name}（约 ${fmt1(prev.dist)}° 之前）。` : '近处没有刚完成的相位。'}
        {vacant ? ` 走出${signName(signAt(moon))}之前不再完成主要相位。` : next ? ` 下一站是${next.who}的${next.name}，还要 ${fmt1(next.dist)}°，本座还剩 ${fmt1(rem)}°。` : ''}
      </div>
    </div>
  )
}

function BridgeWidget({ mode = 'transfer' }: { mode?: string }) {
  const [which, setWhich] = useState(mode === 'collect' ? 'collect' : 'transfer')
  const [playing, setPlaying] = usePlaying(false)
  const [t, setT] = useState(0)
  useLoop(playing, (dt) => setT((x) => Math.min(1, x + dt * 0.25)))
  const transfer = which === 'transfer'
  const moon = 16 + t * 6
  const venus = 40 + t * 5
  const merc = 155 + t * 10
  return (
    <div className="wg">
      <Note>{transfer ? '传递' : '集中'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 300">
        {ring(100)}
        {transfer ? <>
          {dot(10, 100, PLANET.saturn.color)}
          {dot(80, 100, PLANET.jupiter.color)}
          {dot(moon, 100, PLANET.moon.color)}
        </> : <>
          {dot(105, 100, PLANET.saturn.color)}
          {dot(venus, 100, PLANET.venus.color)}
          {dot(merc, 100, PLANET.mercury.color)}
        </>}
      </svg>
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <button className="wg-btn" onClick={() => setT(0)}>回到起点</button>
      </div>
      <Btns items={[['transfer', '传递'], ['collect', '集中']] as [string, string][]} value={which} onChange={(v) => { setWhich(v); setT(0) }} />
      <div className="wg-cap">{transfer
        ? '月亮已离开土星白羊 10° 的合，正向白羊 20° 走，去完成与木星双子 20° 的六分。土星和木星自己差 70°。'
        : '金星从金牛 10° 走向 15°，水星从处女 5° 走向 15°，两边都入相土星巨蟹 15° 的六分。土星最慢。'}</div>
    </div>
  )
}

function MirrorWidget({ axis = 'solstice' }: { axis?: string }) {
  const [ax, setAx] = useState(axis === 'equinox' ? 'equinox' : 'solstice')
  const [lon, setLon] = useState(10)
  const [lat, setLat] = useState(40)
  const mirror = ax === 'solstice' ? norm(180 - lon) : norm(-lon)
  const d1 = sunDecl(lon)
  const d2 = sunDecl(mirror)
  const day1 = dayLength(lat, d1)
  const day2 = dayLength(lat, d2)
  return (
    <div className="wg">
      <Note>{ax === 'solstice' ? '二至轴' : '二分轴'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        <line {...linePts(ax === 'solstice' ? 90 : 0, ax === 'solstice' ? 270 : 180, 124)} stroke="#c2a05a" strokeWidth={1.5} />
        {dot(lon, 104, '#d9a441')}
        {dot(mirror, 104, '#8fb0d6')}
      </svg>
      <Btns items={[['solstice', '映点'], ['equinox', '反映点']] as [string, string][]} value={ax} onChange={setAx} />
      <Slider label="黄经" value={lon} min={0} max={359} onChange={setLon} fmt={(v) => `${v}°`} />
      <Slider label="纬度" value={lat} min={0} max={60} onChange={setLat} fmt={(v) => `${v}°`} />
      <div className="wg-read">
        <span>原赤纬 <b>{fmt1(d1)}°</b></span>
        <span>镜像 <b>{fmt1(d2)}°</b></span>
        <span>昼长 <b>{fmt1(day1)} h</b> / <b>{fmt1(day2)} h</b></span>
      </div>
      <div className="wg-cap">{ax === 'solstice'
        ? `映点在 ${fmt1(mirror)}°（${signName(signAt(mirror))}）。赤纬同号，这条纬度上的昼长应相同。`
        : `反映点在 ${fmt1(mirror)}°。赤纬反号，两边昼长相加应接近 24 小时。`}</div>
    </div>
  )
}

const MINORS: [number, string][] = [
  [30, '30°。古典叫不合意，不是半个六分的古名。'],
  [45, '45° 是 8 等分。1.5 座，对不上整座。'],
  [72, '72° 是 5 等分。2.4 座。开普勒 1619 年才写入相位。'],
  [135, '135° = 90° + 45°。同样对不上整座。'],
  [144, '144° = 72° × 2。和 72° 是同一家。'],
  [150, '150°。古典也是不合意。本课不借用"梅花"这个译名。'],
]

function MinorWidget() {
  const [i, setI] = useState(2)
  const [deg, text] = MINORS[i]
  return (
    <div className="wg">
      <Note>{deg}°</Note>
      <svg className="wg-svg" viewBox="0 0 340 300">
        {ring(100)}
        <line {...linePts(0, deg, 100)} stroke="#e88a72" strokeWidth={2} />
        {dot(0, 100, '#d9a441')}
        {dot(deg, 100, '#e88a72')}
      </svg>
      <Btns items={MINORS.map((m, k) => [k, `${m[0]}°`] as [number, string])} value={i} onChange={setI} />
      <div className="wg-cap">{text}</div>
    </div>
  )
}

const PATTERNS: [string, number[], string][] = [
  ['大三角', [0, 120, 240], '三条边都是 120°。精确时元素相同。'],
  ['T 三角', [0, 180, 90], '对分加两个四分。外号里的"顶点"是现代说法。'],
  ['大十字', [0, 90, 180, 270], '四个四分、两组对分。精确时模式相同。'],
  ['风筝', [0, 120, 240, 180], '大三角再加一个对分。新点与另外两点成六分。'],
  ['Y 形', [0, 60, 210], '底边 60°，两侧 150°。150° 是古典的不合意。外号是现代的。'],
]

function PatternWidget() {
  const [i, setI] = useState(0)
  const [name, pts, text] = PATTERNS[i]
  return (
    <div className="wg">
      <Note>{name}</Note>
      <svg className="wg-svg" viewBox="0 0 340 300">
        {ring(100)}
        {pts.map((p, k) => pts.slice(k + 1).map((q) => {
          const d = ang(p, q)
          const minor = Math.abs(d - 150) < 1
          return <line key={`${p}-${q}`} {...linePts(p, q, 100)} stroke={minor ? '#e88a72' : '#c2a05a'} strokeWidth={1.8} />
        }))}
        {pts.map((p) => <g key={p}>{dot(p, 100, '#f6f1e4')}</g>)}
      </svg>
      <Btns items={PATTERNS.map((p, k) => [k, p[0]] as [number, string])} value={i} onChange={setI} />
      <div className="wg-cap">{text} 赭色线是 150°。</div>
    </div>
  )
}

function HarmonicWidget() {
  const [n, setN] = useState(5)
  const [playing, setPlaying] = usePlaying(true)
  const [spin, setSpin] = useState(0)
  useLoop(playing, (dt) => setSpin((s) => norm(s + dt * 8)))
  const step = 360 / n
  const hit = n > 1 && (Math.abs(step % 30) < 0.05)
  const star = Array.from({ length: n + 1 }, (_, i) => {
    const [x, y] = wheel(CX, CY, 100, spin + ((i * 2) % n) * step)
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return (
    <div className="wg">
      <Note>{n} 等分</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        {n >= 2 && <path d={poly(spin, n, 100)} fill="none" stroke="rgba(194,160,90,0.85)" strokeWidth={1.6} />}
        {n >= 5 && <path d={star} fill="none" stroke="rgba(143,176,214,0.8)" strokeWidth={1.2} />}
      </svg>
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <Slider label="n" value={n} min={1} max={12} onChange={setN} />
      <div className="wg-cap">{n <= 1 ? '1 份就是整圆重合，对应合相的 0°。' : `360 ÷ ${n} = ${fmt1(step)}°。${hit ? '顶点落在星座边界上。' : '顶点对不上星座边界。花形仍然可以画，那是后来的读法。'}`}</div>
    </div>
  )
}

const DIGN: [string, string][] = [
  ['无本质尊贵', '手里没有本质尊贵'],
  ['入庙', '在自己的守护座'],
  ['入旺', '在入旺的座'],
  ['落陷', '在落陷的座'],
  ['入弱', '在入弱的座'],
]

function SentenceWidget() {
  const [a, setA] = useState<Planet>('mercury')
  const [b, setB] = useState<Planet>('saturn')
  const [asp, setAsp] = useState('合')
  const [da, setDa] = useState(0)
  const [db, setDb] = useState(4)
  return (
    <div className="wg">
      <Note>四格</Note>
      <Btns items={SEV.map((p) => [p, PLANET[p].short] as [Planet, string])} value={a} onChange={setA} />
      <Btns items={MAJ.map((m) => [m.name, m.name] as [string, string])} value={asp} onChange={setAsp} />
      <Btns items={SEV.map((p) => [p, PLANET[p].short] as [Planet, string])} value={b} onChange={setB} />
      <Slider label={`${PLANET[a].short}的尊贵`} value={da} min={0} max={4} onChange={setDa} fmt={(v) => DIGN[v][0]} />
      <Slider label={`${PLANET[b].short}的尊贵`} value={db} min={0} max={4} onChange={setDb} fmt={(v) => DIGN[v][0]} />
      <div className="wg-cap">{PLANET[a].name}{DIGN[da][1]}，以{asp}接触{PLANET[b].name}。{PLANET[b].name}{DIGN[db][1]}。传统只把这句当成功能的关系。这不是科学结论。</div>
    </div>
  )
}

function EinsteinWidget() {
  const [chart, setChart] = useState<Chart | null>(null)
  const [wide, setWide] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    computeChart({ date: '1879-03-14', time: '11:30', tz: 10 / 15, lat: 48.4, lon: 10 }).then(
      (c) => { if (live) setChart(c) },
      () => { if (live) setErr('算不出这张盘') },
    )
    return () => { live = false }
  }, [])
  if (err) return <div className="wg"><div className="wg-cap">{err}</div></div>
  if (!chart) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const engine = aspects(chart.pos, SEV)
  const engKey = new Set(engine.map((x) => [x.a, x.b].sort().join('-')))
  const lines: { a: Planet; b: Planet; name: string; off: number; extra: boolean }[] = []
  if (wide) {
    for (let i = 0; i < SEV.length; i++) for (let j = i + 1; j < SEV.length; j++) {
      const a = SEV[i], b = SEV[j]
      const near = nearest(ang(chart.pos[a].lon, chart.pos[b].lon))
      const allow = (ORB[a] + ORB[b]) / 2
      if (near.off <= allow + 1e-6) lines.push({ a, b, name: near.name, off: near.off, extra: !engKey.has([a, b].sort().join('-')) })
    }
    lines.sort((p, q) => p.off - q.off)
  } else {
    for (const x of engine) lines.push({ a: x.a as Planet, b: x.b as Planet, name: x.name, off: x.orb, extra: false })
  }
  return (
    <div className="wg">
      <Note>{wide ? '光体' : '引擎'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {ring()}
        {lines.map((ln) => <line key={`${ln.a}-${ln.b}`} {...linePts(chart.pos[ln.a].lon, chart.pos[ln.b].lon, 104)} stroke="rgba(194,160,90,0.7)" strokeWidth={ln.off < 3 ? 2.4 : 1.2} />)}
        {SEV.map((p) => {
          const [x, y] = wheel(CX, CY, 104, chart.pos[p].lon)
          return <PlanetAt key={p} p={p} x={x} y={y} size={18} color={PLANET[p].color} />
        })}
      </svg>
      <Btns items={[['eng', '引擎'], ['wide', '光体也算']] as [string, string][]} value={wide ? 'wide' : 'eng'} onChange={(v) => setWide(v === 'wide')} />
      <div className="wg-read">{lines.map((ln) => <span key={`${ln.a}${ln.b}`}>{PLANET[ln.a].short}{ln.name}{PLANET[ln.b].short} {fmt1(ln.off)}°{ln.extra ? ' ·多' : ''}</span>)}</div>
      <div className="wg-cap">1879-03-14 11:30 地方平时，乌尔姆。AA。默认线是课程引擎。打开光体后，标"多"的四条是水星六分火星、火星六分土星、月亮三分土星、太阳合土星。</div>
    </div>
  )
}

export const W04: WidgetMap = {
  's4-snap': () => <SnapWidget />,
  's4-divide': (a) => <DivideWidget n0={typeof a.n === 'number' ? a.n : 6} />,
  's4-nature': () => <NatureWidget />,
  's4-fuse': () => <FuseWidget />,
  's4-gap': () => <GapWidget />,
  's4-aversion': (a) => <AversionWidget mode={typeof a.mode === 'string' ? a.mode : 'sign'} />,
  's4-orb': (a) => <OrbWidget system={typeof a.system === 'string' ? a.system : 'moiety'} />,
  's4-chase': (a) => <ChaseWidget preset={typeof a.preset === 'string' ? a.preset : 'direct'} />,
  's4-hand': (a) => <HandWidget mode={typeof a.mode === 'string' ? a.mode : 'both'} />,
  's4-siege': (a) => <SiegeWidget preset={typeof a.preset === 'string' ? a.preset : 'free'} />,
  's4-rays': () => <RaysWidget />,
  's4-tone': () => <ToneWidget />,
  's4-moon': (a) => <MoonWidget mode={typeof a.mode === 'string' ? a.mode : 'run'} />,
  's4-bridge': (a) => <BridgeWidget mode={typeof a.mode === 'string' ? a.mode : 'transfer'} />,
  's4-mirror': (a) => <MirrorWidget axis={typeof a.axis === 'string' ? a.axis : 'solstice'} />,
  's4-minor': () => <MinorWidget />,
  's4-pattern': () => <PatternWidget />,
  's4-harmonic': () => <HarmonicWidget />,
  's4-sentence': () => <SentenceWidget />,
  's4-einstein': () => <EinsteinWidget />,
}
