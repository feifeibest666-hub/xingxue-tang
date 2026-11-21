import { useEffect, useMemo, useState } from 'react'
import { Btns, Note, PlayBtn, Slider, useLoop, usePlaying, wheel, type WidgetMap } from './common'
import { GlyphAt } from '../Glyph'
import { PLACES } from './tools'
import type { Planet } from '../../data/classical'
import { ELEMENT_COLOR, SIGNS, element, fmtLon, modality, signOf } from '../../data/zodiac'
import { BODY_COLOR, BODY_NAME, BODY_SHORT, CLASSICAL, birthUT, chartAt, computeChart, positionsSync, sep, signIdx, signRuler, type Birth, type Chart } from '../../lib/natal'
import { eclipses } from '../../lib/timing'
import { loadAstro, seasons } from '../../lib/astro'
import { useMyBirth } from './natal'
import { useStore } from '../../lib/store'

const GOLD = '#c2a05a', STAR = '#f6f1e4', DIM = 'rgba(246,241,228,0.45)'
const D2R = Math.PI / 180

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtAt(d: Date, tz: number) {
  const x = new Date(d.getTime() + tz * 3600000)
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`
}
function fmtUTC(t: number) {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const norm180 = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180
const forward = (a: number, b: number) => ((b - a) % 360 + 360) % 360

/* ── 木土大会合 1800–2100：扫黄经差，10 天一步，再对分 ── */
type Hit = { t: number; lon: number }
type AE = Awaited<ReturnType<typeof loadAstro>>

function geoLon(A: AE, body: 'Jupiter' | 'Saturn', t: Date) {
  const v = A.GeoVector(body as never, t, true)
  const s = A.SphereFromVector(A.RotateVector(A.Rotation_EQJ_ECT(t), v))
  return ((s.lon % 360) + 360) % 360
}
function signedJS(A: AE, t: number) {
  let d = geoLon(A, 'Jupiter', new Date(t)) - geoLon(A, 'Saturn', new Date(t))
  d = ((d + 540) % 360) - 180
  return d
}
let conjP: Promise<Hit[]> | null = null
function loadConj() {
  if (!conjP) conjP = (async () => {
    const A = await loadAstro()
    const step = 10 * 86400000
    const t2 = Date.UTC(2100, 0, 1)
    const hits: Hit[] = []
    let ta = Date.UTC(1800, 0, 1)
    let fa = signedJS(A, ta)
    for (let tb = ta + step; tb <= t2 + step; tb += step) {
      const fb = signedJS(A, tb)
      if (fa !== 0 && Math.sign(fa) !== Math.sign(fb) && Math.abs(fa - fb) < 40) {
        let lo = ta, hi = tb, flo = fa
        for (let k = 0; k < 46; k++) {
          const mid = (lo + hi) / 2
          const fm = signedJS(A, mid)
          if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm } else hi = mid
        }
        const t = (lo + hi) / 2
        hits.push({ t, lon: geoLon(A, 'Jupiter', new Date(t)) })
      }
      ta = tb
      fa = fb
    }
    return hits
  })().catch((e) => { conjP = null; throw e })
  return conjP
}

const ASPS: [number, string][] = [[0, '合'], [60, '六分'], [90, '四分'], [120, '三分'], [180, '对分']]

function GreatWidget() {
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [err, setErr] = useState('')
  const [i, setI] = useState(0)
  const [natal, setNatal] = useState(0)
  const [playing, setPlaying] = usePlaying(false)
  useEffect(() => {
    let ok = true
    loadConj().then((h) => { if (ok) { setHits(h); setI(h.length - 1) } }).catch((e: Error) => ok && setErr(e.message || '计算失败'))
    return () => { ok = false }
  }, [])
  useLoop(playing, (dt) => {
    acc += dt
    if (acc < 0.65) return
    acc = 0
    setI((n) => {
      if (!hits || n >= hits.length - 1) { setPlaying(false); return hits ? hits.length - 1 : n }
      return n + 1
    })
  })
  if (err) return <div className="wg"><div className="wg-cap">计算没有完成：{err}</div></div>
  if (!hits) return <div className="wg"><div className="wg-cap">计算中…（1800–2100，约每 10 天看一次）</div></div>
  const shown = hits.slice(0, i + 1)
  const cur = hits[i]
  const el = element(signOf(cur.lon).sign.i)
  const prev = i > 0 ? forward(hits[i - 1].lon, cur.lon) : null
  const near = ASPS.map(([deg, name]) => ({ name, d: Math.abs(sep(cur.lon, natal) - deg), deg })).sort((a, b) => a.d - b.d)[0]
  const cx = 170, cy = 112, R = 96
  return (
    <div className="wg">
      <Note>世界时 · 现场计算</Note>
      <svg className="wg-svg" viewBox="0 0 340 228">
        <circle cx={cx} cy={cy} r={R + 8} fill="#101528" stroke="rgba(246,241,228,0.25)" />
        {SIGNS.map((g) => {
          const a0 = (g.i - 1) * 30, a1 = a0 + 30
          const [x0, y0] = wheel(cx, cy, R + 4, a0), [x1, y1] = wheel(cx, cy, R + 4, a1)
          const [gx, gy] = wheel(cx, cy, R - 14, a0 + 15)
          return (
            <g key={g.i}>
              <path d={`M${x0} ${y0} A${R + 4} ${R + 4} 0 0 1 ${x1} ${y1}`} stroke={ELEMENT_COLOR[element(g.i)]} strokeWidth={7} fill="none" opacity={0.85} />
              <GlyphAt i={g.i} x={gx} y={gy} size={13} color={DIM} width={8} />
            </g>
          )
        })}
        {shown.slice(1).map((h, k) => {
          const a = shown[k]
          const same = element(signOf(a.lon).sign.i) === element(signOf(h.lon).sign.i)
          const [x1, y1] = wheel(cx, cy, R - 28, a.lon), [x2, y2] = wheel(cx, cy, R - 28, h.lon)
          return <line key={h.t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={same ? ELEMENT_COLOR[element(signOf(h.lon).sign.i)] : GOLD} strokeWidth={1.4} opacity={0.85} strokeDasharray={same ? undefined : '4 3'} />
        })}
        {shown.map((h, k) => {
          const [x, y] = wheel(cx, cy, R - 28, h.lon)
          const c = ELEMENT_COLOR[element(signOf(h.lon).sign.i)]
          const on = k === i
          return <g key={h.t}><circle cx={x} cy={y} r={on ? 6 : 3.5} fill={c} stroke={on ? STAR : 'none'} strokeWidth={1.2} /></g>
        })}
      </svg>
      <Slider label="看到第几次" value={i} min={0} max={hits.length - 1} step={1} onChange={(v) => { setI(v); setPlaying(false) }} fmt={(v) => `${v + 1} / ${hits.length}`} />
      <div className="wg-btns">
        <PlayBtn playing={playing} set={(v) => { if (v) { acc = 0; setI(0) } setPlaying(v) }} />
        <button className="wg-btn" onClick={() => { setPlaying(false); setI(hits.length - 1) }}>全部</button>
      </div>
      <div className="wg-read">
        <span>{fmtUTC(cur.t)}　<b style={{ color: ELEMENT_COLOR[el] }}>{fmtLon(cur.lon)}</b>　{el}象</span>
        {prev != null && <span>比上一次前进 <b>{prev.toFixed(1)}°</b></span>}
      </div>
      <div style={{ maxHeight: 168, overflow: 'auto' }}>
        <table className="wg-table">
          <thead><tr><th>世界时</th><th>位置</th><th>元素</th><th>前进</th></tr></thead>
          <tbody>
            {hits.map((h, k) => {
              const e = element(signOf(h.lon).sign.i)
              const gap = k > 0 ? h.t - hits[k - 1].t : Infinity
              const triple = gap < 400 * 86400000 || (k < hits.length - 1 && hits[k + 1].t - h.t < 400 * 86400000)
              return (
                <tr key={h.t} onClick={() => { setI(k); setPlaying(false) }} style={{ background: k === i ? 'rgba(194,160,90,0.15)' : undefined, cursor: 'pointer' }}>
                  <td>{fmtUTC(h.t)}{triple ? ' ·三次' : ''}</td>
                  <td>{fmtLon(h.lon)}</td>
                  <td style={{ color: ELEMENT_COLOR[e] }}>{e}</td>
                  <td>{k ? `${forward(hits[k - 1].lon, h.lon).toFixed(0)}°` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Slider label="对照一条黄经" value={natal} min={0} max={359.9} step={0.1} onChange={setNatal} fmt={(v) => fmtLon(v)} />
      <div className="wg-cap">
        这次会合与对照点相距 {sep(cur.lon, natal).toFixed(1)}°，最接近{near.name}（差 {near.d.toFixed(1)}°）。
        可对一下：2020-12-21 水瓶 0°29′；2000-05-28 金牛约 22°；1980–81 天秤三次。虚线是换了元素的一跳。
      </div>
    </div>
  )
}
let acc = 0

/* ── 会合周期 1/|1/a−1/b|，以及每次净前进 ── */
const PERIODS: { id: string; name: string; y: number }[] = [
  { id: 'jupiter', name: '木星', y: 11.862 },
  { id: 'saturn', name: '土星', y: 29.457 },
  { id: 'uranus', name: '天王星', y: 84.02 },
  { id: 'neptune', name: '海王星', y: 164.8 },
  { id: 'pluto', name: '冥王星', y: 248 },
]
const PAIRS: [string, string][] = [
  ['jupiter', 'saturn'], ['saturn', 'uranus'], ['saturn', 'neptune'], ['saturn', 'pluto'],
  ['uranus', 'pluto'], ['uranus', 'neptune'], ['neptune', 'pluto'],
]
function synodic(a: number, b: number) {
  const P = 1 / Math.abs(1 / a - 1 / b)
  const fast = Math.min(a, b)
  const walked = (P / fast) * 360
  const adv = walked - 360
  return { P, walked, adv }
}
function SynWidget({ a0, b0 }: { a0?: string; b0?: string }) {
  const [a, setA] = useState(a0 && PERIODS.some((p) => p.id === a0) ? a0 : 'jupiter')
  const [b, setB] = useState(b0 && PERIODS.some((p) => p.id === b0) ? b0 : 'saturn')
  const A = PERIODS.find((p) => p.id === a)!, B = PERIODS.find((p) => p.id === b)!
  const same = a === b
  const s = same ? null : synodic(A.y, B.y)
  const fast = s ? (A.y < B.y ? A : B) : A
  const drift = s ? s.adv - Math.round(s.adv / 120) * 120 : 0
  return (
    <div className="wg">
      <Note>平均周期</Note>
      <div className="wg-btns">
        {PAIRS.map(([x, y]) => (
          <button key={x + y} className={`wg-btn ${a === x && b === y ? 'on' : ''}`} onClick={() => { setA(x); setB(y) }}>
            {PERIODS.find((p) => p.id === x)!.name.slice(0, 1)}{PERIODS.find((p) => p.id === y)!.name.slice(0, 1)}
          </button>
        ))}
      </div>
      <div className="wg-row">
        <label>较快</label>
        <select value={a} onChange={(e) => setA(e.target.value)}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.name} {p.y} 年</option>)}</select>
      </div>
      <div className="wg-row">
        <label>较慢</label>
        <select value={b} onChange={(e) => setB(e.target.value)}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.name} {p.y} 年</option>)}</select>
      </div>
      {s ? (
        <>
          <table className="wg-table"><tbody>
            <tr><td>1 / {fast.y}</td><td>{(1 / fast.y).toFixed(5)}（每年转过的圈数）</td></tr>
            <tr><td>会合周期</td><td><b>1 / |1/{A.y} − 1/{B.y}| = {s.P.toFixed(2)} 年</b></td></tr>
            <tr><td>{fast.name}走过</td><td>{s.P.toFixed(2)} / {fast.y} × 360° = {s.walked.toFixed(1)}°</td></tr>
            <tr><td>净前进</td><td>{s.walked.toFixed(1)}° − 360° = <b>{s.adv.toFixed(1)}°</b>（约 {(s.adv / 30).toFixed(2)} 个星座）</td></tr>
            <tr><td>离 120° 的倍数</td><td>{drift.toFixed(1)}°（同元素星座相隔 120°）</td></tr>
          </tbody></table>
          <div className="wg-cap">
            {a === 'jupiter' && b === 'saturn'
              ? '木土：约 19.86 年，净前进约 242.7°。240° 是 8 个星座，多出来的约 2.7° 让会合点在同一元素里慢慢挪。'
              : '周期是平均匀速算出来的。真的会合会因椭圆轨道和逆行而早晚几年。'}
          </div>
        </>
      ) : <div className="wg-cap">请选两颗不同的行星。</div>}
    </div>
  )
}

/* ── 四季入境盘 ── */
const RULE: Record<string, string> = {
  开创: '开创上升：约定上这张春分盘只管一个季度，夏至、秋分、冬至三张也要看。',
  固定: '固定上升：约定上这张春分盘管全年。',
  变动: '变动上升：约定上大约管半年，后半年再看秋分盘。',
}
function IngressWidget({ year0 }: { year0?: number }) {
  const [year, setYear] = useState(year0 && year0 > 999 ? year0 : 2020)
  const [pi, setPi] = useState(0)
  const [pick, setPick] = useState(0)
  const [rows, setRows] = useState<{ name: string; when: Date; chart: Chart }[] | null>(null)
  const place = PLACES[pi]
  useEffect(() => {
    let ok = true
    setRows(null)
    seasons(year).then(async (ss) => {
      const charts = await Promise.all(ss.map((s) => chartAt(s.date, place.lat, place.lon)))
      if (ok) setRows(ss.map((s, k) => ({ name: s.name, when: s.date, chart: charts[k] })))
    }).catch(() => ok && setRows([]))
    return () => { ok = false }
  }, [year, pi, place.lat, place.lon])
  const spring = rows?.[0]
  const mod = spring ? modality(signOf(spring.chart.asc).sign.i) : null
  const row = rows?.[pick]
  return (
    <div className="wg">
      <Note>约定 · 中世纪规则</Note>
      <div className="wg-row"><label>年份</label><input type="number" value={year} min={1000} max={2100} onChange={(e) => setYear(Number(e.target.value) || year)} /></div>
      <div className="wg-row">
        <label>城市</label>
        <select value={pi} onChange={(e) => setPi(Number(e.target.value))}>{PLACES.map((p, k) => <option key={p.name} value={k}>{p.name}</option>)}</select>
      </div>
      {!rows ? <div className="wg-cap">计算中…</div> : rows.length === 0 ? <div className="wg-cap">这一年没有算出来。</div> : (
        <>
          <table className="wg-table">
            <thead><tr><th></th><th>当地时间</th><th>上升</th><th>模式</th></tr></thead>
            <tbody>
              {rows.map((r, k) => {
                const m = modality(signOf(r.chart.asc).sign.i)
                return (
                  <tr key={r.name} onClick={() => setPick(k)} style={{ cursor: 'pointer', background: k === pick ? 'rgba(194,160,90,0.15)' : undefined }}>
                    <td>{r.name}</td><td>{fmtAt(r.when, place.tz)}</td><td>{fmtLon(r.chart.asc)}</td><td>{m}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {row && (
            <div className="wg-read">
              <span>天顶 <b>{fmtLon(row.chart.mc)}</b></span>
              <span>上升主 <b>{BODY_NAME[signRuler(signIdx(row.chart.asc))]}</b></span>
            </div>
          )}
          <div className="wg-cap">{mod ? RULE[mod] : ''} 规则只看春分盘的上升。南半球季节相反，能否照搬是另一件事。</div>
        </>
      )}
    </div>
  )
}

/* ── 占星地图：天顶经线 + 升落曲线。没有海岸线数据 ── */
const MAP_L = 8, MAP_R = 332, MAP_T = 16, MAP_B = 188
const Xlon = (lon: number) => MAP_L + ((norm180(lon) + 180) / 360) * (MAP_R - MAP_L)
const Ylat = (lat: number) => MAP_T + ((90 - lat) / 180) * (MAP_B - MAP_T)
type Curve = { lon: number; lat: number }

function horizon(ra: number, dec: number, gmst: number, lat: number) {
  const c = -Math.tan(lat * D2R) * Math.tan(dec * D2R)
  if (c < -1 || c > 1) return null
  const H0 = Math.acos(c) / D2R
  return { asc: norm180(ra - H0 - gmst), dsc: norm180(ra + H0 - gmst) }
}
function pathOf(ra: number, dec: number, gmst: number, sign: 1 | -1): Curve[][] {
  const segs: Curve[][] = []
  let cur: Curve[] = []
  for (let lat = -60; lat <= 60; lat += 2) {
    const h = horizon(ra, dec, gmst, lat)
    const lon = h ? (sign < 0 ? h.asc : h.dsc) : null
    if (lon == null) { if (cur.length) segs.push(cur); cur = []; continue }
    const prev = cur[cur.length - 1]
    if (prev && (lat - prev.lat > 3 || Math.abs(norm180(lon - prev.lon)) > 100)) { segs.push(cur); cur = [] }
    cur.push({ lon, lat })
  }
  if (cur.length) segs.push(cur)
  return segs
}
function poly(seg: Curve[]) {
  return seg.map((p, k) => `${k ? 'L' : 'M'}${Xlon(p.lon).toFixed(1)} ${Ylat(p.lat).toFixed(1)}`).join(' ')
}

const CITIES = PLACES.map((p) => ({ ...p, label: p.name === '赤道（新加坡）' ? '新加坡' : p.name }))

function MapWidget({ mine, iso }: { mine?: boolean; iso?: string }) {
  const birth = useMyBirth()
  const settings = useStore().settings
  const base = useMemo(() => {
    if (mine && birth) return birthUT(birth).getTime()
    if (iso) return new Date(iso).getTime()
    return Date.parse('2020-12-21T18:26:00Z')
  }, [mine, birth, iso])
  const [hours, setHours] = useState(0)
  const [who, setWho] = useState<Planet | 'all'>('jupiter')
  const [sky, setSky] = useState<{ gmst: number; pos: Awaited<ReturnType<typeof positionsSync>> } | null>(null)
  useEffect(() => {
    let ok = true
    setSky(null)
    const when = new Date(base + hours * 3600000)
    loadAstro().then((A) => {
      if (!ok) return
      setSky({ gmst: A.SiderealTime(when) * 15, pos: positionsSync(A, when, [...CLASSICAL]) })
    }).catch(() => ok && setSky(null))
    return () => { ok = false }
  }, [base, hours])
  const planets: Planet[] = who === 'all' ? [...CLASSICAL] : [who]
  return (
    <div className="wg">
      <Note>无海岸线</Note>
      <svg className="wg-svg" viewBox="0 0 340 210">
        <rect x={MAP_L} y={MAP_T} width={MAP_R - MAP_L} height={MAP_B - MAP_T} fill="#101528" stroke="rgba(246,241,228,0.3)" />
        {Array.from({ length: 13 }, (_, k) => -180 + k * 30).map((lon) => <line key={lon} x1={Xlon(lon)} y1={MAP_T} x2={Xlon(lon)} y2={MAP_B} stroke="rgba(246,241,228,0.12)" />)}
        {[-60, -30, 0, 30, 60].map((lat) => <line key={lat} x1={MAP_L} y1={Ylat(lat)} x2={MAP_R} y2={Ylat(lat)} stroke={lat === 0 ? 'rgba(246,241,228,0.35)' : 'rgba(246,241,228,0.12)'} strokeDasharray={Math.abs(lat) === 60 ? '3 3' : undefined} />)}
        {sky && planets.map((p) => {
          const { ra, dec } = sky.pos[p]
          const mc = norm180(ra - sky.gmst)
          const ic = norm180(ra + 180 - sky.gmst)
          const col = BODY_COLOR[p]
          const asc = pathOf(ra, dec, sky.gmst, -1)
          const dsc = pathOf(ra, dec, sky.gmst, 1)
          return (
            <g key={p} opacity={who === 'all' ? 0.8 : 1}>
              <line x1={Xlon(mc)} y1={MAP_T} x2={Xlon(mc)} y2={MAP_B} stroke={col} strokeWidth={1.6} />
              <line x1={Xlon(ic)} y1={MAP_T} x2={Xlon(ic)} y2={MAP_B} stroke={col} strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
              <text x={Xlon(mc) + 2} y={MAP_T + 10} fontSize={9} fill={col}>{BODY_SHORT[p]}顶</text>
              {asc.map((seg, k) => <path key={'a' + k} d={poly(seg)} fill="none" stroke={col} strokeWidth={1.5} />)}
              {dsc.map((seg, k) => <path key={'d' + k} d={poly(seg)} fill="none" stroke={col} strokeWidth={1} strokeDasharray="4 3" opacity={0.75} />)}
            </g>
          )
        })}
        {CITIES.map((c) => (
          <g key={c.label}>
            <circle cx={Xlon(c.lon)} cy={Ylat(c.lat)} r={2.3} fill={STAR} />
            <text x={Xlon(c.lon) + 3} y={Ylat(c.lat) - 2} fontSize={8} fill={DIM}>{c.label}</text>
          </g>
        ))}
        <circle cx={Xlon(settings.lon)} cy={Ylat(settings.lat)} r={3.4} fill="none" stroke={GOLD} />
      </svg>
      <Btns items={[...CLASSICAL.map((p) => [p, BODY_SHORT[p]] as [Planet | 'all', string]), ['all', '全部']]} value={who} onChange={setWho} />
      <Slider label="时刻偏移" value={hours} min={-24} max={24} step={0.5} onChange={setHours} fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} 时`} />
      <div className="wg-cap">
        {!sky ? '计算中…' : mine && !birth ? '还没有出生资料，先用 2020-12-21 木土会合的时刻。实线竖线是天顶，虚线竖线是天底；实曲线是上升，虚曲线是下降。' : '实线竖线 = 天顶（经度 = 赤经 − 格林尼治恒星时），虚线竖线 = 天底。曲线 = 上升 / 下降，只画到南北纬 60°。没有海岸线，格子是经纬网。金圈是设置里的位置。'}
        {sky && who !== 'all' && <> {BODY_NAME[who]}天顶经度 <b>{norm180(sky.pos[who].ra - sky.gmst).toFixed(1)}°</b>。</>}
      </div>
    </div>
  )
}

/* ── 迁移：同一世界时，换城市，只改四轴 ── */
const TEACH: Birth = { date: '2000-01-01', time: '12:00', tz: 8, lat: 39.9, lon: 116.4, place: '北京（教学时刻）' }
function MoveWidget() {
  const mine = useMyBirth()
  const [useMine, setUseMine] = useState(false)
  const [pi, setPi] = useState(2)
  const birth = useMine && mine ? mine : TEACH
  const dest = PLACES[pi]
  const [a, setA] = useState<Chart | null>(null)
  const [b, setB] = useState<Chart | null>(null)
  useEffect(() => {
    let ok = true
    setA(null); setB(null)
    computeChart(birth).then((c) => ok && setA(c)).catch(() => { /* 教学时刻失败时留在「计算中」 */ })
    chartAt(birthUT(birth), dest.lat, dest.lon).then((c) => ok && setB(c)).catch(() => { /* 同上 */ })
    return () => { ok = false }
  }, [birth.date, birth.time, birth.tz, birth.lat, birth.lon, dest.lat, dest.lon]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="wg">
      <Note>{useMine && mine ? '我的出生时刻' : '教学时刻'}</Note>
      <div className="wg-btns">
        <button className={`wg-btn ${!useMine || !mine ? 'on' : ''}`} onClick={() => setUseMine(false)}>教学时刻</button>
        <button className={`wg-btn ${useMine && mine ? 'on' : ''}`} onClick={() => setUseMine(true)}>{mine ? '我的出生时刻' : '尚未填写出生资料'}</button>
      </div>
      <div className="wg-row">
        <label>搬到</label>
        <select value={pi} onChange={(e) => setPi(Number(e.target.value))}>{PLACES.map((p, k) => <option key={p.name} value={k}>{p.name}</option>)}</select>
      </div>
      {!a || !b ? <div className="wg-cap">计算中…</div> : (
        <table className="wg-table">
          <thead><tr><th></th><th>{birth.place || '原地点'}</th><th>{dest.name}</th></tr></thead>
          <tbody>
            <tr><td>上升</td><td>{fmtLon(a.asc)}</td><td>{fmtLon(b.asc)}</td></tr>
            <tr><td>天顶</td><td>{fmtLon(a.mc)}</td><td>{fmtLon(b.mc)}</td></tr>
            <tr><td>太阳黄经</td><td>{fmtLon(a.pos.sun.lon)}</td><td>{fmtLon(b.pos.sun.lon)}</td></tr>
          </tbody>
        </table>
      )}
      <div className="wg-cap">世界时相同，所以太阳黄经相同。上升和天顶随经纬度改变。教学时刻是 2000-01-01 12:00 北京时间，不是某个人。</div>
    </div>
  )
}

/* ── 若干历史时刻：现场起盘，供国家盘和案例核对 ── */
type Preset = { id: string; label: string; date: string; time: string; tz: number; lat: number; lon: number; place: string; note: string }
const PRESETS: Preset[] = [
  { id: 'prc15', label: '中国 · 下午约 3 时（常用）', date: '1949-10-01', time: '15:00', tz: 8, lat: 39.9, lon: 116.4, place: '北京（近似）', note: '开国大典当天。常用版本取北京时间下午约 3 时。这里只比较钟点，不做政治判断。' },
  { id: 'prc0', label: '中国 · 当天 0 时', date: '1949-10-01', time: '00:00', tz: 8, lat: 39.9, lon: 116.4, place: '北京（近似）', note: '同一天的零点。和下午 3 时相差 15 小时，上升会换成另一个星座。' },
  { id: 'sibly', label: '美国 · 傍晚约 17:10', date: '1776-07-04', time: '17:10', tz: -75.15 / 15, lat: 39.95, lon: -75.15, place: '费城', note: '常见的傍晚版本，上升在射手。埃比尼泽·西布利（Ebenezer Sibly）1787 年发表过这类盘。分钟各书不完全一致。' },
  { id: 'gem', label: '美国 · 凌晨约 2 时', date: '1776-07-04', time: '02:00', tz: -75.15 / 15, lat: 39.95, lon: -75.15, place: '费城', note: '另一种版本，上升在双子。本课不把这个时刻安到某个人名下。' },
  { id: 'jul2', label: '美国 · 7 月 2 日中午（示意）', date: '1776-07-02', time: '12:00', tz: -75.15 / 15, lat: 39.95, lon: -75.15, place: '费城', note: '独立是 7 月 2 日投票通过的。中午只是示意，没有"官方出生分钟"。' },
  { id: 'aug2', label: '美国 · 8 月 2 日中午（示意）', date: '1776-08-02', time: '12:00', tz: -75.15 / 15, lat: 39.95, lon: -75.15, place: '费城', note: '多数签名写在 8 月 2 日。中午只是示意。' },
  { id: 'y1524', label: '1524-02-15 黄经', date: '1524-02-15', time: '12:00', tz: 0, lat: 48.5, lon: 9.0, place: '只看黄经', note: '1524 年 2 月，多颗行星聚在双鱼。黄经与地点无关；四轴只是顺带算的。' },
  { id: 'y1603', label: '1603-12-18 木土会合', date: '1603-12-18', time: '06:59', tz: 0, lat: 51.5, lon: -0.1, place: '世界时', note: '星历时刻。1603 年英国仍用儒略历，比这套公历日期晚约 10 天，但会合仍在那年年底。' },
  { id: 'y1623', label: '1623-07-16 木土会合', date: '1623-07-16', time: '23:04', tz: 0, lat: 51.5, lon: -0.1, place: '世界时', note: '下一次木土会合。看它是否仍在火象。' },
  { id: 'e1999', label: '1999-08-11 日全食', date: '1999-08-11', time: '11:03', tz: 0, lat: 45.09, lon: 24.32, place: '最大食分附近', note: '日全食的食甚。地点约北纬 45°、东经 24°。本工具不给出食延（持续几小时）。' },
  { id: 'sp2020', label: '2020-01-12 土冥合', date: '2020-01-12', time: '17:04', tz: 0, lat: 39.9, lon: 116.4, place: '世界时', note: '土星与冥王星合相。黄经与地点无关。' },
]

function MomentsWidget({ preset }: { preset?: string }) {
  const [id, setId] = useState(PRESETS.some((p) => p.id === preset) ? preset! : 'prc15')
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
  const [c, setC] = useState<Chart | null>(null)
  useEffect(() => {
    let ok = true
    setC(null)
    computeChart({ date: p.date, time: p.time, tz: p.tz, lat: p.lat, lon: p.lon, place: p.place }).then((x) => ok && setC(x)).catch(() => { /* 保持「计算中」 */ })
    return () => { ok = false }
  }, [p])
  return (
    <div className="wg">
      <Note>现场起盘</Note>
      <div className="wg-row">
        <label>时刻</label>
        <select value={id} onChange={(e) => setId(e.target.value)}>{PRESETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
      </div>
      {!c ? <div className="wg-cap">计算中…</div> : (
        <table className="wg-table"><tbody>
          <tr><th>上升</th><td>{fmtLon(c.asc)}（{modality(signOf(c.asc).sign.i)}）</td></tr>
          <tr><th>天顶</th><td>{fmtLon(c.mc)}</td></tr>
          {CLASSICAL.map((b) => <tr key={b}><th>{BODY_NAME[b]}</th><td>{fmtLon(c.pos[b].lon)}{c.pos[b].retro ? ' 逆' : ''}</td></tr>)}
        </tbody></table>
      )}
      <div className="wg-cap">{p.note}</div>
    </div>
  )
}

/* ── 一年的材料：四季入境 + 日月食 + 慢行星 ── */
function YearWidget({ year0, next }: { year0?: number; next?: boolean }) {
  const [year, setYear] = useState(() => (year0 && year0 > 999 ? year0 : new Date().getFullYear() + (next ? 1 : 0)))
  const [pi, setPi] = useState(0)
  const place = PLACES[pi]
  const [pack, setPack] = useState<{ rows: { name: string; when: Date; chart: Chart }[]; ecl: { t: Date; kind: string; lon: number }[] } | null>(null)
  useEffect(() => {
    let ok = true
    setPack(null)
    ;(async () => {
      const ss = await seasons(year)
      const charts = await Promise.all(ss.map((s) => chartAt(s.date, place.lat, place.lon)))
      const ecl = await eclipses(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1)))
      if (ok) setPack({ rows: ss.map((s, k) => ({ name: s.name, when: s.date, chart: charts[k] })), ecl })
    })().catch(() => ok && setPack({ rows: [], ecl: [] }))
    return () => { ok = false }
  }, [year, pi, place.lat, place.lon])
  const spring = pack?.rows[0]
  const mod = spring ? modality(signOf(spring.chart.asc).sign.i) : null
  return (
    <div className="wg">
      <Note>先天文，后传统</Note>
      <div className="wg-row"><label>年份</label><input type="number" value={year} min={1000} max={2100} onChange={(e) => setYear(Number(e.target.value) || year)} /></div>
      <div className="wg-row">
        <label>城市</label>
        <select value={pi} onChange={(e) => setPi(Number(e.target.value))}>{PLACES.map((p, k) => <option key={p.name} value={k}>{p.name}</option>)}</select>
      </div>
      {!pack ? <div className="wg-cap">计算中…</div> : (
        <>
          <table className="wg-table">
            <thead><tr><th>入境</th><th>当地时间</th><th>上升</th></tr></thead>
            <tbody>{pack.rows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{fmtAt(r.when, place.tz)}</td><td>{fmtLon(r.chart.asc)} · {modality(signOf(r.chart.asc).sign.i)}</td></tr>)}</tbody>
          </table>
          {mod && <div className="wg-cap">{RULE[mod]}</div>}
          {spring && (
            <div className="wg-read">
              {(['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const).map((b) => (
                <span key={b}>{BODY_NAME[b]} <b>{fmtLon(spring.chart.pos[b].lon)}</b></span>
              ))}
            </div>
          )}
          <table className="wg-table">
            <thead><tr><th>日月食（世界时）</th><th>种类</th><th>黄经</th></tr></thead>
            <tbody>{pack.ecl.map((e) => <tr key={e.t.toISOString()}><td>{fmtUTC(e.t.getTime())}</td><td>{e.kind}</td><td>{fmtLon(e.lon)}</td></tr>)}</tbody>
          </table>
          <div className="wg-cap">慢行星的位置取春分那一刻。日月食按世界时列入这一年。象征含义要另外标明「传统」。</div>
        </>
      )}
    </div>
  )
}

export const W14: WidgetMap = {
  mGreatConj: () => <GreatWidget />,
  mSynodic: (a) => <SynWidget a0={typeof a.a === 'string' ? a.a : undefined} b0={typeof a.b === 'string' ? a.b : undefined} />,
  mIngress: (a) => <IngressWidget year0={typeof a.year === 'number' ? a.year : undefined} />,
  mAstroMap: (a) => <MapWidget mine={Boolean(a.mine)} iso={typeof a.iso === 'string' ? a.iso : undefined} />,
  mMove: () => <MoveWidget />,
  mMoments: (a) => <MomentsWidget preset={typeof a.preset === 'string' ? a.preset : undefined} />,
  mYear: (a) => <YearWidget year0={typeof a.year === 'number' ? a.year : undefined} next={Boolean(a.next)} />,
}
