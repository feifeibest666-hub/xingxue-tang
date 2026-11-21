import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Btns, Note, PlayBtn, reduceMotion, useLoop, usePlaying, wheel } from './common'
import { Glyph, GlyphAt } from '../Glyph'
import { ELEMENT_COLOR, ELEMENT_QUAL, GAP_INFO, SIGNS, element, gap, modality, polarity, type Element, type Modality } from '../../data/zodiac'
import { ascensionTime, dayLength, sunDecl } from '../../lib/astro'
import { getState, setNote } from '../../lib/store'

const CX = 170, CY = 170

function SignRing({ R = 128, hi, onTap, color, size = 18 }: { R?: number; hi?: (i: number) => boolean; onTap?: (i: number) => void; color?: (i: number) => string; size?: number }) {
  return (
    <>
      <circle cx={CX} cy={CY} r={R + 20} fill="none" stroke="rgba(246,241,228,0.1)" />
      {SIGNS.map((s) => {
        const [x, y] = wheel(CX, CY, R, (s.i - 1) * 30 + 15)
        const on = hi?.(s.i)
        return (
          <g key={s.i} onClick={() => onTap?.(s.i)} style={{ cursor: onTap ? 'pointer' : undefined }}>
            <circle cx={x} cy={y} r={size} fill={on ? 'rgba(194,160,90,0.25)' : 'rgba(246,241,228,0.04)'} stroke={on ? '#c2a05a' : 'rgba(246,241,228,0.15)'} />
            <GlyphAt i={s.i} x={x} y={y} size={size * 1.05} color={color?.(s.i) ?? (on ? '#e6cf95' : '#f6f1e4')} width={8} />
          </g>
        )
      })}
    </>
  )
}
const pos = (i: number, R = 128) => wheel(CX, CY, R, (i - 1) * 30 + 15)

/* ── 阴阳拉链（第 22 天） ── */
export function ZipperWidget() {
  const [n, setN] = useState(() => (reduceMotion() ? 12 : 0))
  const [sel, setSel] = useState<number | null>(null)
  useEffect(() => { if (n < 12) { const t = setTimeout(() => setN(n + 1), 260); return () => clearTimeout(t) } }, [n])
  const opp = sel ? ((sel + 5) % 12) + 1 : null
  const nb = sel ? [((sel + 10) % 12) + 1, (sel % 12) + 1] : []
  return (
    <div className="wg">
      <Note>点一个星座</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        {SIGNS.map((s) => {
          const shown = s.i <= n
          const yang = s.i % 2 === 1
          const [x0, y0] = wheel(CX, CY, 150, (s.i - 1) * 30), [x1, y1] = wheel(CX, CY, 150, s.i * 30)
          const [i0x, i0y] = wheel(CX, CY, 70, (s.i - 1) * 30), [i1x, i1y] = wheel(CX, CY, 70, s.i * 30)
          const [tx, ty] = wheel(CX, CY, 88, (s.i - 1) * 30 + 15)
          const ring = s.i === sel ? '#c2a05a' : s.i === opp ? '#8fbf9a' : nb.includes(s.i) ? '#e88a72' : '#141a2e'
          return (
            <g key={s.i} onClick={() => setSel(s.i)} style={{ cursor: 'pointer' }}>
              <motion.path d={`M${i0x} ${i0y} L${x0} ${y0} A150 150 0 0 0 ${x1} ${y1} L${i1x} ${i1y} A70 70 0 0 1 ${i0x} ${i0y}`}
                initial={false} animate={{ fill: shown ? (yang ? '#efe3c2' : '#2f3958') : 'rgba(246,241,228,0.05)' }} transition={{ duration: 0.35 }}
                stroke={ring} strokeWidth={ring === '#141a2e' ? 1.5 : 3} />
              {(() => { const [gx, gy] = wheel(CX, CY, 124, (s.i - 1) * 30 + 15); return <GlyphAt i={s.i} x={gx} y={gy} size={18} color={shown ? (yang ? '#141a2e' : '#e6cf95') : 'rgba(246,241,228,0.3)'} width={8} /> })()}
              {shown && <text x={tx} y={ty + 4} textAnchor="middle" fontSize="12" fill={yang ? '#141a2e' : '#e6cf95'} fontFamily="var(--serif)">{yang ? '阳' : '阴'}</text>}
            </g>
          )
        })}
        <text x={CX} y={CY - 4} textAnchor="middle" fill="#f6f1e4" fontSize="14" fontFamily="var(--serif)">{sel ? `${SIGNS[sel - 1].name}（${sel}）` : '一明一暗'}</text>
        <text x={CX} y={CY + 16} textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="11">{sel ? `${polarity(sel)}性` : '奇数阳 · 偶数阴'}</text>
      </svg>
      <div className="wg-btns"><button className="wg-btn" onClick={() => { setN(0); setSel(null) }}>重新翻一遍</button></div>
      <div className="wg-cap">{sel ? <><b style={{ color: '#8fbf9a' }}>对面</b>相隔 6（偶数）→ 极性相同；<b style={{ color: '#e88a72' }}>左右邻居</b>一定相反。</> : '点任何一个星座，看对面和邻居。'}</div>
    </div>
  )
}

/* ── 四元素：2 × 2 表格长成四个三角（第 23–24 天） ── */
export function ElementsWidget({ triangles = false }: { triangles?: boolean }) {
  const [phase, setPhase] = useState<'table' | 'ring'>(triangles ? 'ring' : 'table')
  const [focus, setFocus] = useState<Element | null>(null)
  const els: Element[] = ['火', '土', '风', '水']
  const cell: Record<Element, [number, number]> = { 火: [0, 0], 风: [0, 1], 土: [1, 0], 水: [1, 1] }
  return (
    <div className="wg">
      <Note>{phase === 'table' ? '冷热 × 干湿' : '每 4 个一轮'}</Note>
      <AnimatePresence mode="wait">
        {phase === 'table' ? (
          <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <svg className="wg-svg" viewBox="0 0 340 260">
              <text x="120" y="30" textAnchor="middle" fill="#f6f1e4" fontSize="14">干</text>
              <text x="250" y="30" textAnchor="middle" fill="#f6f1e4" fontSize="14">湿</text>
              <text x="36" y="104" textAnchor="middle" fill="#e8b85c" fontSize="14">热</text>
              <text x="36" y="204" textAnchor="middle" fill="#8fb0d6" fontSize="14">冷</text>
              {els.map((e, k) => {
                const [r, c] = cell[e]
                const x = 60 + c * 130, y = 46 + r * 100
                return (
                  <motion.g key={e} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + k * 0.35 }}>
                    <rect x={x} y={y} width={120} height={90} rx={14} fill={ELEMENT_COLOR[e]} opacity={0.85} />
                    <text x={x + 60} y={y + 44} textAnchor="middle" fill="#fff" fontSize="26" fontFamily="var(--serif)">{e}</text>
                    <text x={x + 60} y={y + 70} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="12">{ELEMENT_QUAL[e]}</text>
                  </motion.g>
                )
              })}
              <text x="170" y="250" textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="11">两个二选一 → 2 × 2 = 4 种</text>
            </svg>
            <div className="wg-btns"><button className="wg-btn on" onClick={() => setPhase('ring')}>放到 12 个星座上 →</button></div>
          </motion.div>
        ) : (
          <motion.div key="r" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <svg className="wg-svg" viewBox="0 0 340 340">
              {els.map((e, k) => {
                const idx = [1, 2, 3, 4][k]
                const pts = [idx, idx + 4, idx + 8].map((i) => pos(i, 108).join(',')).join(' ')
                const dim = focus && focus !== e
                return <motion.polygon key={e} points={pts} fill={focus === e ? `${ELEMENT_COLOR[e]}33` : 'none'} stroke={ELEMENT_COLOR[e]} strokeWidth={focus === e ? 3.5 : 2.2}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1, opacity: dim ? 0.15 : 1 }} transition={{ duration: 0.9, delay: k * 0.5 }} />
              })}
              <SignRing R={128} color={(i) => ELEMENT_COLOR[element(i)]} hi={(i) => focus === element(i)} size={17} />
              <text x={CX} y={CY + 5} textAnchor="middle" fill="#f6f1e4" fontSize="13" fontFamily="var(--serif)">{focus ? `${focus}象` : '四个三角'}</text>
            </svg>
            <div className="wg-btns">
              {els.map((e) => <button key={e} className={`wg-btn ${focus === e ? 'on' : ''}`} style={{ borderColor: ELEMENT_COLOR[e] }} onClick={() => setFocus(focus === e ? null : e)}>{e}</button>)}
              {!triangles && <button className="wg-btn" onClick={() => setPhase('table')}>回到表格</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="wg-cap">{phase === 'table' ? <>热的（火、风）向外，<b>主动</b>；冷的（土、水）向内，<b>被动</b>。</> : focus ? <>{SIGNS.filter((s) => element(s.i) === focus).map((s) => s.name).join('、')}：相隔 4 个 = <b>120°</b>，正三角形。</> : '点一个元素，看它的三角。'}</div>
    </div>
  )
}

const MOD_SHAPE: Record<Modality, (x: number, y: number, c: string) => React.ReactNode> = {
  开创: (x, y, c) => <path d={`M${x - 7} ${y + 5} L${x} ${y - 7} L${x + 7} ${y + 5}`} fill="none" stroke={c} strokeWidth={2.4} strokeLinejoin="round" />,
  固定: (x, y, c) => <rect x={x - 5.5} y={y - 5.5} width={11} height={11} fill="none" stroke={c} strokeWidth={2.4} />,
  变动: (x, y, c) => <path d={`M${x - 8} ${y} Q${x - 4} ${y - 6} ${x} ${y} T${x + 8} ${y}`} fill="none" stroke={c} strokeWidth={2.4} />,
}
export const ModShape = ({ m, size = 22, color = 'currentColor' }: { m: Modality; size?: number; color?: string }) => (
  <svg viewBox="-11 -11 22 22" width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }}>{MOD_SHAPE[m](0, 0, color)}</svg>
)

/* ── 三个十字（第 25 天） ── */
export function CrossesWidget() {
  const [focus, setFocus] = useState<Modality | null>(null)
  const [spin, setSpin] = useState(0)
  const [playing] = usePlaying()
  useLoop(playing, (dt) => setSpin((s) => (s + dt * 4) % 360))
  const mods: Modality[] = ['开创', '固定', '变动']
  const col: Record<Modality, string> = { 开创: '#e6cf95', 固定: '#8fb0d6', 变动: '#8fbf9a' }
  return (
    <div className="wg">
      <Note>形状 = 模式</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        <g transform={`rotate(${spin} ${CX} ${CY})`}>
          {mods.map((m, k) => {
            const ids = [1, 4, 7, 10].map((i) => i + k)
            const [a, b, c, d] = ids.map((i) => pos(i, 105))
            const dim = focus && focus !== m
            return (
              <motion.g key={m} initial={{ opacity: 0 }} animate={{ opacity: dim ? 0.12 : 1 }} transition={{ delay: k * 0.6, duration: 0.6 }}>
                <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} stroke={col[m]} strokeWidth={focus === m ? 3.5 : 2} />
                <line x1={b[0]} y1={b[1]} x2={d[0]} y2={d[1]} stroke={col[m]} strokeWidth={focus === m ? 3.5 : 2} />
              </motion.g>
            )
          })}
        </g>
        <SignRing R={128} hi={(i) => focus === modality(i)} size={17} />
        {SIGNS.map((s) => { const [x, y] = pos(s.i, 158); return <g key={s.i}>{MOD_SHAPE[modality(s.i)](x, y, col[modality(s.i)])}</g> })}
        <text x={CX} y={CY + 5} textAnchor="middle" fill="#f6f1e4" fontSize="13" fontFamily="var(--serif)">{focus ?? '三个十字'}</text>
      </svg>
      <div className="wg-btns">{mods.map((m) => <button key={m} className={`wg-btn ${focus === m ? 'on' : ''}`} onClick={() => setFocus(focus === m ? null : m)}><ModShape m={m} size={16} /> {m}</button>)}</div>
      <div className="wg-cap">{focus === '开创' ? <>开创星座的起点 = <b>二分二至</b>（天文事实）。</> : focus === '固定' ? <>中国的<b>四立</b>正好落在固定星座的正中间。</> : focus === '变动' ? <>季节交替之处，下一季在<b>敲门</b>。</> : <>同模式相隔 3 个 = <b>90°</b>，四个连成十字。</>}</div>
    </div>
  )
}

/* ── 季节之门（第 25 天） ── */
export function DoorWidget() {
  const [season, setSeason] = useState(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = usePlaying()
  useEffect(() => { if (!playing) return; const t = setInterval(() => setStep((s) => (s + 1) % 3), 1600); return () => clearInterval(t) }, [playing])
  const names = ['春', '夏', '秋', '冬']
  const doorAngle = [70, 70, 15][step]
  const signsOf = [1, 2, 3].map((k) => SIGNS[season * 3 + k - 1])
  const verbs = ['推门 · 开创', '撑门 · 固定', '合门 · 变动']
  return (
    <div className="wg">
      <svg className="wg-svg" viewBox="0 0 340 220">
        <rect x="120" y="30" width="100" height="160" fill={['#8fbf9a', '#e8b85c', '#c4633f', '#8fb0d6'][season]} opacity={0.35} />
        <text x="170" y="115" textAnchor="middle" fill="#f6f1e4" fontSize="34" fontFamily="var(--serif)">{names[season]}</text>
        {step === 2 && <text x="170" y="150" textAnchor="middle" fill="rgba(246,241,228,0.7)" fontSize="11">{names[(season + 1) % 4]}天在门外</text>}
        <motion.g style={{ originX: '120px', originY: '110px' }} animate={{ scaleX: Math.cos((doorAngle * Math.PI) / 180) }} transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}>
          <rect x="120" y="30" width="100" height="160" fill="#3c4566" stroke="#c2a05a" strokeWidth="2" />
          <circle cx="205" cy="112" r="4" fill="#c2a05a" />
        </motion.g>
        <rect x="114" y="24" width="112" height="170" fill="none" stroke="rgba(246,241,228,0.4)" strokeWidth="3" />
        <g transform="translate(250 60)">
          {signsOf.map((s, k) => (
            <g key={s.i} transform={`translate(0 ${k * 44})`} opacity={k === step ? 1 : 0.4}>
              <GlyphAt i={s.i} x={12} y={12} size={20} color={k === step ? '#e6cf95' : '#f6f1e4'} width={8} />
              <text x={30} y={10} fill="#f6f1e4" fontSize="12">{s.name}</text>
              <text x={30} y={25} fill="rgba(246,241,228,0.6)" fontSize="10">{['开创', '固定', '变动'][k]}</text>
            </g>
          ))}
        </g>
        <text x="20" y="110" fill="#c2a05a" fontSize="14" fontFamily="var(--serif)">{verbs[step]}</text>
      </svg>
      <Btns items={names.map((n, k) => [k, `${n}天`] as [number, string])} value={season} onChange={(v) => { setSeason(v); setStep(0) }} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} />{[0, 1, 2].map((k) => <button key={k} className={`wg-btn ${step === k ? 'on' : ''}`} onClick={() => { setPlaying(false); setStep(k) }}>{verbs[k].split(' · ')[1]}</button>)}</div>
    </div>
  )
}

/* ── 齿轮咬合：4 × 3 = 12（第 26 天） ── */
export function GearsWidget() {
  const [k, setK] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  useEffect(() => { if (!playing) return; if (k >= 12) { setPlaying(false); return } const t = setTimeout(() => setK(k + 1), 650); return () => clearTimeout(t) }, [playing, k, setPlaying])
  const els: Element[] = ['火', '土', '风', '水']
  const mods: Modality[] = ['开创', '固定', '变动']
  const gear = (cx: number, cy: number, n: number, r: number, rot: number, fill: (j: number) => string, label: (j: number) => React.ReactNode) => (
    <motion.g animate={{ rotate: rot }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} style={{ originX: `${cx}px`, originY: `${cy}px` }}>
      <circle cx={cx} cy={cy} r={r} fill="#232b45" stroke="rgba(246,241,228,0.3)" />
      {Array.from({ length: n }, (_, j) => {
        const a = (j * 360) / n - 90
        const x = cx + (r + 9) * Math.cos((a * Math.PI) / 180), y = cy + (r + 9) * Math.sin((a * Math.PI) / 180)
        return <g key={j}><circle cx={x} cy={y} r={13} fill={fill(j)} stroke="#141a2e" strokeWidth={2} />{label(j)}</g>
      })}
      <circle cx={cx} cy={cy} r={6} fill="#c2a05a" />
    </motion.g>
  )
  const lbl = (cx: number, cy: number, n: number, r: number, j: number, node: React.ReactNode) => {
    const a = (j * 360) / n - 90
    const x = cx + (r + 9) * Math.cos((a * Math.PI) / 180), y = cy + (r + 9) * Math.sin((a * Math.PI) / 180)
    return <g transform={`translate(${x} ${y})`}>{node}</g>
  }
  return (
    <div className="wg">
      <Note>每转一格落下一个星座</Note>
      <svg className="wg-svg" viewBox="0 0 340 300">
        {gear(80, 80, 4, 34, -k * 90, (j) => ELEMENT_COLOR[els[j]], (j) => lbl(80, 80, 4, 34, j, <text textAnchor="middle" y={4} fontSize="12" fill="#fff">{els[j]}</text>))}
        {gear(80, 205, 3, 28, -k * 120, () => '#3c4566', (j) => lbl(80, 205, 3, 28, j, MOD_SHAPE[mods[j]](0, 0, '#e6cf95')))}
        <text x="80" y="144" textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="11">4 齿：元素</text>
        <text x="80" y="268" textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="11">3 齿：模式</text>
        <g transform="translate(110 0)">
          {SIGNS.map((s) => {
            const [x, y] = wheel(120, 150, 92, (s.i - 1) * 30 + 15)
            const on = s.i <= k
            return (
              <g key={s.i}>
                <circle cx={x} cy={y} r={19} fill="rgba(246,241,228,0.04)" stroke="rgba(246,241,228,0.15)" />
                {on && <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ originX: `${x}px`, originY: `${y}px` }}>
                  <circle cx={x} cy={y} r={19} fill={ELEMENT_COLOR[element(s.i)]} opacity={0.85} />
                  {MOD_SHAPE[modality(s.i)](x, y - 5, '#fff')}
                  <text x={x} y={y + 12} textAnchor="middle" fontSize="9" fill="#fff">{s.name}</text>
                </motion.g>}
              </g>
            )
          })}
          <text x="120" y="146" textAnchor="middle" fill="#f6f1e4" fontSize="22" fontFamily="var(--serif)">{k}</text>
          <text x="120" y="166" textAnchor="middle" fill="rgba(246,241,228,0.6)" fontSize="11">/ 12</text>
        </g>
      </svg>
      <div className="wg-btns">
        <button className="wg-btn on" onClick={() => setK(Math.min(12, k + 1))} disabled={k >= 12}>转一格</button>
        <PlayBtn playing={playing} set={(v) => { if (k >= 12) setK(0); setPlaying(v) }} />
        <button className="wg-btn" onClick={() => { setK(0); setPlaying(false) }}>重来</button>
      </div>
      <div className="wg-cap">{k >= 12 ? <>12 格填满，<b>两个齿轮同时回到原位</b>：12 种组合各出现一次。</> : k > 0 ? <>第 {k} 个：{SIGNS[k - 1].name} = {element(k)} + {modality(k)}</> : '4 和 3 没有公因数……转转看。'}</div>
    </div>
  )
}

/* ── 星座符号书写 + 属性（第 30–37、40 天） ── */
export function GlyphsWidget({ signs = [1, 2] }: { signs?: number[] }) {
  const [key, setKey] = useState(0)
  const [sel, setSel] = useState(signs[0])
  const all = signs.length > 4
  const show = all ? [sel] : signs
  return (
    <div className="wg">
      {all && <div className="wg-btns" style={{ marginBottom: 6 }}>{signs.map((i) => <button key={i} className={`wg-btn ${sel === i ? 'on' : ''}`} onClick={() => { setSel(i); setKey(key + 1) }}>{SIGNS[i - 1].name}</button>)}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${show.length}, 1fr)`, gap: 10 }} key={key}>
        {show.map((i, n) => {
          const s = SIGNS[i - 1]
          const chips = [`第 ${i} 个`, `${polarity(i)}性`, `${element(i)}象`, modality(i), s.season]
          return (
            <div key={i} style={{ textAlign: 'center', padding: '8px 4px' }}>
              <div style={{ display: 'grid', placeItems: 'center', height: 96 }}><Glyph i={i} size={84} color="#e6cf95" draw width={5} delay={n * 0.4} /></div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, marginTop: 4 }}>{s.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 6 }}>
                {chips.map((c, k) => (
                  <motion.span key={c} className="wg-btn" style={{ fontSize: 11.5, padding: '2px 8px', borderColor: k === 2 ? ELEMENT_COLOR[element(i)] : undefined }}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + n * 0.4 + k * 0.18 }}>{c}</motion.span>
                ))}
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 + n * 0.4 }} style={{ fontSize: 12, color: 'rgba(246,241,228,0.65)', marginTop: 6 }}>符号：{s.image}</motion.div>
            </div>
          )
        })}
      </div>
      <div className="wg-btns" style={{ justifyContent: 'center' }}><button className="wg-btn" onClick={() => setKey(key + 1)}>再写一遍</button></div>
    </div>
  )
}

/* ── 星座关系网（第 38 天） ── */
export function WebWidget() {
  const [a, setA] = useState(1)
  const [b, setB] = useState(5)
  const [next, setNext] = useState<'a' | 'b'>('a')
  const g = gap(a, b)
  const info = GAP_INFO[g]
  const tap = (i: number) => { if (next === 'a') { setA(i); setNext('b') } else { setB(i); setNext('a') } }
  const [ax, ay] = pos(a, 112), [bx, by] = pos(b, 112)
  return (
    <div className="wg">
      <Note>点两个星座</Note>
      <svg className="wg-svg" viewBox="0 0 340 340">
        <motion.line key={`${a}-${b}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#c2a05a" strokeWidth={2.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
        <SignRing R={128} hi={(i) => i === a || i === b} onTap={tap} />
        <text x={CX} y={CY - 8} textAnchor="middle" fill="#f6f1e4" fontSize="20" fontFamily="var(--serif)">{info.name}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fill="#c2a05a" fontSize="12">{info.deg}°</text>
      </svg>
      <div className="wg-read">
        <span>{SIGNS[a - 1].name}：<b>{polarity(a)} · {element(a)} · {modality(a)}</b></span>
        <span>{SIGNS[b - 1].name}：<b>{polarity(b)} · {element(b)} · {modality(b)}</b></span>
      </div>
      <div className="wg-cap">共同点：<b>{info.share}</b><br />传统评价：{info.mood} · 后来的相位：{info.aspect}</div>
    </div>
  )
}

/* ── 镜像轴：相看、相听、快升慢升（第 39 天） ── */
export function MirrorWidget() {
  const [mode, setMode] = useState<'see' | 'hear' | 'rise'>('see')
  const [sel, setSel] = useState(2)
  const mirror = mode === 'see' ? ((6 - sel + 12) % 12) + 1 : ((12 - sel + 12) % 12) + 1
  // 相看：以巨蟹 0°–摩羯 0° 为轴，镜像黄经 = 180° − λ；相听：以白羊 0°–天秤 0° 为轴，镜像 = 360° − λ
  const mid = (i: number) => (i - 1) * 30 + 15
  const dl = (i: number) => dayLength(40, sunDecl(mid(i)))
  const at = (i: number) => ascensionTime(i - 1, 40)
  const axisA = mode === 'see' ? 90 : 0
  const [x1, y1] = wheel(CX, CY, 150, axisA), [x2, y2] = wheel(CX, CY, 150, axisA + 180)
  const [p1x, p1y] = pos(sel, 112), [p2x, p2y] = pos(mirror, 112)
  const maxAt = 2.8
  return (
    <div className="wg">
      <Btns items={[['see', '相看（等昼长）'], ['hear', '相听（等升起时间）'], ['rise', '快升 · 慢升']]} value={mode} onChange={setMode} />
      {mode !== 'rise' ? (
        <>
          <svg className="wg-svg" viewBox="0 0 340 340">
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={mode === 'see' ? '#e8b85c' : '#8fb0d6'} strokeWidth={2} strokeDasharray="6 5" />
            <motion.line key={`${sel}-${mode}`} x1={p1x} y1={p1y} x2={p2x} y2={p2y} stroke="#c2a05a" strokeWidth={1.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />
            <SignRing R={128} hi={(i) => i === sel || i === mirror} onTap={setSel} />
            <text x={CX} y={CY - 6} textAnchor="middle" fill="#f6f1e4" fontSize="14" fontFamily="var(--serif)">{SIGNS[sel - 1].name} ↔ {SIGNS[mirror - 1].name}</text>
            <text x={CX} y={CY + 14} textAnchor="middle" fill="rgba(246,241,228,0.65)" fontSize="11">{mode === 'see' ? '镜子：巨蟹–摩羯轴（二至）' : '镜子：白羊–天秤轴（二分）'}</text>
          </svg>
          <div className="wg-read">
            {mode === 'see'
              ? <><span>{SIGNS[sel - 1].name}中段昼长 <b>{dl(sel).toFixed(1)} 时</b></span><span>{SIGNS[mirror - 1].name}中段昼长 <b>{dl(mirror).toFixed(1)} 时</b></span></>
              : <><span>{SIGNS[sel - 1].name}升起 <b>{(at(sel) * 60).toFixed(0)} 分钟</b></span><span>{SIGNS[mirror - 1].name}升起 <b>{(at(mirror) * 60).toFixed(0)} 分钟</b></span></>}
          </div>
          <div className="wg-cap">点任意星座，镜子另一侧的"伙伴"亮起。数值按北京（北纬 40°）计算。</div>
        </>
      ) : (
        <>
          <svg className="wg-svg" viewBox="0 0 340 280">
            {SIGNS.map((s, k) => {
              const t = at(s.i)
              const w = (t / maxAt) * 220
              const fast = t < 2
              return (
                <g key={s.i} transform={`translate(0 ${10 + k * 22})`}>
                  <GlyphAt i={s.i} x={16} y={8} size={14} color="#f6f1e4" width={8} />
                  <text x={30} y={12} fill="#f6f1e4" fontSize="11">{s.name}</text>
                  <motion.rect x={64} y={1} height={14} rx={4} fill={fast ? '#8fb0d6' : '#e8b85c'} initial={{ width: 0 }} animate={{ width: w }} transition={{ delay: k * 0.05, duration: 0.6 }} />
                  <text x={70 + w} y={12} fill="rgba(246,241,228,0.75)" fontSize="10">{(t * 60).toFixed(0)} 分</text>
                </g>
              )
            })}
          </svg>
          <div className="wg-cap">北京：<b style={{ color: '#8fb0d6' }}>摩羯→双子</b>升得快，<b style={{ color: '#e8b85c' }}>巨蟹→射手</b>升得慢。</div>
        </>
      )}
    </div>
  )
}

/* ── 属性速算：序号 → 极性、元素、模式（第 26–27 天） ── */
export function CalcWidget() {
  const [i, setI] = useState(5)
  return (
    <div className="wg">
      <div className="wg-btns">{SIGNS.map((s) => <button key={s.i} className={`wg-btn ${i === s.i ? 'on' : ''}`} onClick={() => setI(s.i)}>{s.i} {s.name}</button>)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }} key={i}>
        <Glyph i={i} size={64} color="#e6cf95" draw width={5} />
        <div style={{ fontSize: 14, lineHeight: 2, fontFamily: 'var(--serif)' }}>
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>{i} 是{i % 2 ? '奇' : '偶'}数 → <b style={{ color: '#c2a05a' }}>{polarity(i)}性</b></motion.div>
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>{i} ÷ 4 余 {i % 4} → <b style={{ color: ELEMENT_COLOR[element(i)] }}>{element(i)}</b>（余 1 火 · 2 土 · 3 风 · 0 水）</motion.div>
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>{i} ÷ 3 余 {i % 3} → <b style={{ color: '#c2a05a' }}>{modality(i)}</b>（余 1 开创 · 2 固定 · 0 变动）</motion.div>
        </div>
      </div>
    </div>
  )
}

/* ── 速算闯关：20 题，每题 10 秒（第 27 天） ── */
export function SpeedWidget() {
  const [round, setRound] = useState<{ i: number; ask: 'p' | 'e' | 'm' | 'r' }[] | null>(null)
  const [k, setK] = useState(0)
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(10)
  const [flash, setFlash] = useState<null | boolean>(null)
  const best = Number(getState().notes['speed-best'] ?? 0)
  const start = () => {
    const asks: ('p' | 'e' | 'm' | 'r')[] = ['p', 'e', 'm', 'r']
    setRound(Array.from({ length: 20 }, () => ({ i: 1 + Math.floor(Math.random() * 12), ask: asks[Math.floor(Math.random() * 4)] })))
    setK(0); setScore(0); setLeft(10)
  }
  const q = round?.[k]
  useEffect(() => {
    if (!round || k >= 20) return
    const t = setInterval(() => setLeft((l) => l - 0.1), 100)
    return () => clearInterval(t)
  }, [round, k])
  const answer = (ok: boolean) => {
    setFlash(ok)
    const ns = score + (ok ? 1 : 0)
    setScore(ns)
    setTimeout(() => setFlash(null), 350)
    if (k + 1 >= 20 && ns > best) setNote('speed-best', String(ns))
    setK(k + 1); setLeft(10)
  }
  useEffect(() => { if (round && k < 20 && left <= 0) answer(false) })
  const opts = useMemo(() => {
    if (!q) return []
    if (q.ask === 'p') return ['阳', '阴'].map((o) => [o, o === polarity(q.i)] as const)
    if (q.ask === 'e') return (['火', '土', '风', '水'] as const).map((o) => [o, o === element(q.i)] as const)
    if (q.ask === 'm') return (['开创', '固定', '变动'] as const).map((o) => [o, o === modality(q.i)] as const)
    const cands = [q.i, ((q.i + 3) % 12) + 1, ((q.i + 6) % 12) + 1, ((q.i + 8) % 12) + 1]
    return cands.sort((a, b) => (a * 7) % 5 - (b * 7) % 5).map((c) => [SIGNS[c - 1].name, c === q.i] as const)
  }, [q])
  if (!round) return (
    <div className="wg" style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, margin: '10px 0' }}>速算闯关 · 20 题</div>
      <div style={{ fontSize: 13, color: 'rgba(246,241,228,0.7)' }}>每题 10 秒。不用背：从白羊数，用奇偶、÷4、÷3。</div>
      {best > 0 && <div style={{ fontSize: 13, color: '#c2a05a', marginTop: 6 }}>最好成绩 {best} / 20</div>}
      <button className="btn gold" style={{ marginTop: 14 }} onClick={start}>开始</button>
    </div>
  )
  if (k >= 20) return (
    <div className="wg" style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 40, color: '#c2a05a' }}>{score} / 20</div>
      <div style={{ fontSize: 13, color: 'rgba(246,241,228,0.7)' }}>{score >= 18 ? '又快又准！' : score >= 12 ? '不错，再来一轮会更快。' : '慢慢来，先把三个规则想清楚。'}</div>
      <button className="btn gold" style={{ marginTop: 14 }} onClick={start}>再来一轮</button>
    </div>
  )
  const sign = SIGNS[q!.i - 1]
  const prompt = q!.ask === 'p' ? `${sign.name}（第 ${q!.i} 个）的极性？` : q!.ask === 'e' ? `${sign.name}（第 ${q!.i} 个）的元素？` : q!.ask === 'm' ? `${sign.name}（第 ${q!.i} 个）的模式？` : `哪个是"${element(q!.i)} + ${modality(q!.i)}"？`
  return (
    <motion.div className="wg" animate={{ boxShadow: flash === null ? '0 0 0 0 rgba(0,0,0,0)' : flash ? '0 0 0 3px #3f6e66' : '0 0 0 3px #b0442f' }}>
      <div className="wg-read" style={{ justifyContent: 'space-between' }}><span>第 <b>{k + 1}</b> / 20</span><span>得分 <b>{score}</b></span></div>
      <div style={{ height: 4, background: 'rgba(246,241,228,0.12)', borderRadius: 4, margin: '6px 0 12px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${left * 10}%`, background: left < 3 ? '#e88a72' : '#c2a05a', transition: 'width 0.1s linear' }} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        {q!.ask !== 'r' && <Glyph i={q!.i} size={44} color="#e6cf95" width={6} />}
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{prompt}</div>
      </div>
      <div className="wg-btns" style={{ justifyContent: 'center', marginTop: 14 }}>
        {opts.map(([o, ok]) => <button key={o} className="wg-btn" style={{ fontSize: 15, padding: '8px 16px' }} onClick={() => answer(ok)}>{o}</button>)}
      </div>
    </motion.div>
  )
}
