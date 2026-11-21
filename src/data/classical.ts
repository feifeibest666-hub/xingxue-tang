// 古典占星常用表（第 2–6 阶段共用）。星座用 1–12（白羊 = 1），与 zodiac.ts 的 SIGNS[i - 1] 对应。
export type Planet = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'

/** 迦勒底顺序：按古人估计的视运动周期从慢到快 */
export const CHALDEAN: Planet[] = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon']
/** 星期顺序：日月火水木金土 */
export const WEEKDAY: Planet[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn']

export const PLANET: Record<Planet, { name: string; short: string; cn: string; color: string }> = {
  sun: { name: '太阳', short: '日', cn: '太阳', color: '#d9a441' },
  moon: { name: '月亮', short: '月', cn: '太阴', color: '#c9c3b6' },
  mercury: { name: '水星', short: '水', cn: '辰星', color: '#8aa9b8' },
  venus: { name: '金星', short: '金', cn: '太白', color: '#d8b48a' },
  mars: { name: '火星', short: '火', cn: '荧惑', color: '#c4633f' },
  jupiter: { name: '木星', short: '木', cn: '岁星', color: '#b58a52' },
  saturn: { name: '土星', short: '土', cn: '镇星', color: '#7d7a6e' },
}

/** 平均日速（度/天）、恒星周期（天）、会合周期（天，日月无） */
export const MOTION: Record<Planet, { daily: number; sidereal: number; synodic?: number }> = {
  sun: { daily: 0.9856, sidereal: 365.256 },
  moon: { daily: 13.176, sidereal: 27.322, synodic: 29.531 },
  mercury: { daily: 0.9856, sidereal: 87.97, synodic: 115.88 },
  venus: { daily: 0.9856, sidereal: 224.7, synodic: 583.92 },
  mars: { daily: 0.524, sidereal: 686.98, synodic: 779.94 },
  jupiter: { daily: 0.0831, sidereal: 4332.6, synodic: 398.88 },
  saturn: { daily: 0.0335, sidereal: 10759.2, synodic: 378.09 },
}
/** 内行星最大距角（度，平均值） */
export const MAX_ELONGATION = { mercury: 28, venus: 47 } as const

/** 昼夜区分：昼 = 日木土，夜 = 月金火；水星看晨昏 */
export const SECT: Record<Planet, 'day' | 'night' | 'either'> = {
  sun: 'day', jupiter: 'day', saturn: 'day', moon: 'night', venus: 'night', mars: 'night', mercury: 'either',
}
/** 托勒密的吉凶 */
export const BENEFIC: Record<Planet, '吉' | '凶' | '中性' | '发光体'> = {
  sun: '发光体', moon: '发光体', jupiter: '吉', venus: '吉', saturn: '凶', mars: '凶', mercury: '中性',
}

/** 入庙（守护）：DOMICILE[星座 1–12] */
export const DOMICILE: Planet[] = ['mars', 'venus', 'mercury', 'moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter']
/** 擢升：星座与度数 */
export const EXALTATION: Partial<Record<Planet, { sign: number; deg: number }>> = {
  sun: { sign: 1, deg: 19 }, moon: { sign: 2, deg: 3 }, mercury: { sign: 6, deg: 15 }, venus: { sign: 12, deg: 27 },
  mars: { sign: 10, deg: 28 }, jupiter: { sign: 4, deg: 15 }, saturn: { sign: 7, deg: 21 },
}
export const opposite = (sign: number) => ((sign + 5) % 12) + 1
export const domicileOf = (p: Planet) => DOMICILE.flatMap((q, i) => (q === p ? [i + 1] : []))
export const detrimentOf = (p: Planet) => domicileOf(p).map(opposite)
export const fallOf = (p: Planet) => (EXALTATION[p] ? opposite(EXALTATION[p]!.sign) : undefined)

/** 三分性主星（多罗修斯）：昼、夜、共管；按元素 火 土 风 水 */
export const TRIPLICITY: Record<'火' | '土' | '风' | '水', [Planet, Planet, Planet]> = {
  火: ['sun', 'jupiter', 'saturn'], 土: ['venus', 'moon', 'mars'], 风: ['saturn', 'mercury', 'jupiter'], 水: ['venus', 'mars', 'moon'],
}

/** 埃及界：每个星座 5 段，[主星, 终点度数] */
export const BOUNDS: [Planet, number][][] = [
  [['jupiter', 6], ['venus', 12], ['mercury', 20], ['mars', 25], ['saturn', 30]],
  [['venus', 8], ['mercury', 14], ['jupiter', 22], ['saturn', 27], ['mars', 30]],
  [['mercury', 6], ['jupiter', 12], ['venus', 17], ['mars', 24], ['saturn', 30]],
  [['mars', 7], ['venus', 13], ['mercury', 19], ['jupiter', 26], ['saturn', 30]],
  [['jupiter', 6], ['venus', 11], ['saturn', 18], ['mercury', 24], ['mars', 30]],
  [['mercury', 7], ['venus', 17], ['jupiter', 21], ['mars', 28], ['saturn', 30]],
  [['saturn', 6], ['mercury', 14], ['jupiter', 21], ['venus', 28], ['mars', 30]],
  [['mars', 7], ['venus', 11], ['mercury', 19], ['jupiter', 24], ['saturn', 30]],
  [['jupiter', 12], ['venus', 17], ['mercury', 21], ['saturn', 26], ['mars', 30]],
  [['mercury', 7], ['jupiter', 14], ['venus', 22], ['saturn', 26], ['mars', 30]],
  [['mercury', 7], ['venus', 13], ['jupiter', 20], ['mars', 25], ['saturn', 30]],
  [['venus', 12], ['jupiter', 16], ['mercury', 19], ['mars', 28], ['saturn', 30]],
]
export const boundAt = (lon: number) => {
  const l = ((lon % 360) + 360) % 360
  const s = Math.floor(l / 30), d = l - s * 30
  return BOUNDS[s].find(([, end]) => d < end)![0]
}
/** 迦勒底外观（十度）：白羊 0° 起火星，按迦勒底顺序循环 */
export const faceAt = (lon: number) => CHALDEAN[(2 + Math.floor((((lon % 360) + 360) % 360) / 10)) % 7]

/** 行星的喜乐宫（整宫制宫位 1–12） */
export const JOY: Record<Planet, number> = { mercury: 1, moon: 3, venus: 5, mars: 6, sun: 9, jupiter: 11, saturn: 12 }

/** 托勒密相位 */
export const ASPECTS = [
  { name: '合', deg: 0, signs: 0 }, { name: '六分', deg: 60, signs: 2 }, { name: '四分', deg: 90, signs: 3 },
  { name: '三分', deg: 120, signs: 4 }, { name: '对分', deg: 180, signs: 6 },
] as const
/** 中世纪"光体半径"（Lilly 的容许度，取一半为 moiety） */
export const ORB: Record<Planet, number> = { sun: 15, moon: 12, mercury: 7, venus: 7, mars: 7.5, jupiter: 9, saturn: 9 }

/** 十二宫的古典主题（希腊化传统） */
export const HOUSE_TOPICS = [
  '生命、身体、性情', '生计、财产', '兄弟姐妹、短途、"女神"', '父母、家、根基、晚年', '子女、好运、娱乐', '疾病、劳役、"坏运"',
  '婚姻、伴侣、公开的对手', '死亡、他人的财物', '远行、神明、哲学、"神"', '事业、行动、名声', '朋友、盟友、"善灵"', '敌人、隐秘、监禁、"恶灵"',
]
/** 角宫 / 续宫 / 果宫 */
export const ANGULARITY = (house: number) => (['角宫', '续宫', '果宫'] as const)[(house - 1) % 3]

/** 本质尊贵（简化计分：庙 5、旺 4、三分 3、界 2、面 1；陷 −5、落 −4） */
export function dignityOf(p: Planet, lon: number, isDay = true) {
  const sign = Math.floor((((lon % 360) + 360) % 360) / 30) + 1
  const el = (['水', '火', '土', '风'] as const)[sign % 4]
  const out: { name: string; score: number }[] = []
  if (DOMICILE[sign - 1] === p) out.push({ name: '入庙', score: 5 })
  if (EXALTATION[p]?.sign === sign) out.push({ name: '擢升', score: 4 })
  if (TRIPLICITY[el][isDay ? 0 : 1] === p) out.push({ name: '三分', score: 3 })
  if (boundAt(lon) === p) out.push({ name: '界', score: 2 })
  if (faceAt(lon) === p) out.push({ name: '外观', score: 1 })
  if (detrimentOf(p).includes(sign)) out.push({ name: '陷', score: -5 })
  if (fallOf(p) === sign) out.push({ name: '落', score: -4 })
  return out
}
