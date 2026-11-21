import { motion } from 'motion/react'
import type { Planet } from '../data/classical'

/** 自绘行星符号（viewBox 0 0 100 100），不用 Unicode ☉☽ 等字符 */
export const PLANET_PATHS: Record<Planet, string> = {
  sun: 'M50 18 A32 32 0 1 1 49.9 18 Z M50 46 A4 4 0 1 1 49.9 46 Z',
  moon: 'M60 14 A36 36 0 1 0 60 86 A28 28 0 1 1 60 14 Z',
  mercury: 'M34 10 C36 22 64 22 66 10 M50 22 A18 18 0 1 1 49.9 22 Z M50 58 L50 92 M36 78 L64 78',
  venus: 'M50 12 A22 22 0 1 1 49.9 12 Z M50 56 L50 92 M34 76 L66 76',
  mars: 'M42 42 A22 22 0 1 0 58 58 M54 30 L78 14 M60 14 L78 14 L78 32',
  jupiter: 'M20 30 C24 14 48 14 46 32 C44 48 30 58 22 64 L80 64 M64 20 L64 90',
  saturn: 'M34 12 L34 70 M22 24 L48 24 M34 46 C42 34 64 34 64 52 C64 66 50 72 50 82 C50 90 58 92 64 86',
}

export function PlanetGlyph({ p, size = 32, color = 'currentColor', width = 6, draw = false }: { p: Planet; size?: number; color?: string; width?: number; draw?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
      {PLANET_PATHS[p].split(/(?=M)/).map((d, k) => (
        <motion.path key={k} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
          initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: k * 0.25 }} />
      ))}
    </svg>
  )
}

/** 在已有 SVG 坐标系里放行星符号 */
export function PlanetAt({ p, x, y, size, color, width = 7 }: { p: Planet; x: number; y: number; size: number; color: string; width?: number }) {
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})`}>
      <path d={PLANET_PATHS[p]} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}
