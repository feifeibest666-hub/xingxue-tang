// 阶段 15：比对盘、组合中点 / 戴维森、改写、咨询后自评。星历只走 natal.ts。
import { useEffect, useState } from 'react'
import { GlyphAt } from '../Glyph'
import { PlanetAt } from '../PlanetGlyph'
import { MAX_ELONGATION, type Planet } from '../../data/classical'
import { fmtLon } from '../../data/zodiac'
import { type Birth, type Chart, BODY_COLOR, BODY_NAME, BODY_SHORT, CLASSICAL, chartAt, computeChart, norm, sep, wholeHouse } from '../../lib/natal'
import { setNote, useStore } from '../../lib/store'
import { CasePicker, NeedMine, Wheel, useChartOf } from './natal'
import { Btns, reduceMotion, type WidgetMap } from './common'
import { PLACES } from './tools'

const D = Math.PI / 180
const GOLD = '#c2a05a'
const TEAL = '#7fc4c0'

/** 近中点：沿较短弧走一半。角距 ≥ 175° 时两条弧几乎一样长，标成歧义。 */
function nearerMid(a: number, b: number) {
  const apart = sep(a, b)
  let d = norm(b - a)
  if (d > 180) d -= 360
  return { mid: norm(a + d / 2), apart, ambiguous: apart >= 175 }
}
const geo = (lon: number) => (lon > 180 ? lon - 360 : lon)
const fmtUT = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UT`
}
const PTO = [{ name: '合', deg: 0 }, { name: '六分', deg: 60 }, { name: '四分', deg: 90 }, { name: '三分', deg: 120 }, { name: '对分', deg: 180 }]
function crossAspects(a: Chart, b: Chart) {
  const out: { pa: Planet; pb: Planet; name: string; orb: number }[] = []
  for (const pa of CLASSICAL) for (const pb of CLASSICAL) {
    const dist = sep(a.pos[pa].lon, b.pos[pb].lon)
    for (const x of PTO) {
      const orb = Math.abs(dist - x.deg)
      const lim = pa === 'sun' || pa === 'moon' || pb === 'sun' || pb === 'moon' ? 8 : 6
      if (orb <= lim + 1e-6) out.push({ pa, pb, name: x.name, orb })
    }
  }
  return out.sort((p, q) => p.orb - q.orb)
}
function along(from: number, to: number, t: number) {
  let d = norm(to - from)
  if (d > 180) d -= 360
  return norm(from + d * t)
}
/** 播放一次（约 0.9 秒）。减少动效时直接停在终点。 */
function useSlide(key: string) {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (reduceMotion()) { setP(1); return }
    setP(0)
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 900)
      setP(1 - (1 - t) ** 3)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key])
  return p
}

interface Side { mode: 'case' | 'form'; src: string; date: string; time: string; place: string; dst: boolean }
const sideOf = (src: string): Side => ({ mode: 'case', src, date: '1992-03-21', time: '08:00', place: '北京', dst: false })

function useSide(side: Side) {
  const picked = useChartOf(side.mode === 'case' ? side.src : 'elizabeth2')
  const place = PLACES.find((x) => x.name === side.place) ?? PLACES[0]
  const [chart, setChart] = useState<Chart | null>(null)
  useEffect(() => {
    if (side.mode !== 'form' || !side.date) { setChart(null); return }
    const birth: Birth = { date: side.date, time: side.time || '12:00', tz: place.tz + (side.dst ? 1 : 0), lat: place.lat, lon: place.lon, place: place.name }
    let ok = true
    setChart(null)
    computeChart(birth).then((c) => { if (ok) setChart(c) })
    return () => { ok = false }
  }, [side.mode, side.date, side.time, side.place, side.dst, place.tz, place.lat, place.lon, place.name])
  if (side.mode === 'case') return { chart: picked.chart, birth: picked.birth, label: picked.label || '案例', waiting: Boolean(picked.birth && !picked.chart), needMine: side.src === 'me' && !picked.birth }
  const demo = side.date === '1992-03-21' && side.time === '08:00' && side.place === '北京' ? '示意甲（虚构）'
    : side.date === '1990-09-23' && side.time === '20:30' && side.place === '上海' ? '示意乙（虚构）' : ''
  const birth: Birth | null = side.date ? { date: side.date, time: side.time || '12:00', tz: place.tz + (side.dst ? 1 : 0), lat: place.lat, lon: place.lon, place: place.name } : null
  return { chart, birth, label: demo || (birth ? `手填 · ${birth.place}` : '手填'), waiting: Boolean(birth && !chart), needMine: false }
}

function SideEdit({ title, side, set }: { title: string; side: Side; set: (s: Side) => void }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div className="wg-cap" style={{ textAlign: 'left' }}>{title}：{side.mode === 'case' ? '从案例里选' : '手填出生资料'}</div>
      <Btns<Side['mode']> items={[['case', '案例 / 我的盘'], ['form', '手填']]} value={side.mode} onChange={(mode) => set({ ...side, mode })} />
      {side.mode === 'case' ? <CasePicker value={side.src} onChange={(src) => set({ ...side, src })} /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.85fr 1fr', gap: 6, marginTop: 6 }}>
            <input type="date" value={side.date} onChange={(e) => set({ ...side, date: e.target.value })} />
            <input type="time" value={side.time} onChange={(e) => set({ ...side, time: e.target.value })} />
            <select value={side.place} onChange={(e) => set({ ...side, place: e.target.value })}>{PLACES.map((p) => <option key={p.name}>{p.name}</option>)}</select>
          </div>
          <div className="wg-btns"><button className={`wg-btn ${side.dst ? 'on' : ''}`} onClick={() => set({ ...side, dst: !side.dst })}>夏令时 +1 小时</button></div>
        </>
      )}
    </div>
  )
}

function usePair(initA: string, initB: string) {
  const [a, setA] = useState<Side>(() => sideOf(initA))
  const [b, setB] = useState<Side>(() => ({ ...sideOf(initB), date: '1990-09-23', time: '20:30', place: '上海' }))
  const [swap, setSwap] = useState(false)
  const A = useSide(a)
  const B = useSide(b)
  const loadDemo = () => {
    setSwap(false)
    setA({ mode: 'form', src: initA, date: '1992-03-21', time: '08:00', place: '北京', dst: false })
    setB({ mode: 'form', src: initB, date: '1990-09-23', time: '20:30', place: '上海', dst: false })
  }
  return { a, setA, b, setB, A, B, inner: swap ? B : A, outer: swap ? A : B, swap, setSwap, loadDemo }
}

function PairNotes({ a, b }: { a: Side; b: Side }) {
  const sisters = a.mode === 'case' && b.mode === 'case' && [a.src, b.src].sort().join() === 'elizabeth2,margaret'
  const demo = a.mode === 'form' && b.mode === 'form' && a.date === '1992-03-21' && b.date === '1990-09-23'
  return (
    <>
      {sisters && <div className="wg-read"><span>伊丽莎白二世和玛格丽特公主是<b>姐妹</b>，不是伴侣。这里用来练家庭比对。</span></div>}
      {demo && <div className="wg-read"><span>示意甲、示意乙是<b>虚构</b>的教学盘，不是历史人物，也不是一对真实伴侣。</span></div>}
      <div className="wg-cap">手填的资料只在这一页计算，不写入存档、不上传。给真人起盘前先征得同意。</div>
    </>
  )
}

function Biwheel({ a: initA = 'elizabeth2', b: initB = 'margaret' }: { a?: string; b?: string }) {
  const pair = usePair(initA, initB)
  const { inner, outer } = pair
  const key = `${inner.chart?.ut.getTime() ?? 0}-${outer.chart?.ut.getTime() ?? 0}-${inner.label}-${outer.label}`
  const slide = useSlide(key)
  const ready = inner.chart && outer.chart
  const pts = ready ? CLASSICAL.map((b) => ({
    lon: norm(outer.chart!.pos[b].lon + (1 - slide) * 42),
    label: BODY_SHORT[b],
    color: BODY_COLOR[b],
  })) : []
  const houses = ready ? CLASSICAL.map((b) => ({ b, house: wholeHouse(outer.chart!.pos[b].lon, inner.chart!.asc), lon: outer.chart!.pos[b].lon })) : []
  const aspects = ready ? crossAspects(inner.chart!, outer.chart!) : []
  return (
    <div className="wg">
      <SideEdit title="甲" side={pair.a} set={pair.setA} />
      <SideEdit title="乙" side={pair.b} set={pair.setB} />
      <div className="wg-btns">
        <button className="wg-btn" onClick={pair.loadDemo}>载入示意一对（虚构）</button>
        <button className={`wg-btn ${pair.swap ? 'on' : ''}`} onClick={() => pair.setSwap((v) => !v)}>对调甲 ↔ 乙</button>
      </div>
      <PairNotes a={pair.a} b={pair.b} />
      {inner.needMine || outer.needMine ? <NeedMine /> : !ready ? <div className="wg-cap">计算中…</div> : (
        <>
          <div className="wg-cap" style={{ textAlign: 'left' }}>内圈 {inner.label}　外圈 {outer.label}（滑入一次）</div>
          <Wheel c={inner.chart!} outer={{ pts, name: outer.label }} showAspects={false} />
          <div className="wg-cap">外圈是对方的七颗古典行星，落进内圈的整宫。盘内相位先关掉，交叉相位看下面的表。</div>
          <table className="wg-table">
            <thead><tr><th>外圈</th><th>位置</th><th>落在内圈</th></tr></thead>
            <tbody>{houses.map((h) => <tr key={h.b}><td>{BODY_NAME[h.b]}</td><td>{fmtLon(h.lon)}</td><td>第 {h.house} 宫</td></tr>)}</tbody>
          </table>
          <table className="wg-table">
            <thead><tr><th>内圈</th><th>相位</th><th>外圈</th><th>容许</th></tr></thead>
            <tbody>
              {aspects.length === 0 && <tr><td colSpan={4}>本课容许度内没有托勒密交叉相位</td></tr>}
              {aspects.map((x, i) => <tr key={i}><td>{BODY_NAME[x.pa]}</td><td>{x.name}</td><td>{BODY_NAME[x.pb]}</td><td>{x.orb.toFixed(1)}°</td></tr>)}
            </tbody>
          </table>
          <div className="wg-cap">托勒密五种相位。一般容许 ≤ 6°；只要有一边是太阳或月亮，放宽到 ≤ 8°。这是本课的约定。</div>
        </>
      )}
    </div>
  )
}

function polar(cx: number, cy: number, lon: number, r: number) {
  const t = lon * D
  return [cx - r * Math.cos(t), cy + r * Math.sin(t)] as const
}

function CompositeRing({ a, b, p }: { a: Chart; b: Chart; p: number }) {
  const size = 168, cx = 84, cy = 84
  const rows = CLASSICAL.map((body) => ({ body, ...nearerMid(a.pos[body].lon, b.pos[body].lon) }))
  return (
    <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={78} fill="#101528" stroke="rgba(246,241,228,0.3)" />
      <circle cx={cx} cy={cy} r={62} fill="none" stroke="rgba(246,241,228,0.2)" />
      {Array.from({ length: 12 }, (_, k) => {
        const [x, y] = polar(cx, cy, k * 30 + 15, 70)
        return <GlyphAt key={k} i={k + 1} x={x} y={y} size={11} color={GOLD} width={8} />
      })}
      {rows.map((r) => {
        const la = along(a.pos[r.body].lon, r.mid, p)
        const lb = along(b.pos[r.body].lon, r.mid, p)
        const [xa, ya] = polar(cx, cy, la, 48)
        const [xb, yb] = polar(cx, cy, lb, 48)
        return (
          <g key={r.body}>
            {p < 0.98 && <PlanetAt p={r.body} x={xb} y={yb} size={12} color={TEAL} width={8} />}
            <PlanetAt p={r.body} x={xa} y={ya} size={13} color={BODY_COLOR[r.body]} width={8} />
          </g>
        )
      })}
    </svg>
  )
}

function Composite({ a: initA = 'elizabeth2', b: initB = 'margaret' }: { a?: string; b?: string }) {
  const pair = usePair(initA, initB)
  const cA = pair.A.chart, cB = pair.B.chart
  const key = `${cA?.ut.getTime() ?? 0}-${cB?.ut.getTime() ?? 0}`
  const slide = useSlide(cA && cB ? key : 'wait')
  const [dav, setDav] = useState<Chart | null>(null)
  const [meta, setMeta] = useState('')
  useEffect(() => {
    if (!cA || !cB) return
    const midUT = new Date((cA.ut.getTime() + cB.ut.getTime()) / 2)
    const midLat = (cA.lat + cB.lat) / 2
    const m = nearerMid(cA.lon, cB.lon)
    const lon = geo(m.mid)
    let ok = true
    setDav(null)
    setMeta(`${fmtUT(midUT)} · 北纬 ${midLat.toFixed(1)}° · 东经 ${lon.toFixed(1)}°${m.ambiguous ? ' · 经度中点有歧义' : ''}`)
    chartAt(midUT, midLat, lon).then((c) => { if (ok) setDav(c) }).catch(() => { if (ok) setDav(null) })
    return () => { ok = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = cA && cB ? CLASSICAL.map((body) => ({ body, ...nearerMid(cA.pos[body].lon, cB.pos[body].lon) })) : []
  const sun = rows.find((r) => r.body === 'sun')
  const merc = rows.find((r) => r.body === 'mercury')
  const ven = rows.find((r) => r.body === 'venus')
  const venEl = sun && ven ? sep(ven.mid, sun.mid) : 0
  const mercEl = sun && merc ? sep(merc.mid, sun.mid) : 0
  const venAlt = sun && ven ? sep(ven.mid, norm(sun.mid + 180)) : 0
  const dVen = dav ? sep(dav.pos.venus.lon, dav.pos.sun.lon) : 0
  const dMerc = dav ? sep(dav.pos.mercury.lon, dav.pos.sun.lon) : 0
  return (
    <div className="wg">
      <SideEdit title="甲" side={pair.a} set={pair.setA} />
      <SideEdit title="乙" side={pair.b} set={pair.setB} />
      <div className="wg-btns"><button className="wg-btn" onClick={pair.loadDemo}>载入示意一对（虚构）</button></div>
      <PairNotes a={pair.a} b={pair.b} />
      {pair.A.needMine || pair.B.needMine ? <NeedMine /> : !cA || !cB ? <div className="wg-cap">计算中…</div> : (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wg-cap">组合中点</div>
              <CompositeRing a={cA} b={cB} p={slide} />
              <div className="wg-cap">黄道 0° 在左侧。两颗星滑向近中点，只播放一次。</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wg-cap">戴维森盘</div>
              {dav ? <Wheel c={dav} size={168} showAspects={false} /> : <div className="wg-cap">计算中…</div>}
              <div className="wg-cap">上升放在左侧。这是真实的一刻。</div>
            </div>
          </div>
          <div className="wg-read"><span>戴维森：<b>{meta || '计算中…'}</b></span></div>
          <div className="wg-read">
            <span>组合中点可以拼出真实天空没有的格局；戴维森盘是一个真实时刻，不会。</span>
          </div>
          {sun?.ambiguous && (
            <div className="wg-read"><span>太阳角距 {sun.apart.toFixed(1)}°，接近 180°，<b>近中点不稳定</b>。按当前近中点，金星距太阳 {venEl.toFixed(1)}°{venEl > 48 ? '，超过约 47° 的平均上限' : ''}；改取对面的中点，这个距角变成 {venAlt.toFixed(1)}°。先标出歧义，再谈格局。</span></div>
          )}
          {!sun?.ambiguous && (venEl > 48 || mercEl > 29) && (
            <div className="wg-read"><span>{mercEl > 29 ? `水星距组合太阳 ${mercEl.toFixed(1)}°，超过约 ${MAX_ELONGATION.mercury}°。` : ''}{venEl > 48 ? `金星距组合太阳 ${venEl.toFixed(1)}°，超过约 ${MAX_ELONGATION.venus}°。` : ''}真实天空里不会离太阳这么远。</span></div>
          )}
          {dav && <div className="wg-read"><span>戴维森盘里水星距太阳 {dMerc.toFixed(1)}°，金星距太阳 {dVen.toFixed(1)}°（平均上限约 {MAX_ELONGATION.mercury}° / {MAX_ELONGATION.venus}°）。</span></div>}
          <table className="wg-table">
            <thead><tr><th>行星</th><th>近中点</th><th>角距</th><th></th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.body}><td>{BODY_NAME[r.body]}</td><td>{fmtLon(r.mid)}</td><td>{r.apart.toFixed(1)}°</td><td>{r.ambiguous ? '歧义' : ''}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  )
}

const REWRITES: { id: string; bad: string; good: string; rule: string }[] = [
  { id: 'divorce', bad: '你会离婚。', good: '关系里有些主题，这段时间会被反复碰到。怎么走，要看你们怎么处理。', rule: '不说死；加上时间范围' },
  { id: 'fit', bad: '他天生不适合你。', good: '你们的相处里有一种反复出现的张力。适不适合，要看双方愿不愿意面对它。', rule: '不说死；把选择权留下' },
  { id: 'blame', bad: '你命里克夫。', good: '这种说法把别人的遭遇算到你头上。盘最多描述相处的主题，不能把谁的命运归咎于谁。', rule: '不归咎' },
  { id: 'money', bad: '你今年一定破财。', good: '今年钱的话题可能更显眼：预算、合作、意外开支。把它当作提醒去核对，不是注定。', rule: '不说死；加上时间范围' },
  { id: 'mother', bad: '你母亲就是这样的人，改不了。', good: '盘描述的是相处里反复出现的角色，不是给一个人下终生判决。', rule: '不说死；不归咎' },
  { id: 'stay', bad: '你不该和这个人在一起。', good: '我可以讲看到的相处主题和可能的代价。去留是你的决定。', rule: '把选择权留下' },
  { id: 'child', bad: '你的孩子以后没出息。', good: '对未成年人，只讲当下可以怎么支持，不下终生标签。具体安排要和监护人一起看。', rule: '不说死；不归咎' },
  { id: 'ill', bad: '你下个月会大病一场。', good: '我不能用星盘预言疾病。身体不舒服请看医生；紧急情况打 120。', rule: '该转介就转介' },
  { id: 'death', bad: '你活不过五十岁。', good: '我不为任何人预言死亡。如果这句话让你害怕，我们停下；需要的话找专业的人谈。', rule: '该转介就转介；不说死' },
  { id: 'sign', bad: '你们太阳星座不合，在一起不会幸福。', good: '太阳星座只是大约十个天体里的一个，也不能决定一段关系。要看相处里具体发生什么。', rule: '不说死' },
  { id: 'cheat', bad: '他出轨是你盘里写好的。', good: '别人的行为是别人的责任。盘不能替任何人的选择开脱，也不能把责任算到你身上。', rule: '不归咎；把选择权留下' },
  { id: 'job', bad: '你这个月必须辞职，否则一辈子完了。', good: '工作主题这段时间比较紧。辞不辞职，取决于合同、存款和你自己的打算。', rule: '加上时间范围；把选择权留下' },
]

function Rewrite() {
  const notes = useStore().notes
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  return (
    <div className="wg">
      <div className="wg-cap" style={{ textAlign: 'left' }}>点一句宿命论的话，看它怎么改成"倾向"。你自己的改写只存在本机。</div>
      {REWRITES.map((c) => {
        const on = open === c.id
        const mine = draft[c.id] ?? notes[`r-rewrite-${c.id}`] ?? ''
        return (
          <div key={c.id} style={{ marginTop: 8, padding: '8px 10px', borderRadius: 12, background: 'rgba(246,241,228,0.04)', border: '1px solid rgba(246,241,228,0.12)' }}>
            <button className="wg-btn" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(on ? null : c.id)}>{c.bad}</button>
            {on && (
              <div style={{ marginTop: 8 }}>
                <div style={{ textDecoration: 'line-through', color: 'rgba(246,241,228,0.45)', fontSize: 13 }}>{c.bad}</div>
                <div className="wg-read"><span>{c.good}</span></div>
                <div className="wg-cap" style={{ textAlign: 'left' }}>用到的规则：{c.rule}</div>
                <textarea value={mine} placeholder="换成你自己的说法…" onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, [c.id]: v })); setNote(`r-rewrite-${c.id}`, v) }} style={{ width: '100%', minHeight: 64, marginTop: 6 }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const FEED = [
  ['open', '开场确认了对方想谈的主题'],
  ['frame', '讲了框架：这是象征读法，不是定论'],
  ['tone', '用了"倾向"，没有说"一定"'],
  ['death', '没有预言死亡或疾病'],
  ['choice', '没有替对方做决定'],
  ['minor', '若涉及未成年人：确认了监护人同意，没有贴标签'],
  ['crisis', '若出现危机：指向了专业帮助（内地紧急情况 120、110；心理热线用当地公开号码）'],
  ['privacy', '出生数据留在本机，没有未经同意外传'],
  ['close', '结尾做了总结，并问对方听懂了没有'],
  ['honest', '不确定的地方记下了，没有装懂'],
] as const

function Feedback() {
  const notes = useStore().notes
  const saved = (() => { try { return JSON.parse(notes['r-feedback'] || '{}') as { on?: string[]; note?: string } } catch { return {} } })()
  const [on, setOn] = useState<string[]>(saved.on ?? [])
  const [note, setN] = useState(saved.note ?? '')
  const write = (next: string[], text: string) => setNote('r-feedback', JSON.stringify({ on: next, note: text }))
  const toggle = (id: string) => {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id]
    setOn(next); write(next, note)
  }
  return (
    <div className="wg">
      <div className="wg-cap" style={{ textAlign: 'left' }}>咨询之后自己勾。只存在本机，用来改下一次，不是给自己打分。</div>
      {FEED.map(([id, label]) => (
        <button key={id} className={`wg-btn ${on.includes(id) ? 'on' : ''}`} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6 }} onClick={() => toggle(id)}>{on.includes(id) ? '✓ ' : '○ '}{label}</button>
      ))}
      <textarea value={note} placeholder="这次最想改的一句…" onChange={(e) => { setN(e.target.value); write(on, e.target.value) }} style={{ width: '100%', minHeight: 64, marginTop: 8 }} />
    </div>
  )
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
export const W15: WidgetMap = {
  rBiwheel: (a) => <Biwheel a={str(a.a)} b={str(a.b)} />,
  rComposite: (a) => <Composite a={str(a.a)} b={str(a.b)} />,
  rRewrite: () => <Rewrite />,
  rFeedback: () => <Feedback />,
}
