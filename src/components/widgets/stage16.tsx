import { useMemo, useState } from 'react'
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

export const W16: WidgetMap = {
  sChance: (a) => <ChanceWidget mode={a.mode as string | undefined} />,
}
