import { useState } from 'react'
import { motion } from 'motion/react'
import { todayStr } from '../lib/store'

const WD = ['一', '二', '三', '四', '五', '六', '日']

/** 打卡日历：每个学习日是一颗星，连续的日子连成星座 */
export function StarCalendar({ checkins }: { checkins: string[] }) {
  const now = new Date()
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth()])
  const [y, m] = ym
  const first = new Date(y, m, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(y, m + 1, 0).getDate()
  const rows = Math.ceil((lead + days) / 7)
  const set = new Set(checkins)
  const today = todayStr()
  const cw = 46, ch = 40
  const pos = (d: number) => {
    const k = lead + d - 1
    return [cw / 2 + (k % 7) * cw, ch / 2 + Math.floor(k / 7) * ch] as const
  }
  const key = (d: number) => todayStr(new Date(y, m, d))
  const lines: [number, number][] = []
  for (let d = 1; d < days; d++) if (set.has(key(d)) && set.has(key(d + 1))) lines.push([d, d + 1])
  const monthCount = Array.from({ length: days }, (_, i) => i + 1).filter((d) => set.has(key(d))).length
  const shift = (k: number) => { const t = new Date(y, m + k, 1); setYm([t.getFullYear(), t.getMonth()]) }
  return (
    <div className="cal">
      <div className="cal-head">
        <button onClick={() => shift(-1)} aria-label="上个月">‹</button>
        <span>{y} 年 {m + 1} 月 · 星空打卡</span>
        <button onClick={() => shift(1)} aria-label="下个月">›</button>
      </div>
      <div className="cal-week">{WD.map((w) => <span key={w}>{w}</span>)}</div>
      <svg className="cal-svg" viewBox={`0 0 ${cw * 7} ${ch * rows}`}>
        {lines.map(([a, b], k) => {
          const [x1, y1] = pos(a), [x2, y2] = pos(b)
          return <motion.line key={`${y}-${m}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c2a05a" strokeOpacity={0.55} strokeWidth={1.2}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.2 + k * 0.04 }} />
        })}
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const [x, yy] = pos(d)
          const on = set.has(key(d))
          const isToday = key(d) === today
          return (
            <g key={d}>
              {isToday && <circle cx={x} cy={yy} r={15} fill="none" stroke="rgba(246,241,228,.5)" strokeDasharray="2 3" />}
              {on ? (
                <motion.path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" fill="#f3d999"
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16, delay: d * 0.015 }}
                  style={{ x, y: yy }} />
              ) : (
                <text x={x} y={yy + 4} textAnchor="middle" fontSize={11} fill="rgba(246,241,228,.35)">{d}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="cal-foot"><span>本月点亮 {monthCount} 颗星</span><span>连续的日子会连成星座</span></div>
    </div>
  )
}
