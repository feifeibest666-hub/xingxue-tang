import { useEffect, useMemo, useRef, useState } from 'react'
import { Btns, D2R, Note, PlayBtn, Slider, useLoop, wheel, type WidgetMap } from './common'
import { GlyphAt } from '../Glyph'
import { ELEMENT_COLOR, element, fmtLon, modality } from '../../data/zodiac'
import { PLACES } from './tools'
import { loadAstro } from '../../lib/astro'
import {
  BODY_COLOR, BODY_NAME, BODY_SHORT, CLASSICAL, MODERN, chartAt, norm, positionsSync, signIdx, wholeHouse,
  type Body, type Chart,
} from '../../lib/natal'
import { Wheel } from './natal'
import type { Planet } from '../../data/classical'
import { useMyBirth } from './natal'

const GOLD = '#c2a05a', STAR = '#f6f1e4', DIM = 'rgba(246,241,228,0.45)'
const pad = (n: number) => String(n).padStart(2, '0')

function fmtUT(t: Date) {
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())} UT`
}
function fmtZone(t: Date, tz: number) {
  const x = new Date(t.getTime() + tz * 3600000)
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`
}
const elOf = (lon: number) => element(signIdx(lon))
const modOf = (lon: number) => modality(signIdx(lon))
/** 入境时刻的太阳紧贴 0°/90°/180°/270°，避免 359.99° 被显示成上一星座的 30°。 */
function fmtSun(lon: number) {
  const l = norm(lon)
  for (const t of [0, 90, 180, 270]) {
    const d = Math.abs(((l - t + 540) % 360) - 180)
    if (d < 0.05) return fmtLon(t)
  }
  return fmtLon(l)
}

/** 会合周期（年）与每次会合点前进的度数。pa、pb 为恒星周期（年）。 */
export function synodic(pa: number, pb: number) {
  const syn = 1 / Math.abs(1 / pa - 1 / pb)
  const fast = Math.min(pa, pb)
  const travel = (360 / fast) * syn
  return { syn, travel, adv: travel % 360 }
}

type AE = Awaited<ReturnType<typeof loadAstro>>
function planetLon(A: AE, name: 'Jupiter' | 'Saturn', t: Date) {
  const v = A.GeoVector(name as never, t, true)
  const s = A.SphereFromVector(A.RotateVector(A.Rotation_EQJ_ECT(t), v))
  return norm(s.lon)
}
function wrapped(j: number, s: number) {
  return ((j - s + 540) % 360) - 180
}

export type Conj = { t: Date; lon: number }
/** 1800–2100 年木土地心合相。步长 10 天，黄经差变号后对分。逆行会留下三次连合。 */
export async function findGreatConjunctions(): Promise<Conj[]> {
  const A = await loadAstro()
  const diff = (ms: number) => wrapped(planetLon(A, 'Jupiter', new Date(ms)), planetLon(A, 'Saturn', new Date(ms)))
  const t1 = Date.UTC(1800, 0, 1)
  const t2 = Date.UTC(2100, 11, 31, 23, 59)
  const step = 10 * 86400000
  const out: Conj[] = []
  let ta = t1
  let fa = diff(ta)
  for (let tb = ta + step; tb <= t2 + step; tb += step) {
    const fb = diff(Math.min(tb, t2))
    if (fa !== 0 && Math.sign(fa) !== Math.sign(fb) && Math.abs(fa - fb) < 90) {
      let lo = ta, hi = Math.min(tb, t2), flo = fa
      for (let k = 0; k < 48; k++) {
        const mid = (lo + hi) / 2
        const fm = diff(mid)
        if (fm === 0 || Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm } else hi = mid
      }
      const ms = (lo + hi) / 2
      if (ms >= t1 && ms <= t2) out.push({ t: new Date(ms), lon: planetLon(A, 'Jupiter', new Date(ms)) })
    }
    ta = Math.min(tb, t2)
    fa = fb
    if (ta >= t2) break
  }
  return out
}

let conjCache: Promise<Conj[]> | null = null

function GreatConj() {
  const [hits, setHits] = useState<Conj[] | null>(null)
  const [err, setErr] = useState('')
  const [sel, setSel] = useState(0)
  const [shown, setShown] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [el, setEl] = useState<'全部' | '火' | '土' | '风' | '水'>('全部')
  useEffect(() => {
    let ok = true
    ;(conjCache ??= findGreatConjunctions()).then((h) => { if (ok) { setHits(h); setShown(h.length); setSel(Math.max(0, h.findIndex((x) => x.t.getUTCFullYear() === 2020))) } }, (e) => ok && setErr(String(e)))
    return () => { ok = false }
  }, [])
  useLoop(playing, (dt) => setShown((n) => {
    if (!hits) return n
    const next = n + dt * 1.4
    return next >= hits.length ? hits.length : next
  }))
  useEffect(() => { if (hits && shown >= hits.length) setPlaying(false) }, [hits, shown])
  const cx = 170, cy = 118, R = 96
  const nShow = Math.max(1, Math.floor(shown))
  return (
    <div className="wg">
      <Note>1800–2100 · 地心合相</Note>
      {!hits ? <div className="wg-cap">{err || '计算中…（约十年一步，再对分）'}</div> : (
        <>
          <svg className="wg-svg" viewBox="0 0 340 236">
            <circle cx={cx} cy={cy} r={R} fill="#101528" stroke="rgba(246,241,228,0.35)" />
            <circle cx={cx} cy={cy} r={R - 16} fill="none" stroke="rgba(246,241,228,0.15)" />
            {Array.from({ length: 12 }, (_, k) => {
              const [x1, y1] = wheel(cx, cy, R - 16, k * 30)
              const [x2, y2] = wheel(cx, cy, R, k * 30)
              const [gx, gy] = wheel(cx, cy, R + 14, k * 30 + 15)
              return <g key={k}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={DIM} /><GlyphAt i={k + 1} x={gx} y={gy} size={12} color={GOLD} width={8} /></g>
            })}
            {hits.slice(1, nShow).map((h, i) => {
              const [x1, y1] = wheel(cx, cy, R - 28, hits[i].lon)
              const [x2, y2] = wheel(cx, cy, R - 28, h.lon)
              return <line key={h.t.getTime()} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ELEMENT_COLOR[elOf(h.lon)]} strokeWidth={1.5} opacity={0.9} />
            })}
            {hits.slice(0, nShow).map((h, i) => {
              const [x, y] = wheel(cx, cy, R - 28, h.lon)
              const on = el === '全部' || elOf(h.lon) === el
              const triple = (hits[i - 1] && h.t.getTime() - hits[i - 1].t.getTime() < 400 * 86400000) || (hits[i + 1] && hits[i + 1].t.getTime() - h.t.getTime() < 400 * 86400000)
              return (
                <g key={h.t.getTime()} opacity={on ? 1 : 0.2} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
                  <circle cx={x} cy={y} r={sel === i ? 6 : 3.5} fill={ELEMENT_COLOR[elOf(h.lon)]} stroke={triple ? STAR : 'none'} strokeWidth={1.2} />
                </g>
              )
            })}
          </svg>
          <div className="wg-btns">
            <PlayBtn playing={playing} set={(v) => { if (v) setShown(1); setPlaying(v) }} />
            {(['全部', '火', '土', '风', '水'] as const).map((k) => <button key={k} className={`wg-btn ${el === k ? 'on' : ''}`} onClick={() => setEl(k)}>{k}</button>)}
          </div>
          {hits[sel] && <ConjRead hits={hits} i={sel} />}
          <div style={{ maxHeight: 210, overflow: 'auto' }}>
            <table className="wg-table">
              <thead><tr><th>世界时</th><th>北京时间</th><th>位置</th><th>元素</th></tr></thead>
              <tbody>
                {hits.map((h, i) => (
                  <tr key={h.t.getTime()} onClick={() => { setSel(i); setShown(Math.max(nShow, i + 1)) }} style={{ background: i === sel ? 'rgba(194,160,90,0.15)' : undefined, cursor: 'pointer' }}>
                    <td>{fmtUT(h.t).slice(0, 10)}</td>
                    <td>{fmtZone(h.t, 8).slice(0, 10)}</td>
                    <td>{fmtLon(h.lon)}</td>
                    <td style={{ color: ELEMENT_COLOR[elOf(h.lon)] }}>{elOf(h.lon)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wg-cap">共 {hits.length} 次。点连点每次大约跳 243°，同元素的三次连成一个三角，再慢慢转过去。描边的点是几个月内的三连合。2020-12-21 世界时在水瓶 0°29′ 附近。</div>
        </>
      )}
    </div>
  )
}

function ConjRead({ hits, i }: { hits: Conj[]; i: number }) {
  const h = hits[i]
  const prev = hits[i - 1]
  const step = prev ? norm(h.lon - prev.lon) : null
  const triple = (prev && h.t.getTime() - prev.t.getTime() < 400 * 86400000) || (hits[i + 1] && hits[i + 1].t.getTime() - h.t.getTime() < 400 * 86400000)
  return (
    <div className="wg-read">
      <span>第 {i + 1} 次 <b>{fmtUT(h.t)}</b></span>
      <span>北京 <b>{fmtZone(h.t, 8)}</b></span>
      <span><b>{fmtLon(h.lon)}</b> · {elOf(h.lon)}象</span>
      {step != null && <span>比上次前进 <b>{step.toFixed(1)}°</b>（平均约 242.7°）</span>}
      {triple && <span>三连合中的一次</span>}
    </div>
  )
}

const PAIRS: [string, number, string, number, string][] = [
  ['木星', 11.862, '土星', 29.457, '平均约 19.86 年。真会合会因逆行连合三次，也会短暂探出元素。'],
  ['土星', 29.457, '天王星', 84.02, '平均约 45 年。'],
  ['土星', 29.457, '海王星', 164.8, '平均约 36 年。'],
  ['土星', 29.457, '冥王星', 248, '平均约 33 年。冥王星轨道很扁，真间隔大约 33–38 年；星历给出的合相在 1947、1982、2020。'],
  ['天王星', 84.02, '冥王星', 248, '平均约 127 年。星历给出 1965–66 年的合相。'],
  ['天王星', 84.02, '海王星', 164.8, '平均约 171 年。星历给出 1993 年的合相。'],
  ['海王星', 164.8, '冥王星', 248, '平均约 492 年。星历给出 1891–92 年的合相。'],
]

function Synodic() {
  const [k, setK] = useState(0)
  const [a, pa, b, pb, note] = PAIRS[k]
  const { syn, travel, adv } = synodic(pa, pb)
  const extra = adv - 240
  const cx = 170, cy = 78, R = 58
  const [x0, y0] = wheel(cx, cy, R, 0)
  const [x1, y1] = wheel(cx, cy, R, adv)
  return (
    <div className="wg">
      <Note>平均恒星周期 · 教材取值</Note>
      <Btns items={PAIRS.map((p, i) => [i, `${p[0].slice(0, 1)}–${p[2].slice(0, 1)}`])} value={k} onChange={setK} />
      <svg className="wg-svg" viewBox="0 0 340 150">
        <circle cx={cx} cy={cy} r={R} fill="#101528" stroke="rgba(246,241,228,0.35)" />
        <line x1={cx} y1={cy} x2={x0} y2={y0} stroke={DIM} />
        <line x1={cx} y1={cy} x2={x1} y2={y1} stroke={GOLD} />
        <path d={arcPath(cx, cy, R - 10, 0, adv)} fill="none" stroke={GOLD} strokeWidth={3} />
        <text x={cx} y={cy + 4} fontSize="12" fill={STAR} textAnchor="middle">{adv.toFixed(1)}°</text>
      </svg>
      <table className="wg-table">
        <tbody>
          <tr><th>{a}</th><td>恒星周期 {pa} 年</td></tr>
          <tr><th>{b}</th><td>恒星周期 {pb} 年</td></tr>
          <tr><th>会合周期</th><td>1 / |1/{pa} − 1/{pb}| = <b>{syn.toFixed(2)}</b> 年</td></tr>
          <tr><th>快行星走过</th><td>{travel.toFixed(1)}°（含超车的整圈）</td></tr>
          <tr><th>会合点前进</th><td>{travel.toFixed(1)} − {Math.floor(travel / 360) * 360} = <b>{adv.toFixed(1)}°</b>（约 {(adv / 30).toFixed(2)} 个星座）</td></tr>
        </tbody>
      </table>
      {k === 0 && (
        <div className="wg-read">
          <span>242.7° = 8 个星座（240°）再多 <b>{extra.toFixed(1)}°</b></span>
          <span>多出的角度攒满 30° 大约要 <b>{(30 / extra).toFixed(1)}</b> 次</span>
          <span>10 次 × {syn.toFixed(2)} 年 ≈ <b>{(10 * syn).toFixed(0)}</b> 年，所以常说约 200 年</span>
        </div>
      )}
      <div className="wg-cap">{note} 周期是平均值，不是某一次的精确间隔。</div>
    </div>
  )
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = wheel(cx, cy, r, a0)
  const [x1, y1] = wheel(cx, cy, r, a1)
  const large = norm(a1 - a0) > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 0 ${x1} ${y1}`
}

const RULE = {
  开创: '开创星座上升：约定上这张春分盘只管一个季度，夏至、秋分、冬至也要另起盘。',
  固定: '固定星座上升：约定上这一张春分盘管全年。',
  变动: '变动星座上升：约定上春分盘管半年，下半年改看秋分盘。',
} as const

function Ingress() {
  const [year, setYear] = useState(2026)
  const [pi, setPi] = useState(0)
  const [which, setWhich] = useState(0)
  const [rows, setRows] = useState<{ name: string; ut: Date; chart: Chart }[] | null>(null)
  const place = PLACES[pi]
  useEffect(() => {
    let ok = true
    setRows(null)
    ;(async () => {
      const A = await loadAstro()
      const s = A.Seasons(year)
      const ev = [
        ['春分 · 白羊', s.mar_equinox.date],
        ['夏至 · 巨蟹', s.jun_solstice.date],
        ['秋分 · 天秤', s.sep_equinox.date],
        ['冬至 · 摩羯', s.dec_solstice.date],
      ] as const
      const charts = await Promise.all(ev.map(([, d]) => chartAt(d, place.lat, place.lon)))
      if (ok) setRows(ev.map(([name], i) => ({ name, ut: ev[i][1], chart: charts[i] })))
    })()
    return () => { ok = false }
  }, [year, pi, place.lat, place.lon])
  const aries = rows?.[0]
  const cur = rows?.[which]
  const mod = aries ? modOf(aries.chart.asc) : null
  return (
    <div className="wg">
      <Note>{place.name} · 太阳入境</Note>
      <div className="wg-row">
        <label>年份</label>
        <input type="number" value={year} min={1600} max={2100} onChange={(e) => setYear(Number(e.target.value) || year)} />
        <select value={pi} onChange={(e) => setPi(Number(e.target.value))}>
          {PLACES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
      </div>
      {!rows || !cur || !aries || !mod ? <div className="wg-cap">计算中…</div> : (
        <>
          <Btns items={rows.map((r, i) => [i, r.name.slice(0, 2)])} value={which} onChange={setWhich} />
          <Wheel c={cur.chart} size={300} showAspects={false} />
          <table className="wg-table">
            <thead><tr><th>入境</th><th>{place.name}时间</th><th>上升</th><th>模式</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name} onClick={() => setWhich(i)} style={{ background: i === which ? 'rgba(194,160,90,0.15)' : undefined, cursor: 'pointer' }}>
                  <td>{r.name}</td>
                  <td>{fmtZone(r.ut, place.tz)}</td>
                  <td>{fmtLon(r.chart.asc)}</td>
                  <td>{modOf(r.chart.asc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="wg-read">
            <span>正在看 <b>{cur.name}</b>，天顶 {fmtLon(cur.chart.mc)}</span>
            <span>太阳 {fmtSun(cur.chart.pos.sun.lon)}</span>
          </div>
          <div className="wg-cap">规则只看<b>春分盘</b>的上升（{fmtLon(aries.chart.asc)}，{mod}）。{RULE[mod]} 这一条是约定，不是从天文推出来的。</div>
        </>
      )}
    </div>
  )
}

function to180(lon: number) {
  const x = norm(lon)
  return x > 180 ? x - 360 : x
}

/** sign −1 = 上升（时角 −H₀），+1 = 下降（时角 +H₀）。cos H₀ = −tan φ tan δ。 */
function curves(ra: number, dec: number, gst: number, sign: 1 | -1) {
  const segs: { lon: number; lat: number }[][] = []
  let cur: { lon: number; lat: number }[] = []
  const pushBreak = () => { if (cur.length) segs.push(cur); cur = [] }
  for (let lat = -60; lat <= 60; lat += 2) {
    const x = -Math.tan(lat * D2R) * Math.tan(dec * D2R)
    if (Math.abs(x) > 1) { pushBreak(); continue }
    const H0 = Math.acos(Math.max(-1, Math.min(1, x))) / D2R
    const lon = to180(norm(ra - gst + sign * H0))
    if (cur.length && Math.abs(lon - cur[cur.length - 1].lon) > 180) pushBreak()
    cur.push({ lon, lat })
  }
  pushBreak()
  return segs
}

const MAP = { x0: 26, y0: 16, w: 308, h: 148 }
const xOf = (lon: number) => MAP.x0 + ((lon + 180) / 360) * MAP.w
const yOf = (lat: number) => MAP.y0 + ((60 - lat) / 120) * MAP.h
const CITIES: [string, number, number][] = [
  ['北京', 39.9, 116.4], ['上海', 31.2, 121.5], ['广州', 23.1, 113.3], ['成都', 30.7, 104.1],
  ['哈尔滨', 45.8, 126.6], ['乌市', 43.8, 87.6], ['香港', 22.3, 114.2], ['台北', 25.0, 121.5],
  ['悉尼', -33.9, 151.2], ['伦敦', 51.5, -0.1], ['纽约', 40.7, -74.0], ['新加坡', 1.3, 103.8],
]

function AstroMap() {
  const mine = useMyBirth()
  const [year, setYear] = useState(2026)
  const [hour, setHour] = useState(0)
  const [planet, setPlanet] = useState<Planet>('jupiter')
  const [allMc, setAllMc] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [sky, setSky] = useState<{ gst: number; rows: { id: Planet; ra: number; dec: number }[] } | null>(null)
  const acc = useRef(0)
  const last = useRef(-1)
  useLoop(playing, (dt) => {
    acc.current = (acc.current + dt * 3) % 8760
    const h = Math.round(acc.current)
    if (h !== last.current) { last.current = h; setHour(h) }
  })
  const ut = useMemo(() => new Date(Date.UTC(year, 0, 1) + hour * 3600000), [year, hour])
  useEffect(() => {
    let ok = true
    setSky(null)
    ;(async () => {
      const A = await loadAstro()
      const pos = positionsSync(A, ut, CLASSICAL)
      const gst = A.SiderealTime(ut) * 15
      if (ok) setSky({ gst, rows: CLASSICAL.map((id) => ({ id, ra: pos[id].ra, dec: pos[id].dec })) })
    })()
    return () => { ok = false }
  }, [ut])
  const sel = sky?.rows.find((r) => r.id === planet)
  return (
    <div className="wg">
      <Note>占星地图 · 没有大陆轮廓</Note>
      <div className="wg-row">
        <label>年份</label>
        <input type="number" value={year} min={1900} max={2100} onChange={(e) => setYear(Number(e.target.value) || year)} />
        <span className="wg-v">{fmtUT(ut)}</span>
      </div>
      <Btns items={CLASSICAL.map((p) => [p, BODY_SHORT[p]])} value={planet} onChange={setPlanet} />
      {!sky || !sel ? <div className="wg-cap">计算中…</div> : (
        <svg className="wg-svg" viewBox="0 0 340 196">
          <rect x={MAP.x0} y={MAP.y0} width={MAP.w} height={MAP.h} fill="#101528" stroke="rgba(246,241,228,0.3)" />
          {[-180, -120, -60, 0, 60, 120, 180].map((lon) => <line key={lon} x1={xOf(lon)} y1={MAP.y0} x2={xOf(lon)} y2={MAP.y0 + MAP.h} stroke="rgba(246,241,228,0.12)" />)}
          {[-60, -30, 0, 30, 60].map((lat) => <line key={lat} x1={MAP.x0} y1={yOf(lat)} x2={MAP.x0 + MAP.w} y2={yOf(lat)} stroke="rgba(246,241,228,0.12)" />)}
          {allMc && sky.rows.map((r) => {
            const lon = to180(norm(r.ra - sky.gst))
            return <line key={r.id} x1={xOf(lon)} y1={MAP.y0} x2={xOf(lon)} y2={MAP.y0 + MAP.h} stroke={BODY_COLOR[r.id]} strokeWidth={r.id === planet ? 2.4 : 1} opacity={r.id === planet ? 1 : 0.45} />
          })}
          {!allMc && <line x1={xOf(to180(norm(sel.ra - sky.gst)))} y1={MAP.y0} x2={xOf(to180(norm(sel.ra - sky.gst)))} y2={MAP.y0 + MAP.h} stroke={BODY_COLOR[planet]} strokeWidth={2.4} />}
          <line x1={xOf(to180(norm(sel.ra + 180 - sky.gst)))} y1={MAP.y0} x2={xOf(to180(norm(sel.ra + 180 - sky.gst)))} y2={MAP.y0 + MAP.h} stroke={BODY_COLOR[planet]} strokeWidth={1.2} strokeDasharray="4 3" />
          {([[-1, 'asc'], [1, 'dsc']] as const).map(([sign, key]) => curves(sel.ra, sel.dec, sky.gst, sign).map((seg, i) => (
            <polyline key={key + i} fill="none" stroke={BODY_COLOR[planet]} strokeWidth={1.6} strokeDasharray={sign === 1 ? '2 2' : undefined} points={seg.map((p) => `${xOf(p.lon)},${yOf(p.lat)}`).join(' ')} />
          )))}
          {CITIES.map(([name, lat, lon]) => (
            <g key={name}>
              <circle cx={xOf(lon)} cy={yOf(lat)} r={2.4} fill={GOLD} />
              <text x={xOf(lon) + 3} y={yOf(lat) - 3} fontSize="8" fill={STAR}>{name}</text>
            </g>
          ))}
          <text x={MAP.x0 + 4} y={MAP.y0 + 11} fontSize="9" fill={BODY_COLOR[planet]}>{BODY_NAME[planet]} 实线天顶 · 虚线天底 · 点线下降</text>
        </svg>
      )}
      <Slider label="从元旦起的小时" value={hour} min={0} max={8759} step={1} onChange={(v) => { setHour(v); acc.current = v; last.current = Math.round(v); setPlaying(false) }} fmt={(v) => `${Math.floor(v / 24)} 天 ${Math.round(v % 24)} 时`} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={(v) => { if (v) { acc.current = hour; last.current = Math.round(hour) } setPlaying(v) }} />
        <button className={`wg-btn ${allMc ? 'on' : ''}`} onClick={() => setAllMc((v) => !v)}>{allMc ? '七条天顶都显示' : '只画选中的天顶'}</button>
        <button className="wg-btn" onClick={() => { if (!mine) return; const ut0 = mineUt(mine); setYear(ut0.getUTCFullYear()); const start = Date.UTC(ut0.getUTCFullYear(), 0, 1); setHour(Math.max(0, Math.min(8759, (ut0.getTime() - start) / 3600000))) }}>用我的出生时刻</button>
      </div>
      <div className="wg-cap">图上没有世界地图的矢量海岸线，只有经纬网和 12 个城市点。线随地球自转向西扫：天顶在地方恒星时等于行星赤经的那条经线上。上升、下降用 cos H₀ = −tan φ tan δ，只画到南北纬 60°。</div>
    </div>
  )
}

function mineUt(b: { date: string; time: string; tz: number }) {
  const [y, m, d] = b.date.split('-').map(Number)
  const [hh, mm] = b.time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0) - b.tz * 3600000)
}

const EXTRA_PLACES = [{ name: '费城', lat: 39.95, lon: -75.15, tz: -75.15 / 15 }]
const MOMENT_PLACES = [...PLACES, ...EXTRA_PLACES]
const PRESETS: { id: string; name: string; date: string; time: string; place: string; note: string }[] = [
  { id: 'prc15', name: '大典约 15:00', date: '1949-10-01', time: '15:00', place: '北京', note: '开国大典当天、北京时间约 15 时宣告，是常用的起盘时刻。这里只比较时刻。' },
  { id: 'prc0', name: '当日 0:00', date: '1949-10-01', time: '00:00', place: '北京', note: '同一天的零点，是替代版本之一。上升会和 15 时完全不同。' },
  { id: 'usEve', name: '1776 傍晚', date: '1776-07-04', time: '17:00', place: '费城', note: '地方平时约 17 时，上升在射手。用来看"傍晚、射手上升"这一档。西布利 1787 年发表的图在这个时间段里，各书的分钟并不统一。' },
  { id: 'usAm', name: '1776 凌晨', date: '1776-07-04', time: '02:00', place: '费城', note: '约凌晨 2 时，上升在双子。这个版本在流传。本课不把它安到某个有名有姓的人身上。' },
]

function MomentChart() {
  const [preset, setPreset] = useState(PRESETS[0].id)
  const [date, setDate] = useState(PRESETS[0].date)
  const [time, setTime] = useState(PRESETS[0].time)
  const [pi, setPi] = useState(0)
  const [ri, setRi] = useState(-1)
  const [note, setNote] = useState(PRESETS[0].note)
  const [chart, setChart] = useState<Chart | null>(null)
  const [reloc, setReloc] = useState<Chart | null>(null)
  const place = MOMENT_PLACES[pi]
  const other = ri >= 0 ? MOMENT_PLACES[ri] : null
  useEffect(() => {
    let ok = true
    setChart(null); setReloc(null)
    const ut = localUt(date, time, place.tz)
    if (!ut) return
    chartAt(ut, place.lat, place.lon).then((c) => ok && setChart(c))
    if (other) chartAt(ut, other.lat, other.lon).then((c) => ok && setReloc(c))
    return () => { ok = false }
  }, [date, time, pi, ri, place.lat, place.lon, place.tz, other])
  const apply = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!
    setPreset(id); setDate(p.date); setTime(p.time); setNote(p.note)
    setPi(Math.max(0, MOMENT_PLACES.findIndex((x) => x.name === p.place)))
  }
  return (
    <div className="wg">
      <Note>指定时刻起盘</Note>
      <Btns items={PRESETS.map((p) => [p.id, p.name])} value={preset} onChange={apply} />
      <div className="wg-row">
        <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPreset('') }} />
        <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setPreset('') }} />
      </div>
      <div className="wg-row">
        <label>地点</label>
        <select value={pi} onChange={(e) => { setPi(Number(e.target.value)); setPreset('') }}>
          {MOMENT_PLACES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
        <label>迁到</label>
        <select value={ri} onChange={(e) => setRi(Number(e.target.value))}>
          <option value={-1}>不比较</option>
          {MOMENT_PLACES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
      </div>
      {!chart ? <div className="wg-cap">计算中…</div> : (
        <>
          <Wheel c={chart} size={300} showAspects={false} />
          <AngleTable c={chart} place={place.name} />
          {reloc && other && (
            <table className="wg-table">
              <thead><tr><th></th><th>{place.name}</th><th>{other.name}</th></tr></thead>
              <tbody>
                <tr><th>上升</th><td>{fmtLon(chart.asc)}</td><td>{fmtLon(reloc.asc)}</td></tr>
                <tr><th>天顶</th><td>{fmtLon(chart.mc)}</td><td>{fmtLon(reloc.mc)}</td></tr>
                <tr><th>太阳黄经</th><td>{fmtLon(chart.pos.sun.lon)}</td><td>{fmtLon(reloc.pos.sun.lon)}</td></tr>
                <tr><th>太阳整宫</th><td>第 {wholeHouse(chart.pos.sun.lon, chart.asc)} 宫</td><td>第 {wholeHouse(reloc.pos.sun.lon, reloc.asc)} 宫</td></tr>
              </tbody>
            </table>
          )}
          <div className="wg-cap">{note} 时刻按地点时区换算（费城用地方平时，时区 = 经度/15）。黄经是地心位置，换城市几乎不变；变的是四轴和宫位。</div>
        </>
      )}
    </div>
  )
}

function localUt(date: string, time: string, tz: number) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time || '00:00').split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(hh)) return null
  return new Date(Date.UTC(y, m - 1, d, hh, mm || 0) - tz * 3600000)
}

function AngleTable({ c, place }: { c: Chart; place: string }) {
  const show: Body[] = [...CLASSICAL, ...MODERN]
  return (
    <table className="wg-table">
      <thead><tr><th>{place}</th><th>位置</th><th>整宫</th></tr></thead>
      <tbody>
        <tr><th>上升</th><td>{fmtLon(c.asc)}（{modOf(c.asc)}）</td><td>1</td></tr>
        <tr><th>天顶</th><td>{fmtLon(c.mc)}</td><td>10</td></tr>
        {show.map((b) => (
          <tr key={b}><th>{BODY_NAME[b]}{c.pos[b].retro ? ' 逆' : ''}</th><td>{fmtLon(c.pos[b].lon)}</td><td>{wholeHouse(c.pos[b].lon, c.asc)}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

export const W14: WidgetMap = {
  mGreatConj: () => <GreatConj />,
  mSynodic: () => <Synodic />,
  mIngress: () => <Ingress />,
  mAstroMap: () => <AstroMap />,
  mMoment: () => <MomentChart />,
}
