import { useMemo, useState } from 'react'
import { Glyph } from '../Glyph'
import { SIGNS } from '../../data/zodiac'
import { getState, setNote } from '../../lib/store'
import { Btns, Note, Slider, type WidgetMap } from './common'

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

const tailFrom = (dist: number[], k: number) => dist.slice(Math.max(0, Math.min(k, dist.length))).reduce((a, b) => a + b, 0)
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
/** 大概率用一位小数；很小的尾部保留三位，避免把 0.015% 写成 0 */
const pctTail = (x: number) => {
  const v = x * 100
  if (v >= 0.1) return `${v.toFixed(1)}%`
  if (v <= 0) return '0%'
  return `${v.toFixed(3)}%`
}

/* ── 巴纳姆 / 福勒：十二个星座，同一段话（第 628 天） ── */
const BARNUM = '你外表上挺能应付事情，心里却常常觉得自己还可以更好。你喜欢和人在一起，也需要独处的时间。你有一些能力，还没有完全用出来。你看重真诚，不喜欢被安排；同时你在意别人怎么看你。你有时会犹豫，一旦决定又很认真。你希望生活有些变化，也希望有人真正懂你。'

function BarnumWidget() {
  const [sign, setSign] = useState<number | null>(null)
  const [ratings, setRatings] = useState<(number | null)[]>(() => Array(12).fill(null))
  const [open, setOpen] = useState(false)
  const rated = ratings.filter((r) => r != null).length
  const cur = sign == null ? null : SIGNS[sign - 1]
  return (
    <div className="wg">
      <Note>同一段话</Note>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {SIGNS.map((s) => (
          <button key={s.i} type="button" className={`wg-btn ${sign === s.i ? 'on' : ''}`} onClick={() => setSign(s.i)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 12, padding: '6px 2px' }}>
            <Glyph i={s.i} size={22} color="currentColor" />
            <span style={{ fontSize: 12, marginTop: 2 }}>{s.name}</span>
          </button>
        ))}
      </div>
      {!cur && <div className="wg-cap">点一个星座，读下面的话，再打分。</div>}
      {cur && (
        <>
          <div className="wg-cap" style={{ textAlign: 'left' }}><b>{cur.name}</b>的性格素描</div>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.75, margin: '6px 0 8px' }}>{BARNUM}</p>
          <div className="wg-row"><label>有多像我</label></div>
          <Btns items={[0, 1, 2, 3, 4, 5].map((n) => [n, String(n)] as [number, string])} value={ratings[cur.i - 1] ?? -1}
            onChange={(n) => setRatings((rs) => rs.map((r, i) => (i === cur.i - 1 ? n : r)))} />
        </>
      )}
      {rated > 0 && !open && <div className="wg-btns"><button type="button" className="wg-btn on" onClick={() => setOpen(true)}>揭晓</button></div>}
      {open && (
        <div className="wg-cap" style={{ textAlign: 'left' }}>
          十二个星座下面是<b>同一段话</b>（{BARNUM.length} 个字，一个字都没换）。1949 年福勒让 39 名心理学学生给同一段笼统描述打分，0 到 5 分，平均 <b>4.26</b>。1956 年米尔把这种“谁看了都像在说自己”叫做巴纳姆效应。上面这段是用来体验的，不是福勒的原文。
          {rated > 0 && <> 你给 {rated} 个星座打了分{ratings.filter((r) => r != null).every((r) => (r ?? 0) >= 4) ? '，而且都不少于 4 分。' : '。打得高或低都可以：4.26 是那 39 人的平均，不是每一个人。'}</>}
        </div>
      )}
      {open && rated > 0 && (
        <div className="wg-read">
          {SIGNS.map((s, i) => (ratings[i] == null ? null : <span key={s.i}>{s.name} <b>{ratings[i]}</b></span>))}
        </div>
      )}
    </div>
  )
}

/* ── Carlson 三选一（第 625 天）── 每次在三份里随机选一份，对照 40/116 与事先预期的 ≥50% ── */
function CarlsonWidget() {
  const [n, setN] = useState(116)
  const [one, setOne] = useState<{ pick: number; hit: boolean } | null>(null)
  const [runK, setRunK] = useState<number | null>(null)
  const dist = useMemo(() => binom(n, 1 / 3), [n])
  const max = Math.max(...dist)
  const W = 320 / (n + 1)
  const kObs = Math.round(n * 40 / 116)
  const kHalf = Math.ceil(n * 0.5 - 1e-9)
  const mean = n / 3
  const drawOne = () => {
    const correct = Math.floor(Math.random() * 3)
    const pick = Math.floor(Math.random() * 3)
    setOne({ pick, hit: pick === correct })
  }
  const runAll = () => {
    let k = 0
    for (let i = 0; i < n; i++) if (Math.floor(Math.random() * 3) === 0) k++
    setRunK(k)
  }
  const lx = (k: number) => Math.min(268, 12 + k * W)
  return (
    <div className="wg">
      <Note>每次 1/3 · 纯随机</Note>
      <div className="wg-read">三份性格档案，只有一份是本人的。随机点一份：</div>
      <div className="wg-btns">
        {['甲', '乙', '丙'].map((name, i) => (
          <span key={name} className={`wg-btn ${one?.pick === i ? 'on' : ''}`}>{name}{one?.pick === i ? (one.hit ? ' · 中' : ' · 未中') : ''}</span>
        ))}
      </div>
      <div className="wg-btns">
        <button type="button" className="wg-btn" onClick={drawOne}>随机抽一份</button>
        <button type="button" className="wg-btn" onClick={runAll}>一次模拟 {n} 张</button>
      </div>
      <svg className="wg-svg" viewBox="0 0 340 150">
        {dist.map((v, i) => (
          <rect key={i} x={10 + i * W} y={120 - (v / max) * 100} width={Math.max(1, W - 1)} height={(v / max) * 100}
            fill={i >= kHalf ? RED : i === kObs ? GOLD : 'rgba(246,241,228,0.25)'} />
        ))}
        <line x1={10 + kObs * W} y1={8} x2={10 + kObs * W} y2={122} stroke={GOLD} strokeDasharray="3 3" />
        <line x1={10 + kHalf * W} y1={8} x2={10 + kHalf * W} y2={122} stroke={RED} strokeDasharray="3 3" />
        <text x={lx(kObs)} y={18} fontSize="10" fill={GOLD}>{n === 116 ? '40 张' : `${kObs} 张`} · 约 34%</text>
        <text x={lx(kHalf)} y={32} fontSize="10" fill={RED}>≥ 50%</text>
        {runK != null && <circle cx={10 + runK * W + Math.max(1, W - 1) / 2} cy={120 - (dist[runK] / max) * 100 - 4} r={3.2} fill="#f6f1e4" />}
        <text x={10} y={138} fontSize="10" fill={DIM}>0 张</text>
        <text x={330} y={138} fontSize="10" fill={DIM} textAnchor="end">{n} 张全中</text>
      </svg>
      <Slider label="盘数" value={n} min={12} max={116} onChange={(v) => { setN(v); setRunK(null) }} fmt={(v) => `${v} 张`} />
      <div className="wg-cap">
        随机期望约 <b>{mean.toFixed(1)}</b> 张。Carlson 观察到 40/116（约 34%）；占星师事先预期至少一半。
        按每次 1/3，达到或超过这条 34% 线的概率约 <b>{pctTail(tailFrom(dist, kObs))}</b>，
        达到或超过 50% 的概率约 <b>{pctTail(tailFrom(dist, kHalf))}</b>。
        {runK != null && <><br />这一轮随机中了 <b>{runK}</b> / {n}（{pct1(runK / n)}）。</>}
      </div>
    </div>
  )
}

/* ── 时间双胞胎：相隔几分钟，上升和月亮挪多少（第 627 天） ──
   上升按平均每 4 分钟 1°；月亮按每天约 13°。都是课程里用过的大约值。 */
function TwinsWidget() {
  const [minutes, setMinutes] = useState(4.8)
  const asc = minutes / 4
  const moon = minutes * 13 / 1440
  const x0 = 36
  const scale = 260 / 30
  const mark = (deg: number) => x0 + deg * scale
  return (
    <div className="wg">
      <Note>平均速度 · 示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 168">
        {[['上升', asc, 48], ['月亮', moon, 112]].map(([label, deg, y]) => {
          const d = deg as number
          const yy = y as number
          return (
            <g key={label as string}>
              <text x={8} y={yy - 16} fontSize="12" fill={GOLD}>{label as string}</text>
              <line x1={x0} y1={yy} x2={x0 + 260} y2={yy} stroke="rgba(246,241,228,0.25)" />
              <text x={x0} y={yy + 16} fontSize="10" fill={DIM}>0°</text>
              <text x={x0 + 260} y={yy + 16} fontSize="10" fill={DIM} textAnchor="end">30°</text>
              <circle cx={mark(0)} cy={yy} r={5} fill="#f6f1e4" />
              <circle cx={mark(Math.min(30, d))} cy={yy} r={5} fill={GOLD} />
            </g>
          )
        })}
      </svg>
      <Slider label="相隔" value={minutes} min={0} max={60} step={0.1} onChange={setMinutes} fmt={(v) => `${v.toFixed(1)} 分钟`} />
      <div className="wg-btns">
        <button type="button" className={`wg-btn ${Math.abs(minutes - 4.8) < 0.05 ? 'on' : ''}`} onClick={() => setMinutes(4.8)}>研究里的平均 4.8 分钟</button>
      </div>
      <div className="wg-read">
        <span>上升约 <b>{asc.toFixed(2)}°</b></span>
        <span>月亮约 <b>{moon.toFixed(3)}°</b></span>
      </div>
      <div className="wg-cap">
        {minutes < 0.05 ? '同一分钟，两个标记重叠。' : `相差 ${minutes.toFixed(1)} 分钟：上升按平均每 4 分钟 1°，月亮按每天约 13°。快升、慢升会让上升差得更多或更少。`}
        <br />Dean 与 Kelly（2003）：1958 年 3 月初在伦敦出生的 2101 人，许多人只差几分钟（平均约 4.8 分钟），约 110 项指标在 11、16、23 岁测量，没有超出随机的相似性。
      </div>
    </div>
  )
}

type Journal = { h: number; p: number; m: number; b: number }
function readJournal(): Journal {
  try {
    const raw = getState().notes['s16-journal']
    if (!raw) return { h: 0, p: 0, m: 0, b: 50 }
    const o = JSON.parse(raw) as Partial<Journal>
    const num = (v: unknown, d: number, lo: number, hi: number) => {
      const x = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(x)) return d
      return Math.max(lo, Math.min(hi, Math.round(x)))
    }
    return { h: num(o.h, 0, 0, 200), p: num(o.p, 0, 0, 200), m: num(o.m, 0, 0, 200), b: num(o.b, 50, 10, 90) }
  } catch { return { h: 0, p: 0, m: 0, b: 50 } }
}

/* ── 预测日记：命中 / 部分 / 落空，和基线比尾部概率（第 640 天） ── */
function JournalWidget() {
  const [j, setJ] = useState(readJournal)
  const n = j.h + j.p + j.m
  const p = j.b / 100
  const dist = useMemo(() => {
    if (n <= 0 || p <= 0 || p >= 1) return []
    const d = binom(n, p)
    return d.some((v) => !Number.isFinite(v)) ? [] : d
  }, [n, p])
  const strict = n ? j.h / n : 0
  const loose = n ? (j.h + j.p) / n : 0
  const tStrict = dist.length ? tailFrom(dist, j.h) : 0
  const tLoose = dist.length ? tailFrom(dist, j.h + j.p) : 0
  const max = dist.length ? Math.max(...dist) : 1
  const W = dist.length ? 320 / dist.length : 1
  const save = (patch: Partial<Journal>) => {
    const next = { ...j, ...patch }
    setJ(next)
    setNote('s16-journal', JSON.stringify(next))
  }
  const setCount = (key: 'h' | 'p' | 'm', raw: string) => {
    const x = raw.trim() === '' ? 0 : Number(raw)
    save({ [key]: Number.isFinite(x) ? Math.max(0, Math.min(200, Math.round(x))) : 0 })
  }
  return (
    <div className="wg">
      <Note>只存在本机</Note>
      {([['h', '命中'], ['p', '部分'], ['m', '落空']] as const).map(([key, label]) => (
        <div className="wg-row" key={key}>
          <label>{label}</label>
          <input type="number" inputMode="numeric" min={0} max={200} value={j[key]}
            onChange={(e) => setCount(key, e.target.value)}
            style={{ width: 72, marginLeft: 'auto', textAlign: 'right', borderRadius: 8, padding: '4px 8px' }} />
        </div>
      ))}
      <Slider label="基线" value={j.b} min={10} max={90} step={5} onChange={(v) => save({ b: v })} fmt={(v) => `${v}%`} />
      {n === 0 || !dist.length ? <div className="wg-cap">先填已到期的记录。部分先不算进严格命中。</div> : (
        <>
          <svg className="wg-svg" viewBox="0 0 340 132">
            {dist.map((v, i) => (
              <rect key={i} x={10 + i * W} y={104 - (v / max) * 88} width={Math.max(1, W - 1)} height={(v / max) * 88} fill={i >= j.h ? GOLD : 'rgba(246,241,228,0.25)'} />
            ))}
            <line x1={10 + j.h * W} y1={8} x2={10 + j.h * W} y2={106} stroke={RED} strokeDasharray="3 3" />
            <text x={10} y={124} fontSize="10" fill={DIM}>0 条</text>
            <text x={330} y={124} fontSize="10" fill={DIM} textAnchor="end">{n} 条</text>
          </svg>
          <table className="wg-table">
            <tbody>
              <tr><td>严格命中（只算命中）</td><td>{j.h} / {n}</td><td>{pct1(strict)}</td></tr>
              <tr><td>把部分也算上</td><td>{j.h + j.p} / {n}</td><td>{pct1(loose)}</td></tr>
              <tr><td>基线</td><td></td><td>{j.b}%</td></tr>
            </tbody>
          </table>
          <div className="wg-cap">
            {strict > p + 0.005 ? '严格命中率高于基线。' : strict < p - 0.005 ? '严格命中率低于基线。' : '严格命中率和基线几乎一样。'}
            {' '}若每条只有 {j.b}% 的机会蒙对，得到至少 {j.h} 条严格命中的概率是 <b>{j.h === 0 ? '100%（至少 0 条一定会发生）' : pctTail(tStrict)}</b>。
            把部分也算命中时，至少 {j.h + j.p} 条的概率是 <b>{pctTail(tLoose)}</b>。
          </div>
        </>
      )}
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
