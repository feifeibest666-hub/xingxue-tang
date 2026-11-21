// 真实星盘计算（第 5 阶段起共用）。没有 React、没有导入时副作用；astronomy-engine 在函数内部按需加载。
import { loadAstro } from './astro'
import { ASPECTS, DOMICILE, type Planet, dignityOf } from '../data/classical'

type AE = Awaited<ReturnType<typeof loadAstro>>
const rad = Math.PI / 180
export const norm = (x: number) => ((x % 360) + 360) % 360
/** 两个黄经的最短角距（0–180） */
export const sep = (a: number, b: number) => { const d = norm(a - b); return d > 180 ? 360 - d : d }
export const signIdx = (lon: number) => Math.floor(norm(lon) / 30) + 1

export type Body = Planet | 'uranus' | 'neptune' | 'pluto' | 'node'
export const CLASSICAL: Planet[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']
export const MODERN: Body[] = ['uranus', 'neptune', 'pluto']
export const BODIES: Body[] = [...CLASSICAL, ...MODERN, 'node']
export const BODY_NAME: Record<Body, string> = {
  sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星',
  uranus: '天王星', neptune: '海王星', pluto: '冥王星', node: '北交点',
}
export const BODY_SHORT: Record<Body, string> = {
  sun: '日', moon: '月', mercury: '水', venus: '金', mars: '火', jupiter: '木', saturn: '土', uranus: '天', neptune: '海', pluto: '冥', node: '交',
}
export const BODY_COLOR: Record<Body, string> = {
  sun: '#e2b34f', moon: '#dcd6c6', mercury: '#9fbccb', venus: '#e6c49a', mars: '#d9734f', jupiter: '#cfa56a', saturn: '#a7a291',
  uranus: '#7fc4c0', neptune: '#7f9fe0', pluto: '#b08ab8', node: '#c2a05a',
}
const AE_NAME: Record<Exclude<Body, 'node'>, string> = {
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
}

/** 出生资料：当地钟表时间 + 时区（东为正，小时）；地方平时 LMT 用 tz = 经度 / 15 */
export interface Birth { date: string; time: string; tz: number; lat: number; lon: number; place?: string }
export const birthUT = (b: Birth) => {
  const [y, m, d] = b.date.split('-').map(Number)
  const [hh, mm] = b.time.split(':').map(Number)
  const t = new Date(0)
  t.setUTCFullYear(y, m - 1, d)
  t.setUTCHours(hh, mm, 0, 0)
  return new Date(t.getTime() - b.tz * 3600000)
}

export interface Pos { lon: number; lat: number; speed: number; retro: boolean; ra: number; dec: number }
export type HouseSystem = 'whole' | 'equal' | 'porphyry' | 'placidus'
export const HOUSE_SYSTEM_NAME: Record<HouseSystem, string> = { whole: '整宫制', equal: '等宫制', porphyry: '波菲利', placidus: '普拉西度' }

export interface Chart {
  ut: Date; lat: number; lon: number
  eps: number; ramc: number; asc: number; mc: number
  pos: Record<Body, Pos>
  isDay: boolean
  fortune: number; spirit: number
}

/** 黄道 → 赤道 */
export function toEq(lon: number, lat: number, eps: number) {
  const l = lon * rad, b = lat * rad, e = eps * rad
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)) / rad
  const ra = norm(Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) / rad)
  return { ra, dec }
}
/** 赤经为 ra 的黄道点（黄纬 0） */
export const lonFromRA = (ra: number, eps: number) => norm(Math.atan2(Math.sin(ra * rad), Math.cos(ra * rad) * Math.cos(eps * rad)) / rad)
/** 天顶：tan λ = tan RAMC / cos ε */
export const mcFrom = (ramc: number, eps: number) => lonFromRA(ramc, eps)
/** 上升：λ = atan2(cos RAMC, −(sin ε tan φ + cos ε sin RAMC)) */
export function ascFrom(ramc: number, eps: number, lat: number) {
  const r = ramc * rad, e = eps * rad, p = lat * rad
  return norm(Math.atan2(Math.cos(r), -(Math.sin(e) * Math.tan(p) + Math.cos(e) * Math.sin(r))) / rad)
}
/** 上升差 AD：asin(tan φ · tan δ)；|值| > 1 表示该点在此纬度永不升落 */
export function ascDiff(dec: number, lat: number) {
  const x = Math.tan(lat * rad) * Math.tan(dec * rad)
  return Math.abs(x) > 1 ? null : Math.asin(x) / rad
}
/** 斜升 OA = RA − AD */
export function obliqueAsc(lon: number, lat: number, eps: number, geoLat: number) {
  const { ra, dec } = toEq(lon, lat, eps)
  const ad = ascDiff(dec, geoLat)
  return ad == null ? null : norm(ra - ad)
}

let cache: AE | null = null
const ae = async () => (cache ??= await loadAstro())

function bodyLonLat(A: AE, b: Exclude<Body, 'node'>, t: Date) {
  if (b === 'moon') { const m = A.EclipticGeoMoon(t); return { lon: norm(m.lon), lat: m.lat } }
  if (b === 'sun') return { lon: norm(A.SunPosition(t).elon), lat: 0 }
  const v = A.GeoVector(AE_NAME[b] as never, t, true)
  const s = A.SphereFromVector(A.RotateVector(A.Rotation_EQJ_ECT(t), v))
  return { lon: norm(s.lon), lat: s.lat }
}
/** 平均北交点（Meeus 公式） */
export function meanNode(t: Date) {
  const T = (t.getTime() / 86400000 + 2440587.5 - 2451545) / 36525
  return norm(125.04452 - 1934.136261 * T + 0.0020708 * T * T)
}

/** 同步版本：调用方已经拿到 astronomy-engine 实例 */
export function positionsSync(A: AE, t: Date, bodies: Body[] = BODIES): Record<Body, Pos> {
  const eps = A.e_tilt(A.MakeTime(t)).tobl
  const out = {} as Record<Body, Pos>
  for (const b of bodies) {
    if (b === 'node') {
      const lon = meanNode(t)
      out.node = { lon, lat: 0, speed: -0.053, retro: true, ...toEq(lon, 0, eps) }
      continue
    }
    const p = bodyLonLat(A, b, t)
    const h = b === 'moon' ? 1 / 24 : 0.5
    const a1 = bodyLonLat(A, b, new Date(t.getTime() - h * 86400000)).lon
    const a2 = bodyLonLat(A, b, new Date(t.getTime() + h * 86400000)).lon
    let d = a2 - a1
    if (d > 180) d -= 360
    if (d < -180) d += 360
    const speed = d / (2 * h)
    out[b] = { ...p, speed, retro: speed < 0, ...toEq(p.lon, p.lat, eps) }
  }
  return out
}

export function chartSync(A: AE, ut: Date, lat: number, lon: number): Chart {
  const eps = A.e_tilt(A.MakeTime(ut)).tobl
  const ramc = norm(A.SiderealTime(ut) * 15 + lon)
  const asc = ascFrom(ramc, eps, lat), mc = mcFrom(ramc, eps)
  const pos = positionsSync(A, ut)
  const isDay = norm(pos.sun.lon - asc) >= 180
  const s = pos.sun.lon, m = pos.moon.lon
  return {
    ut, lat, lon, eps, ramc, asc, mc, pos, isDay,
    fortune: norm(isDay ? asc + m - s : asc + s - m),
    spirit: norm(isDay ? asc + s - m : asc + m - s),
  }
}

export async function computeChart(b: Birth): Promise<Chart> {
  return chartSync(await ae(), birthUT(b), b.lat, b.lon)
}
export async function chartAt(ut: Date, lat: number, lon: number): Promise<Chart> {
  return chartSync(await ae(), ut, lat, lon)
}
export async function positionsAt(ut: Date, bodies: Body[] = BODIES) {
  return positionsSync(await ae(), ut, bodies)
}

/** 宫头（12 个黄经）；普拉西度在极圈附近无解时返回 null */
export function cusps(c: Pick<Chart, 'asc' | 'mc' | 'ramc' | 'eps' | 'lat'>, sys: HouseSystem): number[] | null {
  const { asc, mc, ramc, eps, lat } = c
  if (sys === 'whole') { const s = Math.floor(asc / 30) * 30; return Array.from({ length: 12 }, (_, k) => norm(s + k * 30)) }
  if (sys === 'equal') return Array.from({ length: 12 }, (_, k) => norm(asc + k * 30))
  const ic = norm(mc + 180), dsc = norm(asc + 180)
  if (sys === 'porphyry') {
    const q1 = norm(ic - asc) / 3, q2 = norm(dsc - ic) / 3
    return [asc, asc + q1, asc + 2 * q1, ic, ic + q2, ic + 2 * q2, dsc, dsc + q1, dsc + 2 * q1, mc, mc + q2, mc + 2 * q2].map(norm)
  }
  if (Math.abs(lat) > 66) return null
  const cusp = (frac: number, above: boolean) => {
    let R = norm(ramc + (above ? 90 * frac : 180 - 90 * frac))
    for (let k = 0; k < 30; k++) {
      const l = lonFromRA(R, eps)
      const ad = ascDiff(toEq(l, 0, eps).dec, lat)
      if (ad == null) return null
      R = above ? norm(ramc + frac * (90 + ad)) : norm(ramc + 180 - frac * (90 - ad))
    }
    return lonFromRA(R, eps)
  }
  const h11 = cusp(1 / 3, true), h12 = cusp(2 / 3, true), h2 = cusp(2 / 3, false), h3 = cusp(1 / 3, false)
  if ([h11, h12, h2, h3].some((x) => x == null)) return null
  const [a, b, d, e] = [h11!, h12!, h2!, h3!]
  return [asc, d, e, ic, norm(a + 180), norm(b + 180), dsc, norm(d + 180), norm(e + 180), mc, a, b]
}
/** 某黄经落在第几宫 */
export function houseOf(lon: number, cs: number[]) {
  for (let k = 0; k < 12; k++) {
    const a = cs[k], b = cs[(k + 1) % 12]
    if (norm(lon - a) < norm(b - a)) return k + 1
  }
  return 1
}
/** 整宫制宫位：从上升星座数起 */
export const wholeHouse = (lon: number, asc: number) => ((signIdx(lon) - signIdx(asc) + 12) % 12) + 1

export const signRuler = (sign: number): Planet => DOMICILE[sign - 1]

export interface Aspect { a: Body; b: Body; name: string; deg: number; orb: number; applying: boolean }
const ORB_DEG = [8, 5, 7, 7, 8]
/** 度数相位（托勒密五种）；发光体容许度 +2 */
export function aspects(pos: Record<Body, Pos>, bodies: Body[] = CLASSICAL, extra = 0): Aspect[] {
  const out: Aspect[] = []
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j], pa = pos[a], pb = pos[b]
    if (!pa || !pb) continue
    const d = sep(pa.lon, pb.lon)
    ASPECTS.forEach((x, k) => {
      const lum = [a, b].some((q) => q === 'sun' || q === 'moon') ? 2 : 0
      const orb = Math.abs(d - x.deg)
      if (orb > ORB_DEG[k] + lum + extra) return
      const d2 = sep(pa.lon + pa.speed * 0.01, pb.lon + pb.speed * 0.01)
      out.push({ a, b, name: x.name, deg: x.deg, orb, applying: Math.abs(d2 - x.deg) < orb })
    })
  }
  return out.sort((p, q) => p.orb - q.orb)
}

/** 盘面事实：给案例课"自动列出"用的一组句子 */
export function chartFacts(c: Chart, sys: HouseSystem = 'whole') {
  const cs = cusps(c, sys) ?? cusps(c, 'whole')!
  const signName = (l: number) => ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'][signIdx(l) - 1]
  const deg = (l: number) => `${signName(l)} ${Math.floor(norm(l) % 30)}°${String(Math.floor(((norm(l) % 30) % 1) * 60)).padStart(2, '0')}′`
  const ascLord = signRuler(signIdx(c.asc))
  const rows = BODIES.map((b) => {
    const p = c.pos[b]
    const house = sys === 'whole' ? wholeHouse(p.lon, c.asc) : houseOf(p.lon, cs)
    const dig = b in DOMICILE_SET ? dignityOf(b as Planet, p.lon, c.isDay).map((x) => x.name) : []
    return { body: b, name: BODY_NAME[b], lon: p.lon, at: deg(p.lon), house, retro: p.retro && b !== 'node', dig }
  })
  return {
    rows, cusps: cs,
    asc: deg(c.asc), mc: deg(c.mc), ascLord, ascLordRow: rows.find((r) => r.body === ascLord)!,
    sect: c.isDay ? '日生盘（太阳在地平线上）' : '夜生盘（太阳在地平线下）',
    fortune: deg(c.fortune), spirit: deg(c.spirit),
    aspects: aspects(c.pos),
    signName, deg,
  }
}
const DOMICILE_SET: Record<string, 1> = { sun: 1, moon: 1, mercury: 1, venus: 1, mars: 1, jupiter: 1, saturn: 1 }

/** 搜索：某天体黄经到达 target 的时刻（在 [t1, t2] 内，步长 stepDays），返回所有经过的时刻 */
export async function findLonCrossings(body: Exclude<Body, 'node'>, target: number, t1: Date, t2: Date, stepDays = 1): Promise<Date[]> {
  const A = await ae()
  return findLonCrossingsSync(A, body, target, t1, t2, stepDays)
}
export function findLonCrossingsSync(A: AE, body: Exclude<Body, 'node'>, target: number, t1: Date, t2: Date, stepDays = 1): Date[] {
  const f = (t: number) => { let d = bodyLonLat(A, body, new Date(t)).lon - target; d = ((d + 540) % 360) - 180; return d }
  const out: Date[] = []
  const step = stepDays * 86400000
  let ta = t1.getTime(), fa = f(ta)
  for (let tb = ta + step; tb <= t2.getTime() + step; tb += step) {
    const fb = f(tb)
    if (Math.sign(fa) !== Math.sign(fb) && Math.abs(fa - fb) < 90) {
      let lo = ta, hi = tb, flo = fa
      for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, fm = f(mid); if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm } else hi = mid }
      const t = new Date((lo + hi) / 2)
      if (t >= t1 && t <= t2) out.push(t)
    }
    ta = tb; fa = fb
  }
  return out
}
