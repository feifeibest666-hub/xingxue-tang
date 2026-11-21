import { motion } from 'motion/react'
import { SIGNS } from '../data/zodiac'

/** 自绘星座符号（不用 ♈ 等 Unicode，避免在手机上变成彩色表情） */
export function Glyph({ i, size = 40, color = 'currentColor', draw = false, width = 6, delay = 0 }: {
  i: number; size?: number; color?: string; draw?: boolean; width?: number; delay?: number
}) {
  const s = SIGNS[i - 1]
  const dur = 1.1
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label={s.name} style={{ display: 'block', overflow: 'visible' }}>
      {s.glyph.split(/(?=M)/).map((d, k) => (
        <motion.path key={k} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
          initial={draw ? { pathLength: 0, opacity: 0.2 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: dur, delay: delay + k * 0.35, ease: [0.45, 0, 0.25, 1] }} />
      ))}
      {s.dots?.map(([cx, cy, r], k) => (
        <motion.circle key={`d${k}`} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={width}
          initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: delay + 0.6 + k * 0.3 }} />
      ))}
    </svg>
  )
}

/** 在 SVG 内部（已有坐标系）放一个符号 */
export function GlyphAt({ i, x, y, size, color, width = 7 }: { i: number; x: number; y: number; size: number; color: string; width?: number }) {
  const s = SIGNS[i - 1]
  const k = size / 100
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`}>
      <path d={s.glyph} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      {s.dots?.map(([cx, cy, r], j) => <circle key={j} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={width} />)}
    </g>
  )
}

/** 小星星形状 */
export function StarShape({ size = 20, fill = 'var(--gold)' }: { size?: number; fill?: string }) {
  return (
    <svg viewBox="-10 -10 20 20" width={size} height={size} style={{ display: 'block' }}>
      <path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" fill={fill} />
    </svg>
  )
}
