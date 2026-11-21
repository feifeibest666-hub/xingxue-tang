import { useEffect, useRef } from 'react'

/** Canvas 2D 星空背景：星星微微闪烁；减少动态效果时只画静态 */
export function Starfield({ density = 0.00028, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let stars: { x: number; y: number; r: number; p: number; s: number }[] = []
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = c.clientWidth, h = c.clientHeight
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(w * h * density)
      let seed = 7
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      stars = Array.from({ length: n }, () => ({ x: rnd() * w, y: rnd() * h, r: rnd() * 1.1 + 0.25, p: rnd() * Math.PI * 2, s: 0.4 + rnd() * 1.2 }))
    }
    const draw = (t: number) => {
      ctx.clearRect(0, 0, c.clientWidth, c.clientHeight)
      for (const s of stars) {
        const a = reduce ? 0.7 : 0.45 + 0.45 * Math.sin(s.p + (t / 1000) * s.s)
        ctx.globalAlpha = a
        ctx.fillStyle = '#f6f1e4'
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    resize(); draw(0)
    const ro = new ResizeObserver(() => { resize(); if (reduce) draw(0) })
    ro.observe(c)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [density])
  return <canvas ref={ref} className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden />
}
