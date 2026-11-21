import { useEffect, useRef, useState, type ReactNode } from 'react'

/** 各阶段部件表：Widget 按名字查找 */
export type WidgetMap = Record<string, (args: Record<string, unknown>) => ReactNode>

export const D2R = Math.PI / 180
/** 星盘惯例：白羊 0° 在左边，逆时针增加 */
export const wheel = (cx: number, cy: number, r: number, lon: number) => [cx - r * Math.cos(lon * D2R), cy + r * Math.sin(lon * D2R)] as const
export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Slider({ label, value, min, max, step = 1, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string
}) {
  return (
    <div className="wg-row">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="wg-v">{fmt ? fmt(value) : value}</span>
    </div>
  )
}

export function Btns<T extends string | number | boolean>({ items, value, onChange }: { items: [T, ReactNode][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="wg-btns">
      {items.map(([v, l]) => <button key={String(v)} className={`wg-btn ${v === value ? 'on' : ''}`} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  )
}

/** 动画循环：playing 时每帧回调 dt（秒） */
export function useLoop(playing: boolean, cb: (dt: number) => void) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!playing) return
    let raf = 0, last = performance.now()
    const f = (t: number) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; ref.current(dt); raf = requestAnimationFrame(f) }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [playing])
}

export function usePlaying(initial = true) {
  return useState(() => initial && !reduceMotion())
}

export function PlayBtn({ playing, set }: { playing: boolean; set: (v: boolean) => void }) {
  return <button className={`wg-btn ${playing ? 'on' : ''}`} onClick={() => set(!playing)}>{playing ? '❚❚ 暂停' : '▶ 播放'}</button>
}

export const Note = ({ children }: { children: ReactNode }) => <span className="wg-note">{children}</span>

/** 给定日期（年内第几天，0 = 1 月 1 日）近似太阳黄经 */
export const lonFromDoy = (doy: number) => (((doy - 79.3) * 360) / 365.2422 + 360) % 360
export const doyLabel = (doy: number) => {
  const d = new Date(2026, 0, 1 + Math.round(doy))
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/** 简单的星点：固定种子随机 */
export function seeded(n: number, seed = 3) {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: n }, () => [r(), r(), r()] as [number, number, number])
}
