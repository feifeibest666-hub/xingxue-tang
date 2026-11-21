// astronomy-engine 只在需要真实星历时按需加载（模拟器、生日太阳、二分二至）
type AE = typeof import('astronomy-engine')
let mod: Promise<AE> | null = null
export const loadAstro = () => (mod ??= import('astronomy-engine'))

export const OBLIQUITY = 23.44
const rad = Math.PI / 180

/** 太阳视黄经（回归黄道，当日分点） */
export async function sunLongitude(date: Date) {
  const A = await loadAstro()
  return A.SunPosition(date).elon
}

export async function seasons(year: number) {
  const A = await loadAstro()
  const s = A.Seasons(year)
  return [
    { name: '春分', lon: 0, date: s.mar_equinox.date },
    { name: '夏至', lon: 90, date: s.jun_solstice.date },
    { name: '秋分', lon: 180, date: s.sep_equinox.date },
    { name: '冬至', lon: 270, date: s.dec_solstice.date },
  ]
}

/** 岁差值的近似：Lahiri 在 2000 年约 23.85°，每年约 50.3″ */
export const ayanamsaAt = (year: number) => 23.85 + (year - 2000) * (50.29 / 3600)

/** 黄道坐标 → 赤道坐标（度） */
export function eclToEq(lon: number, lat = 0, eps = OBLIQUITY) {
  const l = lon * rad, b = lat * rad, e = eps * rad
  const sinDec = Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)
  const dec = Math.asin(sinDec)
  const y = Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e)
  const x = Math.cos(l)
  const ra = (Math.atan2(y, x) / rad + 360) % 360
  return { ra, dec: dec / rad }
}

/** 赤道坐标 → 地平坐标；lst 为地方恒星时（度） */
export function eqToHor(ra: number, dec: number, lat: number, lst: number) {
  const H = (lst - ra) * rad, d = dec * rad, p = lat * rad
  const sinAlt = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H)
  const alt = Math.asin(sinAlt)
  const y = -Math.sin(H) * Math.cos(d)
  const x = Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H)
  const az = (Math.atan2(y, x) / rad + 360) % 360
  return { alt: alt / rad, az }
}

/** 太阳赤纬（由黄经近似） */
export const sunDecl = (lon: number, eps = OBLIQUITY) => Math.asin(Math.sin(eps * rad) * Math.sin(lon * rad)) / rad
/** 昼长（小时），几何近似 */
export function dayLength(lat: number, decl: number) {
  const c = -Math.tan(lat * rad) * Math.tan(decl * rad)
  if (c <= -1) return 24
  if (c >= 1) return 0
  return (2 * Math.acos(c)) / rad / 15
}
/** 一个黄道星座在某纬度升起要用的时间（小时），用赤经斜升差计算 */
export function ascensionTime(signIdx0: number, lat: number) {
  const oa = (lon: number) => {
    const { ra, dec } = eclToEq(lon)
    const ad = Math.asin(Math.max(-1, Math.min(1, Math.tan(lat * rad) * Math.tan(dec * rad)))) / rad
    return ra - ad
  }
  let d = oa(signIdx0 * 30 + 30) - oa(signIdx0 * 30)
  d = ((d % 360) + 360) % 360
  return (d / 15) * (23.934 / 24)
}
