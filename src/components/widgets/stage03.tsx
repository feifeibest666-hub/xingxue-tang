import { useEffect, useState } from 'react'
import type { WidgetMap } from './common'
import { Btns, Note, PlayBtn, Slider, reduceMotion, useLoop, usePlaying, wheel } from './common'
import { GlyphAt } from '../Glyph'
import { PlanetAt } from '../PlanetGlyph'
import { ELEMENT_COLOR, SIGNS, element, fmtLon, modality, type Element } from '../../data/zodiac'
import {
  BENEFIC, BOUNDS, CHALDEAN, DOMICILE, EXALTATION, PLANET, TRIPLICITY,
  boundAt, detrimentOf, dignityOf, domicileOf, faceAt, fallOf,
  type Planet,
} from '../../data/classical'
import { computeChart, type Birth, type Chart } from '../../lib/natal'

const SEVEN: Planet[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']
const FIVE: Planet[] = ['jupiter', 'venus', 'mercury', 'mars', 'saturn']
const EL: Element[] = ['火', '土', '风', '水']
const DN = { 入庙: '守护', 擢升: '入旺', 三分: '三分', 界: '界', 外观: '十度', 陷: '落陷', 落: '入弱' } as Record<string, string>
const JOB: Record<Planet, string> = {
  sun: '生命力与中心', moon: '身体与情绪', mercury: '思考与传递', venus: '联结与喜好',
  mars: '切割与行动', jupiter: '扩展与信心', saturn: '界限与结构',
}
const signName = (i: number) => SIGNS[(i - 1 + 12) % 12].name
const lonOf = (sign: number, deg: number) => ((sign - 1) * 30 + deg + 360) % 360
const gap = (a: number, b: number) => { const d = Math.abs(a - b) % 12; return Math.min(d, 12 - d) }
const ASP: Record<number, string> = { 0: '同宫', 1: '相邻', 2: '六分', 3: '四分', 4: '三分', 5: '隔五', 6: '对分' }

function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180
  const pt = (r: number, a: number) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))] as const
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0)
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`
}

function scored(p: Planet, lon: number, isDay: boolean, lillyWater: boolean) {
  const sign = Math.floor((((lon % 360) + 360) % 360) / 30) + 1
  let parts = dignityOf(p, lon, isDay).map((x) => ({ ...x }))
  if (lillyWater && element(sign) === '水') {
    parts = parts.filter((x) => x.name !== '三分')
    if (p === 'mars') parts = [...parts, { name: '三分', score: 3 }]
  }
  const sum = parts.reduce((s, x) => s + x.score, 0)
  return { sign, parts, sum, peregrine: !parts.some((x) => x.score > 0) }
}

const PRESET: Record<string, { label: string; birth: Birth; src: string }> = {
  example: {
    label: '示例盘 · 某人',
    birth: { date: '1990-05-12', time: '08:30', tz: 8, lat: 39.9, lon: 116.4, place: '北京' },
    src: '虚构。1990-05-12 08:30 北京时间，北纬 39.9°、东经 116.4°。',
  },
  einstein: {
    label: '爱因斯坦',
    birth: { date: '1879-03-14', time: '11:30', tz: 10 / 15, lat: 48.4, lon: 10, place: '乌尔姆' },
    src: 'AA。1879-03-14 11:30 地方平时，乌尔姆。经度 10° ÷ 15 = 比世界时快 40 分钟。出生记录。',
  },
  elizabeth: {
    label: '伊丽莎白二世',
    birth: { date: '1926-04-21', time: '02:40', tz: 1, lat: 51.51, lon: -0.147, place: '伦敦' },
    src: 'AA。1926-04-21 02:40 英国夏令时（世界时 +1），伦敦布鲁顿街。《泰晤士报》次日公告。',
  },
  obama: {
    label: '奥巴马',
    birth: { date: '1961-08-04', time: '19:24', tz: -10, lat: 21.3, lon: -157.8667, place: '檀香山' },
    src: 'AA。1961-08-04 19:24 夏威夷标准时（世界时 −10），檀香山。出生证明写明时刻。',
  },
}

/* ── 主场 / 客场（第 92 天）── */
function HomeWidget() {
  const [p, setP] = useState<Planet>('venus')
  const [a, setA] = useState(2)
  const [b, setB] = useState(1)
  const cell = (sign: number) => {
    const mine = DOMICILE[sign - 1] === p
    return (
      <div style={{ flex: 1, padding: 8, borderRadius: 10, background: mine ? 'rgba(194,160,90,0.18)' : 'rgba(246,241,228,0.05)' }}>
        <div style={{ fontSize: 13 }}>{signName(sign)}</div>
        <b style={{ color: mine ? '#e6cf95' : '#f6f1e4' }}>{mine ? '主场' : '客场'}</b>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{mine ? '这颗行星自己的星座' : `主人是${PLANET[DOMICILE[sign - 1]].name}`}</div>
      </div>
    )
  }
  return (
    <div className="wg">
      <Note>只看守护</Note>
      <Btns items={SEVEN.map((q) => [q, PLANET[q].short] as [Planet, string])} value={p} onChange={setP} />
      <Slider label="甲座" value={a} min={1} max={12} onChange={setA} fmt={(v) => signName(v)} />
      <Slider label="乙座" value={b} min={1} max={12} onChange={setB} fmt={(v) => signName(v)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>{cell(a)}{cell(b)}</div>
      <div className="wg-cap">同一颗行星，换一座星座，传统就换一套"有没有自己的房子"。房子是约定，不是望远镜能看见的墙。</div>
    </div>
  )
}

/* ── 世界之盘展开（第 93–95 天）── */
const THEME: { step: number; p: Planet; signs: number[] }[] = [
  { step: 1, p: 'moon', signs: [4] }, { step: 1, p: 'sun', signs: [5] },
  { step: 2, p: 'mercury', signs: [3, 6] }, { step: 3, p: 'venus', signs: [2, 7] },
  { step: 4, p: 'mars', signs: [1, 8] }, { step: 5, p: 'jupiter', signs: [9, 12] },
  { step: 6, p: 'saturn', signs: [10, 11] },
]
const STEP_TXT = ['先只看十二座', '月亮住巨蟹，太阳住狮子', '水星贴在两侧', '金星再往外一格', '火星再往外', '木星再往外', '土星落在最外侧，对宫']

function ThemaWidget() {
  const [step, setStep] = useState(() => (reduceMotion() ? 6 : 0))
  const [playing, setPlaying] = usePlaying(false)
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setStep((s) => (s >= 6 ? 0 : s + 1)), 1300)
    return () => clearInterval(id)
  }, [playing])
  const lord = (i: number) => THEME.find((t) => t.step <= step && t.signs.includes(i))
  return (
    <div className="wg">
      <Note>示意 · 不是某一次真实日出</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        <circle cx={170} cy={170} r={132} fill="none" stroke="rgba(246,241,228,0.12)" />
        {SIGNS.map((s) => {
          const [x, y] = wheel(170, 170, 108, (s.i - 1) * 30 + 15)
          const hit = lord(s.i)
          const asc = s.i === 4
          return (
            <g key={s.i}>
              <circle cx={x} cy={y} r={22} fill={hit ? 'rgba(194,160,90,0.16)' : 'rgba(246,241,228,0.03)'} stroke={asc ? '#c2a05a' : 'rgba(246,241,228,0.16)'} />
              <GlyphAt i={s.i} x={x} y={y - (hit ? 6 : 0)} size={16} color={hit ? '#e6cf95' : '#f6f1e4'} width={8} />
              {hit && <PlanetAt p={hit.p} x={x} y={y + 12} size={12} color={PLANET[hit.p].color} width={8} />}
              {asc && step >= 0 && <text x={x} y={y + 34} textAnchor="middle" fontSize="10" fill="#c2a05a">上升</text>}
            </g>
          )
        })}
        <text x={170} y={166} textAnchor="middle" fill="#f6f1e4" fontSize="13">世界之盘</text>
        <text x={170} y={184} textAnchor="middle" fill="rgba(246,241,228,0.65)" fontSize="11">巨蟹升起</text>
      </svg>
      <div className="wg-btns">
        <PlayBtn playing={playing} set={setPlaying} />
        <button className="wg-btn" onClick={() => setStep((s) => Math.min(6, s + 1))}>下一步</button>
        <button className="wg-btn" onClick={() => setStep(0)}>从头</button>
      </div>
      <div className="wg-cap">第 {step} 步 · {STEP_TXT[step]}</div>
    </div>
  )
}

/* ── 相位对称检验（第 96 天）── */
const PAIRS: Record<Planet, [number, number][]> = {
  sun: [[5, 5]], moon: [[4, 4]],
  mercury: [[3, 4], [6, 5]], venus: [[2, 4], [7, 5]], mars: [[1, 4], [8, 5]],
  jupiter: [[12, 4], [9, 5]], saturn: [[10, 4], [11, 5]],
}
function AspectWidget() {
  const [p, setP] = useState<Planet>('venus')
  const [cross, setCross] = useState(false)
  const lines = PAIRS[p].filter(([a, b]) => a !== b)
  const crossLine = lines[0] ? [[lines[0][0], lines[1] ? lines[1][1] : lines[0][1]] as [number, number]] : []
  const show = cross ? [...lines, ...crossLine] : lines
  return (
    <div className="wg">
      <Note>只连对称的那一侧</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        <circle cx={170} cy={170} r={118} fill="none" stroke="rgba(246,241,228,0.12)" />
        {show.map(([a, b], k) => {
          const [x1, y1] = wheel(170, 170, 108, (a - 1) * 30 + 15)
          const [x2, y2] = wheel(170, 170, 108, (b - 1) * 30 + 15)
          const g = gap(a, b)
          const col = g === 2 || g === 4 ? '#c2a05a' : g === 3 || g === 6 ? '#c4633f' : '#5b7fa8'
          return <g key={k}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={2} /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2} fill={col} fontSize="12" textAnchor="middle">{ASP[g]}</text></g>
        })}
        {SIGNS.map((s) => {
          const [x, y] = wheel(170, 170, 108, (s.i - 1) * 30 + 15)
          const on = lines.some(([a, b]) => a === s.i || b === s.i)
          return <g key={s.i}><circle cx={x} cy={y} r={16} fill={on ? 'rgba(194,160,90,0.2)' : '#141a2e'} stroke="rgba(246,241,228,0.2)" /><GlyphAt i={s.i} x={x} y={y} size={16} color="#f6f1e4" width={8} /></g>
        })}
      </svg>
      <Btns items={(['mercury', 'venus', 'mars', 'jupiter', 'saturn'] as Planet[]).map((q) => [q, PLANET[q].name] as [Planet, string])} value={p} onChange={setP} />
      <div className="wg-btns"><button className={`wg-btn ${cross ? 'on' : ''}`} onClick={() => setCross(!cross)}>{cross ? '已连到另一侧' : '连到另一个发光体看看'}</button></div>
      <div className="wg-cap">{PLANET[p].name} · {BENEFIC[p]} · 对称的那一侧是 <b>{lines.map(([a, b]) => `${signName(a)}对${signName(b)}${ASP[gap(a, b)]}`).join('，')}</b></div>
    </div>
  )
}

/* ── 拖放守护（第 97 天）── */
function PlaceWidget() {
  const [pick, setPick] = useState<Planet>('moon')
  const [put, setPut] = useState<(Planet | null)[]>(() => Array(12).fill(null))
  const [sec, setSec] = useState(0)
  const [run, setRun] = useState(false)
  const [hint, setHint] = useState(0)
  const [show, setShow] = useState(false)
  useEffect(() => { if (!run) return; const id = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(id) }, [run])
  const solved = put.every((q, i) => q === DOMICILE[i])
  useEffect(() => { if (solved) setRun(false) }, [solved])
  const paint = (i: number) => {
    if (!run && put.every((x) => !x)) setRun(true)
    setPut((arr) => arr.map((q, k) => (k === i ? (q === pick ? null : pick) : q)))
    setShow(false)
  }
  return (
    <div className="wg">
      <Note>{solved ? `用时 ${sec} 秒` : run ? `${sec} 秒` : '点行星，再点星座'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {SIGNS.map((s) => {
          const [x, y] = wheel(170, 170, 118, (s.i - 1) * 30 + 15)
          const q = put[s.i - 1]
          const ok = show && q === DOMICILE[s.i - 1]
          const bad = show && q && q !== DOMICILE[s.i - 1]
          return (
            <g key={s.i} onClick={() => paint(s.i - 1)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={26} fill="transparent" />
              <circle cx={x} cy={y} r={20} fill={ok ? 'rgba(143,191,154,0.25)' : bad ? 'rgba(196,99,63,0.25)' : 'rgba(246,241,228,0.04)'} stroke={q ? PLANET[q].color : 'rgba(246,241,228,0.2)'} />
              <GlyphAt i={s.i} x={x} y={y - (q ? 5 : 0)} size={14} color="#f6f1e4" width={8} />
              {q && <text x={x} y={y + 14} textAnchor="middle" fontSize="9" fill={PLANET[q].color}>{PLANET[q].short}</text>}
            </g>
          )
        })}
      </svg>
      <Btns items={SEVEN.map((q) => [q, PLANET[q].name] as [Planet, string])} value={pick} onChange={setPick} />
      <div className="wg-btns">
        <button className="wg-btn on" onClick={() => setShow(true)}>核对</button>
        <button className="wg-btn" onClick={() => { setPut(Array(12).fill(null)); setSec(0); setRun(false); setShow(false) }}>清空</button>
        <button className="wg-btn" onClick={() => setHint((h) => Math.min(3, h + 1))}>提示 {hint}/3</button>
      </div>
      <div className="wg-cap">{hint >= 1 && '先放月亮和太阳：北半球夏天那两座。'}{hint >= 2 && '再从两侧向外：水、金、火、木、土。'}{hint >= 3 && '土星落在摩羯和水瓶，和日月正对。'}{hint === 0 && (solved ? '十二座都对上了。' : '日月各一座，其余五颗各两座。')}</div>
    </div>
  )
}

/* ── 距角与宫距（第 99 天）── */
function ElongWidget() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = usePlaying(true)
  useLoop(playing, (dt) => setT((x) => x + dt))
  const dots = [
    { name: '水星', max: 28, col: PLANET.mercury.color, y: 118 },
    { name: '金星', max: 47, col: PLANET.venus.color, y: 168 },
  ]
  const xOf = (deg: number) => 170 + (deg / 60) * 130
  return (
    <div className="wg">
      <Note>示意 · 最大距角是平均值</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <line x1={40} y1={70} x2={300} y2={70} stroke="rgba(246,241,228,0.25)" />
        {[-60, -30, 0, 30, 60].map((d) => (
          <g key={d}>
            <line x1={xOf(d)} y1={62} x2={xOf(d)} y2={78} stroke="#c2a05a" />
            <text x={xOf(d)} y={54} textAnchor="middle" fontSize="11" fill="#c2a05a">{d}°</text>
          </g>
        ))}
        <text x={170} y={96} textAnchor="middle" fontSize="12" fill="#f6f1e4">太阳 · 0°</text>
        {dots.map((d) => {
          const deg = d.max * Math.sin(t * (d.name === '水星' ? 0.8 : 0.45))
          return (
            <g key={d.name}>
              <line x1={xOf(-d.max)} y1={d.y} x2={xOf(d.max)} y2={d.y} stroke={d.col} strokeOpacity={0.35} />
              <circle cx={xOf(deg)} cy={d.y} r={7} fill={d.col} />
              <text x={46} y={d.y + 4} fontSize="12" fill={d.col}>{d.name}</text>
              <text x={300} y={d.y + 4} fontSize="11" fill="rgba(246,241,228,0.7)" textAnchor="end">{deg.toFixed(0)}°</text>
            </g>
          )
        })}
      </svg>
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-cap">一格星座是 30°。水星最远约 28°，跨不出完整的下一座；金星约 47°，能进入隔一座，到不了 60°。</div>
    </div>
  )
}

/* ── 对宫推出落陷、入弱（第 100、103、104 天）── */
function OpposeWidget() {
  const [p, setP] = useState<Planet>('venus')
  const [open, setOpen] = useState(false)
  const ex = EXALTATION[p]!
  const fallSign = fallOf(p)!
  return (
    <div className="wg">
      <Note>对宫 = 加 6 座</Note>
      <Btns items={SEVEN.map((q) => [q, PLANET[q].name] as [Planet, string])} value={p} onChange={(v) => { setP(v); setOpen(false) }} />
      <table className="wg-table">
        <tbody>
          <tr><th>守护</th><td>{domicileOf(p).map(signName).join('、')}</td></tr>
          <tr><th>落陷</th><td>{open ? detrimentOf(p).map(signName).join('、') : '……'}</td></tr>
          <tr><th>入旺</th><td>{signName(ex.sign)} {ex.deg}°</td></tr>
          <tr><th>入弱</th><td>{open ? `${signName(fallSign)} ${ex.deg}°` : '……'}</td></tr>
        </tbody>
      </table>
      <div className="wg-btns"><button className="wg-btn on" onClick={() => setOpen(true)}>取对宫</button></div>
      <div className="wg-cap">{open ? `落陷是守护的对宫，入弱是入旺的对宫，度数照搬。` : '先自己说对宫是谁，再按。'}</div>
    </div>
  )
}

/* ── 入旺度数（第 101–102 天）── */
function ExaltWidget() {
  const [p, setP] = useState<Planet>('sun')
  const ex = EXALTATION[p]!
  const lon = lonOf(ex.sign, ex.deg)
  return (
    <div className="wg">
      <Note>整座都算，度数是峰值</Note>
      <svg className="wg-svg" viewBox="0 0 340 300">
        <circle cx={170} cy={150} r={108} fill="none" stroke="rgba(246,241,228,0.12)" />
        {SIGNS.map((s) => {
          const [x, y] = wheel(170, 150, 108, (s.i - 1) * 30 + 15)
          return <g key={s.i}><GlyphAt i={s.i} x={x} y={y} size={16} color={s.i === ex.sign ? '#e6cf95' : 'rgba(246,241,228,0.55)'} width={8} /></g>
        })}
        {SEVEN.map((q) => {
          const e = EXALTATION[q]!
          const [x, y] = wheel(170, 150, 78, (e.sign - 1) * 30 + e.deg)
          return <g key={q} onClick={() => setP(q)} style={{ cursor: 'pointer' }}><circle cx={x} cy={y} r={q === p ? 11 : 7} fill={PLANET[q].color} opacity={q === p ? 1 : 0.45} /></g>
        })}
        {(() => { const [x, y] = wheel(170, 150, 78, lon); return <circle cx={x} cy={y} r={14} fill="none" stroke="#f6f1e4" /> })()}
      </svg>
      <Btns items={SEVEN.map((q) => [q, PLANET[q].short] as [Planet, string])} value={p} onChange={setP} />
      <div className="wg-cap"><b>{PLANET[p].name}</b> 入旺 {signName(ex.sign)} {ex.deg}° · 入弱在对宫 {signName(fallOf(p)!)} {ex.deg}°。这颗度数为什么是它，泥板没写。</div>
    </div>
  )
}

/* ── 三套三分（第 106–107 天）── */
function TriWidget() {
  const [el, setEl] = useState<Element>('火')
  const [day, setDay] = useState(true)
  const [d0, d1, d2] = TRIPLICITY[el]
  const ptol = el === '水' ? (day ? '火星为主，金星协同' : '火星为主，月亮协同') : PLANET[day ? d0 : d1].name
  const lilly = el === '水' ? '火星' : PLANET[day ? d0 : d1].name
  return (
    <div className="wg">
      <Note>计分只用多罗修斯的昼夜主星</Note>
      <Btns items={EL.map((e) => [e, e] as [Element, string])} value={el} onChange={setEl} />
      <div className="wg-btns">
        <button className={`wg-btn ${day ? 'on' : ''}`} onClick={() => setDay(true)}>日生盘</button>
        <button className={`wg-btn ${!day ? 'on' : ''}`} onClick={() => setDay(false)}>夜生盘</button>
      </div>
      <table className="wg-table">
        <tbody>
          <tr><th>多罗修斯</th><td>昼 {PLANET[d0].name} · 夜 {PLANET[d1].name} · 协同 {PLANET[d2].name}</td></tr>
          <tr><th>这一盘取得</th><td>{PLANET[day ? d0 : d1].name}（协同 {PLANET[d2].name} 不计分）</td></tr>
          <tr><th>托勒密·一种读法</th><td>{ptol}</td></tr>
          <tr><th>李利</th><td>{lilly}</td></tr>
        </tbody>
      </table>
      <div className="wg-cap" style={{ color: ELEMENT_COLOR[el] }}>{el}象 · {day ? '白天用第一颗' : '夜里用第二颗'}。水象的托勒密一行只是一种读法。另一种读法的昼夜主星与多罗修斯相同。其余三象的昼夜主星，三套相同。</div>
    </div>
  )
}

/* ── 分层环：三分、界、十度（第 108、113 天）── */
function LayersWidget() {
  const [sign, setSign] = useState(1)
  const [deg, setDeg] = useState(10)
  const lon = lonOf(sign, deg)
  const el = element(sign)
  const [d0, d1, d2] = TRIPLICITY[el]
  let prev = 0
  const bounds = BOUNDS[sign - 1].map(([p, end]) => { const seg = { p, a0: (prev / 30) * 360, a1: (end / 30) * 360, hit: deg >= prev && deg < end }; prev = end; return seg })
  const faces = [0, 1, 2].map((k) => ({ p: faceAt(lonOf(sign, k * 10 + 1)), a0: k * 120, a1: (k + 1) * 120, hit: deg >= k * 10 && deg < (k + 1) * 10 }))
  return (
    <div className="wg">
      <Note>一座星座的三层</Note>
      <svg className="wg-svg" viewBox="0 0 340 250">
        <circle cx={170} cy={120} r={46} fill="none" stroke={ELEMENT_COLOR[el]} strokeWidth={18} />
        <text x={170} y={116} textAnchor="middle" fontSize="12" fill="#f6f1e4">{el}</text>
        <text x={170} y={130} textAnchor="middle" fontSize="9" fill="rgba(246,241,228,0.75)">三分</text>
        {bounds.map((b, i) => <path key={i} d={sector(170, 120, 58, 82, b.a0, b.a1 - 0.8)} fill={PLANET[b.p].color} opacity={b.hit ? 1 : 0.35} />)}
        {faces.map((f, i) => <path key={i} d={sector(170, 120, 86, 112, f.a0, f.a1 - 0.8)} fill={PLANET[f.p].color} opacity={f.hit ? 1 : 0.35} />)}
        <text x={170} y={168} textAnchor="middle" fontSize="10" fill="rgba(246,241,228,0.7)">中环界 · 外环十度 · 0° 在上方，顺时针</text>
      </svg>
      <Btns items={SIGNS.map((s) => [s.i, s.short] as [number, string])} value={sign} onChange={setSign} />
      <Slider label="度数" value={deg} min={0} max={29} onChange={setDeg} fmt={(v) => `${v}°`} />
      <div className="wg-read">
        <span>三分 昼{PLANET[d0].short}/夜{PLANET[d1].short}/协同{PLANET[d2].short}</span>
        <span>界 <b>{PLANET[boundAt(lon)].name}</b></span>
        <span>十度 <b>{PLANET[faceAt(lon)].name}</b></span>
      </div>
      <div className="wg-cap">{signName(sign)} {deg}°。恰好卡在终点上时，本课算法算下一段。</div>
    </div>
  )
}

const LOOKUP: [number, string][] = [
  [4, '白羊 4°'], [19, '白羊 19°'], [39, '金牛 9°'], [61, '双子 1°'], [98, '巨蟹 8°'],
  [136, '狮子 16°'], [165, '处女 15°'], [183, '天秤 3°'], [298, '摩羯 28°'], [357, '双鱼 27°'],
]

/* ── 查界（第 108、111 天）── */
function BoundsWidget({ quiz = false }: { quiz?: boolean }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<Planet | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(0)
  const [lon, setLon] = useState(15)
  if (!quiz) {
    const s = Math.floor(lon / 30) + 1
    let prev = 0
    return (
      <div className="wg">
        <Note>埃及界</Note>
        <Slider label="黄经" value={lon} min={0} max={359} onChange={setLon} fmt={(v) => fmtLon(v)} />
        <svg className="wg-svg" viewBox="0 0 340 70">
          {BOUNDS[s - 1].map(([p, end], k) => {
            const x = 20 + (prev / 30) * 300, w = ((end - prev) / 30) * 300
            const hit = (lon % 30) >= prev && (lon % 30) < end
            const node = <g key={k}><rect x={x} y={16} width={Math.max(1, w - 2)} height={28} rx={4} fill={PLANET[p].color} opacity={hit ? 1 : 0.35} /><text x={x + w / 2} y={34} textAnchor="middle" fontSize="11" fill="#141a2e">{PLANET[p].short}{end}</text></g>
            prev = end
            return node
          })}
        </svg>
        <div className="wg-cap">{fmtLon(lon)} 的界主是 <b>{PLANET[boundAt(lon)].name}</b>。日月没有界。</div>
      </div>
    )
  }
  const [qLon, qLabel] = LOOKUP[i]
  const ans = boundAt(qLon)
  const choose = (p: Planet) => {
    if (picked) return
    setPicked(p)
    if (p === ans) setScore((s) => s + 1)
  }
  const next = () => { setPicked(null); setDone((n) => n + 1); setI((k) => (k + 1) % LOOKUP.length) }
  return (
    <div className="wg">
      <Note>10 题 · 对 {score}/{done}</Note>
      <div className="wg-cap">第 {i + 1} 题 · {qLabel} 在谁的界？</div>
      <div className="wg-btns">
        {FIVE.map((p) => <button key={p} className={`wg-btn ${picked === p ? 'on' : ''}`} onClick={() => choose(p)}>{PLANET[p].name}</button>)}
      </div>
      {picked && <div className="wg-cap">{picked === ans ? '对。' : `这题是${PLANET[ans].name}。`} 表上的数字是这段的终点。</div>}
      {picked && <div className="wg-btns"><button className="wg-btn on" onClick={next}>下一题</button></div>}
    </div>
  )
}

/* ── 大年（第 109 天）── */
function YearsWidget() {
  const sums: Record<string, number> = {}
  for (const row of BOUNDS) {
    let prev = 0
    for (const [p, end] of row) { sums[p] = (sums[p] ?? 0) + (end - prev); prev = end }
  }
  const order: Planet[] = ['jupiter', 'venus', 'mercury', 'mars', 'saturn']
  return (
    <div className="wg">
      <Note>五段加总</Note>
      <svg className="wg-svg" viewBox="0 0 340 210">
        {order.map((p, i) => (
          <g key={p}>
            <text x={36} y={28 + i * 36} fontSize="13" fill={PLANET[p].color}>{PLANET[p].name}</text>
            <rect x={78} y={14 + i * 36} width={(sums[p] / 82) * 200} height={16} rx={4} fill={PLANET[p].color} />
            <text x={86 + (sums[p] / 82) * 200} y={27 + i * 36} fontSize="12" fill="#f6f1e4">{sums[p]}</text>
          </g>
        ))}
      </svg>
      <div className="wg-cap">79 + 82 + 76 + 66 + 57 = <b>360</b>。日月是 0。这组数传统叫大年，不是小年。</div>
    </div>
  )
}

/* ── 36 十度（第 113–115 天）── */
function triFace(sign: number, part: number): Planet {
  const s = ((sign - 1 + part * 4) % 12) + 1
  return DOMICILE[s - 1]
}
function FacesWidget({ mode = 'chaldean' }: { mode?: string }) {
  const tri = mode === 'tri'
  const [n, setN] = useState(() => (reduceMotion() ? 36 : 1))
  const [playing, setPlaying] = usePlaying(!tri)
  useEffect(() => {
    if (!playing || tri) return
    const id = setInterval(() => setN((k) => (k >= 36 ? 1 : k + 1)), 450)
    return () => clearInterval(id)
  }, [playing, tri])
  const lord = (k: number) => (tri ? triFace(Math.floor(k / 3) + 1, k % 3) : CHALDEAN[(2 + k) % 7])
  return (
    <div className="wg">
      <Note>{tri ? '三分十度' : '迦勒底十度'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        {Array.from({ length: 36 }, (_, k) => {
          const col = k % 12
          const row = Math.floor(k / 12)
          const x = 16 + col * 27, y = 18 + row * 62
          const p = lord(k)
          const on = !tri && k < n
          return (
            <g key={k}>
              <rect x={x} y={y} width={24} height={36} rx={4} fill={PLANET[p].color} opacity={tri || on ? 0.9 : 0.18} />
              <text x={x + 12} y={y + 22} textAnchor="middle" fontSize="11" fill="#141a2e">{PLANET[p].short}</text>
            </g>
          )
        })}
      </svg>
      {!tri && <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /><button className="wg-btn" onClick={() => setN(36)}>放到第 36 段</button></div>}
      <div className="wg-cap">{tri ? '每座的三段，按同元素下一座的守护来排。白羊第三段是木星，和迦勒底的金星不同。' : `已排 ${n} 段。36 = 7×5+1，最后一段又是火星，和第一段连在一起。`}</div>
    </div>
  )
}

/* ── 计分（第 116–118、125、131 天）── */
function ScoreWidget({ who }: { who?: string }) {
  const [p, setP] = useState<Planet>('venus')
  const [sign, setSign] = useState(1)
  const [deg, setDeg] = useState(9)
  const [day, setDay] = useState(true)
  const [lilly, setLilly] = useState(false)
  const [person, setPerson] = useState(who && PRESET[who] ? who : '')
  const [chart, setChart] = useState<Chart | null>(null)
  useEffect(() => {
    if (!person) return
    let ok = true
    setChart(null)
    computeChart(PRESET[person].birth).then((c) => { if (ok) setChart(c) })
    return () => { ok = false }
  }, [person])
  const one = scored(p, lonOf(sign, deg), day, lilly)
  return (
    <div className="wg">
      <Note>{lilly ? '李利水象' : '多罗修斯昼夜 · 与 App 相同'}</Note>
      <div className="wg-btns">
        <button className={`wg-btn ${person === '' ? 'on' : ''}`} onClick={() => setPerson('')}>单颗</button>
        {Object.entries(PRESET).map(([k, v]) => <button key={k} className={`wg-btn ${person === k ? 'on' : ''}`} onClick={() => setPerson(k)}>{v.label}</button>)}
      </div>
      {!person && (
        <>
          <Btns items={SEVEN.map((q) => [q, PLANET[q].short] as [Planet, string])} value={p} onChange={setP} />
          <Btns items={SIGNS.map((s) => [s.i, s.short] as [number, string])} value={sign} onChange={setSign} />
          <Slider label="度数" value={deg} min={0} max={29} onChange={setDeg} fmt={(v) => `${v}°`} />
          <div className="wg-btns">
            <button className={`wg-btn ${day ? 'on' : ''}`} onClick={() => setDay(true)}>日生</button>
            <button className={`wg-btn ${!day ? 'on' : ''}`} onClick={() => setDay(false)}>夜生</button>
            <button className={`wg-btn ${lilly ? 'on' : ''}`} onClick={() => setLilly(!lilly)}>水象改用李利</button>
          </div>
          <div className="wg-cap"><b>{PLANET[p].name}</b> 在{signName(sign)} {deg}° · {one.parts.map((x) => `${DN[x.name] ?? x.name} ${x.score > 0 ? '+' : ''}${x.score}`).join('，') || '没有正尊贵'} · 合计 <b>{one.sum}</b>{one.peregrine ? ' · 游走' : ''}</div>
        </>
      )}
      {person && !chart && <div className="wg-cap">计算中…</div>}
      {person && chart && (
        <>
          <div className="wg-read"><span>{chart.isDay ? '日生盘' : '夜生盘'}</span><span>上升 {fmtLon(chart.asc)}（宫位以后再学）</span></div>
          <table className="wg-table">
            <tbody>
              {SEVEN.map((q) => {
                const r = scored(q, chart.pos[q].lon, chart.isDay, lilly)
                const alt = scored(q, chart.pos[q].lon, chart.isDay, !lilly)
                const names = r.parts.map((x) => DN[x.name] ?? x.name)
                const cell = (r.peregrine ? ['游走', ...names] : names).join('、') || '无'
                return (
                  <tr key={q}>
                    <td>{PLANET[q].name}{chart.pos[q].retro ? '逆' : ''}</td>
                    <td>{fmtLon(chart.pos[q].lon)}</td>
                    <td>{cell}</td>
                    <td>{r.sum}{r.sum !== alt.sum ? `（另一套 ${alt.sum}）` : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="wg-btns"><button className={`wg-btn ${lilly ? 'on' : ''}`} onClick={() => setLilly(!lilly)}>{lilly ? '正在用李利水象' : '改看李利水象'}</button></div>
          <div className="wg-cap">{PRESET[person].src} 度数来自本 App 的星历，和其他软件可能差几角分。</div>
        </>
      )}
    </div>
  )
}

/* ── 互容（第 120 天）── */
const RECS: { name: string; a: Planet; as: number; b: Planet; bs: number }[] = [
  { name: '月土·落陷', a: 'moon', as: 10, b: 'saturn', bs: 4 },
  { name: '月日·入旺', a: 'moon', as: 1, b: 'sun', bs: 2 },
  { name: '示例·月木', a: 'moon', as: 9, b: 'jupiter', bs: 4 },
  { name: '示例·日金', a: 'sun', as: 2, b: 'venus', bs: 1 },
  { name: '示例·金火', a: 'venus', as: 1, b: 'mars', bs: 12 },
]
function holds(sign: number, q: Planet) {
  return { dom: DOMICILE[sign - 1] === q, ex: EXALTATION[q]?.sign === sign }
}
function ReceptionWidget() {
  const [i, setI] = useState(0)
  const r = RECS[i]
  const ab = holds(r.as, r.b), ba = holds(r.bs, r.a)
  const kind = ab.dom && ba.dom ? '守护互容' : ab.ex && ba.ex ? '入旺互容' : (ab.dom || ab.ex) && (ba.dom || ba.ex) ? '混合互容' : '不是互容'
  return (
    <div className="wg">
      <Note>交换钥匙</Note>
      <Btns items={RECS.map((x, k) => [k, x.name] as [number, string])} value={i} onChange={setI} />
      <div className="wg-read">
        <span>{PLANET[r.a].name}在{signName(r.as)}：{ab.dom ? '在对方守护宫' : ab.ex ? '在对方入旺宫' : '不在对方的宫'}</span>
        <span>{PLANET[r.b].name}在{signName(r.bs)}：{ba.dom ? '在对方守护宫' : ba.ex ? '在对方入旺宫' : '不在对方的宫'}</span>
      </div>
      <div className="wg-cap"><b>{kind}</b>。计分条不自动加互容的分；传统另说"彼此有钥匙，做客没那么窘"。</div>
    </div>
  )
}

/* ── 定位星链（第 122、125 天）── */
const CHAIN0: Record<Planet, number> = { sun: 2, moon: 9, mercury: 2, venus: 1, mars: 12, jupiter: 4, saturn: 10 }
const CPOS: Record<Planet, [number, number]> = {
  sun: [55, 58], moon: [145, 58], mercury: [235, 58], venus: [55, 148],
  mars: [145, 148], jupiter: [250, 148], saturn: [155, 228],
}
function ChainWidget() {
  const [sign, setSign] = useState<Record<Planet, number>>({ ...CHAIN0 })
  const [pick, setPick] = useState<Planet>('moon')
  const [t, setT] = useState(0)
  const [playing, setPlaying] = usePlaying(true)
  useLoop(playing, (dt) => setT((x) => (x + dt * 0.6) % 1))
  const lord = (p: Planet) => DOMICILE[sign[p] - 1]
  const finals = SEVEN.filter((p) => lord(p) === p)
  return (
    <div className="wg">
      <Note>点一颗，再换它的星座</Note>
      <svg className="wg-svg" viewBox="0 0 340 270">
        {SEVEN.map((p) => {
          const q = lord(p)
          if (q === p) return null
          const [x1, y1] = CPOS[p], [x2, y2] = CPOS[q]
          const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t
          return <g key={p}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(194,160,90,0.45)" /><circle cx={x} cy={y} r={3.5} fill="#e6cf95" /></g>
        })}
        {SEVEN.map((p) => {
          const [x, y] = CPOS[p]
          const self = lord(p) === p
          return (
            <g key={p} onClick={() => setPick(p)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={24} fill={p === pick ? 'rgba(194,160,90,0.25)' : '#141a2e'} stroke={self ? '#c2a05a' : 'rgba(246,241,228,0.25)'} strokeWidth={self ? 3 : 1} />
              <PlanetAt p={p} x={x} y={y - 4} size={16} color={PLANET[p].color} width={8} />
              <text x={x} y={y + 16} textAnchor="middle" fontSize="10" fill="#f6f1e4">{signName(sign[p])}</text>
            </g>
          )
        })}
      </svg>
      <div className="wg-btns">
        {SIGNS.map((s) => <button key={s.i} className="wg-btn" onClick={() => setSign((m) => ({ ...m, [pick]: s.i }))}>{s.short}</button>)}
        <button className="wg-btn" onClick={() => setSign({ ...CHAIN0 })}>回到示例盘</button>
        <PlayBtn playing={playing} set={setPlaying} />
      </div>
      <div className="wg-cap">{PLANET[pick].name}在{signName(sign[pick])}，定位星是{PLANET[lord(pick)].name}。{finals.length ? `在自己宫里的：${finals.map((p) => PLANET[p].name).join('、')}` : '现在没有人住在自己的守护宫。'} 互相指来指去就是循环，没有单颗终点。</div>
    </div>
  )
}

/* ── 四格读法（第 127–130 天）── */
function ReadWidget() {
  const [p, setP] = useState<Planet>('moon')
  const [sign, setSign] = useState(10)
  const host = DOMICILE[sign - 1]
  const bits = [
    host === p ? '守护' : null,
    EXALTATION[p]?.sign === sign ? '入旺' : null,
    detrimentOf(p).includes(sign) ? '落陷' : null,
    fallOf(p) === sign ? '入弱' : null,
  ].filter(Boolean)
  const slow = p === 'jupiter' || p === 'saturn'
  return (
    <div className="wg">
      <Note>四格 · 先别背形容词</Note>
      <Btns items={SEVEN.map((q) => [q, PLANET[q].short] as [Planet, string])} value={p} onChange={setP} />
      <Btns items={SIGNS.map((s) => [s.i, s.short] as [number, string])} value={sign} onChange={setSign} />
      <div className="wg-read">
        <span>做什么：{JOB[p]}</span>
        <span>怎么做：{signName(sign)} · {element(sign)} · {modality(sign)} · {SIGNS[sign - 1].keywords.slice(0, 2).join('、')}</span>
        <span>资源：{bits.length ? bits.join('、') : '这四项都没有（还可能有三分、界、十度）'}</span>
        <span>受谁影响：{host === p ? '自己，链条可以在这里停下' : PLANET[host].name}</span>
      </div>
      <div className="wg-cap">{slow ? `${PLANET[p].name}走得慢，这一座是同龄人里一批人的共同背景，不是你一个人的私产。` : '关键词来自第 1 阶段的星座推导，用的时候要能说回来源。'}</div>
    </div>
  )
}

/* ── 接纳：整宫看见（第 121 天）── */
const SEE_PRE: { name: string; g: Planet; gs: number; h: Planet; hs: number }[] = [
  { name: '火被木接纳', g: 'mars', gs: 12, h: 'jupiter', hs: 4 },
  { name: '月木看不见', g: 'moon', gs: 9, h: 'jupiter', hs: 4 },
  { name: '月土对分', g: 'moon', gs: 10, h: 'saturn', hs: 4 },
  { name: '火土整宫', g: 'mars', gs: 10, h: 'saturn', hs: 1 },
]
function hostKey(host: Planet, sign: number) {
  if (DOMICILE[sign - 1] === host) return '守护'
  if (EXALTATION[host]?.sign === sign) return '入旺'
  return ''
}
function SeeWidget() {
  const [pi, setPi] = useState(0)
  const [g, setG] = useState<Planet>('mars')
  const [gs, setGs] = useState(12)
  const [h, setH] = useState<Planet>('jupiter')
  const [hs, setHs] = useState(4)
  const key = hostKey(h, gs)
  const back = hostKey(g, hs)
  const d = gap(gs, hs)
  const see = d === 0 || d === 2 || d === 3 || d === 4 || d === 6
  const [x1, y1] = wheel(170, 108, 52, (gs - 1) * 30 + 15)
  const [x2, y2] = gs === hs ? [x1 + 22, y1] : wheel(170, 108, 52, (hs - 1) * 30 + 15)
  const apply = (i: number) => {
    const x = SEE_PRE[i]
    setPi(i); setG(x.g); setGs(x.gs); setH(x.h); setHs(x.hs)
  }
  return (
    <div className="wg">
      <Note>整宫 · 不查度数容许</Note>
      <Btns items={SEE_PRE.map((x, i) => [i, x.name] as [number, string])} value={pi} onChange={apply} />
      <Btns items={SEVEN.map((q) => [q, `客${PLANET[q].short}`] as [Planet, string])} value={g} onChange={(v) => { setPi(-1); setG(v) }} />
      <Slider label="客座" value={gs} min={1} max={12} onChange={(v) => { setPi(-1); setGs(v) }} fmt={(v) => signName(v)} />
      <Btns items={SEVEN.map((q) => [q, `主${PLANET[q].short}`] as [Planet, string])} value={h} onChange={(v) => { setPi(-1); setH(v) }} />
      <Slider label="主座" value={hs} min={1} max={12} onChange={(v) => { setPi(-1); setHs(v) }} fmt={(v) => signName(v)} />
      <svg className="wg-svg" viewBox="0 0 340 210">
        <circle cx={170} cy={108} r={78} fill="none" stroke="rgba(246,241,228,0.12)" />
        {SIGNS.map((s) => {
          const [x, y] = wheel(170, 108, 78, (s.i - 1) * 30 + 15)
          const on = s.i === gs || s.i === hs
          return <GlyphAt key={s.i} i={s.i} x={x} y={y} size={14} color={on ? '#e6cf95' : 'rgba(246,241,228,0.35)'} width={7} />
        })}
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={see ? '#c2a05a' : 'rgba(246,241,228,0.28)'} strokeDasharray={see ? undefined : '4 3'} />
        <PlanetAt p={g} x={x1} y={y1} size={18} color={PLANET[g].color} />
        <PlanetAt p={h} x={x2} y={y2} size={18} color={PLANET[h].color} />
      </svg>
      <div className="wg-read">
        <span>钥匙：{key ? `${PLANET[h].name}以${key}管着${PLANET[g].name}` : `${PLANET[h].name}不是这座的守护，客人也没有落在${PLANET[h].name}的入旺星座`}</span>
        <span>看见：隔 {d} · {ASP[d]} · {see ? '整宫看得见' : '整宫看不见'}</span>
        <span>{back ? `反过来，${PLANET[g].name}也以${back}管着主人，这是互容。` : '反过来主人并不落在客人的守护或入旺里。'}</span>
      </div>
      <div className="wg-cap">{key && see ? `按本课严定义：${PLANET[h].name}接纳${PLANET[g].name}。` : '按本课严定义：这还不是接纳。'}三分、界、十度的钥匙这页不查。度数容许度留到第 4 阶段。</div>
    </div>
  )
}

/* ── 本质 / 偶然两本账（第 123 天）── */
function LedgerWidget() {
  const [p, setP] = useState<Planet>('saturn')
  const [sign, setSign] = useState(10)
  const [deg, setDeg] = useState(25)
  const [retro, setRetro] = useState(true)
  const [angular, setAngular] = useState(true)
  const one = scored(p, lonOf(sign, deg), true, false)
  return (
    <div className="wg">
      <Note>两本账 · 示意</Note>
      <Btns items={SEVEN.map((q) => [q, PLANET[q].short] as [Planet, string])} value={p} onChange={setP} />
      <Slider label="星座" value={sign} min={1} max={12} onChange={setSign} fmt={(v) => signName(v)} />
      <Slider label="度数" value={deg} min={0} max={29} onChange={setDeg} fmt={(v) => `${v}°`} />
      <div className="wg-btns">
        <button className={`wg-btn ${retro ? 'on' : ''}`} onClick={() => setRetro(!retro)}>{retro ? '逆行：已记账' : '逆行：不记'}</button>
        <button className={`wg-btn ${angular ? 'on' : ''}`} onClick={() => setAngular(!angular)}>{angular ? '角宫：已记账' : '角宫：不记'}</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1, padding: 8, borderRadius: 10, background: 'rgba(194,160,90,0.14)' }}>
          <b>本质</b>
          <div style={{ fontSize: 13, marginTop: 4 }}>{one.parts.map((x) => `${DN[x.name] ?? x.name} ${x.score > 0 ? '+' : ''}${x.score}`).join('，') || '没有正负项'}</div>
          <div>合计 <b>{one.sum}</b>{one.peregrine ? ' · 游走' : ''}</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 10, background: 'rgba(91,127,168,0.16)' }}>
          <b>偶然</b>
          <div style={{ fontSize: 13, marginTop: 4 }}>逆行 {retro ? '记一笔' : '不记'} · 角宫 {angular ? '记一笔' : '不记'}</div>
          <div style={{ fontSize: 13 }}>快慢、焦伤、日核：第 6 阶段</div>
        </div>
      </div>
      <div className="wg-cap">左边是本质，右边是偶然。两栏不相加，也不合成一个总强度。右边怎么勾，左边的 <b>{one.sum}</b> 都不变。{p === 'saturn' && sign === 10 && deg === 25 ? '这一格是守护 +5、界 +2。' : '把土星放回摩羯 25°，合计应是 7。'}</div>
    </div>
  )
}

/* ── 本性 × 资源（第 124 天）── */
function NatureWidget() {
  const [p, setP] = useState<Planet>('saturn')
  const [sign, setSign] = useState(10)
  const home = DOMICILE[sign - 1] === p
  const ex = EXALTATION[p]?.sign === sign
  const det = detrimentOf(p).includes(sign)
  const fall = fallOf(p) === sign
  const res = [home && '守护', ex && '入旺', det && '落陷', fall && '入弱'].filter(Boolean).join('、') || '守护、入旺、落陷、入弱都没有'
  const rich = home || ex
  const poor = det || fall
  const nature = BENEFIC[p]
  const read = nature === '凶' && rich ? '有资源的严厉者。本性仍写凶。'
    : nature === '凶' && poor ? '严厉，而且缺这层资源。不要写成"更不幸"的科学结论。'
    : nature === '吉' && rich ? '善意，而且有工具。不要写成保证发生的好事。'
    : nature === '吉' && poor ? '善意还在，工具不在自己手里。'
    : nature === '发光体' && rich ? '发光体在自己的强位。强的是资源，不是吉凶。'
    : nature === '发光体' && poor ? '发光体在弱位。弱的是资源，光本身还在。'
    : nature === '中性' ? '水星先不标吉凶。它随所连接的行星，资源单独写。'
    : '本性一列、资源一列。这一格两边都不在极端上。'
  return (
    <div className="wg">
      <Note>两列不要并成一句好坏</Note>
      <div className="wg-btns">
        <button className="wg-btn" onClick={() => { setP('saturn'); setSign(10) }}>土星摩羯</button>
        <button className="wg-btn" onClick={() => { setP('venus'); setSign(1) }}>金星白羊</button>
        <button className="wg-btn" onClick={() => { setP('mars'); setSign(10) }}>火星摩羯</button>
        <button className="wg-btn" onClick={() => { setP('jupiter'); setSign(4) }}>木星巨蟹</button>
      </div>
      <Btns items={SEVEN.map((q) => [q, PLANET[q].short] as [Planet, string])} value={p} onChange={setP} />
      <Slider label="星座" value={sign} min={1} max={12} onChange={setSign} fmt={(v) => signName(v)} />
      <div className="wg-read">
        <span>本性：{nature} · {JOB[p]}</span>
        <span>资源：{res}</span>
        <span>{read}</span>
      </div>
      <div className="wg-cap">界、十度、三分没算进这四格。土星在摩羯仍是凶星；金星在白羊仍是吉星。</div>
    </div>
  )
}

export const W03: WidgetMap = {
  's3-home': () => <HomeWidget />,
  's3-thema': () => <ThemaWidget />,
  's3-aspects': () => <AspectWidget />,
  's3-place': () => <PlaceWidget />,
  's3-elong': () => <ElongWidget />,
  's3-oppose': () => <OpposeWidget />,
  's3-exalt': () => <ExaltWidget />,
  's3-tri': () => <TriWidget />,
  's3-layers': () => <LayersWidget />,
  's3-bounds': (a) => <BoundsWidget quiz={a.quiz === true} />,
  's3-years': () => <YearsWidget />,
  's3-faces': (a) => <FacesWidget mode={a.mode === 'tri' ? 'tri' : 'chaldean'} />,
  's3-score': (a) => <ScoreWidget who={typeof a.who === 'string' ? a.who : undefined} />,
  's3-reception': () => <ReceptionWidget />,
  's3-see': () => <SeeWidget />,
  's3-chain': () => <ChainWidget />,
  's3-ledger': () => <LedgerWidget />,
  's3-nature': () => <NatureWidget />,
  's3-read': () => <ReadWidget />,
}
