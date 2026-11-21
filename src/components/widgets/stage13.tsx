import { useEffect, useMemo, useState } from 'react'
import { Note, Slider, type WidgetMap } from './common'
import { Wheel, useMyBirth } from './natal'
import { moonNext } from './stage12'
import { SIGNS, fmtLon, norm360 } from '../../data/zodiac'
import { ANGULARITY, CHALDEAN, PLANET, WEEKDAY, dignityOf, type Planet } from '../../data/classical'
import { BODY_NAME, chartSync, computeChart, positionsSync, sep, signIdx, signRuler, wholeHouse, type Chart } from '../../lib/natal'
import { loadAstro } from '../../lib/astro'
import { useStore } from '../../lib/store'
import { PlanetAt } from '../PlanetGlyph'

const GOLD = '#c2a05a', STAR = '#f6f1e4', DIM = 'rgba(246,241,228,0.45)', RED = '#e88a72', GREEN = '#8fbf9a'
type Astro = Awaited<ReturnType<typeof loadAstro>>

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const SIGN = (lon: number) => SIGNS[signIdx(lon) - 1].name

/** 按经度把世界时折成地方平时，读出来的是墙上的钟点 */
export function lmtParts(ut: Date, lon: number) {
  const s = new Date(ut.getTime() + (lon / 15) * 3600000)
  return {
    y: s.getUTCFullYear(), m: s.getUTCMonth(), d: s.getUTCDate(),
    hh: s.getUTCHours(), mi: s.getUTCMinutes(),
    key: s.toISOString().slice(0, 10),
  }
}
export const lmtMidnight = (now: Date, lon: number) => {
  const p = lmtParts(now, lon)
  return Date.UTC(p.y, p.m, p.d) - (lon / 15) * 3600000
}
const pad = (n: number) => String(n).padStart(2, '0')
export const fmtLmt = (ut: number, lon: number) => {
  const p = lmtParts(new Date(ut), lon)
  return `${p.m + 1}月${p.d}日 ${pad(p.hh)}:${pad(p.mi)}`
}
const fmtClock = (ut: number, lon: number) => {
  const p = lmtParts(new Date(ut), lon)
  return `${p.hh}:${pad(p.mi)}`
}

const MALEFIC_HIT = 8
const COMBUST = 8.5

/** 教学简化：与太阳 < 8.5° 算燃烧；与另一颗凶星合、四分或对分（8° 内）算伤害。凶星不伤害自己。 */
export function maleficHit(c: Chart, p: Planet): string | null {
  if (p !== 'sun' && sep(c.pos[p].lon, c.pos.sun.lon) < COMBUST) {
    return `离太阳 ${sep(c.pos[p].lon, c.pos.sun.lon).toFixed(1)}°（小于 ${COMBUST}°，按简化规则算燃烧）`
  }
  for (const m of ['mars', 'saturn'] as const) {
    if (m === p) continue
    const d = sep(c.pos[p].lon, c.pos[m].lon)
    const kind = d <= MALEFIC_HIT ? '合' : Math.abs(d - 90) <= MALEFIC_HIT ? '四分' : Math.abs(d - 180) <= MALEFIC_HIT ? '对分' : ''
    if (kind) return `与${BODY_NAME[m]}${kind}（角距 ${d.toFixed(1)}°）`
  }
  return null
}

export function digSum(c: Chart, p: Planet) {
  const parts = dignityOf(p, c.pos[p].lon, c.isDay)
  return { parts, sum: parts.reduce((s, x) => s + x.score, 0) }
}

export type ScanSlot = {
  ut: number
  wax: boolean
  isVoid: boolean
  inVc: boolean
  mercRx: boolean
  moonBen: boolean
  malAng: boolean
  moonLon: number
  asc: number
  next: string
}

export function scanSlot(c: Chart, ut: number): ScanSlot {
  const el = norm360(c.pos.moon.lon - c.pos.sun.lon)
  let next = '无相位'
  let moonBen = false
  let isVoid = true
  try {
    const mn = moonNext(c)
    if (mn.best && Number.isFinite(mn.best.t)) {
      isVoid = false
      next = `${mn.best.name}${BODY_NAME[mn.best.p]}`
      moonBen = mn.best.p === 'venus' || mn.best.p === 'jupiter'
    }
  } catch { /* 外推失败就当作空亡，不让整次扫描停住 */ }
  const moonLon = norm360(c.pos.moon.lon)
  const marsH = wholeHouse(c.pos.mars.lon, c.asc)
  const satH = wholeHouse(c.pos.saturn.lon, c.asc)
  const ang = (h: number) => h === 1 || h === 4 || h === 7 || h === 10
  return {
    ut, wax: el <= 180, isVoid, inVc: moonLon >= 195 && moonLon <= 225,
    mercRx: c.pos.mercury.retro, moonBen, malAng: ang(marsH) || ang(satH),
    moonLon, asc: c.asc, next,
  }
}

type Cond = 'wax' | 'voc' | 'vc' | 'merc' | 'ben' | 'mal'
const CONDS: [Cond, string][] = [
  ['wax', '月亮增光'], ['voc', '不空亡'], ['vc', '离燃烧'],
  ['merc', '水星顺行'], ['ben', '入相金木'], ['mal', '角宫无凶'],
]
const holds = (s: ScanSlot): [Cond, boolean, string][] => [
  ['wax', s.wax, '增光'], ['voc', !s.isVoid, '不空亡'], ['vc', !s.inVc, '离燃烧'],
  ['merc', !s.mercRx, '水顺'], ['ben', s.moonBen, '入相金木'], ['mal', !s.malAng, '角宫无凶'],
]
function passOn(s: ScanSlot, on: Record<Cond, boolean>) {
  for (const [k, ok] of holds(s)) if (on[k] && !ok) return false
  return true
}
function initialOn(preset?: string): Record<Cond, boolean> {
  const on: Record<Cond, boolean> = { wax: false, voc: false, vc: false, merc: false, ben: false, mal: false }
  const list: Cond[] = preset === 'open' ? []
    : preset === 'moon' ? ['wax', 'voc', 'vc']
    : preset === 'strict' ? ['wax', 'voc', 'vc', 'merc', 'ben', 'mal']
    : ['wax', 'mal']
  for (const k of list) on[k] = true
  return on
}

function ScanWidget({ preset, step }: { preset?: string; step?: number }) {
  const { lat, lon, place } = useStore().settings
  const [stepH, setStepH] = useState(step === 1 ? 1 : 2)
  const [on, setOn] = useState(() => initialOn(preset))
  const [pack, setPack] = useState<{ origin: number; slots: ScanSlot[] } | null>(null)
  const [prog, setProg] = useState(0)
  const [err, setErr] = useState('')
  const [pick, setPick] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { setOn(initialOn(preset)) }, [preset])
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id) }, [])
  useEffect(() => {
    let cancel = false
    setPack(null); setProg(0); setErr(''); setPick(null)
    const origin = lmtMidnight(new Date(), lon)
    const n = 30 * (24 / stepH)
    ;(async () => {
      try {
        const A = await loadAstro()
        const out: ScanSlot[] = []
        for (let i = 0; i < n; i += 36) {
          if (cancel) return
          const end = Math.min(n, i + 36)
          for (let k = i; k < end; k++) {
            const ut = origin + k * stepH * 3600000
            out.push(scanSlot(chartSync(A, new Date(ut), lat, lon), ut))
          }
          if (cancel) return
          setProg(end / n)
          await new Promise((r) => setTimeout(r, 0))
        }
        if (!cancel) setPack({ origin, slots: out })
      } catch { if (!cancel) setErr('星历没有算出来') }
    })()
    return () => { cancel = true }
  }, [lat, lon, stepH])

  const slots = pack?.slots ?? null
  const per = 24 / stepH
  const lit = useMemo(() => (slots ?? []).map((s, i) => ({ s, i })).filter(({ s }) => s.ut >= now && passOn(s, on)), [slots, on, now])
  const top = lit.slice(0, 5)
  const shown = pick != null && slots ? slots[pick] : top[0]?.s
  const x0 = 34, y0 = 18, cw = stepH === 1 ? 12.4 : 24.8, ch = 7.5
  return (
    <div className="wg">
      <Note>{place} · 未来 30 天 · 每 {stepH} 小时 · 地方时</Note>
      <div className="wg-btns">
        {CONDS.map(([k, name]) => (
          <button key={k} className={`wg-btn ${on[k] ? 'on' : ''}`} onClick={() => setOn({ ...on, [k]: !on[k] })}>{name}</button>
        ))}
      </div>
      <div className="wg-btns">
        <button className={`wg-btn ${stepH === 2 ? 'on' : ''}`} onClick={() => setStepH(2)}>每 2 小时</button>
        <button className={`wg-btn ${stepH === 1 ? 'on' : ''}`} onClick={() => setStepH(1)}>每 1 小时</button>
      </div>
      {!slots && !err && <div className="wg-cap">计算中… {Math.round(prog * 100)}%。位置只算一遍，后面开关条件不再重算。</div>}
      {err && <div className="wg-cap" style={{ color: RED }}>{err}</div>}
      <svg className="wg-svg" viewBox="0 0 340 252">
        {[0, 6, 12, 18].map((h) => (
          <text key={h} x={x0 + (h / stepH) * cw + cw / 2} y={12} fontSize="8" fill={DIM} textAnchor="middle">{h}时</text>
        ))}
        {Array.from({ length: 30 }, (_, day) => {
          if (day % 5 !== 0 || !pack) return null
          const p = lmtParts(new Date(pack.origin + day * 86400000), lon)
          return <text key={day} x={2} y={y0 + day * ch + ch / 2 + 2} fontSize="8" fill={DIM}>{p.m + 1}/{p.d}</text>
        })}
        {slots && slots.map((s, i) => {
          const day = Math.floor(i / per), hi = i % per
          const x = x0 + hi * cw + cw / 2, y = y0 + day * ch + ch / 2
          const future = s.ut >= now
          const ok = future && passOn(s, on)
          return (
            <g key={i} onClick={() => setPick(i)}>
              <rect x={x - cw / 2} y={y - ch / 2} width={cw} height={ch} fill="transparent" />
              {ok ? (
                <>
                  <circle cx={x} cy={y} r={3.1} fill="rgba(194,160,90,0.22)" />
                  <line x1={x - 2.6} y1={y} x2={x + 2.6} y2={y} stroke={GOLD} strokeWidth={0.7} />
                  <line x1={x} y1={y - 2.6} x2={x} y2={y + 2.6} stroke={GOLD} strokeWidth={0.7} />
                  <circle cx={x} cy={y} r={1.15} fill={STAR} />
                </>
              ) : (
                <circle cx={x} cy={y} r={future ? 1 : 0.7} fill={future ? 'rgba(246,241,228,0.28)' : 'rgba(246,241,228,0.1)'} />
              )}
            </g>
          )
        })}
      </svg>
      <div className="wg-read"><span>亮着 <b>{slots ? lit.length : '…'}</b> 个时刻</span><span>点一格可看详情</span></div>
      {shown && (
        <div className="wg-cap">
          {fmtLmt(shown.ut, lon)} · 上升{SIGN(shown.asc)} · 月亮{fmtLon(shown.moonLon)} · 下一相位 {shown.next}
          <br />成立：{holds(shown).filter(([, ok]) => ok).map(([, , name]) => name).join('、') || '无'}
        </div>
      )}
      <div className="wg-cap" style={{ textAlign: 'left' }}>
        {slots && top.length === 0 && '这 30 天里没有同时满足的时刻。关掉一条，星星会重新亮起来。'}
        {top.map(({ s }, n) => (
          <div key={s.ut}>候选 {n + 1} · {fmtLmt(s.ut, lon)} · {holds(s).filter(([, ok]) => ok).map(([, , name]) => name).join('、')}</div>
        ))}
      </div>
      <div className="wg-cap">时间是按经度估算的地方时，和法定时区可能差几十分钟。亮星只说明"这些条件同时成立"，不是事情一定会成。</div>
    </div>
  )
}

export type RxPeriod = { from: number; to: number; fromPrev: boolean; intoNext: boolean }
export type RxYear = { year: number; days: number; rxDays: number; periods: RxPeriod[]; pct: number }

/** 每天世界时正午看水星速度的正负。跨年的一段只要有一天落在这一年里，就数进这一年。 */
export function mercuryRetroYear(A: Astro, year: number): RxYear {
  const start = Date.UTC(year, 0, 1, 12)
  const days = Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000)
  const rx: boolean[] = []
  for (let d = -45; d < days + 5; d++) {
    const t = new Date(start + d * 86400000)
    rx.push(positionsSync(A, t, ['mercury']).mercury.speed < 0)
  }
  const at = (d: number) => rx[d + 45]
  let rxDays = 0
  for (let d = 0; d < days; d++) if (at(d)) rxDays++
  const periods: RxPeriod[] = []
  let d = 0
  while (d < days) {
    if (!at(d)) { d++; continue }
    let from = d
    while (from > 0 && at(from - 1)) from--
    let to = d
    while (to + 1 < days && at(to + 1)) to++
    periods.push({ from, to, fromPrev: from === 0 && at(-1), intoNext: to === days - 1 && at(days) })
    d = to + 1
  }
  return { year, days, rxDays, periods, pct: (100 * rxDays) / days }
}
const ymd = (year: number, index: number) => {
  const t = new Date(Date.UTC(year, 0, 1 + index))
  return `${t.getUTCMonth() + 1}月${t.getUTCDate()}日`
}

function MercWidget() {
  const [year, setYear] = useState(() => new Date().getUTCFullYear())
  const [wait, setWait] = useState(year)
  const [row, setRow] = useState<RxYear | null>(null)
  useEffect(() => { const id = setTimeout(() => setWait(year), 180); return () => clearTimeout(id) }, [year])
  useEffect(() => {
    let cancel = false
    setRow(null)
    ;(async () => {
      const A = await loadAstro()
      await new Promise((r) => setTimeout(r, 0))
      if (cancel) return
      const got = mercuryRetroYear(A, wait)
      if (!cancel) setRow(got)
    })()
    return () => { cancel = true }
  }, [wait])
  const n = row?.days ?? 365
  return (
    <div className="wg">
      <Note>每天正午看一次速度的正负</Note>
      <Slider label="年份" value={year} min={2018} max={2032} step={1} onChange={setYear} fmt={(v) => `${v} 年`} />
      {!row && <div className="wg-cap">计算中…</div>}
      <svg className="wg-svg" viewBox="0 0 340 92">
        <rect x={16} y={36} width={308} height={16} rx={3} fill="rgba(246,241,228,0.12)" />
        {row && row.periods.map((p) => (
          <rect key={p.from} x={16 + (p.from / n) * 308} y={36} width={Math.max(2, ((p.to - p.from + 1) / n) * 308)} height={16} fill={GOLD} />
        ))}
        {[0, 3, 6, 9].map((m) => (
          <text key={m} x={16 + ((Date.UTC(year, m, 1) - Date.UTC(year, 0, 1)) / 86400000 / n) * 308} y={68} fontSize="10" fill={DIM}>{m + 1}月</text>
        ))}
        <text x={16} y={22} fontSize="12" fill={STAR}>{row ? `${row.periods.length} 段 · ${row.rxDays} 天 · ${row.pct.toFixed(1)}%` : '…'}</text>
      </svg>
      {row && (
        <div className="wg-cap" style={{ textAlign: 'left' }}>
          {row.periods.map((p) => <div key={p.from}>{ymd(row.year, p.from)} – {ymd(row.year, p.to)}（{p.to - p.from + 1} 天）{p.fromPrev ? ' · 上一年已经开始' : ''}{p.intoNext ? ' · 下一年还在继续' : ''}</div>)}
          <div>这一年 {row.days} 天，逆行占 {row.pct.toFixed(1)}%。常见年份在 19% 上下；每天只采样一次，交界可能差一天。</div>
        </div>
      )}
    </div>
  )
}

export type PHour = { i: number; day: boolean; lord: Planet; from: number; to: number }
export type HourTable = {
  rise: number; set: number; next: number; weekday: number; hours: PHour[]
  dayMin: number; nightMin: number; nextLord: Planet; tableNext: Planet
}

export function planetaryHours(A: Astro, y: number, m: number, d: number, lat: number, lon: number): HourTable | null {
  const obs = new A.Observer(lat, lon, 0)
  const mid = new Date(Date.UTC(y, m - 1, d) - (lon / 15) * 3600000)
  const rise = A.SearchRiseSet(A.Body.Sun, obs, 1, mid, 2)
  if (!rise) return null
  const set = A.SearchRiseSet(A.Body.Sun, obs, -1, rise.date, 2)
  if (!set) return null
  const next = A.SearchRiseSet(A.Body.Sun, obs, 1, set.date, 2)
  if (!next) return null
  const rp = lmtParts(rise.date, lon)
  if (rp.y !== y || rp.m !== m - 1 || rp.d !== d) return null
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const ruler = WEEKDAY[weekday]
  const i0 = CHALDEAN.indexOf(ruler)
  const riseT = rise.date.getTime(), setT = set.date.getTime(), nextT = next.date.getTime()
  const dayLen = (setT - riseT) / 12, nightLen = (nextT - setT) / 12
  const hours: PHour[] = []
  for (let i = 0; i < 12; i++) hours.push({ i, day: true, lord: CHALDEAN[(i0 + i) % 7], from: riseT + i * dayLen, to: riseT + (i + 1) * dayLen })
  for (let i = 0; i < 12; i++) hours.push({ i: i + 12, day: false, lord: CHALDEAN[(i0 + 12 + i) % 7], from: setT + i * nightLen, to: setT + (i + 1) * nightLen })
  return {
    rise: riseT, set: setT, next: nextT, weekday, hours,
    dayMin: dayLen / 60000, nightMin: nightLen / 60000,
    nextLord: CHALDEAN[(i0 + 24) % 7], tableNext: WEEKDAY[(weekday + 1) % 7],
  }
}

function HoursWidget() {
  const { lat, lon, place } = useStore().settings
  const today = lmtParts(new Date(), lon).key
  const [date, setDate] = useState(today)
  const [table, setTable] = useState<HourTable | null>(null)
  const [err, setErr] = useState('')
  const [pick, setPick] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id) }, [])
  useEffect(() => {
    let cancel = false
    setTable(null); setErr('')
    const [y, m, d] = date.split('-').map(Number)
    if (!y || !m || !d) return
    ;(async () => {
      try {
        const A = await loadAstro()
        const got = planetaryHours(A, y, m, d, lat, lon)
        if (cancel) return
        if (!got) { setTable(null); setErr('这一天算不出日出日落（纬度太高时，太阳可能不升不落）。'); return }
        setTable(got)
        const cur = got.hours.findIndex((h) => now >= h.from && now < h.to)
        setPick(cur >= 0 ? cur : 0)
      } catch { if (!cancel) setErr('星历没有算出来') }
    })()
    return () => { cancel = true }
  }, [date, lat, lon]) // now 只用来高亮，不重新搜寻日出
  const cur = table?.hours.findIndex((h) => now >= h.from && now < h.to) ?? -1
  const h = table?.hours[pick]
  return (
    <div className="wg">
      <Note>{place} · 从日出到次日日出 · 地方时</Note>
      <div className="wg-row"><label>日期</label><input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
      {err && <div className="wg-cap" style={{ color: RED }}>{err}</div>}
      {!table && !err && <div className="wg-cap">计算中…</div>}
      {table && (
        <>
          <svg className="wg-svg" viewBox="0 0 340 132">
            <text x={8} y={16} fontSize="11" fill={DIM}>白昼 12 时 · 每时 {table.dayMin.toFixed(0)} 分</text>
            <text x={8} y={74} fontSize="11" fill={DIM}>黑夜 12 时 · 每时 {table.nightMin.toFixed(0)} 分</text>
            {table.hours.map((hour) => {
              const col = hour.i % 12
              const x = 10 + col * 27.2, y = hour.day ? 24 : 82
              const on = hour.i === pick
              const live = hour.i === cur
              return (
                <g key={hour.i} onClick={() => setPick(hour.i)}>
                  <rect x={x} y={y} width={25} height={28} rx={4} fill={on ? 'rgba(194,160,90,0.28)' : 'rgba(246,241,228,0.06)'} stroke={live ? GOLD : 'rgba(246,241,228,0.18)'} strokeWidth={live ? 1.6 : 0.6} />
                  <PlanetAt p={hour.lord} x={x + 12.5} y={y + 14} size={16} color={PLANET[hour.lord].color} width={7} />
                </g>
              )
            })}
          </svg>
          <div className="wg-read">
            <span>周{WEEK[table.weekday]} · 第 1 时 {PLANET[WEEKDAY[table.weekday]].name}</span>
            <span>日出 {fmtClock(table.rise, lon)} · 日落 {fmtClock(table.set, lon)}</span>
          </div>
          {h && (
            <div className="wg-cap">
              第 {h.i + 1} 时（{h.day ? '白昼' : '黑夜'}）· {PLANET[h.lord].name} · {fmtClock(h.from, lon)}–{fmtClock(h.to, lon)}
              {h.i === cur ? ' · 此刻' : ''}
            </div>
          )}
          <div className="wg-cap">
            24 时走完，下一天第 1 时是{PLANET[table.nextLord].name}；星期表上的下一天也是{PLANET[table.tableNext].name}。
            {table.nextLord === table.tableNext ? '两条对得上。' : '两条不一致，计算有误。'}
          </div>
        </>
      )}
    </div>
  )
}

export const SCORE_ITEMS: { id: string; group: string; name: string; w: number }[] = [
  { id: 'wax', group: '月亮', name: '月亮增光（距角 0°–180°）', w: 2 },
  { id: 'voc', group: '月亮', name: '月亮不空亡', w: 2 },
  { id: 'ben', group: '月亮', name: '下一相位是金星或木星', w: 2 },
  { id: 'vc', group: '月亮', name: '月亮不在燃烧途径', w: 1 },
  { id: 'dig', group: '上升', name: '上升主星有尊贵（计分 > 0）', w: 2 },
  { id: 'house', group: '上升', name: '上升主星在角宫或续宫', w: 2 },
  { id: 'safe', group: '上升', name: '上升主星未被凶星伤害', w: 2 },
  { id: 'matter', group: '事项', name: '事项宫主星有力', w: 2 },
  { id: 'mal', group: '角宫', name: '火星、土星都不在角宫', w: 2 },
  { id: 'natal', group: '本命', name: '与本命吉点相合（8° 内）', w: 1 },
  { id: 'merc', group: '水星', name: '水星顺行', w: 1 },
]
export const SCORE_MAX = SCORE_ITEMS.reduce((s, x) => s + x.w, 0)

const MATTERS: [number, string][] = [
  [7, '婚礼 / 合作 · 7 宫'], [10, '开业 · 10 宫'], [2, '钱财 · 2 宫'],
  [3, '签约 / 短途 · 3 宫'], [9, '远行 · 9 宫'], [4, '搬家 · 4 宫'],
]
const houseSign = (asc: number, house: number) => ((signIdx(asc) - 1 + house - 1) % 12) + 1
const goodHouse = (h: number) => (h - 1) % 3 !== 2
const angular = (h: number) => h === 1 || h === 4 || h === 7 || h === 10

export type ScoreRow = { id: string; ok: boolean; why: string }
export function scoreChart(c: Chart, house: number, natal: Chart | null): { rows: ScoreRow[]; matterLord: Planet } {
  const slot = scanSlot(c, c.ut.getTime())
  const lord = signRuler(signIdx(c.asc))
  const dig = digSum(c, lord)
  const lordH = wholeHouse(c.pos[lord].lon, c.asc)
  const hit = maleficHit(c, lord)
  const ms = houseSign(c.asc, house)
  const mr = signRuler(ms)
  const md = digSum(c, mr)
  const mrH = wholeHouse(c.pos[mr].lon, c.asc)
  const marsH = wholeHouse(c.pos.mars.lon, c.asc)
  const satH = wholeHouse(c.pos.saturn.lon, c.asc)
  let natalOk = false
  let natalWhy = '没有填写本命资料，这一项不自动勾。'
  if (natal) {
    const pts: [string, number][] = [['上升', natal.asc], ['天顶', natal.mc], ['太阳', natal.pos.sun.lon], ['月亮', natal.pos.moon.lon], ['福点', natal.fortune]]
    const hitP = pts.find(([, lon]) => sep(c.asc, lon) <= 8)
    const g = (['venus', 'jupiter'] as const).find((p) => sep(c.pos[p].lon, natal.asc) <= 8 || sep(c.pos[p].lon, natal.mc) <= 8)
    natalOk = Boolean(hitP || g)
    natalWhy = hitP ? `择日上升合本命${hitP[0]}（${sep(c.asc, hitP[1]).toFixed(1)}°）`
      : g ? `${BODY_NAME[g]}合本命${sep(c.pos[g].lon, natal.asc) <= 8 ? '上升' : '天顶'}`
      : '8° 内没有对上本命的上升、天顶、日月、福点，金星和木星也没合本命角度。'
  }
  const rows: ScoreRow[] = [
    { id: 'wax', ok: slot.wax, why: `月日距角 ${norm360(c.pos.moon.lon - c.pos.sun.lon).toFixed(0)}°（0–180 为增光）` },
    { id: 'voc', ok: !slot.isVoid, why: slot.isVoid ? '离开本星座前不再完成相位' : `下一相位 ${slot.next}` },
    { id: 'ben', ok: slot.moonBen, why: slot.moonBen ? `下一相位是${slot.next}` : `下一相位是${slot.next}，不是金星或木星` },
    { id: 'vc', ok: !slot.inVc, why: slot.inVc ? `月亮在 ${fmtLon(c.pos.moon.lon)}，落在燃烧途径` : `月亮在 ${fmtLon(c.pos.moon.lon)}` },
    { id: 'dig', ok: dig.sum > 0, why: `${BODY_NAME[lord]}在${fmtLon(c.pos[lord].lon)}：${dig.parts.length ? dig.parts.map((x) => `${x.name}${x.score > 0 ? '+' : ''}${x.score}`).join('、') : '无'}，合计 ${dig.sum}` },
    { id: 'house', ok: goodHouse(lordH), why: `${BODY_NAME[lord]}在 ${lordH} 宫（${ANGULARITY(lordH)}）。好宫这里指角宫或续宫。` },
    { id: 'safe', ok: !hit, why: hit ?? '没有触发简化的伤害规则' },
    { id: 'matter', ok: md.sum > 0 || angular(mrH), why: `${house} 宫${SIGNS[ms - 1].name}，主星${BODY_NAME[mr]}在${fmtLon(c.pos[mr].lon)}、${mrH} 宫，尊贵合计 ${md.sum}${md.sum > 0 || angular(mrH) ? '' : '，既无正分也不在角宫'}` },
    { id: 'mal', ok: !angular(marsH) && !angular(satH), why: `火星 ${marsH} 宫，土星 ${satH} 宫` },
    { id: 'natal', ok: natalOk, why: natalWhy },
    { id: 'merc', ok: !c.pos.mercury.retro, why: c.pos.mercury.retro ? '水星逆行' : '水星顺行' },
  ]
  return { rows, matterLord: mr }
}

export function scoreTensions(on: Record<string, boolean>, matterLord?: Planet): string[] {
  const out: string[] = []
  if (on.wax && on.vc) out.push('增光和"不在燃烧途径"不永远打架。太阳在狮子、处女一带时，增光的月亮会走过天秤 15°–天蝎 15°，两条才挤在一起。')
  if (on.ben && on.voc) out.push('"下一相位是金星或木星"已经包含"不空亡"。前者窄，后者宽，不必当成两条独立的功劳。')
  if (on.dig && on.house) out.push('主星今天落在哪个星座，决定它有没有尊贵；哪个星座升上来，决定它在第几宫。能让它有尊贵的上升，常常把它放进果宫。')
  if (on.mal && on.matter) out.push(matterLord === 'mars' || matterLord === 'saturn'
    ? `事项主星正是${BODY_NAME[matterLord]}。它要有力，又要凶星离开角宫，两件事会撞车。`
    : '若事项主星是火星或土星，它一进角宫，"有力"和"角宫无凶"就对着干。')
  if (on.natal && (on.wax || on.ben || on.dig)) out.push('再要求合到本命的吉点，窗口会更窄。选不到时，先放下这一条。')
  if (on.merc) out.push('水星顺行大约占全年八成。文书可以把它当加分，不必当成"这几周什么都不能签"。')
  const all = SCORE_ITEMS.every((it) => on[it.id])
  if (all) out.push(`十一条全亮是 ${SCORE_MAX} 分。一个月里常常没有这种时刻。目标是排序，不是满分。`)
  return out
}

function ScoreWidget() {
  const { lat, lon, place } = useStore().settings
  const mine = useMyBirth()
  const [natal, setNatal] = useState<Chart | null>(null)
  const [house, setHouse] = useState(7)
  const nowP = lmtParts(new Date(), lon)
  const [date, setDate] = useState(nowP.key)
  const [hour, setHour] = useState(nowP.hh)
  const [minute, setMinute] = useState(nowP.mi)
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(SCORE_ITEMS.map((it) => [it.id, false])))
  const [facts, setFacts] = useState<ScoreRow[] | null>(null)
  const [lord, setLord] = useState<Planet | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const birthKey = mine ? `${mine.date}|${mine.time}|${mine.tz}|${mine.lat}|${mine.lon}` : ''
  useEffect(() => {
    let cancel = false
    setNatal(null)
    if (mine) computeChart(mine).then((c) => { if (!cancel) setNatal(c) })
    return () => { cancel = true }
  }, [birthKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const got = SCORE_ITEMS.reduce((s, it) => s + (on[it.id] ? it.w : 0), 0)
  const tensions = scoreTensions(on, lord)
  async function fill() {
    const [y, m, d] = date.split('-').map(Number)
    if (!y || !m || !d) return
    setBusy(true)
    try {
      const A = await loadAstro()
      const ut = new Date(Date.UTC(y, m - 1, d, hour, minute) - (lon / 15) * 3600000)
      const c = chartSync(A, ut, lat, lon)
      const r = scoreChart(c, house, natal)
      setOn(Object.fromEntries(r.rows.map((row) => [row.id, row.ok])))
      setFacts(r.rows)
      setLord(r.matterLord)
    } finally { setBusy(false) }
  }
  let last = ''
  return (
    <div className="wg">
      <Note>满分 {SCORE_MAX} · 勾选是判断，不是天文</Note>
      <div className="wg-row">
        <label>事项</label>
        <select value={house} onChange={(e) => { setHouse(Number(e.target.value)); setFacts(null); setLord(undefined) }} style={{ width: 'auto', padding: '4px 10px', fontSize: 13, borderRadius: 999 }}>
          {MATTERS.map(([h, name]) => <option key={h} value={h}>{name}</option>)}
        </select>
      </div>
      <div className="wg-row"><label>日期</label><input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
      <Slider label="地方时" value={hour + minute / 60} min={0} max={23.99} step={1 / 60} onChange={(v) => { setHour(Math.floor(v)); setMinute(Math.round((v - Math.floor(v)) * 60) % 60) }} fmt={(v) => `${Math.floor(v)}:${pad(Math.round((v - Math.floor(v)) * 60) % 60)}`} />
      <div className="wg-btns"><button className="wg-btn" onClick={fill}>{busy ? '计算中…' : '按这个时刻填入'}</button></div>
      <div className="wg-cap">{place} · 钟点按经度折成地方时。伤害和"有力"用的是课上写明的简化规则。{mine && !natal ? ' 本命盘计算中，稍等再点填入。' : ''}{!mine ? ' 还没填出生资料，本命那 1 分不会自动勾。' : ''}</div>
      {SCORE_ITEMS.map((it) => {
        const head = it.group !== last
        last = it.group
        return (
          <div key={it.id}>
            {head && <div style={{ marginTop: 8 }}><Note>{it.group}</Note></div>}
            <button className={`wg-btn ${on[it.id] ? 'on' : ''}`} style={{ textAlign: 'left' }} onClick={() => { setOn({ ...on, [it.id]: !on[it.id] }); setFacts(null); setLord(undefined) }}>
              {on[it.id] ? '✓ ' : '○ '}{it.name} · {it.w} 分
            </button>
          </div>
        )
      })}
      <svg className="wg-svg" viewBox="0 0 340 46">
        <rect x={16} y={16} width={308} height={12} rx={6} fill="rgba(246,241,228,0.12)" />
        <rect x={16} y={16} width={308 * got / SCORE_MAX} height={12} rx={6} fill={GOLD} />
        <text x={16} y={12} fontSize="11" fill={STAR}>{got} / {SCORE_MAX}</text>
      </svg>
      {facts && (
        <table className="wg-table"><tbody>
          {facts.map((row) => <tr key={row.id}><td style={{ color: row.ok ? GREEN : DIM }}>{row.ok ? '成立' : '未成立'}</td><td>{row.why}</td></tr>)}
        </tbody></table>
      )}
      <div className="wg-cap" style={{ textAlign: 'left' }}>
        {tensions.length ? tensions.map((t) => <div key={t} style={{ marginTop: 4 }}>取舍 · {t}</div>) : '当前勾选之间没有列出的挤占。再多勾几条，取舍会出现。'}
      </div>
    </div>
  )
}

const BAGHDAD = { lat: 33.34, lon: 44.4, y: 762, m: 7, d: 30 }
const GREENWICH = { lat: 51.48, lon: 0 }
/** 1675 年英国仍用儒略历。字面 8 月 10 日直接送进星历，和"儒略 8 月 10 日 = 格里 8 月 20 日"不是同一天。 */
const GREEN_DAYS = [
  { d: 10, name: '字面 8/10' },
  { d: 20, name: '儒略→8/20' },
] as const

function FoundingWidget({ which }: { which?: string }) {
  const green = which === 'greenwich'
  const [A, setA] = useState<Astro | null>(null)
  const [hour, setHour] = useState(15)
  const [gDay, setGDay] = useState<(typeof GREEN_DAYS)[number]['d']>(10)
  useEffect(() => { let ok = true; loadAstro().then((a) => ok && setA(a)); return () => { ok = false } }, [])
  const chart = useMemo(() => {
    if (!A) return null
    if (green) return chartSync(A, new Date(Date.UTC(1675, 7, gDay, 15, 14)), GREENWICH.lat, GREENWICH.lon)
    const ut = new Date(Date.UTC(BAGHDAD.y, BAGHDAD.m - 1, BAGHDAD.d) + (hour - BAGHDAD.lon / 15) * 3600000)
    return chartSync(A, ut, BAGHDAD.lat, BAGHDAD.lon)
  }, [A, green, hour, gDay])
  const hourNote = useMemo(() => {
    if (!A || !green) return ''
    const ph = planetaryHours(A, 1675, 8, gDay, GREENWICH.lat, GREENWICH.lon)
    if (!ph) return ''
    const ut = Date.UTC(1675, 7, gDay, 15, 14)
    const h = ph.hours.find((x) => ut >= x.from && ut < x.to)
    return h ? `这一算法下，15:14 落在第 ${h.i + 1} 时，主星是${PLANET[h.lord].name}。换一种历，时辰会变，所以不把时辰写成史料。` : ''
  }, [A, green, gDay])
  if (!chart) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const rows: [string, string][] = (['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const).map((p) => [
    BODY_NAME[p],
    `${fmtLon(chart.pos[p].lon)}${chart.pos[p].retro ? ' 逆' : ''} · ${wholeHouse(chart.pos[p].lon, chart.asc)} 宫`,
  ])
  return (
    <div className="wg">
      <Note>{green ? '格林尼治 · 时刻和历法都要标明' : '巴格达 · 日期与钟点都是近似'}</Note>
      {!green && <Slider label="地方时" value={hour} min={0} max={23} step={1} onChange={setHour} fmt={(v) => `${v} 时`} />}
      {green && (
        <div className="wg-btns">
          {GREEN_DAYS.map((g) => (
            <button key={g.d} className={`wg-btn ${gDay === g.d ? 'on' : ''}`} onClick={() => setGDay(g.d)}>{g.name}</button>
          ))}
        </div>
      )}
      <Wheel c={chart} sys="whole" lit={{ bodies: ['jupiter', 'mercury'], houses: [1, 10] }} showAspects={false} size={300} />
      <table className="wg-table"><tbody>
        <tr><th>上升</th><td>{fmtLon(chart.asc)}</td></tr>
        <tr><th>天顶</th><td>{fmtLon(chart.mc)}</td></tr>
        <tr><th>昼夜</th><td>{chart.isDay ? '日生盘' : '夜生盘'}</td></tr>
        {rows.map(([n, v]) => <tr key={n}><th>{n}</th><td>{v}</td></tr>)}
      </tbody></table>
      <div className="wg-cap">
        {green
          ? `约 15:14，经度近 0，钟点是近似值。英国 1752 年前用儒略历：当时的 8 月 10 日要加 10 天，才是星历里的 8 月 20 日。"格里 8/10"是把数字直接送进星历。两张都不是手稿抄件。${hourNote}`
          : `762 年 7 月 30 日，地方时 ${hour} 时。木星整天都在射手；把滑块拖到下午，看它何时进入 1 宫。也有人把公历换算成 7 月 31 日。古代日期只看星座和大约度数。`}
      </div>
    </div>
  )
}

export const W13: WidgetMap = {
  eScan: (a) => <ScanWidget preset={a.preset as string | undefined} step={a.step as number | undefined} />,
  eMercRx: () => <MercWidget />,
  eHours: () => <HoursWidget />,
  eScore: () => <ScoreWidget />,
  eFound: (a) => <FoundingWidget which={a.which as string | undefined} />,
}
