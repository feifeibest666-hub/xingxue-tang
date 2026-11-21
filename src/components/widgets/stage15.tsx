// 阶段 15：比对盘、组合中点 / 戴维森、改写与咨询自评。容许度按本阶段约定：托勒密相位，一般 ≤ 6°，任一方为日月则 ≤ 8°。
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Btns, Note, reduceMotion, type WidgetMap } from './common'
import { CasePicker, MyBirthForm, NeedMine, Wheel, fmtL, useChartOf } from './natal'
import { ASPECTS, DOMICILE, EXALTATION, HOUSE_TOPICS, MAX_ELONGATION, type Planet } from '../../data/classical'
import { fmtLon } from '../../data/zodiac'
import {
  BODY_COLOR, BODY_NAME, BODY_SHORT, BODIES, CLASSICAL, type Birth, type Body, type Chart,
  chartAt, computeChart, norm, positionsAt, sep, signIdx, signRuler, wholeHouse,
} from '../../lib/natal'
import { getState, setNote, useStore } from '../../lib/store'

const AMBIG = 170

function orbLimit(a: string, b: string) {
  return a === 'sun' || a === 'moon' || b === 'sun' || b === 'moon' ? 8 : 6
}
function nearerMid(a: number, b: number) {
  const d = norm(b - a)
  const apart = d > 180 ? 360 - d : d
  const mid = norm(a + (d <= 180 ? d / 2 : -(360 - d) / 2))
  return { mid, apart, ambiguous: apart >= AMBIG }
}
function midGeo(x: number, y: number) {
  let d = y - x
  while (d > 180) d -= 360
  while (d < -180) d += 360
  let m = x + d / 2
  while (m > 180) m -= 360
  while (m <= -180) m += 360
  return { mid: m, apart: Math.abs(d), ambiguous: Math.abs(d) >= AMBIG }
}
function lerpLon(from: number, to: number, t: number) {
  let d = norm(to - from)
  if (d > 180) d -= 360
  return norm(from + d * t)
}
function hits(aLon: number, aName: string, bLon: number, bName: string) {
  const d = sep(aLon, bLon)
  const out: { name: string; orb: number }[] = []
  for (const asp of ASPECTS) {
    const orb = Math.abs(d - asp.deg)
    if (orb <= orbLimit(aName, bName) + 1e-9) out.push({ name: asp.name, orb })
  }
  return out
}
function reception(guestLon: number, host: Planet) {
  const s = signIdx(guestLon)
  const by: string[] = []
  if (DOMICILE[s - 1] === host) by.push('庙')
  if (EXALTATION[host]?.sign === s) by.push('旺')
  return by
}

function usePair(id: string, custom: Birth | null) {
  const picked = useChartOf(id === 'custom' ? 'elizabeth2' : id)
  const [chart, setChart] = useState<Chart | null>(null)
  const key = custom ? JSON.stringify(custom) : ''
  useEffect(() => {
    if (id !== 'custom' || !custom) { setChart(null); return }
    let ok = true
    computeChart(custom).then((c) => { if (ok) setChart(c) }).catch(() => { if (ok) setChart(null) })
    return () => { ok = false }
  }, [id, key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (id === 'custom') return { chart, label: '手填的乙', birth: custom }
  return picked
}

function BirthFields({ onUse }: { onUse: (b: Birth) => void }) {
  const [date, setDate] = useState('1990-01-01')
  const [time, setTime] = useState('12:00')
  const [tz, setTz] = useState(8)
  const [lat, setLat] = useState(39.9)
  const [lon, setLon] = useState(116.4)
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 6 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <input type="number" value={tz} step={0.5} onChange={(e) => setTz(Number(e.target.value))} aria-label="时区" />
        <span className="wg-read" style={{ marginTop: 0 }}><span>时区（东经为正）</span></span>
        <input type="number" value={lat} step={0.1} onChange={(e) => setLat(Number(e.target.value))} aria-label="纬度" />
        <input type="number" value={lon} step={0.1} onChange={(e) => setLon(Number(e.target.value))} aria-label="经度" />
      </div>
      <div className="wg-btns">
        <button className="wg-btn on" disabled={!date || Number.isNaN(lat) || Number.isNaN(lon)} onClick={() => onUse({ date, time: time || '12:00', tz: Number.isNaN(tz) ? 0 : tz, lat: Math.max(-66, Math.min(66, lat)), lon: Math.max(-180, Math.min(180, lon)), place: '手填' })}>用这组出生资料</button>
      </div>
      <div className="wg-cap" style={{ fontSize: 13, textAlign: 'left' }}>先得到对方同意。数字只留在本机。上面的初始值是示例，请改成真实的日期、钟点和地点。</div>
    </div>
  )
}

function PairBar({ a, b, setA, setB, custom, setCustom }: {
  a: string; b: string; setA: (v: string) => void; setB: (v: string) => void; custom: Birth | null; setCustom: (b: Birth) => void
}) {
  return (
    <>
      <div className="wg-btns" style={{ marginTop: 0 }}>
        <span className="wg-read" style={{ marginTop: 0 }}><span>甲</span></span>
        <CasePicker value={a} onChange={setA} />
        <span className="wg-read" style={{ marginTop: 0 }}><span>乙</span></span>
        {b === 'custom'
          ? <button className="wg-btn on" onClick={() => setB('margaret')}>手填乙</button>
          : <CasePicker value={b} onChange={setB} />}
        <button className={`wg-btn ${b === 'custom' ? 'on' : ''}`} onClick={() => setB('custom')}>手填第二人</button>
      </div>
      {b === 'custom' && <BirthFields onUse={(birth) => { setNote('r-birth-b', JSON.stringify(birth)); setCustom(birth) }} />}
      {b === 'custom' && custom && <div className="wg-read"><span>当前手填：{custom.date} {custom.time}　时区 {custom.tz}　{custom.lat}°, {custom.lon}°</span></div>}
    </>
  )
}

function rememberCustom(): Birth | null {
  try {
    const b = JSON.parse(getState().notes['r-birth-b'] ?? 'null') as Birth | null
    return b && b.date ? b : null
  } catch { return null }
}

/* ── 双盘：内圈甲，外圈乙滑入 ── */
function Biwheel({ a0, b0, focus }: { a0: string; b0: string; focus?: string }) {
  const [aId, setA] = useState(a0)
  const [bId, setB] = useState(b0)
  const [custom, setCustom] = useState<Birth | null>(rememberCustom)
  const [inner, setInner] = useState<'a' | 'b'>('a')
  const [slide, setSlide] = useState(1)
  const A = usePair(aId, custom)
  const B = usePair(bId, custom)
  const left = inner === 'a' ? A : B
  const right = inner === 'a' ? B : A
  const key = left.chart && right.chart ? `${inner}:${left.chart.ut.toISOString()}:${right.chart.ut.toISOString()}:${left.chart.asc.toFixed(2)}:${right.chart.asc.toFixed(2)}` : ''
  useEffect(() => {
    if (!key) return
    if (reduceMotion()) { setSlide(1); return }
    setSlide(0)
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 900)
      setSlide(p)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [key])
  const bodies: Planet[] = focus === 'lights' ? ['sun', 'moon'] : focus === 'venus' ? ['venus', 'mars'] : [...CLASSICAL]
  const outer = useMemo(() => {
    if (!left.chart || !right.chart) return undefined
    const pts = bodies.map((b) => ({
      lon: lerpLon(left.chart!.asc, right.chart!.pos[b].lon, slide),
      label: BODY_SHORT[b],
      color: BODY_COLOR[b],
    }))
    if (focus !== 'venus') pts.push({ lon: lerpLon(left.chart.asc, right.chart.asc, slide), label: '升', color: '#f6f1e4' })
    return { pts, name: '外圈' }
  }, [left.chart, right.chart, slide, focus]) // eslint-disable-line react-hooks/exhaustive-deps
  const sisters = [aId, bId].sort().join() === 'elizabeth2,margaret'
  const rows = left.chart && right.chart ? bodies.map((b) => {
    const h = wholeHouse(right.chart!.pos[b].lon, left.chart!.asc)
    return { b, h, lon: right.chart!.pos[b].lon }
  }) : []
  const crosses = left.chart && right.chart ? CLASSICAL.flatMap((x) => CLASSICAL.map((y) => {
    const hit = hits(left.chart!.pos[x].lon, x, right.chart!.pos[y].lon, y)[0]
    return hit ? { x, y, ...hit } : null
  }).filter((v) => v != null)).sort((p, q) => p.orb - q.orb) : []
  const shown = focus === 'lights'
    ? crosses.filter((c) => c.x === 'sun' || c.x === 'moon' || c.y === 'sun' || c.y === 'moon')
    : focus === 'venus'
      ? crosses.filter((c) => c.x === 'venus' || c.x === 'mars' || c.y === 'venus' || c.y === 'mars')
      : crosses
  const ra = left.chart ? signRuler(signIdx(left.chart.asc)) : null
  const rb = right.chart ? signRuler(signIdx(right.chart.asc)) : null
  const rulerHit = left.chart && right.chart && ra && rb ? hits(left.chart.pos[ra].lon, ra, right.chart.pos[rb].lon, rb)[0] : undefined
  const recAB = left.chart && ra && rb ? reception(left.chart.pos[ra].lon, rb) : []
  const recBA = right.chart && ra && rb ? reception(right.chart.pos[rb].lon, ra) : []
  return (
    <div className="wg">
      <Note>整宫 · 容许 6° / 日月 8°</Note>
      <PairBar a={aId} b={bId} setA={setA} setB={setB} custom={custom} setCustom={setCustom} />
      <div className="wg-btns">
        <button className={`wg-btn ${inner === 'a' ? 'on' : ''}`} onClick={() => setInner('a')}>甲在内圈</button>
        <button className={`wg-btn ${inner === 'b' ? 'on' : ''}`} onClick={() => setInner('b')}>乙在内圈</button>
      </div>
      {(aId === 'me' && !A.birth) || (bId === 'me' && !B.birth) ? <><NeedMine /><MyBirthForm /></> : null}
      {bId === 'custom' && !custom && <div className="wg-cap">先填乙的出生资料。</div>}
      {left.chart && right.chart && outer && <>
        <Wheel c={left.chart} outer={outer} showAspects={false} />
        <div className="wg-cap" style={{ fontSize: 13 }}>内圈 {left.label}，外圈 {right.label} 的行星滑入内圈的宫。</div>
        {sisters && <div className="wg-read"><span>伊丽莎白二世和玛格丽特公主是姊妹，出生时间在案例库里。用她们练叠盘可以，不要把她们说成一对恋人。</span></div>}
        <table className="wg-table">
          <thead><tr><th>外圈</th><th>黄经</th><th>落内圈</th><th>传统主题</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.b}><td>{BODY_NAME[r.b]}</td><td>{fmtL(r.lon)}</td><td>第 {r.h} 宫</td><td>{HOUSE_TOPICS[r.h - 1]}</td></tr>)}</tbody>
        </table>
        <table className="wg-table">
          <thead><tr><th>内圈</th><th>外圈</th><th>相位</th><th>容许</th></tr></thead>
          <tbody>
            {shown.length ? shown.map((c) => <tr key={c.x + c.y + c.name}><td>{BODY_NAME[c.x]}</td><td>{BODY_NAME[c.y]}</td><td>{c.name}</td><td>{c.orb.toFixed(1)}°</td></tr>) : <tr><td colSpan={4}>按本课容许度，这一组没有交叉相位。</td></tr>}
          </tbody>
        </table>
        {ra && rb && left.chart && right.chart && (
          <div className="wg-read">
            <span>内圈命主 {BODY_NAME[ra]} {fmtL(left.chart.pos[ra].lon)}；外圈命主 {BODY_NAME[rb]} {fmtL(right.chart.pos[rb].lon)}。</span>
            <span>{rulerHit ? `两颗命主${rulerHit.name}，容许 ${rulerHit.orb.toFixed(1)}°。` : `两颗命主相距 ${sep(left.chart.pos[ra].lon, right.chart.pos[rb].lon).toFixed(0)}°，本课容许度内没有相位。`}</span>
            <span>{recAB.length ? `外圈命主以${recAB.join('、')}接纳内圈命主。` : '外圈命主没有以庙或旺接纳内圈命主。'}</span>
            <span>{recBA.length ? `内圈命主以${recBA.join('、')}接纳外圈命主。` : '内圈命主没有以庙或旺接纳外圈命主。'}</span>
          </div>
        )}
      </>}
      {(!left.chart || !right.chart) && (aId !== 'me' || A.birth) && (bId !== 'me' || B.birth) && bId !== 'custom' && <div className="wg-cap">计算中…</div>}
      <div className="wg-cap" style={{ fontSize: 12.5 }}>落宫用整宫制：从内圈上升的星座数起。对调内外之后，宫位常常对不上，这是方法的一部分。</div>
    </div>
  )
}

function withLons(base: Chart, lons: Partial<Record<Body, number>>, asc: number, mc: number): Chart {
  const pos = { ...base.pos }
  for (const b of BODIES) if (lons[b] != null) pos[b] = { ...base.pos[b], lon: lons[b]!, speed: 0, retro: false }
  return { ...base, pos, asc, mc, isDay: norm(pos.sun.lon - asc) >= 180 }
}

/* ── 组合中点盘 vs 戴维森盘 ── */
function Composite({ a0, b0 }: { a0: string; b0: string }) {
  const [aId, setA] = useState(a0)
  const [bId, setB] = useState(b0)
  const [custom, setCustom] = useState<Birth | null>(rememberCustom)
  const A = usePair(aId, custom)
  const B = usePair(bId, custom)
  const [dav, setDav] = useState<Chart | null>(null)
  const pack = A.chart && B.chart ? {
    ut: new Date((A.chart.ut.getTime() + B.chart.ut.getTime()) / 2),
    lat: (A.chart.lat + B.chart.lat) / 2,
    geo: midGeo(A.chart.lon, B.chart.lon),
  } : null
  const packKey = pack ? `${pack.ut.toISOString()}|${pack.lat}|${pack.geo.mid}` : ''
  useEffect(() => {
    if (!pack) { setDav(null); return }
    let ok = true
    setDav(null)
    chartAt(pack.ut, pack.lat, pack.geo.mid).then((c) => { if (ok) setDav(c) }).catch(() => { if (ok) setDav(null) })
    return () => { ok = false }
  }, [packKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const mids = A.chart && B.chart ? BODIES.map((b) => ({ b, ...nearerMid(A.chart!.pos[b].lon, B.chart!.pos[b].lon) })) : []
  const ascM = A.chart && B.chart ? nearerMid(A.chart.asc, B.chart.asc) : null
  const mcM = A.chart && B.chart ? nearerMid(A.chart.mc, B.chart.mc) : null
  const comp = A.chart && ascM && mcM ? withLons(A.chart, Object.fromEntries(mids.map((m) => [m.b, m.mid])), ascM.mid, mcM?.mid ?? A.chart.mc) : null
  const sun = mids.find((m) => m.b === 'sun')
  const merc = mids.find((m) => m.b === 'mercury')
  const ven = mids.find((m) => m.b === 'venus')
  const flags: string[] = []
  if (sun && merc && sep(sun.mid, merc.mid) > MAX_ELONGATION.mercury) flags.push(`组合盘水星离太阳 ${sep(sun.mid, merc.mid).toFixed(0)}°，超过水星离日最远的大约 ${MAX_ELONGATION.mercury}°。真实天空不会这样。`)
  if (sun && ven && sep(sun.mid, ven.mid) > MAX_ELONGATION.venus) flags.push(`组合盘金星离太阳 ${sep(sun.mid, ven.mid).toFixed(0)}°，超过金星离日最远的大约 ${MAX_ELONGATION.venus}°。真实天空不会这样。`)
  return (
    <div className="wg">
      <Note>中点 · 真实时刻</Note>
      <PairBar a={aId} b={bId} setA={setA} setB={setB} custom={custom} setCustom={setCustom} />
      {A.chart && B.chart && comp && <>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ flex: 1 }}><Wheel c={comp} size={168} showAspects /><div className="wg-cap" style={{ fontSize: 12 }}>组合中点</div></div>
          <div style={{ flex: 1 }}>{dav ? <Wheel c={dav} size={168} showAspects /> : <div className="wg-cap">计算中…</div>}<div className="wg-cap" style={{ fontSize: 12 }}>戴维森</div></div>
        </div>
        {pack && <div className="wg-read"><span>戴维森时刻 {pack.ut.toISOString().slice(0, 16).replace('T', ' ')} UT，纬度 {pack.lat.toFixed(2)}°，经度 {pack.geo.mid.toFixed(2)}°。这是一个真实的天空。那一刻不必真有人站在那个地点。</span></div>}
        {pack?.geo.ambiguous && <div className="wg-read"><span>两地经度几乎差 180°，地点中点含糊。</span></div>}
        {flags.map((f) => <div key={f} className="wg-read"><span>{f} 组合中点盘可以画出真实天空不会有的格局。戴维森盘的行星受天文约束。</span></div>)}
        {!flags.length && <div className="wg-read"><span>这一对的水星、金星中点没有超出离日最远距离。组合盘仍是把度数取平均，不是某一时刻的天空。</span></div>}
        <table className="wg-table">
          <thead><tr><th></th><th>中点</th><th>含糊</th><th>戴维森</th></tr></thead>
          <tbody>
            {mids.filter((m) => (CLASSICAL as string[]).includes(m.b)).map((m) => (
              <tr key={m.b}><td>{BODY_NAME[m.b]}</td><td>{fmtLon(m.mid)}</td><td>{m.ambiguous ? `相距 ${m.apart.toFixed(0)}°` : ''}</td><td>{dav ? fmtLon(dav.pos[m.b].lon) : '…'}</td></tr>
            ))}
            {ascM && <tr><td>上升</td><td>{fmtLon(ascM.mid)}</td><td>{ascM.ambiguous ? '含糊' : ''}</td><td>{dav ? fmtLon(dav.asc) : '…'}</td></tr>}
          </tbody>
        </table>
        <div className="wg-cap" style={{ fontSize: 12.5 }}>相距 ≥ {AMBIG}° 时，较短弧的中点几乎和另一侧一样近，本课标成含糊。这条界线是教学约定。</div>
      </>}
      {(!A.chart || !B.chart) && <div className="wg-cap">计算中…</div>}
    </div>
  )
}

const RULES = ['不说满', '不归咎', '把决定权还回去', '加上时间', '该转介就停'] as const
const REWRITES: { fatal: string; next: string; rule: string }[] = [
  { fatal: '你会离婚。', next: '这段时间，承诺和压力的主题被标得很显眼。这是倾向，不是判决。关系怎么走，是你们两个人的事。', rule: '不说满；把决定权还回去' },
  { fatal: '他土星很重，所以他冷漠，都是他的错。', next: '土星的传统含义常被读成慢、谨慎、有负担。这是一种描述，不是给他的人格下判决，也不能变成责备他的理由。', rule: '不归咎' },
  { fatal: '你们星座不合，在一起没结果。', next: '太阳星座只是整张盘里很小的一块。研究也没有支持"星座不合就不能在一起"。合不合适，要看你们怎么相处。', rule: '不说满' },
  { fatal: '你命里没有孩子。', next: '我不能用星盘判断生育。这是医学的事，请去问医生。5 宫只是传统主题的名字。', rule: '该转介就停' },
  { fatal: '这个月必有桃花。', next: '金星这几个星期走到关系宫附近。传统会把"关系"标成这段时间更显眼的主题。"必有"说得太满。', rule: '不说满；加上时间' },
  { fatal: '都是你妈妈的盘把你害成这样。', next: '家庭盘可以描述彼此落在哪些主题里。不能把一个人的人生算成另一个人的过错。', rule: '不归咎' },
  { fatal: '你 32 岁一定结婚。', next: '有的时间技法会把某一年标成关系主题比较响的一年。它给的是一段时间的重点，不是一张结婚通知。', rule: '加上时间；不说满' },
  { fatal: '他在骗你，盘上都写了。', next: '星盘证明不了另一位具体做了什么。我不能替你断定他骗了你。这要靠你知道的事实。', rule: '把决定权还回去' },
  { fatal: '你这是抑郁症，盘上很明显。', next: '我不是医生，不能下诊断。如果你正在难受，请找精神科或心理咨询。星盘不代替他们。', rule: '该转介就停' },
  { fatal: '你再不辞职，就会倒霉一辈子。', next: '10 宫说的是事业主题，不是最后通牒。要不要换工作，等你看清自己的情况再决定。', rule: '不说满；把决定权还回去' },
  { fatal: '你父亲明年过不去。', next: '我不预言死亡。如果担心家人的身体，请去医院；紧急情况打 120。', rule: '该转介就停' },
  { fatal: '你天生就不适合学习。', next: '水星的状态是传统里的一种描述，不是智力测验，也不是终身判决。学习的办法可以改。', rule: '不说满；把决定权还回去' },
]

function Rewrite() {
  const notes = useStore().notes
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(false)
  const card = REWRITES[i]
  const id = `r-rewrite-${i}`
  const [text, setText] = useState(notes[id] ?? '')
  useEffect(() => { setText(notes[id] ?? ''); setOpen(false) }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="wg">
      <Note>{i + 1} / {REWRITES.length}</Note>
      <div className="wg-cap" style={{ textAlign: 'left', textDecoration: open ? 'line-through' : 'none', opacity: open ? 0.55 : 1 }}>{card.fatal}</div>
      <div className="wg-btns">
        <button className="wg-btn on" onClick={() => setOpen(true)}>{open ? '已揭开' : '改写成倾向'}</button>
        <button className="wg-btn" onClick={() => { setI((i + REWRITES.length - 1) % REWRITES.length) }}>上一句</button>
        <button className="wg-btn" onClick={() => { setI((i + 1) % REWRITES.length) }}>下一句</button>
      </div>
      {open && (
        <motion.div initial={reduceMotion() ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="wg-read"><span>{card.next}</span></div>
          <div className="wg-cap" style={{ fontSize: 13, textAlign: 'left' }}>用到的规则：{card.rule}</div>
        </motion.div>
      )}
      <div className="wg-cap" style={{ fontSize: 13, textAlign: 'left' }}>你自己的改写（存在本机）</div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setNote(id, e.target.value) }} placeholder="先写你的句子，再点开对照。" style={{ width: '100%', marginTop: 6 }} />
      <div className="wg-read">{RULES.map((r) => <span key={r}>{r}</span>)}</div>
    </div>
  )
}

const FEEDBACK: [string, string][] = [
  ['consent', '看盘之前，我问过同意了吗？'],
  ['data', '出生时间的来源和精度，我说明了吗？'],
  ['frame', '我有没有先说：这是传统主题，不是注定？'],
  ['evidence', '每个主题下面，有没有星、宫或相位当依据？'],
  ['room', '对方有没有足够的时间说话？'],
  ['decide', '我有没有替对方做决定（辞职、分手、生育）？'],
  ['harm', '我有没有预言疾病或死亡？'],
  ['minor', '若是未成年人：有没有监护人同意，有没有贴标签？'],
  ['crisis', '若出现危机：我有没有停下，并建议专业帮助？'],
  ['end', '结束时，决定权是不是仍在对方手里？'],
]

function Feedback() {
  const saved = useStore().notes['r-feedback']
  const [on, setOn] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(saved || '{}') } catch { return {} }
  })
  const toggle = (k: string) => {
    const next = { ...on, [k]: !on[k] }
    setOn(next)
    setNote('r-feedback', JSON.stringify(next))
  }
  const n = FEEDBACK.filter(([k]) => on[k]).length
  return (
    <div className="wg">
      <Note>只存本机</Note>
      <div className="wg-cap" style={{ textAlign: 'left', fontSize: 14 }}>咨询之后勾一遍。勾了，表示你记得检查过，不是打分。</div>
      <div className="wg-btns" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {FEEDBACK.map(([k, label]) => (
          <button key={k} className={`wg-btn ${on[k] ? 'on' : ''}`} style={{ textAlign: 'left', borderRadius: 12 }} onClick={() => toggle(k)}>{on[k] ? '✓ ' : '○ '}{label}</button>
        ))}
      </div>
      <div className="wg-read"><span>已勾 {n} / {FEEDBACK.length}。没勾的那几条，就是下次要改的地方。</span></div>
    </div>
  )
}

const ROLES: Record<string, { who: string; line: string; tasks: string[]; model: string; debrief: string }> = {
  career: {
    who: '职业迷茫的来访者（教学角色，不是真人）',
    line: '我干了三年，天天加班。盘是不是叫我辞职？你就告诉我该不该走。',
    tasks: ['先分清：他受不了的是工时、内容，还是人。', '不替他决定辞或不辞。', '若用盘，只说 10 宫和命主的传统主题，并说这是倾向。', '把问题还给他：你最想先改变的是哪一件？'],
    model: '我不能替你决定辞不辞。加班累，是你生活里的事实，比星盘优先。盘如果要看，也只是把事业读成"哪些主题被强调"，不会读成"必须走"。你现在最想改变的，是工作内容、是工时，还是和上级的关系？',
    debrief: '容易滑进去的地方：用 10 宫的一句话替他做职业决定；或把土星说成"你活该辛苦"。',
  },
  skeptic: {
    who: '怀疑占星的朋友（教学角色）',
    line: '星座不就是骗人的吗？你给我看盘，我当笑话听。',
    tasks: ['不急着辩赢。', '说出太阳星座研究的结果：没有找到稳定关联。', '说清你在做的事：传统象征语言，预测力没有被证实。', '尊重"不要看"。'],
    model: '你怀疑的那一部分有道理：只凭太阳星座说配不配，大样本研究没有找到稳定关联。我如果看盘，做的是另一件事，用一套传统象征描述主题，并且会告诉你哪句是算出来的、哪句只是传统。预测力没有被科学证实。你要是不想看，我们就停。',
    debrief: '容易滑进去的地方：被惹急了，改口说"你以后会信的"；或为了留住朋友，把证据说满。',
  },
  relate: {
    who: '关系困扰的来访者（教学角色）',
    line: '我们是不是星座不合，所以天天吵架？我是不是该分手？',
    tasks: ['不劝分，也不劝合。', '说明太阳星座解释不了吵架，研究也不支持这个说法。', '没有对方同意，不起对方的盘。', '问一次具体的吵架，而不是问星座。'],
    model: '星座合不合，解释不了你们为什么吵架。分手还是留下，我不能替你定。对方同意之前，我也不会去起他的盘。你愿意的话，先说说最近一次吵架是从哪句话开始的？',
    debrief: '容易滑进去的地方：用 7 宫或金星火星宣判这段关系；没问同意就分析另一个人。',
  },
  refuse: {
    who: '要求预测坏事的来访者（教学角色）',
    line: '你就告诉我他什么时候死。我想有个准备。',
    tasks: ['明确拒绝，不改口成"我暗示一下"。', '说明理由：不预言死亡，星盘也给不出这种答案。', '如果他其实在害怕，或他说自己撑不住，停止占星。', '急症：中国大陆医疗急救 120，人身危险 110。心理热线用当地正在公布的号码，不编造。'],
    model: '这个我不能看，也不会看。我不预言死亡，星盘也给不出这种答案。如果你担心的是他的身体，请去医院，紧急情况打 120。如果你自己正撑不住，我们把占星停掉，改找你所在地的心理危机热线或医院。',
    debrief: '这一课练的就是拒绝。暗示 8 宫"有一点凶"，仍然是在预言。对方若说自己不想活，不要继续解盘，不要用盘评价"是不是已定"。',
  },
}

function Role({ which }: { which: string }) {
  const role = ROLES[which] ?? ROLES.career
  const [show, setShow] = useState<'task' | 'model' | 'debrief'>('task')
  return (
    <div className="wg">
      <Note>角色卡</Note>
      <div className="wg-read"><span>{role.who}</span></div>
      <div className="wg-cap" style={{ textAlign: 'left' }}>「{role.line}」</div>
      <Btns items={[['task', '你的任务'], ['model', '示范回答'], ['debrief', '复盘']]} value={show} onChange={setShow} />
      {show === 'task' && <ul className="wg-read" style={{ display: 'block', paddingLeft: 18 }}>{role.tasks.map((t) => <li key={t}>{t}</li>)}</ul>}
      {show === 'model' && <div className="wg-read"><span>{role.model}</span></div>}
      {show === 'debrief' && <div className="wg-read"><span>{role.debrief}</span></div>}
    </div>
  )
}

function tightest(trLon: number, transit: Planet, c: Chart) {
  const found: { name: string; orb: number; who: string }[] = []
  const consider = (lon: number, who: string, kind: string) => {
    for (const asp of ASPECTS) {
      const orb = Math.abs(sep(trLon, lon) - asp.deg)
      if (orb <= orbLimit(transit, kind)) found.push({ name: asp.name, orb, who })
    }
  }
  for (const b of CLASSICAL) consider(c.pos[b].lon, BODY_NAME[b], b)
  consider(c.asc, '上升', 'asc')
  found.sort((a, b) => a.orb - b.orb)
  return found[0] ?? null
}

function Shared({ a0, b0 }: { a0: string; b0: string }) {
  const [aId, setA] = useState(a0)
  const [bId, setB] = useState(b0)
  const [custom, setCustom] = useState<Birth | null>(rememberCustom)
  const [when, setWhen] = useState('1980-06-15T12:00')
  const A = usePair(aId, custom)
  const B = usePair(bId, custom)
  const [tr, setTr] = useState<Awaited<ReturnType<typeof positionsAt>> | null>(null)
  useEffect(() => {
    const ut = new Date(`${when}:00Z`)
    if (Number.isNaN(ut.getTime())) { setTr(null); return }
    let ok = true
    setTr(null)
    positionsAt(ut, [...CLASSICAL]).then((p) => { if (ok) setTr(p) }).catch(() => { if (ok) setTr(null) })
    return () => { ok = false }
  }, [when])
  const slow: Planet[] = ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']
  const ca = A.chart
  const cb = B.chart
  const rows = tr && ca && cb ? slow.flatMap((p) => {
    const a = tightest(tr[p].lon, p, ca)
    const b = tightest(tr[p].lon, p, cb)
    return a && b ? [{ p, a, b }] : []
  }) : []
  return (
    <div className="wg">
      <Note>同一天空</Note>
      <PairBar a={aId} b={bId} setA={setA} setB={setB} custom={custom} setCustom={setCustom} />
      <div className="wg-row"><label>世界时</label><input type="datetime-local" value={when} onChange={(e) => e.target.value && setWhen(e.target.value)} /></div>
      <div className="wg-cap" style={{ fontSize: 13, textAlign: 'left' }}>日期随便选，用来看"同一颗行运行星同时碰到两张盘"。不要拿传记里的大事去对号。月亮走得快，几乎每天都相位，这里不拿月亮当共同主题。</div>
      {!tr && <div className="wg-cap">计算中…</div>}
      {tr && <table className="wg-table"><thead><tr><th>行运</th><th>对甲</th><th>对乙</th></tr></thead><tbody>
        {rows.length ? rows.map((r) => <tr key={r.p}><td>{BODY_NAME[r.p]} {fmtLon(tr[r.p].lon)}</td><td>{r.a.name}{r.a.who} {r.a.orb.toFixed(1)}°</td><td>{r.b.name}{r.b.who} {r.b.orb.toFixed(1)}°</td></tr>) : <tr><td colSpan={3}>这一刻没有同时碰到两张盘的行运（按本课容许度，不含月亮）。</td></tr>}
      </tbody></table>}
    </div>
  )
}

const VOICE: { tag: string; peer: string; lay: string }[] = [
  { tag: '命主', peer: '伊丽莎白二世：上升摩羯约 21°，夜生盘，命主土星在天蝎约 24°，逆行，整宫第 11 宫。这些是算出来的位置。', lay: '她的盘把"把事情做长久、自己把关"放在很前的位置。这是传统的讲法，不是性格测验的分数。' },
  { tag: '发光体', peer: '两人太阳三分，容许约 2°。姐姐的太阳与妹妹的月亮四分，容许约 5°。容许度用的是本课的 8°。', lay: '两个人的"做事节奏"在传统里被看成能对上。这只是一个主题，不是感情保证，也不是姐妹感情的原因。' },
  { tag: '落宫', peer: '玛格丽特的土星在摩羯，落在伊丽莎白的第 1 宫。宫位按姐姐的上升、整宫制来数。', lay: '妹妹的一个位置，落在姐姐"自己"那一宫里。传统会把这读成"妹妹在姐姐的生活里很靠前"。她们本来就是家人，说得对也不能证明方法灵。' },
  { tag: '两种盘', peer: '两人的组合金星几乎对分组合太阳，超过金星离日最远的大约 47°。戴维森盘用 1928-06-20 23:01 UT、纬度约 54.06°、经度约 −1.58° 起盘，金星在太阳旁边约 3°。', lay: '有一种算法会画出天空里不可能出现的样子。另一种用的是一个真实的时刻。两种都是人选择的比较法，都不是已经证实的关系说明书。' },
]

function Voice() {
  const [mode, setMode] = useState<'lay' | 'peer'>('lay')
  const [i, setI] = useState(0)
  const card = VOICE[i]
  return (
    <div className="wg">
      <Note>{card.tag}</Note>
      <Btns items={[['lay', '讲给外行'], ['peer', '讲给同行']]} value={mode} onChange={setMode} />
      <div className="wg-btns">{VOICE.map((v, k) => <button key={v.tag} className={`wg-btn ${k === i ? 'on' : ''}`} onClick={() => setI(k)}>{v.tag}</button>)}</div>
      <div className="wg-cap" style={{ textAlign: 'left', fontSize: 15 }}>{mode === 'lay' ? card.lay : card.peer}</div>
      <div className="wg-read"><span>{mode === 'lay' ? '外行版：先说人能感到的主题，术语能不用就不用。比喻说完，补一句它证明不了什么。' : '同行版：写出星、度数、宫制、容许度，并分开"算出来的"和"传统读法"。'}</span></div>
    </div>
  )
}

export const W15: WidgetMap = {
  rBiwheel: (a) => <Biwheel a0={typeof a.a === 'string' ? a.a : 'elizabeth2'} b0={typeof a.b === 'string' ? a.b : 'margaret'} focus={typeof a.focus === 'string' ? a.focus : undefined} />,
  rComposite: (a) => <Composite a0={typeof a.a === 'string' ? a.a : 'elizabeth2'} b0={typeof a.b === 'string' ? a.b : 'margaret'} />,
  rRewrite: () => <Rewrite />,
  rFeedback: () => <Feedback />,
  rRole: (a) => <Role which={typeof a.which === 'string' ? a.which : 'career'} />,
  rShared: (a) => <Shared a0={typeof a.a === 'string' ? a.a : 'elizabeth2'} b0={typeof a.b === 'string' ? a.b : 'margaret'} />,
  rVoice: () => <Voice />,
}
