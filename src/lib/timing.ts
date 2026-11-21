// 预测技术（第 9–11 阶段起共用）：行运、回归、推运、太阳弧、小限、法达、黄道释放、主限。
// 没有 React；需要星历的函数在内部按需加载 astronomy-engine。
import { loadAstro } from './astro'
import { CHALDEAN, DOMICILE, type Planet } from '../data/classical'
import { type Body, type Chart, BODIES, ascDiff, ascFrom, chartSync, findLonCrossingsSync, lonFromRA, mcFrom, norm, positionsSync, sep, signIdx, toEq } from './natal'

const DAY = 86400000
export const TROPICAL_YEAR = 365.2422
export const NAIBOD = 0.98564733
const addDays = (t: Date, d: number) => new Date(t.getTime() + d * DAY)
export const ageAt = (birth: Date, t: Date) => (t.getTime() - birth.getTime()) / DAY / TROPICAL_YEAR
export const dateAtAge = (birth: Date, age: number) => addDays(birth, age * TROPICAL_YEAR)
export const fmtDate = (t: Date) => `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`

/* ───────── 年小限 ───────── */
/** 年满 age 岁那一年的小限星座（1–12）与年主星 */
export function profection(ascSign: number, age: number, base = 1) {
  const years = Math.floor(age)
  const sign = ((ascSign - 1 + years) % 12) + 1
  return { sign, house: ((base - 1 + years) % 12) + 1, lord: DOMICILE[sign - 1] }
}
/** 月小限：年小限之后，每个"小限月"（约 30.4 天）再前进一个星座 */
export function monthlyProfection(ascSign: number, age: number) {
  const y = Math.floor(age), m = Math.floor((age - y) * 12)
  const sign = ((ascSign - 1 + y + m) % 12) + 1
  return { sign, lord: DOMICILE[sign - 1], month: m + 1 }
}

/* ───────── 法达 ───────── */
export type FLord = Planet | 'nnode' | 'snode'
export const FIRDAR_YEARS: Record<FLord, number> = { sun: 10, venus: 8, mercury: 13, moon: 9, saturn: 11, jupiter: 12, mars: 7, nnode: 3, snode: 2 }
export const FLORD_NAME: Record<FLord, string> = { sun: '太阳', venus: '金星', mercury: '水星', moon: '月亮', saturn: '土星', jupiter: '木星', mars: '火星', nnode: '北交点', snode: '南交点' }
const DAY_ORDER: Planet[] = ['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars']
const NIGHT_ORDER: Planet[] = ['moon', 'saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury']
export interface Period { lord: FLord; from: number; to: number; subs?: { lord: FLord; from: number; to: number }[] }
/** nodesAfterMars：夜盘把交点放在火星之后（博纳提的一种读法），否则放在全部七星之后 */
export function firdaria(isDay: boolean, nodesAfterMars = false): Period[] {
  let order: FLord[] = isDay ? [...DAY_ORDER, 'nnode', 'snode'] : [...NIGHT_ORDER, 'nnode', 'snode']
  if (!isDay && nodesAfterMars) order = ['moon', 'saturn', 'jupiter', 'mars', 'nnode', 'snode', 'sun', 'venus', 'mercury']
  let t = 0
  return order.map((lord) => {
    const len = FIRDAR_YEARS[lord], from = t
    t += len
    if (lord === 'nnode' || lord === 'snode') return { lord, from, to: t }
    const start = CHALDEAN.indexOf(lord as Planet)
    const subs = Array.from({ length: 7 }, (_, k) => ({ lord: CHALDEAN[(start + k) % 7] as FLord, from: from + (k * len) / 7, to: from + ((k + 1) * len) / 7 }))
    return { lord, from, to: t, subs }
  })
}

/* ───────── 黄道释放 ───────── */
/** 星座期长 = 星座主星的"小年"；摩羯按瓦伦斯给 27（而不是土星的 30） */
export const MINOR_YEARS: Record<Planet, number> = { saturn: 30, jupiter: 12, mars: 15, sun: 19, venus: 8, mercury: 20, moon: 25 }
export const ZR_SIGN_YEARS = DOMICILE.map((p, i) => (i === 9 ? 27 : MINOR_YEARS[p]))
export interface ZRPeriod { level: number; sign: number; start: number; end: number; lb?: boolean; peak?: number }
/**
 * 从 startSign 开始释放。时间单位：天。L1 一个单位 = 一"年"，L2 = 一"月"（L1 的 1/12），L3 = L2 的 1/12……
 * yearDays：360（瓦伦斯）或 365.25；fortuneSign：用于标出巅峰期（相对福点星座的角宫）。
 */
export function zodiacalReleasing(startSign: number, spanDays: number, level = 2, yearDays = 360, fortuneSign = startSign): ZRPeriod[] {
  const out: ZRPeriod[] = []
  const unit = (lv: number) => yearDays / 12 ** (lv - 1)
  const peakOf = (s: number) => { const h = ((s - fortuneSign + 12) % 12) + 1; return [1, 4, 7, 10].includes(h) ? h : undefined }
  const run = (lv: number, sign0: number, start: number, end: number) => {
    let s = sign0, t = start, count = 0, lb = false
    while (t < end) {
      const len = ZR_SIGN_YEARS[s - 1] * unit(lv)
      const p: ZRPeriod = { level: lv, sign: s, start: t, end: Math.min(end, t + len), peak: peakOf(s), lb: lb || undefined }
      lb = false
      out.push(p)
      if (lv < level) run(lv + 1, s, p.start, p.end)
      t += len
      count++
      s = (s % 12) + 1
      // 松绑：子周期走完 12 个星座、将回到起点时，跳到起点的对宫
      if (lv > 1 && count === 12) { s = ((sign0 + 5) % 12) + 1; lb = true }
    }
  }
  run(1, startSign, 0, spanDays)
  return out
}

/* ───────── 主限 ───────── */
export type Key = 'ptolemy' | 'naibod'
export const KEY_NAME: Record<Key, string> = { ptolemy: '托勒密（赤经 1° = 1 年）', naibod: '奈伯德（0°59′08″ = 1 年）' }
export const arcToYears = (arc: number, key: Key) => (key === 'ptolemy' ? arc : arc / NAIBOD)
export interface Direction { promissor: Body | 'fortune'; target: 'asc' | 'mc' | 'dsc' | 'ic'; aspect: number; arc: number; years: number; mundane: boolean }
/**
 * 到四轴的直接主限（促发者被周日运动带到轴上）。
 * 到上升 / 下降：斜升 / 斜降之差（极点 = 出生纬度）；到天顶 / 天底：赤经之差。
 * mundane = true 时带行星黄纬（in mundo 的近似）；false 时取黄道上的点（in zodiaco）。
 */
export function directionsToAngles(c: Chart, key: Key = 'ptolemy', maxYears = 90, mundane = false, aspectsDeg = [0]): Direction[] {
  const out: Direction[] = []
  const oaAsc = norm(c.ramc + 90), odDsc = norm(c.ramc - 90 + 360)
  const promissors: (Body | 'fortune')[] = [...BODIES.filter((b) => b !== 'node'), 'fortune']
  for (const p of promissors) {
    for (const asp of aspectsDeg) for (const sgn of asp === 0 || asp === 180 ? [1] : [1, -1]) {
      const lon0 = p === 'fortune' ? c.fortune : c.pos[p].lon
      const lat = p === 'fortune' || !mundane ? 0 : c.pos[p].lat
      const lon = norm(lon0 + sgn * asp)
      const { ra, dec } = toEq(lon, asp === 0 ? lat : 0, c.eps)
      const ad = ascDiff(dec, c.lat)
      const push = (target: Direction['target'], arc: number) => {
        const years = arcToYears(arc, key)
        if (years > 0.05 && years <= maxYears) out.push({ promissor: p, target, aspect: sgn * asp, arc, years, mundane })
      }
      push('mc', norm(ra - c.ramc))
      push('ic', norm(ra - norm(c.ramc + 180)))
      if (ad != null) {
        push('asc', norm(norm(ra - ad) - oaAsc))
        push('dsc', norm(norm(ra + ad) - odDsc))
      }
    }
  }
  return out.sort((a, b) => a.years - b.years)
}
/** 某年龄时被主限"转"到的四轴（用于校正）：上升 / 天顶按赤经弧整体推进 */
export function directedAngles(c: Chart, age: number, key: Key = 'ptolemy') {
  const arc = key === 'ptolemy' ? age : age * NAIBOD
  const ramc = norm(c.ramc + arc)
  return { mc: mcFrom(ramc, c.eps), asc: ascFrom(ramc, c.eps, c.lat), arc }
}

/* ───────── 需要星历的技术 ───────── */
type AE = Awaited<ReturnType<typeof loadAstro>>
let cache: AE | null = null
const ae = async () => (cache ??= await loadAstro())

/** 次限推运：出生后第 age 天的天空 = 第 age 岁。四轴可选太阳弧（默认）或奈伯德 */
export async function progressed(c: Chart, age: number, angles: 'solarArc' | 'naibod' = 'solarArc') {
  const A = await ae()
  const t = addDays(c.ut, age)
  const pos = positionsSync(A, t)
  const arc = angles === 'solarArc' ? norm(pos.sun.lon - c.pos.sun.lon) : age * NAIBOD
  const ra = norm(c.ramc + (angles === 'solarArc' ? norm(pos.sun.ra - c.pos.sun.ra) : arc))
  return { date: t, pos, arc, mc: lonFromRA(ra, c.eps), asc: ascFrom(ra, c.eps, c.lat) }
}
/** 太阳弧：所有点一起加上推运太阳走过的弧 */
export async function solarArc(c: Chart, age: number) {
  const A = await ae()
  const sun = positionsSync(A, addDays(c.ut, age), ['sun']).sun.lon
  const arc = norm(sun - c.pos.sun.lon)
  const pts: Record<string, number> = Object.fromEntries(BODIES.map((b) => [b, norm(c.pos[b].lon + arc)]))
  return { arc, pts, asc: norm(c.asc + arc), mc: norm(c.mc + arc) }
}

/** 太阳回归：year 年里太阳回到本命精确黄经的时刻，以及当时在 (lat, lon) 起的盘 */
export async function solarReturn(c: Chart, year: number, lat = c.lat, lon = c.lon) {
  const A = await ae()
  const bd = c.ut
  const guess = new Date(Date.UTC(year, bd.getUTCMonth(), bd.getUTCDate()) - 4 * DAY)
  const t = A.SearchSunLongitude(c.pos.sun.lon, guess, 10)
  if (!t) return null
  return chartSync(A, t.date, lat, lon)
}
/** 月亮回归：after 之后第一次月亮回到本命月亮黄经 */
export async function lunarReturn(c: Chart, after: Date, lat = c.lat, lon = c.lon) {
  const A = await ae()
  const ts = findLonCrossingsSync(A, 'moon', c.pos.moon.lon, after, addDays(after, 29), 0.5)
  return ts.length ? chartSync(A, ts[0], lat, lon) : null
}
/** 行星回归：本命位置被再次经过的所有时刻（含逆行造成的多次） */
export async function returnsOf(c: Chart, body: Exclude<Body, 'node' | 'sun' | 'moon'>, years = 90) {
  const A = await ae()
  return findLonCrossingsSync(A, body, c.pos[body].lon, addDays(c.ut, 20), addDays(c.ut, years * TROPICAL_YEAR), body === 'mercury' || body === 'venus' ? 1 : 3)
}
/** 外行星到本命某点的相位（如天王星对冲 = 本命天王星 + 180） */
export async function transitHits(body: Exclude<Body, 'node'>, target: number, t1: Date, t2: Date) {
  const A = await ae()
  return findLonCrossingsSync(A, body, norm(target), t1, t2, body === 'moon' ? 0.25 : body === 'sun' || body === 'mercury' || body === 'venus' ? 1 : 2)
}

export interface Transit { t: Date; body: Body; target: Body | 'asc' | 'mc'; aspect: number }
const ASPECT_LIST = [0, 60, 90, 120, 180]
const ECL_KIND: Record<string, string> = { total: '全食', partial: '偏食', annular: '环食', penumbral: '半影', hybrid: '全环食' }
/** 行运列表：t1–t2 之间，慢行星对本命点的精确相位 */
export async function transitList(c: Chart, t1: Date, t2: Date, movers: Exclude<Body, 'node'>[] = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'], targets: (Body | 'asc' | 'mc')[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'asc', 'mc']): Promise<Transit[]> {
  const A = await ae()
  const out: Transit[] = []
  for (const m of movers) for (const tg of targets) {
    const lon = tg === 'asc' ? c.asc : tg === 'mc' ? c.mc : c.pos[tg].lon
    const seen = new Set<number>()
    for (const a of ASPECT_LIST) for (const s of a === 0 || a === 180 ? [1] : [1, -1]) {
      const tl = norm(lon + s * a)
      if (seen.has(Math.round(tl * 100))) continue
      seen.add(Math.round(tl * 100))
      for (const t of findLonCrossingsSync(A, m, tl, t1, t2, m === 'mars' ? 1 : 3)) out.push({ t, body: m, target: tg, aspect: a })
    }
  }
  return out.sort((a, b) => a.t.getTime() - b.t.getTime())
}

/** 新月与满月：t1–t2 之间每次朔望的时刻与黄经 */
export async function lunations(t1: Date, t2: Date) {
  const A = await ae()
  const out: { t: Date; kind: '新月' | '满月'; lon: number }[] = []
  for (const [phase, kind] of [[0, '新月'], [180, '满月']] as const) {
    let t: Date = t1
    for (;;) {
      const r = A.SearchMoonPhase(phase, t, 40)
      if (!r || r.date > t2) break
      out.push({ t: r.date, kind, lon: norm(A.SunPosition(r.date).elon + phase) })
      t = addDays(r.date, 1)
    }
  }
  return out.sort((a, b) => a.t.getTime() - b.t.getTime())
}
/** 日月食：t1–t2 之间，返回时刻、种类、黄经 */
export async function eclipses(t1: Date, t2: Date) {
  const A = await ae()
  const out: { t: Date; kind: string; lon: number }[] = []
  let l = A.SearchLunarEclipse(t1)
  while (l.peak.date < t2) { out.push({ t: l.peak.date, kind: `月食（${ECL_KIND[l.kind] ?? l.kind}）`, lon: norm(A.SunPosition(l.peak.date).elon + 180) }); l = A.NextLunarEclipse(l.peak) }
  let s = A.SearchGlobalSolarEclipse(t1)
  while (s.peak.date < t2) { out.push({ t: s.peak.date, kind: `日食（${ECL_KIND[s.kind] ?? s.kind}）`, lon: norm(A.SunPosition(s.peak.date).elon) }); s = A.NextGlobalSolarEclipse(s.peak) }
  return out.sort((a, b) => a.t.getTime() - b.t.getTime())
}

/** 某行星在某日期所在的星座（1–12） */
export async function signOn(body: Exclude<Body, 'node'>, t: Date) {
  const A = await ae()
  return signIdx(positionsSync(A, t, [body])[body].lon)
}
/** 两点是否在 orb 内构成某相位 */
export const hits = (a: number, b: number, asp: number, orb = 1) => Math.abs(sep(a, b) - asp) <= orb
