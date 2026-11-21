export type Element = '火' | '土' | '风' | '水'
export type Modality = '开创' | '固定' | '变动'

export interface Sign {
  i: number // 1–12
  name: string
  short: string
  en: string
  season: string
  term: string // 太阳进入本宫 0° 时的中气
  image: string // 符号的图像来源
  keywords: string[]
  glyph: string // 自绘 SVG 路径，viewBox 0 0 100 100
  dots?: [number, number, number][] // 需要额外画的小圆
}

export const SIGNS: Sign[] = [
  { i: 1, name: '白羊', short: '羊', en: 'Aries', season: '春分 · 春天开头', term: '春分', image: '公羊的两只角', keywords: ['点火', '开头', '勇气', '直接'],
    glyph: 'M22 40 C12 22 30 8 42 20 C48 27 50 36 50 48 L50 86 M78 40 C88 22 70 8 58 20 C52 27 50 36 50 48' },
  { i: 2, name: '金牛', short: '牛', en: 'Taurus', season: '仲春', term: '谷雨', image: '牛头和牛角', keywords: ['扎根', '积累', '感官', '稳'],
    glyph: 'M16 16 C22 36 36 42 50 42 C64 42 78 36 84 16 M50 42 C34 42 28 54 28 64 C28 76 38 86 50 86 C62 86 72 76 72 64 C72 54 66 42 50 42' },
  { i: 3, name: '双子', short: '双', en: 'Gemini', season: '春末', term: '小满', image: '一对双胞胎', keywords: ['好奇', '交流', '多变', '两面'],
    glyph: 'M22 16 C40 26 60 26 78 16 M22 84 C40 74 60 74 78 84 M38 23 L38 77 M62 23 L62 77' },
  { i: 4, name: '巨蟹', short: '蟹', en: 'Cancer', season: '夏至 · 夏天开头', term: '夏至', image: '螃蟹的两只钳', keywords: ['守护', '家', '照顾', '感受'],
    glyph: 'M84 36 C70 14 34 16 20 36 M16 64 C30 86 66 84 80 64', dots: [[28, 40, 9], [72, 60, 9]] },
  { i: 5, name: '狮子', short: '狮', en: 'Leo', season: '盛夏', term: '大暑', image: '狮子的鬃毛和尾巴', keywords: ['发光', '表达', '骄傲', '慷慨'],
    glyph: 'M38 70 C26 70 20 62 22 54 C24 46 34 42 42 48 C46 34 40 28 46 20 C54 10 74 14 74 30 C74 44 62 52 62 66 C62 78 70 84 80 80' },
  { i: 6, name: '处女', short: '女', en: 'Virgo', season: '夏末 · 收获', term: '处暑', image: '手持麦穗的少女', keywords: ['整理', '改进', '服务', '细致'],
    glyph: 'M14 30 C14 22 28 22 28 32 L28 76 M28 34 C28 22 44 22 44 34 L44 76 M44 34 C44 22 60 22 60 34 L60 64 C60 80 74 82 80 70 C86 58 74 50 66 58 C60 64 62 80 70 90' },
  { i: 7, name: '天秤', short: '秤', en: 'Libra', season: '秋分 · 秋天开头', term: '秋分', image: '一杆天平', keywords: ['平衡', '关系', '公平', '审美'],
    glyph: 'M14 80 L86 80 M14 64 L34 64 C26 56 26 42 36 34 C44 28 56 28 64 34 C74 42 74 56 66 64 L86 64' },
  { i: 8, name: '天蝎', short: '蝎', en: 'Scorpio', season: '深秋', term: '霜降', image: '蝎子和它翘起的尾刺', keywords: ['深度', '执着', '隐秘', '转化'],
    glyph: 'M12 30 C12 22 26 22 26 32 L26 72 M26 34 C26 22 42 22 42 34 L42 72 M42 34 C42 22 58 22 58 34 L58 70 C58 80 64 82 72 78 L86 70 M76 64 L86 70 L80 80' },
  { i: 9, name: '射手', short: '射', en: 'Sagittarius', season: '秋末', term: '小雪', image: '半人马射手的箭', keywords: ['远行', '信念', '扩张', '自由'],
    glyph: 'M20 82 L80 22 M52 22 L80 22 L80 50 M32 48 L54 70' },
  { i: 10, name: '摩羯', short: '羯', en: 'Capricorn', season: '冬至 · 冬天开头', term: '冬至', image: '羊头鱼尾的海山羊', keywords: ['攀登', '责任', '结构', '纪律'],
    glyph: 'M12 28 C20 26 24 34 26 46 L28 74 M28 40 C30 26 46 24 50 36 L52 62 C54 80 76 84 80 70 C84 58 70 50 62 58 C54 66 54 80 44 88' },
  { i: 11, name: '水瓶', short: '瓶', en: 'Aquarius', season: '隆冬', term: '大寒', image: '倒水的人（但它是风象）', keywords: ['理念', '群体', '独立', '坚持'],
    glyph: 'M12 44 L26 34 L40 44 L54 34 L68 44 L84 34 M12 68 L26 58 L40 68 L54 58 L68 68 L84 58' },
  { i: 12, name: '双鱼', short: '鱼', en: 'Pisces', season: '冬末 · 一年的最后', term: '雨水', image: '两条被绳子系住的鱼', keywords: ['消融', '想象', '共情', '过渡'],
    glyph: 'M28 14 C48 34 48 66 28 86 M72 14 C52 34 52 66 72 86 M22 50 L78 50' },
]

/** 极性：奇数位阳、偶数位阴 */
export const polarity = (i: number) => (i % 2 === 1 ? '阳' : '阴')
/** 元素：除以 4 的余数 1 火、2 土、3 风、0 水 */
export const element = (i: number): Element => (['水', '火', '土', '风'] as const)[i % 4]
/** 模式：除以 3 的余数 1 开创、2 固定、0 变动 */
export const modality = (i: number): Modality => (['变动', '开创', '固定'] as const)[i % 3]

export const ELEMENT_COLOR: Record<Element, string> = { 火: '#c4633f', 土: '#8b7a4e', 风: '#8aa9b8', 水: '#3f6f8f' }
export const ELEMENT_QUAL: Record<Element, string> = { 火: '热 + 干', 土: '冷 + 干', 风: '热 + 湿', 水: '冷 + 湿' }

export const AXES: [number, number, string, string][] = [
  [1, 7, '自己', '他人'], [2, 8, '我的', '共有的'], [3, 9, '近处的知识', '远方的信念'],
  [4, 10, '家', '社会'], [5, 11, '个人', '群体'], [6, 12, '细节', '整体'],
]

/** 二十四节气，按黄经 0°、15°……排列（从春分开始） */
export const TERMS = ['春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰']

export const norm360 = (x: number) => ((x % 360) + 360) % 360
export function signOf(lon: number) {
  const l = norm360(lon)
  const idx = Math.floor(l / 30)
  return { sign: SIGNS[idx], deg: l - idx * 30 }
}
export const fmtDeg = (d: number) => {
  const D = Math.floor(d + 1e-9)
  let M = Math.round((d - D) * 60)
  if (M === 60) return `${D + 1}°00′`
  return `${D}°${String(M).padStart(2, '0')}′`
}
export const fmtLon = (lon: number) => { const { sign, deg } = signOf(lon); return `${sign.name} ${fmtDeg(deg)}` }
export const termAt = (lon: number) => TERMS[Math.floor(norm360(lon) / 15)]

/** 隔几个（0–6） */
export const gap = (a: number, b: number) => { const d = Math.abs(a - b) % 12; return Math.min(d, 12 - d) }
export const GAP_INFO: { name: string; deg: number; share: string; mood: string; aspect: string }[] = [
  { name: '同一个', deg: 0, share: '完全相同', mood: '同一个星座', aspect: '合（同宫）' },
  { name: '隔 1', deg: 30, share: '极性相反，元素、模式都不同', mood: '毫无共同点，反差大', aspect: '古人称"不合意"（互相看不见）' },
  { name: '隔 2', deg: 60, share: '极性相同（都主动或都被动）', mood: '友好', aspect: '六分' },
  { name: '隔 3', deg: 90, share: '模式相同，极性相反', mood: '同节奏、方向冲突 → 紧张', aspect: '四分' },
  { name: '隔 4', deg: 120, share: '元素相同（因此极性也相同）', mood: '最和谐', aspect: '三分' },
  { name: '隔 5', deg: 150, share: '极性、元素、模式全不同', mood: '别扭', aspect: '古人称"不合意"' },
  { name: '隔 6', deg: 180, share: '极性相同、模式相同、元素互补', mood: '张力与互补（对宫）', aspect: '对分' },
]
