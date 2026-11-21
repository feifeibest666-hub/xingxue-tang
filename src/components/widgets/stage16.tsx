import { useMemo, useState } from 'react'
import { Btns, Note, Slider, type WidgetMap } from './common'
import { GlyphAt } from '../Glyph'
import { SIGNS } from '../../data/zodiac'
import { getState, setNote, useStore } from '../../lib/store'

const GOLD = '#c2a05a', RED = '#e88a72', DIM = 'rgba(246,241,228,0.45)'

/** 二项分布：n 次、每次命中概率 p，恰好命中 k 次的概率 */
function binom(n: number, p: number) {
  const out: number[] = []
  let c = 1
  for (let k = 0; k <= n; k++) {
    if (k > 0) c = (c * (n - k + 1)) / k
    out.push(c * p ** k * (1 - p) ** (n - k))
  }
  return out
}

/* ── 随机命中有多常见（第 519、523、640、687 天） ──
   mode 'df'：每条预测有 k 种可选解释，只要一种对上就算"命中" → 有效命中率 1 − (1 − p)^k */
function ChanceWidget({ mode }: { mode?: string }) {
  const [n, setN] = useState(20)
  const [p, setP] = useState(50)
  const [th, setTh] = useState(70)
  const [k, setK] = useState(mode === 'df' ? 2 : 1)
  const pe = 1 - (1 - p / 100) ** k
  const dist = useMemo(() => binom(n, pe), [n, pe])
  const need = Math.ceil((th / 100) * n - 1e-9)
  const tail = dist.slice(need).reduce((a, b) => a + b, 0)
  const max = Math.max(...dist)
  const W = 320 / (n + 1)
  return (
    <div className="wg">
      <Note>纯猜测 · 不看盘</Note>
      <svg className="wg-svg" viewBox="0 0 340 150">
        {dist.map((v, i) => (
          <rect key={i} x={10 + i * W} y={120 - (v / max) * 100} width={Math.max(1, W - 1)} height={(v / max) * 100} fill={i >= need ? GOLD : 'rgba(246,241,228,0.25)'} />
        ))}
        <line x1={10 + need * W} y1={14} x2={10 + need * W} y2={122} stroke={RED} strokeDasharray="3 3" />
        <text x={10 + need * W + 4} y={24} fontSize="10" fill={RED}>≥ {th}%</text>
        <text x={10} y={138} fontSize="10" fill={DIM}>0 题</text>
        <text x={330} y={138} fontSize="10" fill={DIM} textAnchor="end">{n} 题全中</text>
      </svg>
      <Slider label="记录条数" value={n} min={5} max={100} onChange={setN} fmt={(v) => `${v} 条`} />
      <Slider label="基线" value={p} min={10} max={90} step={5} onChange={setP} fmt={(v) => `${v}%`} />
      <Slider label="命中线" value={th} min={50} max={95} step={5} onChange={setTh} fmt={(v) => `${v}%`} />
      {mode === 'df' && <Btns items={[[1, '1 种解释'], [2, '2 种'], [3, '3 种'], [4, '4 种']]} value={k} onChange={setK} />}
      <div className="wg-cap">
        {mode === 'df' && k > 1 && <>有 {k} 种可选解释时，每条的"命中"概率从 {p}% 升到 <b>{(pe * 100).toFixed(0)}%</b>。<br /></>}
        纯靠运气，{n} 条里命中 ≥ {th}%（至少 {need} 条）的概率是 <b>{(tail * 100).toFixed(1)}%</b>
      </div>
    </div>
  )
}

/** 把很小的概率写成百分数，避免 0.0% 把"很罕见"显示成零 */
function pct(x: number) {
  const v = x * 100
  if (v >= 10) return `${v.toFixed(1)}%`
  if (v >= 0.1) return `${v.toFixed(2)}%`
  if (v >= 0.01) return `${v.toFixed(3)}%`
  return '< 0.01%'
}

/* ── 巴纳姆 / 福勒：十二个星座，同一段话（第 628 天） ── */
const BARNUM = '你希望被喜欢，也会挑剔自己。你有些本事还没用上。外面看着挺稳，里面常常不安。你有时怀疑自己的决定。你喜欢一点变化，太被管着会烦。你觉得自己有主见。有时你爱热闹，有时你想躲开。被认可，和有安全感，对你都重要。'

function BarnumWidget() {
  const [sign, setSign] = useState(0)
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [open, setOpen] = useState(false)
  const rated = Object.values(ratings)
  const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null
  const name = sign ? SIGNS[sign - 1].name : ''
  return (
    <div className="wg">
      <Note>点任何一个星座</Note>
      <svg className="wg-svg" viewBox="0 0 340 58">
        {SIGNS.map((s) => {
          const x = 16 + (s.i - 1) * 28
          const on = sign === s.i
          return (
            <g key={s.i} onClick={() => setSign(s.i)} style={{ cursor: 'pointer' }}>
              <rect x={x - 13} y={1} width={26} height={56} rx={6} fill={on ? 'rgba(194,160,90,0.22)' : 'transparent'} />
              <GlyphAt i={s.i} x={x} y={20} size={22} color={on ? GOLD : '#f6f1e4'} />
              <text x={x} y={46} fontSize="9" textAnchor="middle" fill={on ? GOLD : DIM}>{s.short}</text>
            </g>
          )
        })}
      </svg>
      {sign === 0 && <div className="wg-cap">十二个星座，各看一段"专属"描述，再打分。</div>}
      {sign > 0 && (
        <>
          <div className="wg-cap" style={{ textAlign: 'left' }}>
            <b>{name}座的你</b><br />{BARNUM}
          </div>
          <div className="wg-row"><label>有多像我</label><span className="wg-v">0–5</span></div>
          <Btns items={[0, 1, 2, 3, 4, 5].map((n) => [n, String(n)] as [number, string])} value={ratings[sign] ?? -1} onChange={(n) => setRatings((r) => ({ ...r, [sign]: n }))} />
        </>
      )}
      {rated.length > 0 && !open && <div className="wg-btns"><button className="wg-btn" onClick={() => setOpen(true)}>揭晓</button></div>}
      {open && (
        <div className="wg-cap" style={{ textAlign: 'left' }}>
          标题换成了十二个星座，正文一个字都没变。你打了 {rated.length} 个星座{avg != null && <>，平均 <b>{avg.toFixed(2)}</b> 分</>}。
          <br />1949 年福勒让 39 名学生给同一段通用描述打分（0–5），平均 <b>4.26</b>。1956 年米尔把这种现象称为巴纳姆效应。觉得像，是因为句子两头都占，不是因为星座写对了你。你的人数和福勒不同，这里只是同一件事的演示。
        </div>
      )}
    </div>
  )
}

/* ── 卡尔森三选一：随机匹配 vs 40/116 vs 事先预期 ≥50%（第 625 天） ── */
function CarlsonWidget() {
  const [n, setN] = useState(116)
  const [trial, setTrial] = useState<number | null>(null)
  const p = 1 / 3
  const dist = useMemo(() => binom(n, p), [n])
  const mean = n * p
  const sd = Math.sqrt(n * p * (1 - p))
  const obs = (40 / 116) * n
  const half = n / 2
  const lo = Math.max(0, Math.floor(Math.min(mean - 3.8 * sd, obs)))
  const hi = Math.min(n, Math.ceil(Math.max(mean + 3.8 * sd, half)))
  const bins = hi - lo + 1
  const max = Math.max(...dist.slice(lo, hi + 1), 1e-12)
  const W = 300 / bins
  const xOf = (k: number) => 20 + (k - lo) * W
  const tailFrom = (k: number) => dist.slice(Math.ceil(k - 1e-9)).reduce((a, b) => a + b, 0)
  const draw = () => {
    let k = 0
    for (let i = 0; i < n; i++) if (Math.random() < p) k++
    setTrial(k)
  }
  return (
    <div className="wg">
      <Note>每张盘在三份档案里随机挑一份</Note>
      <svg className="wg-svg" viewBox="0 0 340 156">
        {dist.slice(lo, hi + 1).map((v, i) => {
          const k = lo + i
          const h = (v / max) * 96
          return <rect key={k} x={xOf(k)} y={118 - h} width={Math.max(1, W - 1)} height={h} fill={k + 0.5 >= half ? 'rgba(232,138,114,0.85)' : 'rgba(246,241,228,0.28)'} />
        })}
        <line x1={xOf(obs)} y1={14} x2={xOf(obs)} y2={118} stroke={GOLD} strokeDasharray="3 3" />
        <line x1={xOf(half)} y1={14} x2={xOf(half)} y2={118} stroke={RED} strokeDasharray="3 3" />
        <text x={xOf(obs) + 3} y={24} fontSize="10" fill={GOLD}>40/116</text>
        <text x={Math.min(250, xOf(half) + 3)} y={40} fontSize="10" fill={RED}>≥50%</text>
        {trial != null && trial >= lo && trial <= hi && <polygon points={`${xOf(trial) + W / 2 - 4},128 ${xOf(trial) + W / 2 + 4},128 ${xOf(trial) + W / 2},122`} fill={GOLD} />}
        <text x={20} y={146} fontSize="10" fill={DIM}>{lo} 张</text>
        <text x={320} y={146} fontSize="10" fill={DIM} textAnchor="end">{hi} 张</text>
      </svg>
      <Slider label="盘的张数" value={n} min={30} max={200} step={1} onChange={(v) => { setN(v); setTrial(null) }} fmt={(v) => `${v} 张`} />
      <div className="wg-btns"><button className="wg-btn" onClick={draw}>按随机猜测匹配一次</button></div>
      <table className="wg-table">
        <tbody>
          <tr><th>随机期望</th><td>约 {mean.toFixed(1)} 张（33%）</td></tr>
          <tr><th>卡尔森记录</th><td>第一选择 40/116，约 34%{n !== 116 && <>；按比例约在 {obs.toFixed(1)} 张</>}</td></tr>
          <tr><th>占星师事先预期</th><td>至少 50%{n === 116 ? '（至少 58 张）' : `（至少 ${Math.ceil(half - 1e-9)} 张）`}</td></tr>
          {trial != null && <tr><th>这一次随机</th><td>{trial} / {n}，{(100 * trial / n).toFixed(1)}%</td></tr>}
        </tbody>
      </table>
      <div className="wg-cap" style={{ textAlign: 'left' }}>
        纯随机时，第一选择达到"40/116 这个比例"或更高的概率是 <b>{pct(tailFrom(obs))}</b>，很常见。达到占星师自己预期的至少 50% 的概率是 <b>{pct(tailFrom(half))}</b>。
        {n !== 116 && <> 张数不是 116 时，金线红线按同一比例换算；文献里的次数仍是 40/116。</>}
      </div>
    </div>
  )
}

/* ── 时间双胞胎：相差几分钟，上升和月亮挪多少（第 627 天） ──
   上升取全天平均：360° / 24 时 = 15°/时 = 0.25°/分。月亮取课程里的平均数：约 13°/天。 */
const ASC_PER_MIN = 0.25
const MOON_PER_MIN = 13 / 1440

function TwinsWidget() {
  const [min, setMin] = useState(4.8)
  const asc = min * ASC_PER_MIN
  const moon = min * MOON_PER_MIN
  const px = (deg: number) => 118 + Math.min(deg, 30) * (190 / 30)
  return (
    <div className="wg">
      <Note>示意 · 上升用平均速度</Note>
      <svg className="wg-svg" viewBox="0 0 340 168">
        <circle cx={58} cy={58} r={40} fill="none" stroke="rgba(246,241,228,0.35)" />
        <line x1={18} y1={58} x2={98} y2={58} stroke="rgba(246,241,228,0.25)" />
        <text x={58} y={112} fontSize="10" textAnchor="middle" fill={DIM}>同一张盘 · 真实角度</text>
        <text x={58} y={16} fontSize="10" textAnchor="middle" fill={GOLD}>上升</text>
        {/* 两道上升刻度按真实角度画，几分钟内几乎重叠 */}
        {[0, asc].map((d, i) => {
          const a = (-90 + d) * Math.PI / 180
          const x2 = 58 + Math.cos(a) * 40
          const y2 = 58 + Math.sin(a) * 40
          return <line key={i} x1={58} y1={58} x2={x2} y2={y2} stroke={i ? RED : GOLD} strokeWidth={i ? 1.5 : 2} />
        })}
        <text x={130} y={18} fontSize="11" fill="#f6f1e4">和整整一个星座（30°）比</text>
        <text x={112} y={40} fontSize="10" fill={DIM}>上升</text>
        <line x1={118} y1={46} x2={308} y2={46} stroke="rgba(246,241,228,0.25)" />
        <line x1={118} y1={40} x2={118} y2={52} stroke={GOLD} />
        <line x1={px(asc)} y1={40} x2={px(asc)} y2={52} stroke={RED} />
        <text x={112} y={78} fontSize="10" fill={DIM}>月亮</text>
        <line x1={118} y1={84} x2={308} y2={84} stroke="rgba(246,241,228,0.25)" />
        <line x1={118} y1={78} x2={118} y2={90} stroke={GOLD} />
        <line x1={px(moon)} y1={78} x2={px(moon)} y2={90} stroke={RED} />
        <text x={308} y={62} fontSize="10" textAnchor="end" fill={DIM}>30°</text>
        <text x={118} y={128} fontSize="12" fill={GOLD}>上升约 {asc.toFixed(2)}°</text>
        <text x={118} y={146} fontSize="12" fill="#f6f1e4">月亮约 {moon.toFixed(3)}°</text>
      </svg>
      <Slider label="相差" value={min} min={0} max={60} step={0.2} onChange={setMin} fmt={(v) => `${v.toFixed(1)} 分钟`} />
      <div className="wg-cap" style={{ textAlign: 'left' }}>
        上升按平均 4 分钟约 1°（快升星座更快，慢升更慢）。月亮按大约每天 13°。相差几分钟，两张盘几乎一样。
        <br />Dean 与 Kelly（2003）：1958 年 3 月初在伦敦出生的 2101 人，约 110 项指标（11、16、23 岁），许多人只隔几分钟（平均约 4.8 分钟），没有发现超出随机的相似性。
      </div>
    </div>
  )
}

/* ── 预测日记：自由文字不能自动计分，用手工次数和二项尾部比基线（第 640 天） ── */
const JOURNAL_KEYS = ['d513-result', 'd514-result', 'd515-result', 'd517-journal']

function clampCount(n: number) {
  return Math.max(0, Math.min(40, Math.round(n) || 0))
}

function loadTally() {
  const blank = { hits: 0, partial: 0, misses: 0, base: 50, partialAsHit: false }
  try {
    const raw = getState().notes['d640-tally']
    if (!raw) return blank
    const p = JSON.parse(raw) as Partial<typeof blank>
    return {
      hits: clampCount(Number(p.hits)),
      partial: clampCount(Number(p.partial)),
      misses: clampCount(Number(p.misses)),
      base: Math.min(90, Math.max(10, Math.round(Number(p.base)) || 50)),
      partialAsHit: Boolean(p.partialAsHit),
    }
  } catch {
    return blank
  }
}

function JournalWidget() {
  const notes = useStore().notes
  const [tally, setTally] = useState(loadTally)
  const save = (next: typeof tally) => {
    setTally(next)
    setNote('d640-tally', JSON.stringify(next))
  }
  const snippets = [...JOURNAL_KEYS, ...Object.keys(notes)]
    .filter((k, i, arr) => arr.indexOf(k) === i && k !== 'd640-tally' && /result|journal|日记|预测/.test(k))
    .map((k) => ({ k, t: typeof notes[k] === 'string' ? notes[k].trim() : '' }))
    .filter((x) => x.t)
    .slice(0, 6)
  const { hits, partial, misses, base, partialAsHit } = tally
  const n = hits + partial + misses
  const k = hits + (partialAsHit ? partial : 0)
  const rate = n ? k / n : 0
  const p = base / 100
  const tail = n > 0 ? binom(n, p).slice(k).reduce((a, b) => a + b, 0) : 1
  const setNum = (key: 'hits' | 'partial' | 'misses', v: number) => save({ ...tally, [key]: clampCount(v) })
  return (
    <div className="wg">
      <Note>只存在这台设备上</Note>
      {snippets.length === 0 && <div className="wg-cap" style={{ textAlign: 'left' }}>还没有找到第 12 阶段的回填（如 d513-result）。那些是自由文字，本来就不能当成次数。下面用你自己点的数字来比。</div>}
      {snippets.length > 0 && (
        <div className="wg-cap" style={{ textAlign: 'left' }}>
          你写过的回填（原文，不自动判分）：
          {snippets.map((s) => <span key={s.k}><br />{s.k}：{s.t.slice(0, 72)}{s.t.length > 72 ? '…' : ''}</span>)}
        </div>
      )}
      {(['hits', 'partial', 'misses'] as const).map((key) => {
        const label = key === 'hits' ? '命中' : key === 'partial' ? '部分命中' : '落空'
        return (
          <div className="wg-row" key={key}>
            <label>{label}</label>
            <span className="wg-btns" style={{ marginTop: 0 }}>
              <button className="wg-btn" onClick={() => setNum(key, tally[key] - 1)}>−</button>
              <button className="wg-btn" onClick={() => setNum(key, tally[key] + 1)}>+</button>
            </span>
            <span className="wg-v">{tally[key]}</span>
          </div>
        )
      })}
      <Slider label="基线" value={base} min={10} max={90} step={5} onChange={(v) => save({ ...tally, base: v })} fmt={(v) => `${v}%`} />
      <Btns items={[[false, '部分不算命中'], [true, '部分算命中']]} value={partialAsHit} onChange={(v) => save({ ...tally, partialAsHit: v })} />
      <svg className="wg-svg" viewBox="0 0 340 72">
        <text x={8} y={16} fontSize="11" fill={DIM}>你的命中率</text>
        <rect x={78} y={6} width={240} height={12} fill="rgba(246,241,228,0.12)" />
        <rect x={78} y={6} width={240 * rate} height={12} fill={GOLD} />
        <text x={8} y={44} fontSize="11" fill={DIM}>基线</text>
        <rect x={78} y={34} width={240} height={12} fill="rgba(246,241,228,0.12)" />
        <rect x={78} y={34} width={240 * p} height={12} fill={RED} />
        <text x={8} y={66} fontSize="11" fill="#f6f1e4">{n ? `${k}/${n} = ${(rate * 100).toFixed(1)}%` : '还没有条目'}</text>
      </svg>
      <div className="wg-cap" style={{ textAlign: 'left' }}>
        {n === 0 && <>先填次数。部分命中要事先说好算不算；这里每项最多记 40。</>}
        {n > 0 && rate + 1e-9 < p && <>命中率 <b>{(rate * 100).toFixed(1)}%</b>，低于基线 {base}%。这不支持"比基线更准"。</>}
        {n > 0 && rate + 1e-9 >= p && <>命中 {k} / {n}（{(rate * 100).toFixed(1)}%）。若真实水平只是基线 {base}%，至少命中这么多的概率是 <b>{pct(tail)}</b>。这个数越小，越不像单靠基线。条数少的时候，它通常不会很小。</>}
        {n > 0 && !partialAsHit && partial > 0 && <><br />当前把部分命中算进总条数，但不算进命中。</>}
      </div>
    </div>
  )
}

export const W16: WidgetMap = {
  sChance: (a) => <ChanceWidget mode={a.mode as string | undefined} />,
  sBarnum: () => <BarnumWidget />,
  sCarlson: () => <CarlsonWidget />,
  sTwins: () => <TwinsWidget />,
  sJournal: () => <JournalWidget />,
}
