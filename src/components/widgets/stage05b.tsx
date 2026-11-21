import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Btns, Note, PlayBtn, Slider, useLoop, usePlaying, wheel, type WidgetMap } from './common'
import { PlanetAt } from '../PlanetGlyph'
import { ANGULARITY, DOMICILE, HOUSE_TOPICS, JOY, PLANET, type Planet } from '../../data/classical'
import { SIGNS } from '../../data/zodiac'
import {
  CLASSICAL, chartFacts, computeChart, cusps, houseOf, signIdx, signRuler, wholeHouse,
  type Birth, type Chart, type HouseSystem,
} from '../../lib/natal'

const CX = 170, CY = 136, ROUT = 112, RIN = 46
const norm = (x: number) => ((x % 360) + 360) % 360
const houseLon = (h: number) => (h - 1) * 30 + 15
const angName = (h: number) => ANGULARITY(h)
const angFill = (h: number) => ((h - 1) % 3 === 0 ? 'rgba(194,160,90,0.38)' : (h - 1) % 3 === 1 ? 'rgba(91,127,168,0.38)' : 'rgba(168,116,104,0.34)')
const joyOf = (h: number) => (Object.keys(JOY) as Planet[]).find((p) => JOY[p] === h)

function sector(h: number) {
  const a0 = (h - 1) * 30, a1 = h * 30
  const [x0, y0] = wheel(CX, CY, ROUT, a0)
  const [x1, y1] = wheel(CX, CY, ROUT, a1)
  const [u1, v1] = wheel(CX, CY, RIN, a1)
  const [u0, v0] = wheel(CX, CY, RIN, a0)
  return `M${u0} ${v0} L${x0} ${y0} A${ROUT} ${ROUT} 0 0 0 ${x1} ${y1} L${u1} ${v1} A${RIN} ${RIN} 0 0 1 ${u0} ${v0}`
}

function Axes() {
  const [e1, e2] = [wheel(CX, CY, ROUT, 0), wheel(CX, CY, ROUT, 180)]
  const [m1, m2] = [wheel(CX, CY, ROUT, 270), wheel(CX, CY, ROUT, 90)]
  return (
    <>
      <line x1={e1[0]} y1={e1[1]} x2={e2[0]} y2={e2[1]} stroke="rgba(246,241,228,0.45)" strokeWidth={1.4} />
      <line x1={m1[0]} y1={m1[1]} x2={m2[0]} y2={m2[1]} stroke="rgba(194,160,90,0.55)" strokeWidth={1.4} />
      <text x={e1[0] - 14} y={e1[1] + 4} fill="#f6f1e4" fontSize="11">东</text>
      <text x={e2[0] + 6} y={e2[1] + 4} fill="#f6f1e4" fontSize="11">西</text>
    </>
  )
}

function Dial({ active, onPick, fill, mark }: {
  active?: number
  onPick?: (h: number) => void
  fill?: (h: number) => string
  mark?: (h: number) => string
}) {
  return (
    <>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
        const [x, y] = wheel(CX, CY, 86, houseLon(h))
        const on = h === active
        return (
          <g key={h} onClick={() => onPick?.(h)} style={{ cursor: onPick ? 'pointer' : undefined }}>
            <path d={sector(h)} fill={fill?.(h) ?? 'rgba(246,241,228,0.05)'} stroke={on ? '#e6cf95' : 'rgba(246,241,228,0.16)'} strokeWidth={on ? 2.4 : 1} />
            <text x={x} y={y + 4} textAnchor="middle" fill={on ? '#e6cf95' : '#f6f1e4'} fontSize="13" fontFamily="var(--serif)">{mark?.(h) ?? h}</text>
          </g>
        )
      })}
      <Axes />
    </>
  )
}

const REL: { name: string; deg: number; see: boolean }[] = [
  { name: '起点', deg: 0, see: true }, { name: '不合意', deg: 30, see: false }, { name: '六分', deg: 60, see: true },
  { name: '四分', deg: 90, see: true }, { name: '三分', deg: 120, see: true }, { name: '不合意', deg: 150, see: false },
  { name: '对分', deg: 180, see: true }, { name: '不合意', deg: 150, see: false }, { name: '三分', deg: 120, see: true },
  { name: '四分', deg: 90, see: true }, { name: '六分', deg: 60, see: true }, { name: '不合意', deg: 30, see: false },
]

function AngularityWidget() {
  const [h, setH] = useState(1)
  const [play, setPlay] = usePlaying(false)
  const [t, setT] = useState(0.04)
  useLoop(play, (dt) => setT((v) => (v + dt * 0.05) % 1))
  const lon = norm(-t * 360)
  const here = Math.floor(lon / 30) + 1
  const [sx, sy] = wheel(CX, CY, 124, lon)
  return (
    <div className="wg">
      <Note>点一宫 · 金点顺时针走</Note>
      <svg className="wg-svg" viewBox="0 0 340 278">
        <Dial active={h} onPick={setH} fill={(n) => angFill(n)} />
        <motion.circle cx={sx} cy={sy} r={6} fill="#e6cf95" />
      </svg>
      <Slider label="一天" value={Math.round(t * 24 * 10) / 10} min={0} max={24} step={0.1} onChange={(v) => setT(v / 24)} fmt={(v) => `日出后 ${v.toFixed(1)} 时`} />
      <div className="wg-btns"><PlayBtn playing={play} set={setPlay} /></div>
      <div className="wg-read">
        <span>第 <b>{h}</b> 宫 · <b>{angName(h)}</b></span>
        <span>金点正在第 <b>{here}</b> 宫</span>
      </div>
      <div className="wg-cap">
        {angName(h) === '角宫' && '在轴上。传统认为这里最能推动事情。'}
        {angName(h) === '续宫' && '按每天的视运动，这颗星正在走向下一根轴。'}
        {angName(h) === '果宫' && '刚离开一根轴，正在退下。传统把这种离开叫果宫。'}
      </div>
    </div>
  )
}

function AversionWidget() {
  const [h, setH] = useState(8)
  const r = REL[h - 1]
  return (
    <div className="wg">
      <Note>相对第 1 宫</Note>
      <svg className="wg-svg" viewBox="0 0 340 278">
        <Dial active={h} onPick={setH} fill={(n) => (REL[n - 1].see ? 'rgba(143,191,154,0.32)' : 'rgba(196,99,63,0.32)')} />
      </svg>
      <div className="wg-read"><span>绿 = 看得见</span><span>赭 = 不合意</span></div>
      <div className="wg-cap">第 <b>{h}</b> 宫与第 1 宫：<b>{r.name}</b>{r.deg ? ` · ${r.deg}°` : ''}。{r.see ? '传统相位里算"看得到"。' : '30° 或 150°，五种相位都不收，叫不合意。'}</div>
    </div>
  )
}

const PLACE: Record<number, string> = {
  1: '地平线下，正要升起 → 身体与生命',
  12: '刚升起，在东方地平线之上 → 还贴着"出现"',
  10: '一天里最高的位置附近 → 行动与名声',
  7: '正在落下 → 对面的人',
  4: '在地下 → 根、家、看不见的基础',
}

function PlacesWidget() {
  const [play, setPlay] = usePlaying(false)
  const [t, setT] = useState(0)
  useLoop(play, (dt) => setT((v) => (v + dt * 0.045) % 1))
  const lon = norm(-t * 360)
  const h = Math.floor(lon / 30) + 1
  const [sx, sy] = wheel(CX, CY, 124, lon)
  return (
    <div className="wg">
      <Note>示意 · 日出定为 0</Note>
      <svg className="wg-svg" viewBox="0 0 340 278">
        <Dial fill={(n) => (n >= 7 ? 'rgba(91,127,168,0.22)' : 'rgba(20,16,28,0.55)')} mark={(n) => String(n)} active={h} />
        <circle cx={sx} cy={sy} r={7} fill="#e2b34f" />
      </svg>
      <Slider label="行程" value={Math.round(t * 24 * 10) / 10} min={0} max={24} step={0.1} onChange={(v) => setT(((v % 24) + 24) % 24 / 24)} fmt={(v) => `${v.toFixed(1)} 时`} />
      <div className="wg-btns"><PlayBtn playing={play} set={setPlay} /></div>
      <div className="wg-cap">金点在第 <b>{h}</b> 宫。{PLACE[h] ?? '这一宫的含义主要不靠高低，而靠它和第 1 宫的角度，或靠喜乐。'}</div>
    </div>
  )
}

function JoysWidget() {
  const [mode, setMode] = useState<'全部' | '光体' | '吉星' | '凶星' | '水星'>('全部')
  const show = (p: Planet) => mode === '全部' || (mode === '光体' && (p === 'sun' || p === 'moon')) || (mode === '吉星' && (p === 'jupiter' || p === 'venus')) || (mode === '凶星' && (p === 'saturn' || p === 'mars')) || (mode === '水星' && p === 'mercury')
  const pairs: [number, number][] = mode === '凶星' ? [[6, 12]] : mode === '吉星' ? [[5, 11]] : mode === '光体' ? [[3, 9]] : mode === '水星' ? [] : [[3, 9], [5, 11], [6, 12]]
  return (
    <div className="wg">
      <Note>喜乐 · 对宫成对</Note>
      <svg className="wg-svg" viewBox="0 0 340 278">
        <Dial fill={(h) => (joyOf(h) && show(joyOf(h)!) ? 'rgba(194,160,90,0.28)' : 'rgba(246,241,228,0.04)')} />
        {pairs.map(([a, b]) => {
          const [x0, y0] = wheel(CX, CY, 86, houseLon(a))
          const [x1, y1] = wheel(CX, CY, 86, houseLon(b))
          return <line key={`${a}-${b}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#c2a05a" strokeWidth={1.6} strokeDasharray="4 3" />
        })}
        {(Object.keys(JOY) as Planet[]).filter(show).map((p) => {
          const onHorizon = p === 'mercury'
          const [x, y] = wheel(CX, CY, onHorizon ? 78 : 64, onHorizon ? 0 : houseLon(JOY[p]))
          return <PlanetAt key={p} p={p} x={x} y={y} size={22} color={PLANET[p].color} />
        })}
      </svg>
      <Btns items={(['全部', '光体', '吉星', '凶星', '水星'] as const).map((m) => [m, m])} value={mode} onChange={setMode} />
      <div className="wg-cap">
        {mode === '光体' && '太阳在第 9 宫，月亮在第 3 宫，正对面。'}
        {mode === '吉星' && '木星在第 11，金星在第 5，正对面。'}
        {mode === '凶星' && '土星在第 12，火星在第 6，正对面。喜乐不等于吉利。'}
        {mode === '水星' && '水星昼夜都能算，站在地平线上的第 1 宫，不参加那三对。'}
        {mode === '全部' && '名单是传统。三对对称，是把名单和昼夜区分叠在一起看出来的。'}
      </div>
    </div>
  )
}

const DERIVED_PRESETS: [string, number, number][] = [['父亲的财产', 4, 2], ['伴侣的家', 7, 4], ['事业的对手', 10, 7]]

function DerivedWidget() {
  const [start, setStart] = useState(4)
  const [n, setN] = useState(2)
  const hit = ((start + n - 2) % 12) + 1
  return (
    <div className="wg">
      <Note>转宫 · 起点可旋转</Note>
      <svg className="wg-svg" viewBox="0 0 340 278">
        <Dial active={hit} onPick={(h) => { const dn = ((h - start + 12) % 12) + 1; setN(dn) }}
          fill={(h) => (h === start ? 'rgba(194,160,90,0.45)' : h === hit ? 'rgba(143,191,154,0.4)' : 'rgba(246,241,228,0.04)')}
          mark={(h) => String(((h - start + 12) % 12) + 1)} />
      </svg>
      <Slider label="新的第 1 宫" value={start} min={1} max={12} onChange={setStart} fmt={(v) => `原第 ${v} 宫`} />
      <Slider label="从它数第" value={n} min={1} max={12} onChange={setN} fmt={(v) => `${v} 宫`} />
      <div className="wg-btns">{DERIVED_PRESETS.map(([label, a, b]) => (
        <button key={label} className="wg-btn" onClick={() => { setStart(a); setN(b) }}>{label}</button>
      ))}</div>
      <div className="wg-cap">盘面数字是"从新起点重数"的号。金宫是新的第 1 宫，绿宫是数到的地方：原第 <b>{hit}</b> 宫。起点那一宫自己算第 1。</div>
    </div>
  )
}

function aspectTo1(h: number) {
  return REL[h - 1]
}

function TableWidget() {
  const [h, setH] = useState(1)
  const [open, setOpen] = useState(false)
  const joy = joyOf(h)
  const rel = aspectTo1(h)
  const place = PLACE[h]
  return (
    <div className="wg">
      <Note>先写，再对照</Note>
      <Slider label="宫" value={h} min={1} max={12} onChange={(v) => { setH(v); setOpen(false) }} />
      <div className="wg-read">
        <span>角续果 · <b>{angName(h)}</b></span>
        <span>与第 1 宫 · <b>{rel.name}</b>{rel.deg ? ` ${rel.deg}°` : ''}</span>
        <span>喜乐 · <b>{joy ? PLANET[joy].name : '无'}</b></span>
      </div>
      <div className="wg-cap">{place ?? '没有直接的高低象征。含义从相位、喜乐或后来的传统补上。'}</div>
      <div className="wg-btns"><button className="wg-btn on" onClick={() => setOpen((v) => !v)}>{open ? '先藏起传统宫义' : '我写完了，看传统宫义'}</button></div>
      {open && <div className="wg-cap">传统主题（希腊化）：<b>{HOUSE_TOPICS[h - 1]}</b></div>}
    </div>
  )
}

const MODERN = [
  '自我形象、对外的样子', '自我价值、个人资源', '沟通、近处的环境', '家庭、根源、安全感',
  '创造、恋爱、玩耍', '日常工作、健康习惯', '一对一的关系', '性、转化、共同资源、心理深层',
  '信念、远方、高等教育', '社会角色、事业形象', '团体、朋友、理想', '潜意识、隐藏、自我消解',
]

function LayersWidget() {
  const [h, setH] = useState(8)
  return (
    <div className="wg">
      <Note>两层并排 · 不是同一句话</Note>
      <Slider label="宫" value={h} min={1} max={12} onChange={setH} />
      <div className="wg-read">
        <span>古典 · <b>{HOUSE_TOPICS[h - 1]}</b></span>
      </div>
      <div className="wg-read">
        <span>现代心理占星常用 · <b>{MODERN[h - 1]}</b></span>
      </div>
      <div className="wg-cap">{h === 8 ? '第 8 宫最能看出加盖：死亡 → 别人的财物 → 性与转化。后两层不是前一层的翻译。' : '现代词是 20 世纪后常见的说法，各家用词不完全一样。'}</div>
    </div>
  )
}

function RulerWidget() {
  const [house, setHouse] = useState(10)
  const [sign, setSign] = useState(1)
  const [y, setY] = useState(7)
  const lord = DOMICILE[sign - 1]
  return (
    <div className="wg">
      <Note>传统主星</Note>
      <Slider label="哪一宫" value={house} min={1} max={12} onChange={setHouse} fmt={(v) => `第 ${v} 宫`} />
      <Slider label="宫头星座" value={sign} min={1} max={12} onChange={setSign} fmt={(v) => SIGNS[v - 1].name} />
      <Slider label="主星落在" value={y} min={1} max={12} onChange={setY} fmt={(v) => `第 ${v} 宫`} />
      <div className="wg-read">
        <span>承办人 · <b>{PLANET[lord].name}</b></span>
        <span>{SIGNS[sign - 1].name}的庙</span>
      </div>
      <svg className="wg-svg" viewBox="0 0 340 86">
        <PlanetAt p={lord} x={48} y={42} size={36} color={PLANET[lord].color} />
        <text x={78} y={38} fill="#f6f1e4" fontSize="14">第 {house} 宫 · {HOUSE_TOPICS[house - 1].split('、')[0]}</text>
        <text x={78} y={60} fill="#c2a05a" fontSize="14">通过第 {y} 宫 · {HOUSE_TOPICS[y - 1].split('、')[0]}</text>
      </svg>
      <div className="wg-cap">第 {house} 宫的事，通过第 {y} 宫的领域来办。状态还没看，这句话只完成了前半。</div>
    </div>
  )
}

const CONDS = ['入庙，状态强', '落陷，状态弱', '在角宫，能推动', '在果宫，像在退下', '逆行，传统当减弱']

function GenerateWidget() {
  const [x, setX] = useState(7)
  const [y, setY] = useState(10)
  const [c, setC] = useState(0)
  return (
    <div className="wg">
      <Note>现做 · 不背 144 句</Note>
      <Slider label="事情 X" value={x} min={1} max={12} onChange={setX} fmt={(v) => `第 ${v} 宫`} />
      <Slider label="落点 Y" value={y} min={1} max={12} onChange={setY} fmt={(v) => `第 ${v} 宫`} />
      <Btns items={CONDS.map((label, i) => [i, label.split('，')[0]] as [number, string])} value={c} onChange={setC} />
      <div className="wg-cap">第 <b>{x}</b> 宫（{HOUSE_TOPICS[x - 1]}）的事，通过第 <b>{y}</b> 宫（{HOUSE_TOPICS[y - 1]}）来办。承办人{CONDS[c]}。</div>
      <div className="wg-read"><span>宫位组合 <b>12 × 12 = 144</b></span><span>状态还会再往下分</span></div>
    </div>
  )
}

function LordWidget() {
  const [sign, setSign] = useState(4)
  const [day, setDay] = useState(true)
  const lord = DOMICILE[sign - 1]
  const sect: Planet = day ? 'sun' : 'moon'
  return (
    <div className="wg">
      <Note>两个职位</Note>
      <Slider label="上升" value={sign} min={1} max={12} onChange={setSign} fmt={(v) => SIGNS[v - 1].name} />
      <Btns items={[[true, '日生盘'], [false, '夜生盘']]} value={day} onChange={setDay} />
      <svg className="wg-svg" viewBox="0 0 340 120">
        <text x={40} y={28} fill="rgba(246,241,228,0.7)" fontSize="13">命主星</text>
        <PlanetAt p={lord} x={70} y={70} size={40} color={PLANET[lord].color} />
        <text x={100} y={66} fill="#f6f1e4" fontSize="15">{PLANET[lord].name}</text>
        <text x={100} y={88} fill="rgba(246,241,228,0.65)" fontSize="12">{SIGNS[sign - 1].name}的传统主星</text>
        <text x={210} y={28} fill="rgba(246,241,228,0.7)" fontSize="13">日夜主星</text>
        <PlanetAt p={sect} x={230} y={70} size={40} color={PLANET[sect].color} />
        <text x={258} y={74} fill="#f6f1e4" fontSize="15">{PLANET[sect].name}</text>
      </svg>
      <div className="wg-cap">{lord === sect ? '这张盘上，两个职位是同一颗星。换一个上升或换昼夜，常常就不是。' : `命主星是${PLANET[lord].name}，日夜主星是${PLANET[sect].name}。不要并成一个人。`}</div>
    </div>
  )
}

function AccidentalWidget() {
  const [ang, setAng] = useState<'角宫' | '续宫' | '果宫'>('角宫')
  const [joy, setJoy] = useState(false)
  const [speed, setSpeed] = useState<'快' | '平常' | '慢'>('平常')
  const [direct, setDirect] = useState(true)
  const [side, setSide] = useState<'东出' | '西入' | '不记'>('不记')
  const bits = [
    ang === '角宫' ? '在轴上，传统认为推得动' : ang === '续宫' ? '正在走向轴' : '正在从轴退下',
    joy ? '落在喜乐宫' : '不在喜乐宫',
    speed === '快' ? '比自己的平均速度更快' : speed === '慢' ? '比平均更慢' : '速度接近平均',
    direct ? '顺行' : '逆行，传统当减弱',
    side === '不记' ? '先不把东出西入算进去' : side,
  ]
  return (
    <div className="wg">
      <Note>只看处境 · 不打假分数</Note>
      <Btns items={[['角宫', '角宫'], ['续宫', '续宫'], ['果宫', '果宫']]} value={ang} onChange={setAng} />
      <Btns items={[[true, '在喜乐'], [false, '不在喜乐']]} value={joy} onChange={setJoy} />
      <Btns items={[['快', '偏快'], ['平常', '平常'], ['慢', '偏慢']]} value={speed} onChange={setSpeed} />
      <Btns items={[[true, '顺行'], [false, '逆行']]} value={direct} onChange={setDirect} />
      <Btns items={[['东出', '东出'], ['西入', '西入'], ['不记', '先不记']]} value={side} onChange={setSide} />
      <div className="wg-cap">{bits.join('；')}。</div>
      <div className="wg-read"><span>利利用整数给这些项打分</span><span>分数是<b>约定</b>，这里不显示总分</span></div>
    </div>
  )
}

const BIRTHS: Record<string, Birth & { title: string; note: string }> = {
  einstein: { title: '爱因斯坦', date: '1879-03-14', time: '11:30', tz: 10 / 15, lat: 48.4, lon: 10, place: '乌尔姆', note: 'AA · 地方平时 · 北纬 48.4° 东经 10.0°' },
  diana: { title: '戴安娜', date: '1961-07-01', time: '19:45', tz: 1, lat: 52.83, lon: 0.5, place: '桑德灵厄姆', note: 'A · 英国夏令时 · 北纬 52.83° 东经 0.50°' },
  diana14: { title: '戴安娜 · 另一记载', date: '1961-07-01', time: '14:00', tz: 1, lat: 52.83, lon: 0.5, place: '桑德灵厄姆', note: '订婚消息里出现过的 14:00，后来更正' },
  lin: { title: '示例盘 · 林晓', date: '1990-05-12', time: '08:30', tz: 8, lat: 39.9, lon: 116.4, place: '北京', note: '虚构人物 · 按北京标准时间 08:30' },
  linWall: { title: '林晓 · 若 08:30 是夏令时', date: '1990-05-12', time: '07:30', tz: 8, lat: 39.9, lon: 116.4, place: '北京', note: '墙上夏令时减 1 小时后的标准时' },
}

function chainOf(c: Chart) {
  const ascS = signIdx(c.asc)
  let sign = ((ascS - 1 + 9) % 12) + 1
  const lines: string[] = [`第 10 宫是${SIGNS[sign - 1].name}`]
  const seen = new Set<Planet>()
  for (let i = 0; i < 5; i++) {
    const lord = signRuler(sign)
    if (seen.has(lord)) { lines.push(`回到${PLANET[lord].name}，链闭合成环。`); break }
    const p = c.pos[lord]
    const hs = signIdx(p.lon)
    const house = wholeHouse(p.lon, c.asc)
    const own = signRuler(hs) === lord
    lines.push(`${PLANET[lord].name}在${SIGNS[hs - 1].name}、第 ${house} 宫${p.retro ? '，逆行' : ''}${own ? '，入庙' : ''}`)
    seen.add(lord)
    if (own) { lines.push('落在自己守护的星座，链在这里停。'); break }
    sign = hs
  }
  return lines
}

function ChartWidget({ who = 'einstein', showChain = true }: { who?: string; showChain?: boolean }) {
  const base = who in BIRTHS ? who : 'einstein'
  const [key, setKey] = useState(base)
  const [c, setC] = useState<Chart | null>(null)
  const [err, setErr] = useState('')
  const [pick, setPick] = useState<Planet>('sun')
  useEffect(() => { setKey(base) }, [base])
  useEffect(() => {
    let ok = true
    setC(null)
    computeChart(BIRTHS[key]).then((v) => { if (ok) setC(v) }).catch((e) => { if (ok) setErr(String(e)) })
    return () => { ok = false }
  }, [key])
  const b = BIRTHS[key]
  const alt = base === 'diana' ? (key === 'diana' ? 'diana14' : 'diana') : base === 'lin' ? (key === 'lin' ? 'linWall' : 'lin') : ''
  return (
    <div className="wg">
      <Note>整宫 · 天文算法</Note>
      <div className="wg-read"><span><b>{b.title}</b></span><span>{b.date} {b.time}</span><span>{b.place}</span></div>
      <div className="wg-cap">{b.note}</div>
      {alt && <div className="wg-btns"><button className="wg-btn" onClick={() => setKey(alt)}>{key === base ? '换另一个时间对照' : '回到本课用的时间'}</button></div>}
      {!c && <div className="wg-cap">{err || '计算中…'}</div>}
      {c && <ChartBody c={c} pick={pick} setPick={setPick} showChain={showChain} />}
    </div>
  )
}

function ChartBody({ c, pick, setPick, showChain }: { c: Chart; pick: Planet; setPick: (p: Planet) => void; showChain: boolean }) {
  const f = chartFacts(c, 'whole')
  const rows = f.rows.filter((r) => (CLASSICAL as string[]).includes(r.body))
  const row = rows.find((r) => r.body === pick)!
  const groups = new Map<number, typeof rows>()
  rows.forEach((r) => { const g = groups.get(r.house) ?? []; g.push(r); groups.set(r.house, g) })
  return (
    <>
      <svg className="wg-svg" viewBox="0 0 340 278">
        <Dial active={row.house} fill={(h) => angFill(h)} />
        {rows.map((r) => {
          const g = groups.get(r.house)!
          const i = g.indexOf(r)
          const lon = houseLon(r.house) + (i - (g.length - 1) / 2) * 8
          const [x, y] = wheel(CX, CY, 62, lon)
          return (
            <g key={r.body} onClick={() => setPick(r.body as Planet)} style={{ cursor: 'pointer' }}>
              <PlanetAt p={r.body as Planet} x={x} y={y} size={r.body === pick ? 26 : 18} color={PLANET[r.body as Planet].color} />
            </g>
          )
        })}
      </svg>
      <div className="wg-read">
        <span>上升 <b>{f.asc}</b></span>
        <span>天顶 <b>{f.mc}</b></span>
        <span>{f.sect}</span>
      </div>
      <div className="wg-btns">
        {rows.map((r) => (
          <button key={r.body} className={`wg-btn ${r.body === pick ? 'on' : ''}`} onClick={() => setPick(r.body as Planet)}>
            {r.name} 第{r.house}宫
          </button>
        ))}
      </div>
      <div className="wg-cap">
        {row.name}在{row.at}，第 <b>{row.house}</b> 宫（{ANGULARITY(row.house)}）{row.retro ? '，逆行' : ''}。
        {row.dig.length ? `本质：${row.dig.join('、')}。` : '本质尊贵表上没有庙、旺、陷、落。'}
        {f.ascLord === pick ? '这是命主星。' : ''}
      </div>
      {showChain && <div className="wg-cap">{chainOf(c).join(' → ')}</div>}
    </>
  )
}

function NoTimeWidget() {
  const [mode, setMode] = useState<'真盘' | '正午' | '太阳盘'>('真盘')
  const [real, setReal] = useState<Chart | null>(null)
  const [noon, setNoon] = useState<Chart | null>(null)
  useEffect(() => {
    let ok = true
    const place = { lat: 39.9, lon: 116.4 }
    computeChart({ date: '1990-05-12', time: '08:30', tz: 8, ...place }).then((v) => ok && setReal(v))
    computeChart({ date: '1990-05-12', time: '12:00', tz: 8, ...place }).then((v) => ok && setNoon(v))
    return () => { ok = false }
  }, [])
  const c = mode === '正午' ? noon : real
  if (!c) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const ascForHouse = mode === '太阳盘' ? c.pos.sun.lon : c.asc
  const label = (p: Planet) => `第 ${wholeHouse(c.pos[p].lon, ascForHouse)} 宫`
  return (
    <div className="wg">
      <Note>同一天 · 三种起法</Note>
      <Btns items={[['真盘', '真盘 08:30'], ['正午', '正午盘'], ['太阳盘', '太阳整宫']]} value={mode} onChange={setMode} />
      <div className="wg-read">
        <span>太阳 <b>{SIGNS[signIdx(c.pos.sun.lon) - 1].name}</b> · {label('sun')}</span>
        <span>月亮 <b>{SIGNS[signIdx(c.pos.moon.lon) - 1].name}</b> · {label('moon')}</span>
      </div>
      <div className="wg-cap">
        {mode === '真盘' && `上升 ${SIGNS[signIdx(c.asc) - 1].name}。这是有钟点才算得出来的。`}
        {mode === '正午' && '宫位属于中午 12:00，不属于一个未知的出生时刻。月亮和早上那张盘已经差了一截。'}
        {mode === '太阳盘' && '把太阳所在的星座当成第 1 宫。太阳自己一定在第 1 宫。这不是上升点。'}
      </div>
    </div>
  )
}

function useBirth(b: Birth) {
  const [c, setC] = useState<Chart | null>(null)
  useEffect(() => {
    let ok = true
    computeChart(b).then((v) => ok && setC(v))
    return () => { ok = false }
  }, [b.date, b.time, b.tz, b.lat, b.lon])
  return c
}

function ClocksWidget() {
  const dianaEve = useBirth(BIRTHS.diana)
  const dianaAft = useBirth(BIRTHS.diana14)
  const asStd = useBirth(BIRTHS.lin)
  const asDst = useBirth(BIRTHS.linWall)
  const asc = (c: Chart | null) => c ? `${SIGNS[signIdx(c.asc) - 1].name} ${Math.floor(norm(c.asc) % 30)}°` : '计算中…'
  return (
    <div className="wg">
      <Note>时间一变，上升就变</Note>
      <div className="wg-read"><span>戴安娜 19:45 · 上升 <b>{asc(dianaEve)}</b></span></div>
      <div className="wg-read"><span>若用 14:00 · 上升 <b>{asc(dianaAft)}</b></span></div>
      <div className="wg-read"><span>林晓按标准时 08:30 · 上升 <b>{asc(asStd)}</b></span></div>
      <div className="wg-read"><span>若 08:30 是夏令时、先减 1 小时 · 上升 <b>{asc(asDst)}</b></span></div>
      <div className="wg-cap">上升点跟宫位制无关。变的是钟点、时区，或经纬度。宫位制只改中间的宫头。</div>
    </div>
  )
}

function DayArcWidget() {
  const [minutes, setMinutes] = useState(12 * 60)
  const [sys, setSys] = useState<HouseSystem>('porphyry')
  const [c, setC] = useState<Chart | null>(null)
  useEffect(() => {
    let ok = true
    const t = setTimeout(() => {
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
      const mm = String(minutes % 60).padStart(2, '0')
      computeChart({ date: '2026-03-20', time: `${hh}:${mm}`, tz: 8, lat: 39.9, lon: 116.4 }).then((v) => ok && setC(v))
    }, 80)
    return () => { ok = false; clearTimeout(t) }
  }, [minutes])
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  let house = 0
  if (c) {
    if (sys === 'whole') house = wholeHouse(c.pos.sun.lon, c.asc)
    else house = houseOf(c.pos.sun.lon, cusps(c, 'porphyry')!)
  }
  return (
    <div className="wg">
      <Note>2026-03-20 北京 · 真实计算</Note>
      <Slider label="钟点" value={minutes} min={0} max={1435} step={5} onChange={setMinutes} fmt={() => `${hh}:${mm}`} />
      <Btns items={[['porphyry', '波菲利'], ['whole', '整宫']] as [HouseSystem, string][]} value={sys} onChange={setSys} />
      <div className="wg-btns">
        <button className="wg-btn" onClick={() => setMinutes(6 * 60 + 20)}>6:20</button>
        <button className="wg-btn" onClick={() => setMinutes(6 * 60 + 40)}>6:40</button>
        <button className="wg-btn" onClick={() => setMinutes(12 * 60)}>12:00</button>
        <button className="wg-btn" onClick={() => setMinutes(18 * 60 + 20)}>18:20</button>
        <button className="wg-btn" onClick={() => setMinutes(0)}>0:00</button>
      </div>
      {!c && <div className="wg-cap">计算中…</div>}
      {c && (
        <>
          <div className="wg-read">
            <span>太阳 <b>{SIGNS[signIdx(c.pos.sun.lon) - 1].name} {Math.floor(norm(c.pos.sun.lon) % 30)}°</b></span>
            <span>上升 <b>{SIGNS[signIdx(c.asc) - 1].name}</b></span>
            <span>天顶 <b>{SIGNS[signIdx(c.mc) - 1].name}</b></span>
            <span>太阳在第 <b>{house}</b> 宫</span>
          </div>
          <div className="wg-cap">{sys === 'whole' ? '整宫看星座：天顶所在的星座不一定是第 10 个。' : '波菲利把天顶放在第 10 宫宫头上。正午前后太阳多半在第 10 宫。'}</div>
        </>
      )}
    </div>
  )
}

const LAYERS: { name: string; tag: string; text: string }[] = [
  { name: '四轴', tag: '天文', text: '自转造成地平线和子午线。上升、天顶、下降、天底是它们和黄道的交点。天顶不是头顶正上方。' },
  { name: '宫位制', tag: '约定', text: '把这一圈切成十二份。整宫、等宫、波菲利、普拉西度、科赫、雷氏、坎帕纳斯切法不同。上升点本身不变。极圈附近普拉西度会算不出。' },
  { name: '宫义', tag: '传统', text: '角续果、与上升的相位、位置象征、喜乐，四条来源。2、6、8、12 不合意。转宫是把起点换一宫再数。' },
  { name: '宫主星', tag: '传统', text: '宫头星座的主星落在哪一宫，事情就通过那一宫来办。上升的主星是命主星。状态是另一层，不在 144 这个数里面背。' },
]

function MapWidget() {
  const [i, setI] = useState(0)
  const L = LAYERS[i]
  return (
    <div className="wg">
      <Note>四层叠在一张盘上</Note>
      <svg className="wg-svg" viewBox="0 0 340 168">
        {LAYERS.map((layer, k) => {
          const y = 24 + k * 36
          const on = k === i
          return (
            <g key={layer.name} onClick={() => setI(k)} style={{ cursor: 'pointer' }}>
              <rect x={24} y={y} width={292} height={30} rx={8} fill={on ? 'rgba(194,160,90,0.28)' : 'rgba(246,241,228,0.05)'} stroke={on ? '#c2a05a' : 'rgba(246,241,228,0.16)'} />
              <text x={40} y={y + 20} fill="#f6f1e4" fontSize="14">{k + 1} · {layer.name}</text>
              <text x={250} y={y + 20} fill="#c2a05a" fontSize="12">{layer.tag}</text>
            </g>
          )
        })}
      </svg>
      <div className="wg-cap"><b>{L.name}</b> · {L.text}</div>
    </div>
  )
}

export const W05B: WidgetMap = {
  's5b-angular': () => <AngularityWidget />,
  's5b-aversion': () => <AversionWidget />,
  's5b-places': () => <PlacesWidget />,
  's5b-joys': () => <JoysWidget />,
  's5b-derived': () => <DerivedWidget />,
  's5b-table': () => <TableWidget />,
  's5b-layers': () => <LayersWidget />,
  's5b-ruler': () => <RulerWidget />,
  's5b-generate': () => <GenerateWidget />,
  's5b-lord': () => <LordWidget />,
  's5b-accidental': () => <AccidentalWidget />,
  's5b-chart': (a) => <ChartWidget who={String(a.who ?? 'einstein')} showChain={a.showChain !== false} />,
  's5b-notime': () => <NoTimeWidget />,
  's5b-clocks': () => <ClocksWidget />,
  's5b-dayarc': () => <DayArcWidget />,
  's5b-map': () => <MapWidget />,
}
