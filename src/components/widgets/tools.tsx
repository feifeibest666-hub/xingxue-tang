import { useEffect, useMemo, useRef, useState } from 'react'
import { Btns, D2R, Slider } from './common'
import { GlyphAt } from '../Glyph'
import { IAU, constellationAt } from './circle'
import { SIGNS, element, fmtDeg, modality, norm360, polarity, signOf, termAt } from '../../data/zodiac'
import { ayanamsaAt, eclToEq, eqToHor, loadAstro, seasons, sunLongitude } from '../../lib/astro'
import { getState, setNote, useStore } from '../../lib/store'

type AE = Awaited<ReturnType<typeof loadAstro>>
export const PLACES = [
  { name: '北京', lat: 39.9, lon: 116.4, tz: 8 }, { name: '上海', lat: 31.2, lon: 121.5, tz: 8 }, { name: '广州', lat: 23.1, lon: 113.3, tz: 8 },
  { name: '成都', lat: 30.7, lon: 104.1, tz: 8 }, { name: '哈尔滨', lat: 45.8, lon: 126.6, tz: 8 }, { name: '乌鲁木齐', lat: 43.8, lon: 87.6, tz: 8 },
  { name: '香港', lat: 22.3, lon: 114.2, tz: 8 }, { name: '台北', lat: 25.0, lon: 121.5, tz: 8 }, { name: '悉尼', lat: -33.9, lon: 151.2, tz: 10 },
  { name: '伦敦', lat: 51.5, lon: -0.1, tz: 0 }, { name: '纽约', lat: 40.7, lon: -74.0, tz: -5 }, { name: '赤道（新加坡）', lat: 1.3, lon: 103.8, tz: 8 },
]
const fmtBJ = (d: Date, tz = 8) => {
  const x = new Date(d.getTime() + tz * 3600000)
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')} ${String(x.getUTCHours()).padStart(2, '0')}:${String(x.getUTCMinutes()).padStart(2, '0')}`
}

/* ── 今年的二分二至（第 13 天） ── */
export function SeasonsWidget() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<{ name: string; lon: number; date: Date }[] | null>(null)
  useEffect(() => { let ok = true; seasons(year).then((r) => ok && setRows(r)); return () => { ok = false } }, [year])
  return (
    <div className="wg">
      <div className="wg-row"><label>年份</label><input type="number" value={year} min={1900} max={2100} onChange={(e) => setYear(Number(e.target.value) || year)} /></div>
      {!rows ? <div className="wg-cap">正在计算……</div> : (
        <table className="wg-table">
          <thead><tr><th>节点</th><th>太阳黄经</th><th>北京时间</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.lon}°（{SIGNS[r.lon / 30].name} 0°）</td><td>{fmtBJ(r.date)}</td></tr>)}</tbody>
        </table>
      )}
      <div className="wg-cap">由天文算法（astronomy-engine）计算，误差约 1 分钟。</div>
    </div>
  )
}

/* ── 生日那天的太阳（第 13、20、41 天） ── */
interface Person { name: string; date: string; time: string }
export function SunDateWidget({ mode = 'basic' }: { mode?: 'basic' | 'sidereal' | 'attrs' }) {
  const s = useStore()
  const people: Person[] = useMemo(() => { try { return JSON.parse(s.notes['sun-people'] ?? '[]') } catch { return [] } }, [s.notes])
  const [name, setName] = useState(people.length ? '' : '我')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('12:00')
  const [lons, setLons] = useState<Record<string, number>>({})
  useEffect(() => {
    let ok = true
    Promise.all(people.map(async (p) => {
      const [y, m, d] = p.date.split('-').map(Number)
      const [hh, mm] = (p.time || '12:00').split(':').map(Number)
      const dt = new Date(Date.UTC(y, m - 1, d, hh - 8, mm))
      return [p.name + p.date + p.time, await sunLongitude(dt)] as const
    })).then((r) => ok && setLons(Object.fromEntries(r)))
    return () => { ok = false }
  }, [people])
  const save = (list: Person[]) => setNote('sun-people', JSON.stringify(list))
  const add = () => { if (!date) return; save([...people, { name: name || `第 ${people.length + 1} 位`, date, time }]); setName(''); setDate('') }
  return (
    <div className="wg">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 6 }}>
        <input placeholder="名字" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div className="wg-btns"><button className="wg-btn on" onClick={add} disabled={!date}>＋ 算一算</button><span style={{ fontSize: 11.5, color: 'rgba(246,241,228,0.5)', alignSelf: 'center' }}>按北京时间；不知道时刻就用 12:00</span></div>
      {people.length === 0 && <div className="wg-cap">输入一个生日试试。</div>}
      {people.map((p, k) => {
        const lon = lons[p.name + p.date + p.time]
        if (lon === undefined) return <div key={k} className="wg-read">{p.name} · 计算中……</div>
        const t = signOf(lon)
        const year = Number(p.date.slice(0, 4))
        const sid = signOf(lon - ayanamsaAt(year))
        const iau = constellationAt(lon, year)
        const i = t.sign.i
        return (
          <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(246,241,228,0.1)' }}>
            <svg viewBox="0 0 40 40" width={40} height={40}><GlyphAt i={i} x={20} y={20} size={30} color="#e6cf95" width={7} /></svg>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.7 }}>
              <div><b style={{ color: '#f6f1e4', fontSize: 14 }}>{p.name}</b> <span style={{ color: 'rgba(246,241,228,0.55)' }}>{p.date} {p.time}</span></div>
              <div>太阳黄经 <b style={{ color: '#c2a05a' }}>{lon.toFixed(2)}°</b> = <b style={{ color: '#c2a05a' }}>{t.sign.name} {fmtDeg(t.deg)}</b> · 节气：{termAt(lon)}附近</div>
              {mode === 'sidereal' && <div>恒星黄道（减 {ayanamsaAt(year).toFixed(1)}°）：<b style={{ color: '#8fb0d6' }}>{sid.sign.name} {fmtDeg(sid.deg)}</b> · 天文星座：<b style={{ color: iau.oph ? '#e88a72' : '#8fb0d6' }}>{iau.name}座</b></div>}
              {mode === 'attrs' && <div>{polarity(i)} · {element(i)} · {modality(i)} → 传统关键词：{t.sign.keywords.slice(0, 2).join('、')}</div>}
            </div>
            <button className="wg-btn" style={{ padding: '2px 8px' }} onClick={() => save(people.filter((_, j) => j !== k))} aria-label="删除">×</button>
          </div>
        )
      })}
    </div>
  )
}

/* ── 天空模拟器 ── */
const BRIGHT: [string, number, number][] = [
  ['北极星', 37.95, 89.26], ['天狼', 101.29, -16.72], ['织女', 279.23, 38.78], ['牛郎', 297.70, 8.87], ['天津四', 310.36, 45.28],
  ['大角', 213.92, 19.18], ['参宿四', 88.79, 7.41], ['参宿七', 78.63, -8.20], ['毕宿五', 68.98, 16.51], ['轩辕十四', 152.09, 11.97],
  ['角宿一', 201.30, -11.16], ['心宿二', 247.35, -26.43], ['北河三', 116.33, 28.03], ['南河三', 114.83, 5.22], ['五车二', 79.17, 46.00],
  ['北落师门', 344.41, -29.62], ['老人', 95.99, -52.70], ['南门二', 219.90, -60.83], ['天枢', 165.93, 61.75], ['摇光', 206.89, 49.31],
  ['昴星团', 56.75, 24.12], ['娄宿三', 31.79, 23.46], ['氐宿四', 229.25, -9.38], ['斗宿四', 283.82, -26.30], ['室宿一', 346.19, 15.21],
]
const BODIES = [
  { k: 'Sun', n: '太阳', c: '#f2c35b', r: 8 }, { k: 'Moon', n: '月亮', c: '#e4e2d6', r: 6.5 }, { k: 'Mercury', n: '水星', c: '#b8c4cc', r: 3.5 },
  { k: 'Venus', n: '金星', c: '#fff1c9', r: 4.5 }, { k: 'Mars', n: '火星', c: '#e2775a', r: 4 }, { k: 'Jupiter', n: '木星', c: '#e8d3a6', r: 4.5 }, { k: 'Saturn', n: '土星', c: '#cdb98a', r: 4 },
] as const

function eqToEcl(ra: number, dec: number, eps = 23.44) {
  const a = ra * D2R, d = dec * D2R, e = eps * D2R
  const lon = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a))
  return norm360(lon / D2R)
}

export function SkySimWidget() {
  const st = getState().settings
  const [A, setA] = useState<AE | null>(null)
  const [place, setPlace] = useState(() => PLACES.find((p) => p.name === st.place) ?? PLACES[0])
  const now = new Date()
  const [year] = useState(now.getFullYear())
  const local0 = new Date(now.getTime() + place.tz * 3600000)
  const [doy, setDoy] = useState(() => Math.floor((Date.UTC(local0.getUTCFullYear(), local0.getUTCMonth(), local0.getUTCDate()) - Date.UTC(local0.getUTCFullYear(), 0, 1)) / 86400000))
  const [hour, setHour] = useState(() => Math.round((local0.getUTCHours() + local0.getUTCMinutes() / 60) * 4) / 4)
  const [layers, setLayers] = useState({ ecl: true, equ: true, signs: true, iau: false, stars: true, planets: true })
  const [sel, setSel] = useState<string>('Sun')
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => { loadAstro().then(setA) }, [])
  const date = new Date(Date.UTC(year, 0, 1 + doy) + (hour - place.tz) * 3600000)
  const R = 160, cx = 170, cy = 170
  const sky = useMemo(() => {
    if (!A) return null
    const lst = norm360(A.SiderealTime(date) * 15 + place.lon)
    const P = (ra: number, dec: number) => {
      const h = eqToHor(ra, dec, place.lat, lst)
      const r = ((90 - h.alt) / 180) * R
      return { x: cx - r * Math.sin(h.az * D2R), y: cy - r * Math.cos(h.az * D2R), alt: h.alt }
    }
    const curve = (f: (t: number) => { ra: number; dec: number }) => Array.from({ length: 121 }, (_, k) => { const q = f(k * 3); const p = P(q.ra, q.dec); return [p.x, p.y] as [number, number] })
    const ecl = curve((l) => eclToEq(l))
    const equ = curve((ra) => ({ ra, dec: 0 }))
    const obs = new A.Observer(place.lat, place.lon, 0)
    const bodies = BODIES.map((b) => {
      const eq = A.Equator(b.k as never, date, obs, true, true)
      const ra = eq.ra * 15, dec = eq.dec
      const lon = b.k === 'Sun' ? A.SunPosition(date).elon : b.k === 'Moon' ? A.EclipticGeoMoon(date).lon : eqToEcl(ra, dec)
      return { ...b, ...P(ra, dec), lon, dec }
    })
    const stars = BRIGHT.map(([n, ra, dec]) => ({ n, ...P(ra, dec) }))
    const signTicks = SIGNS.map((s) => { const q = eclToEq((s.i - 1) * 30); const m = eclToEq((s.i - 1) * 30 + 15); return { i: s.i, a: P(q.ra, q.dec), m: P(m.ra, m.dec) } })
    const nodes = [0, 180].map((l) => { const q = eclToEq(l); return { l, ...P(q.ra, q.dec) } })
    const iau = Array.from({ length: 120 }, (_, k) => { const l = k * 3; const c = constellationAt(l + 1.5, year); return { l, c } })
    return { ecl, equ, bodies, stars, signTicks, nodes, iau }
  }, [A, date.getTime(), place]) // eslint-disable-line react-hooks/exhaustive-deps
  const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const tog = (k: keyof typeof layers) => setLayers({ ...layers, [k]: !layers[k] })
  const selB = sky?.bodies.find((b) => b.k === sel)
  const local = new Date(Date.UTC(year, 0, 1 + doy))
  return (
    <div className="wg" style={{ padding: '10px 10px 12px' }}>
      <svg ref={svgRef} className="wg-svg" viewBox="0 0 340 340">
        <defs>
          <radialGradient id="ground" cx="50%" cy="50%" r="50%"><stop offset="49.5%" stopColor="#1b2340" /><stop offset="50%" stopColor="#0a0e1a" /><stop offset="100%" stopColor="#06080f" /></radialGradient>
          <clipPath id="sim-clip"><circle cx={cx} cy={cy} r={R} /></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="url(#ground)" />
        <circle cx={cx} cy={cy} r={R / 2} fill="none" stroke="rgba(246,241,228,0.55)" strokeWidth={1.2} />
        {[['北', 0], ['东', 90], ['南', 180], ['西', 270]].map(([t, az]) => {
          const r = R / 2 + 9
          return <text key={t} x={cx - r * Math.sin((az as number) * D2R)} y={cy - r * Math.cos((az as number) * D2R) + 4} textAnchor="middle" fontSize="11" fill="rgba(246,241,228,0.8)">{t}</text>
        })}
        <text x={cx} y={cy + R - 10} textAnchor="middle" fontSize="9.5" fill="rgba(246,241,228,0.35)">地平线以下</text>
        {!sky && <text x={cx} y={cy} textAnchor="middle" fill="#f6f1e4" fontSize="13">正在载入星历……</text>}
        {sky && (
          <g clipPath="url(#sim-clip)">
            {layers.stars && sky.stars.map((s) => <g key={s.n} opacity={s.alt > 0 ? 1 : 0.3}><circle cx={s.x} cy={s.y} r={1.8} fill="#f6f1e4" />{s.alt > 0 && <text x={s.x + 4} y={s.y - 3} fontSize="8.5" fill="rgba(246,241,228,0.55)">{s.n}</text>}</g>)}
            {layers.equ && <path d={path(sky.equ)} fill="none" stroke="#7fa3cc" strokeWidth={1.6} />}
            {layers.ecl && !layers.iau && <path d={path(sky.ecl)} fill="none" stroke="#d8b46a" strokeWidth={2} />}
            {layers.iau && sky.iau.map((seg, k) => {
              const a = sky.ecl[k], b = sky.ecl[k + 1]
              return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={seg.c.oph ? '#e2775a' : IAU_COLORS[IAU.indexOf(seg.c) % 2]} strokeWidth={4} />
            })}
            {layers.signs && layers.ecl && sky.signTicks.map((t) => (
              <g key={t.i}>
                <circle cx={t.a.x} cy={t.a.y} r={2.2} fill="#d8b46a" />
                <GlyphAt i={t.i} x={t.m.x} y={t.m.y - 9} size={11} color={t.m.alt > 0 ? '#e6cf95' : 'rgba(230,207,149,0.45)'} width={9} />
              </g>
            ))}
            {layers.ecl && layers.equ && sky.nodes.map((n) => <g key={n.l}><circle cx={n.x} cy={n.y} r={5} fill="none" stroke="#fff3cf" strokeWidth={1.5} /><text x={n.x + 7} y={n.y + 12} fontSize="9.5" fill="#fff3cf">{n.l === 0 ? '春分点' : '秋分点'}</text></g>)}
            {layers.planets && sky.bodies.map((b) => (
              <g key={b.k} onClick={() => setSel(b.k)} style={{ cursor: 'pointer' }} opacity={b.alt > 0 ? 1 : 0.55}>
                {b.k === sel && <circle cx={b.x} cy={b.y} r={b.r + 5} fill="none" stroke="#c2a05a" strokeWidth={1.5} />}
                <circle cx={b.x} cy={b.y} r={b.r} fill={b.c} />
                <text x={b.x + b.r + 3} y={b.y + 4} fontSize="10" fill={b.c}>{b.n}</text>
              </g>
            ))}
          </g>
        )}
        <text x="6" y="14" fontSize="10" fill="rgba(246,241,228,0.5)">中心 = 头顶 · 内圈 = 地平线</text>
      </svg>
      <div className="wg-read">
        <span><b>{place.name}</b> {local.getUTCMonth() + 1} 月 {local.getUTCDate()} 日 {String(Math.floor(hour)).padStart(2, '0')}:{String(Math.round((hour % 1) * 60)).padStart(2, '0')}</span>
        {selB && <span>{selB.n}：<b>{SIGNS[Math.floor(selB.lon / 30)].name} {fmtDeg(selB.lon % 30)}</b> · {selB.alt > 0 ? `高 ${selB.alt.toFixed(0)}°` : '在地平线下'} · 离黄道 {Math.abs(selB.dec - eclToEq(selB.lon).dec).toFixed(1)}°（赤纬差）</span>}
      </div>
      <Slider label="日期" value={doy} min={0} max={364} onChange={setDoy} fmt={(v) => { const d = new Date(Date.UTC(year, 0, 1 + v)); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}` }} />
      <Slider label="时间" value={hour} min={0} max={23.75} step={0.25} onChange={setHour} fmt={(v) => `${String(Math.floor(v)).padStart(2, '0')}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`} />
      <div className="wg-btns">
        {([['ecl', '黄道'], ['equ', '天赤道'], ['signs', '星宫刻度'], ['iau', '天文星座边界'], ['stars', '亮星'], ['planets', '日月行星']] as const).map(([k, l]) => (
          <button key={k} className={`wg-btn ${layers[k] ? 'on' : ''}`} onClick={() => tog(k)}>{l}</button>
        ))}
      </div>
      <div className="wg-btns">
        <button className="wg-btn" onClick={() => { const n = new Date(); const l = new Date(n.getTime() + place.tz * 3600000); setDoy(Math.floor((Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - Date.UTC(l.getUTCFullYear(), 0, 1)) / 86400000)); setHour(Math.round((l.getUTCHours() + l.getUTCMinutes() / 60) * 4) / 4) }}>此刻</button>
        <select value={place.name} onChange={(e) => setPlace(PLACES.find((p) => p.name === e.target.value)!)} style={{ width: 'auto', padding: '4px 10px', fontSize: 13, borderRadius: 999 }}>
          {PLACES.map((p) => <option key={p.name}>{p.name}</option>)}
        </select>
      </div>
      {sky && layers.planets && (
        <Btns items={sky.bodies.map((b) => [b.k, b.n] as [string, string])} value={sel} onChange={setSel} />
      )}
      <div className="wg-cap" style={{ fontSize: 12.5, color: 'rgba(246,241,228,0.6)' }}>星历：astronomy-engine（误差约 1 角分）。时间按当地标准时间，未计夏令时。</div>
    </div>
  )
}
const IAU_COLORS = ['#8fb0d6', '#5b7fa8']
