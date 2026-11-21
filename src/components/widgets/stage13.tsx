import { useEffect, useMemo, useState } from 'react'
import { Note, type WidgetMap } from './common'
import { Wheel } from './natal'
import { PLANET, WEEKDAY, CHALDEAN, type Planet } from '../../data/classical'
import { fmtLon } from '../../data/zodiac'
import { loadAstro } from '../../lib/astro'
import {
  BODY_NAME, CLASSICAL, ascFrom, chartAt, norm, positionsSync, wholeHouse, type Chart,
} from '../../lib/natal'
import { useStore } from '../../lib/store'
import { moonNext } from './stage12'

const GOLD = '#c2a05a', STAR = '#f6f1e4', DIM = 'rgba(246,241,228,0.28)', RED = '#e88a72'

/** 用经度估算当地时区（北京 116° → 东八区）。法定夏令时另算，这里只求与地点一致。 */
export const placeTz = (lon: number) => Math.max(-12, Math.min(14, Math.round(lon / 15)))

const pad = (n: number) => String(n).padStart(2, '0')
const placeParts = (t: Date, tz: number) => {
  const p = new Date(t.getTime() + tz * 3600000)
  return { y: p.getUTCFullYear(), m: p.getUTCMonth() + 1, d: p.getUTCDate(), hh: p.getUTCHours(), mm: p.getUTCMinutes(), wd: p.getUTCDay() }
}
const fmtMD = (t: Date, tz: number) => { const p = placeParts(t, tz); return `${p.m}月${p.d}日` }
const fmtHM = (t: Date, tz: number) => { const p = placeParts(t, tz); return `${pad(p.hh)}:${pad(p.mm)}` }
const fmtWhen = (t: Date, tz: number) => `${fmtMD(t, tz)} ${fmtHM(t, tz)}`
const todayISO = (tz: number) => {
  const p = placeParts(new Date(), tz)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

/* ── 择日扫描：未来 30 天 × 每 2 小时（第 528、542、545 天） ── */
const STEP_H = 2
const DAYS = 30
const COND = [
  { id: 'wax', short: '月增光', name: '月亮增光' },
  { id: 'voc', short: '月不空亡', name: '月亮不空亡' },
  { id: 'via', short: '月避燃烧', name: '月亮不在燃烧途径' },
  { id: 'merc', short: '水星顺行', name: '水星顺行' },
  { id: 'ben', short: '月入吉星', name: '月亮下一个相位是金星或木星的吉相位' },
  { id: 'ang', short: '角宫无凶', name: '凶星（火土）不在角宫' },
] as const
type Cid = (typeof COND)[number]['id']
type Slot = { t: number; flags: Record<Cid, boolean>; note: string }

const BENEFIC_ASP = new Set(['合', '六分', '三分'])
const ANGULAR = new Set([1, 4, 7, 10])

function evalSlot(A: Awaited<ReturnType<typeof loadAstro>>, t: Date, lat: number, lon: number): Slot {
  const pos = positionsSync(A, t, CLASSICAL)
  const latUse = Math.max(-66, Math.min(66, lat))
  const eps = A.e_tilt(A.MakeTime(t)).tobl
  const asc = ascFrom(norm(A.SiderealTime(t) * 15 + lon), eps, latUse)
  const elong = norm(pos.moon.lon - pos.sun.lon)
  const next = moonNext({ pos } as Chart)
  const benOk = !!next.best && (next.best.p === 'venus' || next.best.p === 'jupiter') && BENEFIC_ASP.has(next.best.name)
  const marsH = wholeHouse(pos.mars.lon, asc)
  const satH = wholeHouse(pos.saturn.lon, asc)
  const flags: Record<Cid, boolean> = {
    wax: elong <= 180,
    voc: !!next.best,
    via: !(pos.moon.lon >= 195 && pos.moon.lon <= 225),
    merc: !pos.mercury.retro,
    ben: benOk,
    ang: !ANGULAR.has(marsH) && !ANGULAR.has(satH),
  }
  const nx = next.best ? `月下一相位 ${next.best.name}${BODY_NAME[next.best.p]}` : '月空亡'
  const note = `${nx} · 火${marsH}宫 土${satH}宫`
  return { t: t.getTime(), flags, note }
}

function ScanWidget() {
  const { lat, lon, place } = useStore().settings
  const tz = placeTz(lon)
  const [on, setOn] = useState<Record<Cid, boolean>>({ wax: true, voc: true, via: true, merc: true, ben: true, ang: true })
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [prog, setProg] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  useEffect(() => {
    let cancel = false
    setSlots(null); setProg(0); setPick(null)
    const p0 = placeParts(new Date(), tz)
    const start = Date.UTC(p0.y, p0.m - 1, p0.d) - tz * 3600000
    const total = DAYS * (24 / STEP_H)
    ;(async () => {
      const A = await loadAstro()
      if (cancel) return
      const out: Slot[] = []
      const chunk = 36
      for (let i = 0; i < total; i += chunk) {
        await new Promise((r) => setTimeout(r, 0))
        if (cancel) return
        const end = Math.min(total, i + chunk)
        for (let j = i; j < end; j++) out.push(evalSlot(A, new Date(start + j * STEP_H * 3600000), lat, lon))
        setProg(end / total)
      }
      if (!cancel) setSlots(out)
    })()
    return () => { cancel = true }
  }, [lat, lon, tz])
  const enabled = COND.filter((c) => on[c.id])
  const scoreOf = (s: Slot) => enabled.reduce((n, c) => n + (s.flags[c.id] ? 1 : 0), 0)
  const ranked = useMemo(() => {
    if (!slots) return []
    return slots.map((s, i) => ({ s, i, sc: scoreOf(s) })).sort((a, b) => b.sc - a.sc || a.s.t - b.s.t).slice(0, 5)
  }, [slots, on]) // eslint-disable-line react-hooks/exhaustive-deps
  const fullN = slots ? slots.filter((s) => scoreOf(s) === enabled.length).length : 0
  const toggle = (id: Cid) => setOn({ ...on, [id]: !on[id] })
  const W = 340, left = 26, top = 16, gw = W - left - 6, gh = 168
  const cw = gw / DAYS, ch = gh / (24 / STEP_H)
  return (
    <div className="wg">
      <Note>{place} · 每 {STEP_H} 小时</Note>
      <div className="wg-btns">
        {COND.map((c) => <button key={c.id} className={`wg-btn ${on[c.id] ? 'on' : ''}`} onClick={() => toggle(c.id)}>{c.short}</button>)}
      </div>
      {!slots && <div className="wg-cap">计算中… {Math.round(prog * 100)}%</div>}
      {slots && (
        <>
          <svg className="wg-svg" viewBox={`0 0 ${W} ${top + gh + 8}`} onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const x = ((e.clientX - r.left) / r.width) * W
            const y = ((e.clientY - r.top) / r.height) * (top + gh + 8)
            const di = Math.floor((x - left) / cw), hi = Math.floor((y - top) / ch)
            if (di >= 0 && di < DAYS && hi >= 0 && hi < 24 / STEP_H) setPick(di * (24 / STEP_H) + hi)
          }}>
            {Array.from({ length: 12 }, (_, h) => h % 3 === 0 && (
              <text key={h} x={left - 3} y={top + h * ch + ch * 0.75} textAnchor="end" fontSize="8" fill={DIM}>{h * STEP_H}</text>
            ))}
            {slots.map((s, i) => {
              const sc = scoreOf(s)
              const full = enabled.length === 0 || sc === enabled.length
              const di = Math.floor(i / (24 / STEP_H)), hi = i % (24 / STEP_H)
              const cx = left + di * cw + cw / 2, cy = top + hi * ch + ch / 2
              const lit = pick === i
              return <circle key={i} cx={cx} cy={cy} r={full ? 2.6 : 1.5} fill={full ? STAR : GOLD} opacity={full ? 1 : 0.14 + (enabled.length ? 0.35 * sc / enabled.length : 0.14)} stroke={lit ? GOLD : 'none'} strokeWidth={1} />
            })}
          </svg>
          <div className="wg-cap">亮星 {fullN} 格 · 已开 {enabled.length} 条。多开一条，亮星就变少。</div>
          {pick != null && slots[pick] && (
            <div className="wg-cap" style={{ fontSize: 13 }}>{fmtWhen(new Date(slots[pick].t), tz)} · {slots[pick].note}<br />{COND.map((c) => `${c.short}${slots[pick].flags[c.id] ? '✓' : '·'}`).join(' ')}</div>
          )}
          <table className="wg-table"><tbody>
            {ranked.map(({ s }, k) => (
              <tr key={s.t}><th>#{k + 1}</th><td>{fmtWhen(new Date(s.t), tz)} · {scoreOf(s)}/{enabled.length || 0} · {COND.filter((c) => enabled.includes(c) && s.flags[c.id]).map((c) => c.short).join('、') || '（没有打开条件）'}</td></tr>
            ))}
          </tbody></table>
          <div className="wg-cap" style={{ fontSize: 12.5 }}>横轴是往后 30 天，纵轴是当地钟点（0、2、4…）。格子用真实星历，不是随机点。2 小时一格是粗扫，上升大约 2 小时才换一座，选定之后还要再细看。</div>
          {Math.abs(lat) > 66 && <div className="wg-cap" style={{ fontSize: 12.5 }}>纬度超过 66°，上升不稳定，"角宫无凶"只供参考。</div>}
        </>
      )}
    </div>
  )
}

/* ── 水星逆行年历（第 543 天） ── */
type RxSpan = { a: number; b: number }
function MercWidget() {
  const { lon } = useStore().settings
  const tz = placeTz(lon)
  const nowY = placeParts(new Date(), tz).y
  const [year, setYear] = useState(nowY)
  const [spans, setSpans] = useState<RxSpan[] | null>(null)
  const [days, setDays] = useState(365)
  useEffect(() => {
    let cancel = false
    setSpans(null)
    ;(async () => {
      const A = await loadAstro()
      if (cancel) return
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
      const n = leap ? 366 : 365
      const flags: boolean[] = []
      for (let d = 0; d < n; d++) {
        if (d % 40 === 0) await new Promise((r) => setTimeout(r, 0))
        if (cancel) return
        const t = new Date(Date.UTC(year, 0, 1 + d, 12) - tz * 3600000)
        flags.push(positionsSync(A, t, ['mercury']).mercury.speed < 0)
      }
      const out: RxSpan[] = []
      for (let d = 0; d < n; d++) {
        if (!flags[d]) continue
        if (d === 0 || !flags[d - 1]) out.push({ a: d, b: d })
        else out[out.length - 1].b = d
      }
      if (!cancel) { setDays(n); setSpans(out) }
    })()
    return () => { cancel = true }
  }, [year, tz])
  const retroN = spans ? spans.reduce((n, s) => n + (s.b - s.a + 1), 0) : 0
  const pct = spans ? (100 * retroN) / days : 0
  const xOf = (d: number) => 14 + (d / days) * 312
  const md = (d: number) => `${new Date(Date.UTC(year, 0, 1 + d)).getUTCMonth() + 1}/${new Date(Date.UTC(year, 0, 1 + d)).getUTCDate()}`
  return (
    <div className="wg">
      <Note>逐日看速度正负</Note>
      <div className="wg-row">
        <label>年份</label>
        <input type="range" min={nowY - 4} max={nowY + 4} step={1} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <span className="wg-v">{year}</span>
      </div>
      {!spans && <div className="wg-cap">计算中…</div>}
      {spans && (
        <>
          <svg className="wg-svg" viewBox="0 0 340 78">
            <rect x={14} y={28} width={312} height={16} rx={3} fill="rgba(246,241,228,0.08)" />
            {spans.map((s, i) => <rect key={i} x={xOf(s.a)} y={28} width={Math.max(2, xOf(s.b + 1) - xOf(s.a))} height={16} fill={RED} opacity={0.9} />)}
            {[0, 90, 181, 273].map((d) => <text key={d} x={xOf(Math.min(d, days - 1))} y={58} fontSize="9" fill={DIM} textAnchor="middle">{new Date(Date.UTC(year, 0, 1 + d)).getUTCMonth() + 1}月</text>)}
          </svg>
          <div className="wg-cap"><b>{spans.length}</b> 段 · 共 {retroN} 天 · 占全年 <b>{pct.toFixed(1)}%</b></div>
          <table className="wg-table"><tbody>
            {spans.map((s, i) => (
              <tr key={i}><th>{i + 1}</th><td>{md(s.a)} – {md(s.b)} · {s.b - s.a + 1} 天{s.b - s.a + 1 < 5 ? '（跨年剩下的尾巴，不是又一次完整的三周）' : ''}</td></tr>
            ))}
          </tbody></table>
          <div className="wg-cap" style={{ fontSize: 12.5 }}>每天当地正午取样。速度为负的日子加起来，近年多在 18%–19%，和"大约 19%"是同一个量级。</div>
        </>
      )}
    </div>
  )
}

/* ── 行星时（第 540、551 天）。阶段 2 的部件还是空的，这里按同一套规则做。 ── */
type HourRow = { i: number; lord: Planet; start: number; end: number; day: boolean }
function HoursWidget() {
  const { lat, lon, place } = useStore().settings
  const tz = placeTz(lon)
  const [date, setDate] = useState(() => todayISO(tz))
  const [rows, setRows] = useState<HourRow[] | null>(null)
  const [err, setErr] = useState('')
  const [sun, setSun] = useState('')
  useEffect(() => {
    let cancel = false
    setRows(null); setErr('')
    ;(async () => {
      const A = await loadAstro()
      if (cancel) return
      const [y, m, d] = date.split('-').map(Number)
      if (!y || !m || !d) return
      const midnight = new Date(Date.UTC(y, m - 1, d) - tz * 3600000)
      const obs = new A.Observer(lat, lon, 0)
      const rise = A.SearchRiseSet(A.Body.Sun, obs, +1, midnight, 1)
      if (!rise) { if (!cancel) setErr('这一天在这个纬度太阳不升或不落，没法按昼夜切成 24 个行星时。'); return }
      const setT = A.SearchRiseSet(A.Body.Sun, obs, -1, rise.date, 2)
      if (!setT) { if (!cancel) setErr('找不到日落。'); return }
      const rise2 = A.SearchRiseSet(A.Body.Sun, obs, +1, setT.date, 2)
      if (!rise2) { if (!cancel) setErr('找不到下一次日出。'); return }
      const dayLen = (+setT.date - +rise.date) / 12
      const nightLen = (+rise2.date - +setT.date) / 12
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      let idx = CHALDEAN.indexOf(WEEKDAY[wd])
      const out: HourRow[] = []
      for (let i = 0; i < 24; i++) {
        const lord = CHALDEAN[idx % 7]
        idx++
        const start = i < 12 ? +rise.date + i * dayLen : +setT.date + (i - 12) * nightLen
        const len = i < 12 ? dayLen : nightLen
        out.push({ i, lord, start, end: start + len, day: i < 12 })
      }
      if (cancel) return
      setSun(`日出 ${fmtHM(rise.date, tz)} · 日落 ${fmtHM(setT.date, tz)} · 白天每时 ${Math.round(dayLen / 60000)} 分 · 夜晚每时 ${Math.round(nightLen / 60000)} 分`)
      setRows(out)
    })()
    return () => { cancel = true }
  }, [date, lat, lon, tz])
  const now = Date.now()
  const cur = rows?.find((r) => now >= r.start && now < r.end)
  return (
    <div className="wg">
      <Note>{place}</Note>
      <div className="wg-row"><label>日期</label><input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
      {!rows && !err && <div className="wg-cap">计算中…</div>}
      {err && <div className="wg-cap">{err}</div>}
      {rows && (
        <>
          <div className="wg-cap" style={{ fontSize: 13 }}>{sun}</div>
          <div className="wg-cap">{cur ? <>此刻是 <b>{PLANET[cur.lord].name}时</b>（第 {cur.i + 1} 时）</> : '所选日期不是今天，下面不标"此刻"。'}</div>
          <table className="wg-table"><tbody>
            {rows.map((r) => (
              <tr key={r.i} style={cur?.i === r.i ? { background: 'rgba(194,160,90,0.2)' } : undefined}>
                <th>{r.day ? '昼' : '夜'}{r.day ? r.i + 1 : r.i - 11}</th>
                <td>{PLANET[r.lord].name}时 · {fmtHM(new Date(r.start), tz)}–{fmtHM(new Date(r.end), tz)}</td>
              </tr>
            ))}
          </tbody></table>
          <div className="wg-cap" style={{ fontSize: 12.5 }}>第一时的主人 = 星期的守护星，然后按土、木、火、日、金、水、月往下排。日出日落用星历，时刻按经度估算的时区。</div>
        </>
      )}
    </div>
  )
}

/* ── 择日清单打分（第 527、531、538 天） ── */
const ITEMS: { id: string; w: number; name: string }[] = [
  { id: 'wax', w: 8, name: '月亮正在增光' },
  { id: 'voc', w: 8, name: '月亮不空亡' },
  { id: 'ben', w: 8, name: '月亮下一相位是金星或木星的吉相位' },
  { id: 'via', w: 6, name: '月亮不在燃烧途径' },
  { id: 'lord', w: 12, name: '上升主星有尊贵，而且不燃烧' },
  { id: 'lordh', w: 8, name: '上升主星在角宫（1、4、7、10）' },
  { id: 'matter', w: 12, name: '事项宫的主星有力' },
  { id: 'mattera', w: 8, name: '事项宫里有吉星，或宫主在角宫' },
  { id: 'ang', w: 15, name: '角宫没有火星、土星' },
  { id: 'natal', w: 15, name: '上升或吉星落在本命的吉点上' },
]
const CONFLICTS: [string, string, string][] = [
  ['wax', 'ben', '增光只占大约半个月。这段里月亮的下一个相位，不一定是金星或木星。'],
  ['lord', 'matter', '上升主星和事项宫主星常常是两颗星，很难同时都待在自己的庙里。'],
  ['ang', 'matter', '事项若正好要火星或土星出力，"角宫躲开凶星"就会和"事项宫主星有力"对着干。'],
  ['natal', 'lord', '本命的吉点是固定的。能接上它的那个上升，未必是命主星最有尊贵的星座。'],
]
function ScoreWidget() {
  const [on, setOn] = useState<Record<string, boolean>>({})
  const score = ITEMS.reduce((n, it) => n + (on[it.id] ? it.w : 0), 0)
  const name = (id: string) => ITEMS.find((x) => x.id === id)!.name
  const hits = CONFLICTS.filter(([a, b]) => on[a] || on[b])
  return (
    <div className="wg">
      <div className="wg-cap" style={{ fontSize: 28, marginTop: 0 }}><b>{score}</b> / 100</div>
      <svg className="wg-svg" viewBox="0 0 340 16"><rect x={10} y={4} width={320} height={8} rx={4} fill="rgba(246,241,228,0.1)" /><rect x={10} y={4} width={320 * score / 100} height={8} rx={4} fill={GOLD} /></svg>
      {ITEMS.map((it) => (
        <label key={it.id} className="wg-row" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={!!on[it.id]} onChange={() => setOn({ ...on, [it.id]: !on[it.id] })} style={{ width: 18, height: 18, flex: 'none', padding: 0, marginTop: 2 }} />
          <span style={{ flex: 1, lineHeight: 1.45 }}>{it.name}</span>
          <span className="wg-v">{it.w}</span>
        </label>
      ))}
      {hits.map(([a, b, why]) => (
        <div key={a + b} className="wg-cap" style={{ fontSize: 13, textAlign: 'left' }}>
          {on[a] && on[b] ? `两项都勾了：「${name(a)}」和「${name(b)}」。` : on[a] ? `保住了「${name(a)}」，「${name(b)}」没做到。` : `保住了「${name(b)}」，「${name(a)}」没做到。`}
          {why}
        </div>
      ))}
      <div className="wg-cap" style={{ fontSize: 12.5 }}>分数是这张清单的加权和。70 分只是一条参考线，线本身是约定，不是"事情会成功"的证明。</div>
    </div>
  )
}

/* ── 两张历史开始盘（第 547–548 天） ── */
function FoundWidget({ which }: { which: string }) {
  const [c, setC] = useState<Chart | null>(null)
  useEffect(() => {
    if (which !== 'greenwich') return
    let ok = true
    chartAt(new Date(Date.UTC(1675, 7, 10, 15, 14)), 51.48, 0).then((x) => ok && setC(x))
    return () => { ok = false }
  }, [which])
  if (which === 'baghdad') {
    return (
      <div className="wg">
        <Note>762 年 · 巴格达</Note>
        <div className="wg-cap" style={{ textAlign: 'left', fontSize: 14 }}>
          据记载，新城开工的时刻由宫廷占星师选定，其中有马沙阿拉和诺巴赫特。比鲁尼记下了这张开始盘。
          各抄本对钟点并不一致，所以这里不算到某一分，也不写一套无法核对的度数。
          要记住的是：择日在那时是开工前的一道正式工序。
        </div>
      </div>
    )
  }
  if (!c) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const ang = (b: 'mars' | 'saturn') => wholeHouse(c.pos[b].lon, c.asc)
  return (
    <div className="wg">
      <Note>时刻是大约</Note>
      <Wheel c={c} />
      <table className="wg-table"><tbody>
        <tr><th>上升</th><td>{fmtLon(c.asc)}</td></tr>
        <tr><th>天顶</th><td>{fmtLon(c.mc)}</td></tr>
        <tr><th>太阳</th><td>{fmtLon(c.pos.sun.lon)}</td></tr>
        <tr><th>月亮</th><td>{fmtLon(c.pos.moon.lon)}</td></tr>
        <tr><th>水星</th><td>{fmtLon(c.pos.mercury.lon)}{c.pos.mercury.retro ? ' 逆行' : ' 顺行'}</td></tr>
        <tr><th>火 / 土</th><td>{ang('mars')} 宫 / {ang('saturn')} 宫（整宫）</td></tr>
      </tbody></table>
      <div className="wg-cap" style={{ fontSize: 12.5 }}>1675 年 8 月 10 日约下午 3:14，格林尼治，经纬度取 51.48°N、0°。度数是星历按这个近似时刻算的，不是弗拉姆斯蒂德原图的逐字抄录。钟点一动，上升就动。</div>
    </div>
  )
}

export const W13: WidgetMap = {
  eScan: () => <ScanWidget />,
  eMercRx: () => <MercWidget />,
  eHours: () => <HoursWidget />,
  eScore: () => <ScoreWidget />,
  eFound: (a) => <FoundWidget which={String(a.which ?? 'greenwich')} />,
}
