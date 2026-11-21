import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Btns, Note, PlayBtn, Slider, useLoop, usePlaying, wheel, type WidgetMap } from './common'
import { GlyphAt } from '../Glyph'
import { SIGNS, element, fmtLon, norm360 } from '../../data/zodiac'
import { BODY_NAME, CLASSICAL, chartAt, signIdx, signRuler, wholeHouse, type Chart } from '../../lib/natal'
import { useStore } from '../../lib/store'
import type { Planet } from '../../data/classical'

const GOLD = '#c2a05a', STAR = '#f6f1e4', DIM = 'rgba(246,241,228,0.45)', RED = '#e88a72', GREEN = '#8fbf9a', BLUE = '#8aa9b8'

/* ── 完成与阻碍：在"星座内度数"尺子上看谁先追上谁（第 486–490 天） ──
   卜卦里两颗行星在成相位的星座里，相位"完成"= 星座内度数相等。所以只看 0–30° 的度数尺就够了。 */
type P = { name: string; deg: number; speed: number; color: string; turn?: number; who: string }
type Scene = { label: string; ps: P[]; pairs: [number, number, string][]; story: (t: number) => string; days: number }
const SCENES: Record<string, Scene> = {
  apply: {
    label: '入相', days: 20,
    ps: [{ name: '月', deg: 8, speed: 13, color: GOLD, who: '问者（月亮）' }, { name: '金', deg: 20, speed: 1.1, color: GREEN, who: '所问之事（7 宫主）' }],
    pairs: [[0, 1, '月亮追上金星']],
    story: (t) => (t < 1 ? '快的月亮在 8°，慢的金星在 20°：快的在后面，正在"入相"。' : '追上了：两颗代表星的相位完成 → 事成。'),
  },
  translate: {
    label: '传递', days: 2,
    ps: [{ name: '土', deg: 12, speed: 0.05, color: BLUE, who: '问者（土星）' }, { name: '木', deg: 22, speed: 0.1, color: GREEN, who: '所问之事（木星）' }, { name: '月', deg: 13, speed: 13, color: GOLD, who: '第三方（月亮）' }],
    pairs: [[2, 1, '月亮把土星的光带给木星']],
    story: (t) => (t < 0.7 ? '土星与木星彼此不入相。月亮刚离开土星（13° > 12°），正奔向木星。' : '月亮追上木星：把土星的"光"传了过去 → 有中间人促成。'),
  },
  collect: {
    label: '集中', days: 20,
    ps: [{ name: '水', deg: 6, speed: 1.3, color: GOLD, who: '问者（水星）' }, { name: '金', deg: 9, speed: 1.1, color: GREEN, who: '所问之事（金星）' }, { name: '土', deg: 25, speed: 0.03, color: BLUE, who: '第三方（土星，最慢）' }],
    pairs: [[0, 2, '水星到土星'], [1, 2, '金星到土星']],
    story: (t) => (t < 15 ? '水星与金星互不相见（星座不合意）。两者都在追更慢的土星。' : '土星同时"收下"两者的光 → 一位更有分量的第三方把事情集中促成。'),
  },
  prohibit: {
    label: '禁止', days: 12,
    ps: [{ name: '金', deg: 10, speed: 1.2, color: GOLD, who: '问者（金星）' }, { name: '土', deg: 20, speed: 0.03, color: GREEN, who: '所问之事（土星）' }, { name: '火', deg: 15, speed: 0.75, color: RED, who: '第三方（火星）' }],
    pairs: [[2, 1, '火星先到土星'], [0, 1, '金星到土星']],
    story: (t) => (t < 6.9 ? '金星正追土星，但火星离土星更近。' : t < 8.5 ? '火星先和土星完成相位 → "禁止"：第三者截住了。' : '金星虽然随后也到了，传统认为事情已被火星代表的人或事打断。'),
  },
  refrain: {
    label: '反悔', days: 30,
    ps: [{ name: '水', deg: 12, speed: 1.2, color: GOLD, who: '问者（水星，将要留）', turn: 6 }, { name: '木', deg: 21, speed: 0.08, color: GREEN, who: '所问之事（木星）' }],
    pairs: [[0, 1, '水星到木星']],
    story: (t) => (t < 6 ? '水星向木星接近……' : t < 9 ? '水星在 15.6° 附近"留"住，速度降到 0。' : '水星转逆退回 → "反悔"：差一点完成，当事人改了主意或撤回。'),
  },
  frustrate: {
    label: '挫败', days: 14,
    ps: [{ name: '月', deg: 10, speed: 2.2, color: GOLD, who: '问者（快行星）' }, { name: '水', deg: 18, speed: 1.6, color: GREEN, who: '所问之事（水星）' }, { name: '土', deg: 24, speed: 0.03, color: BLUE, who: '另一颗（土星）' }],
    pairs: [[1, 2, '水星先到土星'], [0, 1, '快行星到水星']],
    story: (t) => (t < 3.8 ? '快行星在追水星，但水星自己正奔向土星。' : '水星先与土星完成 → "挫败"：被追的一方先投向了别人。'),
  },
}
const posAt = (p: P, t: number) => {
  if (p.turn == null) return p.deg + p.speed * t
  // 先减速到留，再以同样的方式退回
  const T = p.turn
  if (t <= T) return p.deg + p.speed * (t - (t * t) / (2 * T))
  const peak = p.deg + (p.speed * T) / 2
  const u = t - T
  return peak - (p.speed * 0.5 * u * u) / (2 * T) / (1 + u / T)
}
function firstHit(s: Scene, a: number, b: number) {
  const N = 2000
  let prev = posAt(s.ps[a], 0) - posAt(s.ps[b], 0)
  for (let k = 1; k <= N; k++) {
    const t = (k / N) * s.days
    const d = posAt(s.ps[a], t) - posAt(s.ps[b], t)
    if (Math.sign(d) !== Math.sign(prev) && prev !== 0) return t
    prev = d
  }
  return null
}
function PerfectionWidget({ mode }: { mode?: string }) {
  const [k, setK] = useState(mode && SCENES[mode] ? mode : 'apply')
  const s = SCENES[k]
  const [t, setT] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setT((x) => { const n = x + (dt * s.days) / 6; if (n >= s.days) { setPlaying(false); return s.days } return n }))
  const hits = s.pairs.map(([a, b, l]) => ({ l, at: firstHit(s, a, b) }))
  const X = (d: number) => 20 + (Math.max(0, Math.min(30, d)) / 30) * 300
  return (
    <div className="wg">
      <Note>星座内度数尺</Note>
      <Btns items={Object.entries(SCENES).map(([id, v]) => [id, v.label])} value={k} onChange={(v) => { setK(v); setT(0); setPlaying(false) }} />
      <svg className="wg-svg" viewBox="0 0 340 170">
        <line x1={20} y1={60} x2={320} y2={60} stroke="rgba(246,241,228,0.3)" />
        {[0, 5, 10, 15, 20, 25, 30].map((d) => <g key={d}><line x1={X(d)} y1={55} x2={X(d)} y2={65} stroke={DIM} /><text x={X(d)} y={80} fontSize="10" fill={DIM} textAnchor="middle">{d}°</text></g>)}
        {s.ps.map((p, i) => {
          const x = X(posAt(p, t))
          return (
            <g key={p.name}>
              <motion.circle cx={x} cy={60} r={11} fill="#141a2e" stroke={p.color} strokeWidth={2} animate={{ cx: x }} transition={{ duration: 0 }} />
              <text x={x} y={64.5} fontSize="12" textAnchor="middle" fill={p.color} fontFamily="var(--serif)">{p.name}</text>
              <text x={20} y={104 + i * 18} fontSize="11" fill={p.color}>{p.name} = {p.who}　{posAt(p, t).toFixed(1)}°</text>
            </g>
          )
        })}
      </svg>
      <Slider label="过了几天" value={t} min={0} max={s.days} step={s.days / 200} onChange={(v) => { setT(v); setPlaying(false) }} fmt={(v) => `${v.toFixed(1)} 天`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={(v) => { if (v && t >= s.days) setT(0); setPlaying(v) }} /></div>
      <div className="wg-read">{hits.map((h) => <span key={h.l}>{h.l}：<b>{h.at == null ? '不会完成' : `第 ${h.at.toFixed(1)} 天`}</b></span>)}</div>
      <div className="wg-cap">{s.story(t)}</div>
    </div>
  )
}

/* ── 判断前的考量（第 484–485 天） ── */
function ConsiderWidget() {
  const [asc, setAsc] = useState(1.5)
  const [moon, setMoon] = useState(205)
  const [sat, setSat] = useState<'other' | '1' | '7'>('other')
  const inVC = moon >= 195 && moon <= 225
  const checks: [boolean, string, string][] = [
    [asc < 3, `上升 ${asc.toFixed(1)}°：太早`, '问题"还没成熟"，或问者还没把情况弄清。'],
    [asc > 27, `上升 ${asc.toFixed(1)}°：太晚`, '事情已成定局，或问者已经知道答案。'],
    [inVC, `月亮 ${fmtLon(moon)}：在燃烧途径`, '天秤 15°–天蝎 15°，传统认为月亮在此"受伤"。'],
    [sat === '1', '土星在 1 宫', '有人说问者本身就是阻碍，或问题不够真诚。'],
    [sat === '7', '土星在 7 宫', '传统警告：占星师的判断可能出错。'],
  ]
  const on = checks.filter((c) => c[0])
  return (
    <div className="wg">
      <Note>警告不等于不能判</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        <circle cx={170} cy={110} r={92} fill="none" stroke="rgba(246,241,228,0.2)" />
        {(() => {
          const [x0, y0] = wheel(170, 110, 92, 195), [x1, y1] = wheel(170, 110, 92, 225)
          return <path d={`M${x0} ${y0} A92 92 0 0 0 ${x1} ${y1}`} stroke={RED} strokeWidth={10} fill="none" opacity={0.55} />
        })()}
        {SIGNS.map((g) => { const [x, y] = wheel(170, 110, 74, (g.i - 1) * 30 + 15); return <GlyphAt key={g.i} i={g.i} x={x} y={y} size={14} color={DIM} width={7} /> })}
        {(() => { const [x, y] = wheel(170, 110, 92, moon); return <g><circle cx={x} cy={y} r={10} fill="#141a2e" stroke={GOLD} strokeWidth={2} /><text x={x} y={y + 4} fontSize="11" textAnchor="middle" fill={GOLD}>月</text></g> })()}
        <text x={170} y={114} textAnchor="middle" fontSize="12" fill={inVC ? RED : STAR} fontFamily="var(--serif)">{inVC ? '燃烧途径' : fmtLon(moon)}</text>
      </svg>
      <Slider label="上升度数" value={asc} min={0} max={29.9} step={0.1} onChange={setAsc} fmt={(v) => `${v.toFixed(1)}°`} />
      <Slider label="月亮黄经" value={moon} min={0} max={359} onChange={setMoon} fmt={(v) => fmtLon(v)} />
      <Btns items={[['other', '土星在别处'], ['1', '土星在 1 宫'], ['7', '土星在 7 宫']]} value={sat} onChange={setSat} />
      <table className="wg-table"><tbody>{on.length ? on.map((c) => <tr key={c[1]}><td style={{ color: RED }}>{c[1]}</td><td>{c[2]}</td></tr>) : <tr><td>没有触发任何考量，可以进入判断。</td></tr>}</tbody></table>
      <div className="wg-cap">各家态度不同：李利列出这些"警告"，弗劳利等现代作者认为多数可以忽略。</div>
    </div>
  )
}

/* ── 月亮空亡（第 484 天）：离开本星座前还会不会完成任何托勒密相位 ── */
const PLANETS0: [string, number][] = [['日', 250], ['水', 236], ['金', 290], ['火', 140], ['木', 98], ['土', 352]]
const ASPECTS = [0, 60, 90, 120, 180]
const ASP_NAME: Record<number, string> = { 0: '合', 60: '六分', 90: '四分', 120: '三分', 180: '对分' }
function VoidWidget() {
  const [moon, setMoon] = useState(17)
  const sign = Math.floor(moon / 30)
  const rows = PLANETS0.map(([n, lon]) => {
    let best: { asp: number; at: number } | null = null
    for (const a of ASPECTS) for (const sgn of [1, -1]) {
      const target = norm360(lon + sgn * a)
      if (Math.floor(target / 30) !== sign) continue
      if (target > moon && (!best || target < best.at)) best = { asp: a, at: target }
    }
    return { n, lon, best }
  })
  const next = rows.filter((r) => r.best).sort((a, b) => a.best!.at - b.best!.at)[0]
  return (
    <div className="wg">
      <Note>其他行星暂视为不动</Note>
      <Slider label="月亮" value={moon} min={0} max={359.5} step={0.5} onChange={setMoon} fmt={(v) => fmtLon(v)} />
      <table className="wg-table">
        <thead><tr><th>行星</th><th>位置</th><th>月亮在本星座内会碰到</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.n}><td>{r.n}</td><td>{fmtLon(r.lon)}</td><td>{r.best ? <b>{ASP_NAME[r.best.asp]} @ {(r.best.at % 30).toFixed(1)}°</b> : '—'}</td></tr>)}</tbody>
      </table>
      <div className="wg-cap">{next ? <>月亮在 {SIGNS[sign].name}，下一个相位是与<b>{next.n}</b>的相位（{(next.best!.at % 30).toFixed(1)}°）：<b>不空亡</b></> : <>月亮在离开{SIGNS[sign].name}之前不再完成任何相位：<b style={{ color: RED }}>空亡</b></>}</div>
    </div>
  )
}

/* ── 转宫（第 481、505 天） ── */
const PEOPLE: [string, number][] = [['问者自己', 1], ['伴侣 / 对方', 7], ['母亲', 10], ['父亲', 4], ['孩子', 5], ['兄弟姊妹', 3], ['朋友', 11], ['上司', 10]]
const MATTERS: [string, number][] = [['本人', 1], ['钱财', 2], ['兄弟姊妹', 3], ['家 / 父亲', 4], ['孩子', 5], ['健康 / 下属', 6], ['伴侣', 7], ['远行', 9], ['事业 / 上司', 10], ['朋友', 11]]
const HOUSE_NAME = ['', '1 宫', '2 宫', '3 宫', '4 宫', '5 宫', '6 宫', '7 宫', '8 宫', '9 宫', '10 宫', '11 宫', '12 宫']
const turn = (base: number, m: number) => ((base - 1 + m - 1) % 12) + 1
function TurnedWidget() {
  const [p, setP] = useState(1)
  const [m, setM] = useState(1)
  const base = PEOPLE[p][1], mh = MATTERS[m][1], res = turn(base, mh)
  return (
    <div className="wg">
      <Note>从"那个人"的宫重新数</Note>
      <svg className="wg-svg" viewBox="0 0 340 250">
        {Array.from({ length: 12 }, (_, k) => {
          const h = k + 1
          const [x, y] = wheel(170, 125, 95, 180 + k * 30 + 15)
          const counted = ((h - base + 12) % 12) + 1
          const inPath = counted <= mh
          return (
            <g key={h}>
              <circle cx={x} cy={y} r={17} fill={h === res ? 'rgba(194,160,90,0.35)' : h === base ? 'rgba(143,191,154,0.25)' : 'rgba(246,241,228,0.04)'} stroke={h === res ? GOLD : h === base ? GREEN : 'rgba(246,241,228,0.2)'} />
              <text x={x} y={y - 1} fontSize="11" textAnchor="middle" fill={STAR}>{h}</text>
              {inPath && <text x={x} y={y + 11} fontSize="9" textAnchor="middle" fill={GOLD}>第{counted}</text>}
            </g>
          )
        })}
        <text x={170} y={120} textAnchor="middle" fontSize="13" fill={STAR} fontFamily="var(--serif)">{PEOPLE[p][0]}的{MATTERS[m][0]}</text>
        <text x={170} y={140} textAnchor="middle" fontSize="15" fill={GOLD} fontFamily="var(--serif)">= 原盘 {HOUSE_NAME[res]}</text>
      </svg>
      <div className="wg-row"><label>谁的</label><select value={p} onChange={(e) => setP(Number(e.target.value))}>{PEOPLE.map(([n], i) => <option key={n} value={i}>{n}</option>)}</select></div>
      <div className="wg-row"><label>什么事</label><select value={m} onChange={(e) => setM(Number(e.target.value))}>{MATTERS.map(([n], i) => <option key={n} value={i}>{n}</option>)}</select></div>
      <div className="wg-cap">公式：({base} − 1) + ({mh} − 1)，超过 12 减 12，再加 1 → <b>{res}</b>。这个人的宫算"第 1"。</div>
    </div>
  )
}

/* ── 时间判断：度数 × 单位（第 492 天） ── */
const UNITS = ['天', '周', '月', '年']
function TimingWidget() {
  const [deg, setDeg] = useState(4)
  const [mod, setMod] = useState<'开创' | '变动' | '固定'>('开创')
  const [house, setHouse] = useState<'角' | '续' | '果'>('角')
  const score = ['开创', '变动', '固定'].indexOf(mod) + ['角', '续', '果'].indexOf(house)
  const unit = UNITS[Math.min(3, Math.round((score * 3) / 4))]
  const alt = UNITS[Math.min(3, Math.round((score * 3) / 4) + 1)]
  return (
    <div className="wg">
      <Note>约定：换算表各家不同</Note>
      <Slider label="还差几度" value={deg} min={1} max={15} onChange={setDeg} fmt={(v) => `${v}°`} />
      <Btns items={[['开创', '开创星座（快）'], ['变动', '变动星座（中）'], ['固定', '固定星座（慢）']]} value={mod} onChange={setMod} />
      <Btns items={[['角', '角宫（快）'], ['续', '续宫（中）'], ['果', '果宫（慢）']]} value={house} onChange={setHouse} />
      <svg className="wg-svg" viewBox="0 0 340 70">
        {Array.from({ length: 15 }, (_, k) => <rect key={k} x={10 + k * 21} y={20} width={18} height={22} rx={4} fill={k < deg ? 'rgba(194,160,90,0.55)' : 'rgba(246,241,228,0.06)'} />)}
        <text x={170} y={62} textAnchor="middle" fontSize="12" fill={DIM}>每一格 = 1 {unit}</text>
      </svg>
      <div className="wg-cap">{deg}° × 1 {unit} ≈ <b>{deg} {unit}</b>（若和其他线索冲突，可考虑 {deg} {alt}）</div>
    </div>
  )
}

/* ── 方位：宫位与元素（第 493–494 天） ── */
const HOUSE_DIR = ['东', '东北偏东', '东北偏北', '北', '西北偏北', '西北偏西', '西', '西南偏西', '西南偏南', '南', '东南偏南', '东南偏东']
const ELEM_DIR: Record<string, string> = { 火: '东', 土: '南', 风: '西', 水: '北' }
function CompassWidget() {
  const [h, setH] = useState(2)
  const [s, setS] = useState(4)
  const el = element(s)
  return (
    <div className="wg">
      <Note>星盘上：上升 = 东，天顶 = 南</Note>
      <svg className="wg-svg" viewBox="0 0 340 250">
        {Array.from({ length: 12 }, (_, k) => {
          const [x, y] = wheel(170, 125, 90, 180 + k * 30 + 15)
          return <g key={k} onClick={() => setH(k + 1)} style={{ cursor: 'pointer' }}><circle cx={x} cy={y} r={16} fill={h === k + 1 ? 'rgba(194,160,90,0.35)' : 'rgba(246,241,228,0.04)'} stroke={h === k + 1 ? GOLD : 'rgba(246,241,228,0.2)'} /><text x={x} y={y + 4} fontSize="11" textAnchor="middle" fill={STAR}>{k + 1}</text></g>
        })}
        <text x={30} y={129} fontSize="13" fill={GOLD}>东</text><text x={300} y={129} fontSize="13" fill={GOLD}>西</text>
        <text x={163} y={22} fontSize="13" fill={GOLD}>南</text><text x={163} y={244} fontSize="13" fill={GOLD}>北</text>
        <text x={170} y={129} textAnchor="middle" fontSize="13" fill={STAR} fontFamily="var(--serif)">{h} 宫 → {HOUSE_DIR[h - 1]}</text>
      </svg>
      <div className="wg-row"><label>所在星座</label><select value={s} onChange={(e) => setS(Number(e.target.value))}>{SIGNS.map((g) => <option key={g.i} value={g.i}>{g.name}（{element(g.i)}）</option>)}</select></div>
      <div className="wg-cap">宫位给 <b>{HOUSE_DIR[h - 1]}</b>，星座元素给 <b>{ELEM_DIR[el]}</b>。两者不一致时，各家取舍不同（约定）。</div>
    </div>
  )
}

/* ── 代表星速查（第 480–482 天） ── */
const ASKS: [string, number, string][] = [
  ['我能拿回借出去的钱吗？', 2, '钱 = 2 宫；但"借给对方的钱" = 对方（7 宫）的钱 = 8 宫'],
  ['这次面试能成功吗？', 10, '职位、事业 = 10 宫'],
  ['他喜欢我吗？', 7, '对方 = 7 宫'],
  ['我能考上研究生吗？', 9, '高等教育 = 9 宫'],
  ['要不要搬家？', 4, '房子、住处 = 4 宫'],
  ['我丢的钥匙在哪？', 2, '可移动的财物 = 2 宫'],
  ['我哥哥的工作会顺利吗？', 12, '哥哥 3 宫 → 他的事业 = 3 起第 10 = 12 宫'],
  ['这个朋友靠得住吗？', 11, '朋友 = 11 宫'],
]
function SignificatorWidget() {
  const [i, setI] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const [, , ex] = ASKS[i]
  const right = ASKS[i][1]
  const alt = i === 0 ? 8 : null
  const ok = pick != null && (pick === right || pick === alt)
  return (
    <div className="wg">
      <Note>{i + 1} / {ASKS.length}</Note>
      <div className="wg-cap" style={{ minHeight: 44 }}>「{ASKS[i][0]}」</div>
      <div className="wg-btns" style={{ justifyContent: 'center' }}>{Array.from({ length: 12 }, (_, k) => <button key={k} className={`wg-btn ${pick === k + 1 ? 'on' : ''}`} onClick={() => setPick(k + 1)}>{k + 1}</button>)}</div>
      <div className="wg-cap">{pick == null ? '所问之事在几宫？' : ok ? <>对：{ex}。代表星 = 该宫宫头星座的主星；问者 = 上升主星 + 月亮。</> : <span style={{ color: RED }}>再想想：{ex}</span>}</div>
      <div className="wg-btns" style={{ justifyContent: 'center' }}><button className="wg-btn" onClick={() => { setI((i + 1) % ASKS.length); setPick(null) }}>下一题 ›</button></div>
    </div>
  )
}

/* ── 是否盘速判（第 489 天）：只看完成与否 ── */
function YesNoWidget() {
  const cases = useMemo(() => [
    { f: '问者：月亮 白羊 5°（快）；所问：木星 狮子 9°（慢）。', a: 0, ex: '白羊–狮子三分；月亮 5° 在后、正追 9° 的木星 → 入相，会完成。' },
    { f: '问者：金星 双子 20°；所问：土星 天秤 12°；金星更快。', a: 1, ex: '双子–天秤三分，但金星 20° 已超过 12° → 离相，已经过去，不会完成。' },
    { f: '问者：水星 金牛 8°；所问：火星 狮子 10°；中间无他星，水星更快。', a: 0, ex: '金牛–狮子四分；水星 8° 追 10° → 会完成，但四分 = 有困难的完成。' },
    { f: '问者：月亮 处女 25°；所问：木星 白羊 27°；月亮更快。', a: 1, ex: '处女与白羊相隔 5 个星座（不合意，无托勒密相位）→ 不构成相位，不会以入相完成。' },
    { f: '问者：太阳 摩羯 3°；所问：土星 摩羯 9°；太阳更快，土星 7° 处无他星。', a: 0, ex: '同星座合相，太阳 3° 追 9° → 会完成（还要看燃烧等状态）。' },
    { f: '问者：金星 双鱼 11°；所问：土星 巨蟹 18°；火星 天蝎 17° 正追土星；金星、火星都比土星快。', a: 1, ex: '金星要走 7°，火星只差 1° → 火星先和土星完成三分 → 禁止。' },
  ], [])
  const [i, setI] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const c = cases[i]
  return (
    <div className="wg">
      <Note>{i + 1} / {cases.length}</Note>
      <div className="wg-cap" style={{ minHeight: 60, fontSize: 14 }}>{c.f}</div>
      <Btns items={[[0, '会完成'], [1, '不会完成 / 被阻']]} value={pick ?? -1} onChange={setPick} />
      {pick != null && <div className="wg-cap" style={{ color: pick === c.a ? GREEN : RED }}>{pick === c.a ? '对。' : '不对。'}{c.ex}</div>}
      <div className="wg-btns"><button className="wg-btn" onClick={() => { setI((i + 1) % cases.length); setPick(null) }}>下一张 ›</button></div>
    </div>
  )
}

/* ── 此刻起卦：自动列出代表星与判断前考量（第 512–515 天） ── */
const ASP_T: [number, string][] = [[0, '合'], [60, '六分'], [90, '四分'], [120, '三分'], [180, '对分'], [240, '三分'], [270, '四分'], [300, '六分']]
/** 月亮在离开本星座前完成的下一个相位（其他行星按当前速度线性外推） */
export function moonNext(c: Chart) {
  const m = c.pos.moon
  const exit = (30 - (m.lon % 30)) / m.speed
  let best: { p: Planet; name: string; t: number } | null = null
  for (const p of CLASSICAL) {
    if (p === 'moon') continue
    const q = c.pos[p], rel = m.speed - q.speed
    const f0 = norm360(m.lon - q.lon)
    for (const [T, name] of ASP_T) {
      const t = norm360(T - f0) / rel
      if (t > 1e-6 && t < exit && (!best || t < best.t)) best = { p, name, t }
    }
  }
  return { exit, best }
}
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
function HoraryNowWidget() {
  const st = useStore()
  const { lat, lon, place } = st.settings
  const [when, setWhen] = useState(() => localInput(new Date()))
  const [c, setC] = useState<Chart | null>(null)
  useEffect(() => { let ok = true; chartAt(new Date(when), lat, lon).then((x) => ok && setC(x)); return () => { ok = false } }, [when, lat, lon])
  if (!c) return <div className="wg"><div className="wg-cap">正在起盘……</div></div>
  const ascDeg = c.asc % 30
  const lord = signRuler(signIdx(c.asc))
  const mn = moonNext(c)
  const satH = wholeHouse(c.pos.saturn.lon, c.asc)
  const warn: [boolean, string][] = [
    [ascDeg < 3, `上升 ${ascDeg.toFixed(1)}°：太早`],
    [ascDeg > 27, `上升 ${ascDeg.toFixed(1)}°：太晚`],
    [!mn.best, '月亮空亡（离开本星座前无相位）'],
    [c.pos.moon.lon >= 195 && c.pos.moon.lon <= 225, '月亮在燃烧途径'],
    [satH === 1 || satH === 7, `土星在 ${satH} 宫`],
  ]
  return (
    <div className="wg">
      <Note>整宫制 · {place}</Note>
      <div className="wg-row"><label>起盘时刻</label><input type="datetime-local" value={when} onChange={(e) => e.target.value && setWhen(e.target.value)} /></div>
      <div className="wg-btns"><button className="wg-btn" onClick={() => setWhen(localInput(new Date()))}>此刻</button></div>
      <table className="wg-table"><tbody>
        <tr><th>上升</th><td>{fmtLon(c.asc)}</td></tr>
        <tr><th>问者（上升主）</th><td>{BODY_NAME[lord]} {fmtLon(c.pos[lord].lon)}{c.pos[lord].retro ? ' 逆' : ''}，{wholeHouse(c.pos[lord].lon, c.asc)} 宫</td></tr>
        <tr><th>月亮</th><td>{fmtLon(c.pos.moon.lon)}，{wholeHouse(c.pos.moon.lon, c.asc)} 宫</td></tr>
        <tr><th>月亮下一个相位</th><td>{mn.best ? `${mn.best.name}${BODY_NAME[mn.best.p]}（约 ${(mn.best.t * 24).toFixed(0)} 小时后）` : '无（空亡）'}</td></tr>
        {Array.from({ length: 12 }, (_, k) => k + 1).filter((h) => [2, 7, 10].includes(h)).map((h) => {
          const sg = ((signIdx(c.asc) - 1 + h - 1) % 12) + 1, r = signRuler(sg)
          return <tr key={h}><th>{h} 宫主</th><td>{SIGNS[sg - 1].name} → {BODY_NAME[r]} {fmtLon(c.pos[r].lon)}</td></tr>
        })}
      </tbody></table>
      <div className="wg-read">{warn.filter((w) => w[0]).map((w) => <span key={w[1]} style={{ color: RED }}>⚠ {w[1]}</span>)}{!warn.some((w) => w[0]) && <span>没有触发判断前考量</span>}</div>
      <div className="wg-cap">地点取自「设置」。这是真实星历算出的盘；盘和答案的关系是卜卦的假设。</div>
    </div>
  )
}

export const W12: WidgetMap = {
  hNow: () => <HoraryNowWidget />,
  hPerfect: (a) => <PerfectionWidget mode={a.mode as string | undefined} />,
  hConsider: () => <ConsiderWidget />,
  hVoid: () => <VoidWidget />,
  hTurned: () => <TurnedWidget />,
  hTiming: () => <TimingWidget />,
  hCompass: () => <CompassWidget />,
  hSignif: () => <SignificatorWidget />,
  hYesNo: () => <YesNoWidget />,
}
