import { motion } from 'motion/react'
import { STAGES } from '../data/outline'
import { TOTAL_DAYS, type State } from '../lib/store'
import { seeded } from './widgets/common'

const W = 360
const ROW = 96
const TOP = 40

/** 每个阶段一幅小星座图案：7 颗星，学完的比例越高亮得越多 */
export function stagePattern(n: number, r = 22) {
  const rnd = seeded(7, n * 13 + 5)
  return rnd.map(([a, b], k) => {
    const ang = (k / 7) * Math.PI * 2 + a * 0.9
    const rr = r * (0.35 + b * 0.65)
    return [Math.cos(ang) * rr, Math.sin(ang) * rr] as [number, number]
  })
}

const nodeX = (k: number) => W / 2 + Math.sin(k * 0.95 + 0.4) * 92
const nodeY = (k: number) => TOP + k * ROW

export function stageProgress(s: State, n: number) {
  const st = STAGES[n - 1]
  let done = 0
  for (let d = st.from; d <= st.to; d++) if (s.completed[d]) done++
  return { done, total: st.to - st.from + 1 }
}

export function PatternSvg({ n, lit, size = 150, className }: { n: number; lit: number; size?: number; className?: string }) {
  const pts = stagePattern(n, 40)
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={className}>
      {pts.slice(1).map((p, k) => (
        <line key={k} x1={pts[k][0]} y1={pts[k][1]} x2={p[0]} y2={p[1]} stroke={k + 1 < lit ? '#c2a05a' : 'rgba(246,241,228,.18)'} strokeWidth={0.8} />
      ))}
      {pts.map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r={k < lit ? 2.6 : 1.6} fill={k < lit ? '#f3d999' : 'rgba(246,241,228,.4)'} />)}
    </svg>
  )
}

export function LearningMap({ s, current, compact = false }: { s: State; current: number; compact?: boolean }) {
  const cur = STAGES.findIndex((x) => current >= x.from && current <= x.to)
  const done = Object.keys(s.completed).length
  const show = compact ? STAGES.slice(Math.max(0, cur - 1), Math.max(0, cur - 1) + 3) : STAGES
  const off = compact ? Math.max(0, cur - 1) : 0
  const H = TOP + (show.length - 1) * ROW + 54
  const pathD = show.map((_, j) => {
    const k = j + off
    const x = nodeX(k), y = nodeY(j)
    if (j === 0) return `M${x} ${y}`
    const px = nodeX(k - 1), py = nodeY(j - 1)
    return `C${px} ${py + ROW * 0.55} ${x} ${y - ROW * 0.55} ${x} ${y}`
  }).join(' ')
  const dust = seeded(compact ? 40 : 160, 11)
  return (
    <div className={`map ${compact ? 'compact' : ''}`}>
      <div className="map-head">
        <h3>{compact ? '你在星路上的位置' : '700 天星路'}</h3>
        <span>第 {current} / {TOTAL_DAYS} 天 · 已学 {done} 课</span>
      </div>
      <div className="map-prog"><i style={{ width: `${(done / TOTAL_DAYS) * 100}%` }} /></div>
      <svg className="map-svg" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="milky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5b7fa8" stopOpacity="0.28" />
            <stop offset="1" stopColor="#c2a05a" stopOpacity="0.18" />
          </linearGradient>
          <filter id="mblur"><feGaussianBlur stdDeviation="9" /></filter>
          <radialGradient id="nodeGlow"><stop offset="0" stopColor="#f3d999" stopOpacity=".55" /><stop offset="1" stopColor="#f3d999" stopOpacity="0" /></radialGradient>
        </defs>
        {dust.map(([a, b, c], k) => <circle key={k} cx={a * W} cy={b * H} r={c * 1.1 + 0.2} fill="#f6f1e4" opacity={0.15 + c * 0.45} />)}
        <path d={pathD} stroke="url(#milky)" strokeWidth={46} fill="none" filter="url(#mblur)" />
        <path d={pathD} stroke="rgba(246,241,228,.22)" strokeWidth={1.2} strokeDasharray="2 6" fill="none" />
        {show.map((st, j) => {
          const k = j + off
          const x = nodeX(k), y = nodeY(j)
          const { done: d, total } = stageProgress(s, st.n)
          const lit = d === 0 ? 0 : Math.max(1, Math.round((d / total) * 7))
          const pts = stagePattern(st.n)
          const here = k === cur
          const left = x > W / 2
          return (
            <a key={st.n} href={`#/stage/${st.n}`} className="map-node">
              {(here || d === total) && <circle cx={x} cy={y} r={40} fill="url(#nodeGlow)" />}
              <circle cx={x} cy={y} r={29} fill="#141a2e" stroke={here ? '#c2a05a' : 'rgba(246,241,228,.22)'} strokeWidth={here ? 1.6 : 1} />
              {pts.slice(1).map((p, i) => (
                <line key={i} x1={x + pts[i][0]} y1={y + pts[i][1]} x2={x + p[0]} y2={y + p[1]} stroke={i + 1 < lit ? '#c2a05a' : 'rgba(246,241,228,.16)'} strokeWidth={0.8} />
              ))}
              {pts.map((p, i) => <circle key={i} cx={x + p[0]} cy={y + p[1]} r={i < lit ? 2.1 : 1.3} fill={i < lit ? '#f3d999' : 'rgba(246,241,228,.45)'} />)}
              {here && (
                <motion.circle cx={x} cy={y} r={29} fill="none" stroke="#c2a05a" strokeWidth={1.2}
                  animate={{ r: [29, 38], opacity: [0.8, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }} />
              )}
              <text x={left ? x - 40 : x + 40} y={y - 3} textAnchor={left ? 'end' : 'start'} className="map-label">{st.n}. {st.name.length > 9 ? st.name.slice(0, 8) + '…' : st.name}</text>
              <text x={left ? x - 40 : x + 40} y={y + 13} textAnchor={left ? 'end' : 'start'} className="map-label-sub">第 {st.from}–{st.to} 天 · {d}/{total}</text>
              {here && <text x={left ? x - 40 : x + 40} y={y + 28} textAnchor={left ? 'end' : 'start'} className="map-here">✦ 你在这里</text>}
            </a>
          )
        })}
      </svg>
    </div>
  )
}
