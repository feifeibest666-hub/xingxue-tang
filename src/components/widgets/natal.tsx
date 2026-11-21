// 星盘工作台的共用部件：本命盘轮、盘面事实、主题高亮、自己的出生资料（第 7 阶段起，其他阶段也可直接用）
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Btns } from './common'
import { GlyphAt } from '../Glyph'
import { PLACES } from './tools'
import { CASES, caseById } from '../../data/cases'
import { HOUSE_TOPICS, PLANET, type Planet, dignityOf, JOY } from '../../data/classical'
import { fmtLon } from '../../data/zodiac'
import { type Birth, type Body, type Chart, type HouseSystem, BODIES, BODY_COLOR, BODY_NAME, BODY_SHORT, CLASSICAL, HOUSE_SYSTEM_NAME, aspects, computeChart, cusps, houseOf, norm, sep, signIdx, signRuler, wholeHouse } from '../../lib/natal'
import { setNote, useStore } from '../../lib/store'

export const SIGN_CN = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼']
/** 与 fmtLon / chartFacts 相同：分四舍五入，满 60′ 进位到度。 */
export const fmtL = (l: number) => fmtLon(l)
const D = Math.PI / 180

/* ───────── 出生资料来源：案例或"我的盘" ───────── */
export const MY_BIRTH_KEY = 'my-birth'
export function useMyBirth(): Birth | null {
  const s = useStore()
  return useMemo(() => { try { const b = JSON.parse(s.notes[MY_BIRTH_KEY] ?? 'null'); return b && b.date ? b : null } catch { return null } }, [s.notes])
}
export function useChartOf(src: string): { chart: Chart | null; label: string; birth: Birth | null } {
  const mine = useMyBirth()
  const k = caseById(src)
  const birth = src === 'me' ? mine : k?.birth ?? null
  const [chart, setChart] = useState<Chart | null>(null)
  const key = JSON.stringify(birth)
  useEffect(() => { let ok = true; setChart(null); if (birth) computeChart(birth).then((c) => ok && setChart(c)); return () => { ok = false } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return { chart, label: src === 'me' ? '我的盘' : k ? `${k.name}（${k.rating}）` : '', birth }
}
/** 案例选择条；allowMe 时多一个"我的盘" */
export function CasePicker({ value, onChange, ids, allowMe = true }: { value: string; onChange: (v: string) => void; ids?: string[]; allowMe?: boolean }) {
  const list = (ids ?? CASES.map((c) => c.id)).map((id) => [id, caseById(id)?.name ?? id] as [string, string])
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto', padding: '4px 10px', fontSize: 13, borderRadius: 999 }}>
      {list.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
      {allowMe && <option value="me">我的盘</option>}
    </select>
  )
}
export const NeedMine = () => <div className="wg-cap" style={{ fontSize: 13 }}>还没有填写自己的出生资料——在本页或「星图 → 小工具 → 我的出生资料」里填一次，所有工具都会用它。</div>

/* ───────── 星盘轮 ───────── */
export interface Ring { pts: { lon: number; label: string; color?: string }[]; name?: string }
export function Wheel({ c, sys = 'whole', lit, dimOthers, outer, showAspects = true, size = 340, rotate = 0 }: {
  c: Chart; sys?: HouseSystem; lit?: { bodies?: (Body | 'fortune' | 'spirit')[]; houses?: number[] }; dimOthers?: boolean; outer?: Ring; showAspects?: boolean; size?: number; rotate?: number
}) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 6
  const asc = c.asc + rotate
  const P = (lon: number, r: number) => { const t = (lon - asc) * D; return [cx - r * Math.cos(t), cy + r * Math.sin(t)] as const }
  const cs = cusps({ ...c, asc: norm(c.asc + rotate) }, sys) ?? cusps(c, 'whole')!
  const rSign = R - 22, rHouse = rSign - 2, rIn = R * 0.34
  const isLitH = (h: number) => !lit?.houses || lit.houses.includes(h)
  const isLitB = (b: Body | 'fortune' | 'spirit') => !lit?.bodies || lit.bodies.includes(b)
  const bodies = BODIES.map((b) => ({ b, lon: c.pos[b].lon }))
  // 避免符号重叠：按黄经排序后推开
  const placed = [...bodies].sort((a, b) => a.lon - b.lon).map((x) => ({ ...x, d: x.lon }))
  for (let k = 1; k < placed.length * 2; k++) {
    const i = k % placed.length, j = (i + placed.length - 1) % placed.length
    const gap = norm(placed[i].d - placed[j].d)
    if (gap < 7) placed[i].d = placed[j].d + 7
  }
  const asp = showAspects ? aspects(c.pos, CLASSICAL) : []
  const ASP_COLOR: Record<string, string> = { 合: '#e6cf95', 六分: '#7fb0d6', 三分: '#7fb0d6', 四分: '#d9734f', 对分: '#d9734f' }
  const angle = (lon: number, label: string) => { const [x1, y1] = P(lon, rIn); const [x2, y2] = P(lon, R + 2); const [tx, ty] = P(lon, R - 10); return <g key={label}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f6f1e4" strokeWidth={1.6} /><text x={tx} y={ty + 3} fontSize={9} fill="#f6f1e4" textAnchor="middle" fontWeight={700}>{label}</text></g> }
  return (
    <svg className="wg-svg" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={R} fill="#101528" stroke="rgba(246,241,228,0.3)" />
      <circle cx={cx} cy={cy} r={rSign} fill="none" stroke="rgba(246,241,228,0.25)" />
      <circle cx={cx} cy={cy} r={rIn} fill="#0c1020" stroke="rgba(246,241,228,0.2)" />
      {Array.from({ length: 12 }, (_, k) => {
        const [x1, y1] = P(k * 30, rSign), [x2, y2] = P(k * 30, R)
        const [gx, gy] = P(k * 30 + 15, (R + rSign) / 2)
        return <g key={k}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(246,241,228,0.25)" /><GlyphAt i={k + 1} x={gx} y={gy} size={13} color="#c2a05a" width={8} /></g>
      })}
      {cs.map((l, k) => {
        const [x1, y1] = P(l, rIn), [x2, y2] = P(l, rHouse)
        const next = cs[(k + 1) % 12]
        const mid = l + norm(next - l) / 2
        const [hx, hy] = P(mid, rIn + 10)
        const on = isLitH(k + 1)
        return <g key={k} opacity={dimOthers && !on ? 0.25 : 1}>
          {lit?.houses?.includes(k + 1) && <path d={`M${P(l, rIn)[0]} ${P(l, rIn)[1]} L${P(l, rHouse)[0]} ${P(l, rHouse)[1]} A${rHouse} ${rHouse} 0 0 0 ${P(next, rHouse)[0]} ${P(next, rHouse)[1]} L${P(next, rIn)[0]} ${P(next, rIn)[1]} A${rIn} ${rIn} 0 0 1 ${P(l, rIn)[0]} ${P(l, rIn)[1]}Z`} fill="rgba(194,160,90,0.18)" />}
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(246,241,228,0.18)" />
          <text x={hx} y={hy + 3} fontSize={8.5} fill="rgba(246,241,228,0.55)" textAnchor="middle">{k + 1}</text>
        </g>
      })}
      {angle(c.asc, '升')}{angle(c.mc, '顶')}{angle(c.asc + 180, '降')}{angle(c.mc + 180, '底')}
      {asp.map((a, k) => {
        const [x1, y1] = P(c.pos[a.a].lon, rIn), [x2, y2] = P(c.pos[a.b].lon, rIn)
        const on = isLitB(a.a) && isLitB(a.b)
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ASP_COLOR[a.name]} strokeWidth={1} opacity={dimOthers && !on ? 0.12 : 0.55} strokeDasharray={a.name === '六分' ? '3 3' : undefined} />
      })}
      {placed.map(({ b, lon, d }) => {
        const [x, y] = P(d, rIn + 28), [tx, ty] = P(lon, rHouse)
        const on = isLitB(b)
        return <motion.g key={b} initial={false} animate={{ opacity: dimOthers && !on ? 0.2 : 1 }}>
          <line x1={tx} y1={ty} x2={P(lon, rHouse - 6)[0]} y2={P(lon, rHouse - 6)[1]} stroke={BODY_COLOR[b]} strokeWidth={1.5} />
          {lit?.bodies?.includes(b) && <circle cx={x} cy={y} r={11} fill="rgba(194,160,90,0.25)" stroke="#c2a05a" />}
          <text x={x} y={y + 4.5} fontSize={b === 'node' ? 10 : 13} fill={BODY_COLOR[b]} textAnchor="middle" fontWeight={600}>{BODY_SHORT[b]}</text>
          {c.pos[b].retro && b !== 'node' && <text x={x + 9} y={y + 9} fontSize={7} fill="#d9734f">R</text>}
        </motion.g>
      })}
      {(['fortune', 'spirit'] as const).filter((k) => lit?.bodies?.includes(k)).map((k) => { const [x, y] = P(c[k], rIn + 12); return <g key={k}><circle cx={x} cy={y} r={7} fill="none" stroke="#c2a05a" /><text x={x} y={y + 3} fontSize={7.5} fill="#c2a05a" textAnchor="middle">{k === 'fortune' ? '福' : '神'}</text></g> })}
      {outer?.pts.map((p, k) => { const [x, y] = P(p.lon, R + 0), [x2, y2] = P(p.lon, rSign); return <g key={k}><line x1={x} y1={y} x2={x2} y2={y2} stroke={p.color ?? '#7fc4c0'} strokeWidth={2} /><circle cx={x2} cy={y2} r={8} fill="#0c1020" stroke={p.color ?? '#7fc4c0'} /><text x={x2} y={y2 + 3.5} fontSize={9} fill={p.color ?? '#7fc4c0'} textAnchor="middle">{p.label}</text></g> })}
    </svg>
  )
}

/* ───────── 主题高亮：选"职业"，相关宫和行星亮起 ───────── */
export const THEMES: Record<string, { houses: number[]; extra: (Body | 'fortune' | 'spirit')[]; why: string }> = {
  性格: { houses: [1], extra: ['sun', 'moon', 'mercury'], why: '上升（1 宫）与命主星；发光体；水星和月亮管"灵魂的品质"（托勒密）。' },
  职业: { houses: [10], extra: ['spirit', 'mercury', 'venus', 'mars'], why: '10 宫、天顶、10 宫主；精神点；托勒密的"行动主星"水、金、火。' },
  财富: { houses: [2, 11], extra: ['fortune', 'jupiter'], why: '2 宫与 2 宫主；木星；福点和"获得点"（福点起第 11 宫）。' },
  关系: { houses: [7], extra: ['venus', 'mars'], why: '7 宫、下降点、7 宫主；金星和火星的状态与相位。' },
  家庭: { houses: [3, 4, 5], extra: ['sun', 'moon', 'venus', 'saturn', 'jupiter'], why: '父母：昼看日金、夜看土月，加 4 宫；兄弟 3 宫；子女 5 宫与木星。' },
  健康: { houses: [1, 6], extra: ['mars', 'saturn'], why: '上升与 6 宫；传统只描述"体质倾向"，本课程不做诊断。' },
  信仰: { houses: [9, 12], extra: ['sun', 'saturn', 'jupiter'], why: '9 宫是太阳的喜乐宫（神），12 宫是土星的喜乐宫（隐退、暗处）。' },
}
export function themeLit(c: Chart, theme: string) {
  const t = THEMES[theme]
  if (!t) return undefined
  const ascSign = signIdx(c.asc)
  const lords = t.houses.map((h) => signRuler(((ascSign - 1 + h - 1) % 12) + 1))
  return { houses: t.houses, bodies: [...new Set([...lords, ...t.extra])] as (Body | 'fortune' | 'spirit')[] }
}

/* ───────── 盘面事实表 ───────── */
export function FactsTable({ c, sys = 'whole', only }: { c: Chart; sys?: HouseSystem; only?: (Body | 'fortune' | 'spirit')[] }) {
  const cs = cusps(c, sys) ?? cusps(c, 'whole')!
  const house = (l: number) => (sys === 'whole' ? wholeHouse(l, c.asc) : houseOf(l, cs))
  const rows: [string, number, string][] = BODIES.filter((b) => !only || only.includes(b)).map((b) => {
    const dig = (CLASSICAL as Body[]).includes(b) ? dignityOf(b as Planet, c.pos[b].lon, c.isDay).map((x) => x.name).join('、') : ''
    const joy = (CLASSICAL as Body[]).includes(b) && JOY[b as Planet] === wholeHouse(c.pos[b].lon, c.asc) ? '喜乐' : ''
    return [BODY_NAME[b] + (c.pos[b].retro && b !== 'node' ? '（逆）' : ''), c.pos[b].lon, [dig, joy].filter(Boolean).join('、')]
  })
  if (!only || only.includes('fortune')) rows.push(['福点', c.fortune, ''])
  if (!only || only.includes('spirit')) rows.push(['精神点', c.spirit, ''])
  return (
    <table className="wg-table">
      <thead><tr><th>天体</th><th>位置</th><th>宫</th><th>尊贵/状态</th></tr></thead>
      <tbody>{rows.map(([n, l, d]) => <tr key={n}><td>{n}</td><td>{fmtL(l)}</td><td>{house(l)}</td><td style={{ color: 'rgba(246,241,228,0.65)' }}>{d}</td></tr>)}</tbody>
    </table>
  )
}

/** 一句话的盘面概况 */
export function chartBrief(c: Chart) {
  const lord = signRuler(signIdx(c.asc))
  return `上升 ${fmtL(c.asc)}，天顶 ${fmtL(c.mc)}；${c.isDay ? '日生盘' : '夜生盘'}；命主星 ${PLANET[lord].name}在 ${fmtL(c.pos[lord].lon)}（第 ${wholeHouse(c.pos[lord].lon, c.asc)} 宫）`
}

/* ───────── chart：本命盘工作台 ───────── */
export function ChartWidget({ src: src0 = 'einstein', theme: theme0, sys: sys0 = 'whole', facts = true, ids, sidereal = false }: { src?: string; theme?: string; sys?: HouseSystem; facts?: boolean; ids?: string[]; sidereal?: boolean }) {
  const [src, setSrc] = useState(src0)
  const [sys, setSys] = useState<HouseSystem>(sys0)
  const [theme, setTheme] = useState(theme0 ?? '')
  const [zod, setZod] = useState<'trop' | 'sid'>('trop')
  const { chart, birth } = useChartOf(src)
  const k = caseById(src)
  const shown = useMemo(() => {
    if (!chart || zod === 'trop') return chart
    const ay = 23.85 + (chart.ut.getUTCFullYear() - 2000) * (50.29 / 3600)
    const pos = Object.fromEntries(Object.entries(chart.pos).map(([b, p]) => [b, { ...p, lon: norm(p.lon - ay) }])) as Chart['pos']
    return { ...chart, pos, asc: norm(chart.asc - ay), mc: norm(chart.mc - ay), fortune: norm(chart.fortune - ay), spirit: norm(chart.spirit - ay) }
  }, [chart, zod])
  const lit = shown && theme ? themeLit(shown, theme) : undefined
  const placidusOk = shown ? cusps(shown, 'placidus') !== null : true
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}>
        <CasePicker value={src} onChange={setSrc} ids={ids} />
        <select value={sys} onChange={(e) => setSys(e.target.value as HouseSystem)} style={{ width: 'auto', padding: '4px 10px', fontSize: 13, borderRadius: 999 }}>
          {(Object.keys(HOUSE_SYSTEM_NAME) as HouseSystem[]).map((s) => <option key={s} value={s}>{HOUSE_SYSTEM_NAME[s]}</option>)}
        </select>
        {sidereal && <Btns items={[['trop', '回归黄道'], ['sid', '恒星黄道']]} value={zod} onChange={setZod} />}
      </div>
      {src === 'me' && !birth && <><NeedMine /><MyBirthForm /></>}
      {shown && <>
        <Wheel c={shown} sys={sys} lit={lit} dimOthers={Boolean(theme)} />
        <div className="wg-btns">{['', ...Object.keys(THEMES)].map((t) => <button key={t || 'all'} className={`wg-btn ${theme === t ? 'on' : ''}`} onClick={() => setTheme(t)}>{t || '全盘'}</button>)}</div>
        {theme && <div className="wg-read"><span>{THEMES[theme].why}</span></div>}
        <div className="wg-read"><span>{chartBrief(shown)}</span></div>
        {!placidusOk && sys === 'placidus' && <div className="wg-read"><span>这个纬度上普拉西度无解，已改用整宫制画出。</span></div>}
        {zod === 'sid' && <div className="wg-read"><span>恒星黄道 = 回归黄经减去岁差值（Lahiri 近似）；所有点整体后退约 {(23.85 + (shown.ut.getUTCFullYear() - 2000) * 0.01397).toFixed(1)}°，星座常常整个换掉，宫位关系不变。</span></div>}
        {facts && <details><summary className="wg-read" style={{ cursor: 'pointer' }}><span>▸ 盘面事实（App 列出，请核对）</span></summary><FactsTable c={shown} sys={sys} /></details>}
        {k && <div className="wg-read" style={{ fontSize: 11.5 }}><span>出生：{k.birth.date} {k.birth.time} {k.clock}，{k.birth.place}；评级 {k.rating}；来源：{k.source}{k.note ? `。${k.note}` : ''}</span></div>}
      </>}
      {!shown && (src !== 'me' || birth) && <div className="wg-cap">正在计算星盘……</div>}
    </div>
  )
}

/* ───────── 我的出生资料 ───────── */
export function MyBirthForm() {
  const mine = useMyBirth()
  const [date, setDate] = useState(mine?.date ?? '')
  const [time, setTime] = useState(mine?.time ?? '12:00')
  const [place, setPlace] = useState(mine?.place ?? '北京')
  const [dst, setDst] = useState(false)
  const p = PLACES.find((x) => x.name === place) ?? PLACES[0]
  const save = () => date && setNote(MY_BIRTH_KEY, JSON.stringify({ date, time, tz: p.tz + (dst ? 1 : 0), lat: p.lat, lon: p.lon, place: p.name }))
  const y = Number(date.slice(0, 4))
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 6 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <select value={place} onChange={(e) => setPlace(e.target.value)}>{PLACES.map((x) => <option key={x.name}>{x.name}</option>)}</select>
      </div>
      <div className="wg-btns">
        <button className={`wg-btn ${dst ? 'on' : ''}`} onClick={() => setDst(!dst)}>夏令时 +1 小时</button>
        <button className="wg-btn on" onClick={save} disabled={!date}>保存</button>
        {mine && <span className="wg-read" style={{ marginTop: 0 }}><span>已保存：{mine.date} {mine.time} {mine.place}</span></span>}
      </div>
      {y >= 1986 && y <= 1991 && <div className="wg-read"><span>提醒：中国 1986–1991 年每年夏天实行夏令时（4 月中旬到 9 月中旬），出生在这段时间请打开"夏令时"。</span></div>}
      <div className="wg-read" style={{ fontSize: 11.5 }}><span>只存在本机。不知道时刻就填 12:00——那样上升和宫位不可靠，第 11 阶段会讲怎么校正。</span></div>
    </div>
  )
}
export const MyBirthWidget = () => <div className="wg"><div className="wg-cap" style={{ textAlign: 'left', fontSize: 14 }}>我的出生资料</div><MyBirthForm /></div>

/* ───────── sevenSteps：解盘七步进度星路 ───────── */
const SEVEN = ['区分：日盘还是夜盘', '上升与命主星', '两颗发光体', '行星状态（尊贵、宫位、逆行）', '相位与接纳', '整体强调（元素 / 模式 / 半球）', '综合：多重证词']
export function SevenStepsWidget({ src: src0 = 'einstein', ids }: { src?: string; ids?: string[] }) {
  const [src, setSrc] = useState(src0)
  const [step, setStep] = useState(0)
  const { chart: c } = useChartOf(src)
  const body = (k: number): ReactNode => {
    if (!c) return '计算中……'
    const lord = signRuler(signIdx(c.asc))
    const sectBenefic = c.isDay ? 'jupiter' : 'venus', sectMalefic = c.isDay ? 'saturn' : 'mars'
    const st = (b: Planet) => { const d = dignityOf(b, c.pos[b].lon, c.isDay).map((x) => x.name); return `${PLANET[b].name}在${fmtL(c.pos[b].lon)}、第 ${wholeHouse(c.pos[b].lon, c.asc)} 宫${c.pos[b].retro ? '、逆行' : ''}${d.length ? `（${d.join('、')}）` : ''}` }
    switch (k) {
      case 0: return `太阳在第 ${wholeHouse(c.pos.sun.lon, c.asc)} 宫 → ${c.isDay ? '日盘' : '夜盘'}。区分内的吉星是${PLANET[sectBenefic].name}（最吉），区分外的凶星是${PLANET[sectMalefic === 'saturn' ? 'mars' : 'saturn'].name}（最需要留意）；区分光体是${c.isDay ? '太阳' : '月亮'}。`
      case 1: return `上升 ${fmtL(c.asc)}，命主星是${PLANET[lord].name}：${st(lord)}。`
      case 2: return `${st('sun')}；${st('moon')}。日月相距 ${sep(c.pos.sun.lon, c.pos.moon.lon).toFixed(0)}°。`
      case 3: return CLASSICAL.map((b) => st(b)).join('；') + '。'
      case 4: { const a = aspects(c.pos, CLASSICAL).slice(0, 6); return a.length ? a.map((x) => `${BODY_NAME[x.a]}${x.name}${BODY_NAME[x.b]}（${x.orb.toFixed(1)}°${x.applying ? '，入相' : '，出相'}）`).join('；') + '。看相位时再问：两颗星能否在对方的庙或旺里"接纳"对方？' : '主要行星之间几乎没有紧密相位——这本身是一条事实。' }
      case 5: { const e = { 火: 0, 土: 0, 风: 0, 水: 0 } as Record<string, number>; const m = { 开创: 0, 固定: 0, 变动: 0 } as Record<string, number>; let up = 0
        CLASSICAL.forEach((b) => { const s = signIdx(c.pos[b].lon); e[['水', '火', '土', '风'][s % 4]]++; m[['变动', '开创', '固定'][s % 3]]++; if (norm(c.pos[b].lon - c.asc) >= 180) up++ })
        return `七星元素：火 ${e.火}、土 ${e.土}、风 ${e.风}、水 ${e.水}；模式：开创 ${m.开创}、固定 ${m.固定}、变动 ${m.变动}；地平线上 ${up} 颗、下 ${7 - up} 颗。` }
      default: return '把前六步里"至少两条独立证据指向同一方向"的结论写下来；只有一条证据的，标成"待验证"。'
    }
  }
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={(v) => { setSrc(v); setStep(0) }} ids={ids} /></div>
      <svg className="wg-svg" viewBox="0 0 340 60">
        <path d="M14 40 Q 90 6 170 30 T 326 22" fill="none" stroke="rgba(246,241,228,0.2)" strokeDasharray="3 4" />
        {SEVEN.map((_, k) => { const x = 14 + k * 52, y = 40 - Math.sin((k / 6) * Math.PI) * 18 - (k > 3 ? 4 : 0); const on = k <= step
          return <g key={k} onClick={() => setStep(k)} style={{ cursor: 'pointer' }}><motion.circle cx={x} cy={y} r={on ? 8 : 5} fill={on ? '#c2a05a' : '#2f3958'} initial={false} animate={{ r: on ? 8 : 5 }} /><text x={x} y={y + 22} fontSize={9} fill="rgba(246,241,228,0.6)" textAnchor="middle">{k + 1}</text></g> })}
      </svg>
      <div className="wg-cap" style={{ fontSize: 14 }}>第 {step + 1} 步 · {SEVEN[step]}</div>
      <div className="wg-read"><span>{body(step)}</span></div>
      <div className="wg-btns"><button className="wg-btn" onClick={() => setStep(Math.max(0, step - 1))}>‹ 上一步</button><button className="wg-btn on" onClick={() => setStep(Math.min(6, step + 1))}>点亮下一步 ›</button></div>
    </div>
  )
}

/* ───────── scale：证据天平 ───────── */
export function ScaleWidget({ cards = [], left = '支持', right = '反对' }: { cards?: [string, number][]; left?: string; right?: string }) {
  const [where, setWhere] = useState<Record<number, -1 | 0 | 1>>({})
  const w = cards.reduce((s, [, wt], k) => s + (where[k] ?? 0) * wt, 0)
  const tilt = Math.max(-18, Math.min(18, -w * 4))
  return (
    <div className="wg">
      <svg className="wg-svg" viewBox="0 0 340 130">
        <line x1={170} y1={20} x2={170} y2={120} stroke="#c2a05a" strokeWidth={3} /><path d="M150 122 L190 122 L170 108 Z" fill="#c2a05a" />
        <motion.g style={{ originX: '170px', originY: '24px' }} animate={{ rotate: tilt }} transition={{ type: 'spring', stiffness: 80, damping: 12 }}>
          <line x1={60} y1={24} x2={280} y2={24} stroke="#e6cf95" strokeWidth={3} />
          <path d="M30 70 Q60 90 90 70 Z" fill="rgba(127,176,214,0.3)" stroke="#7fb0d6" /><line x1={60} y1={24} x2={36} y2={70} stroke="#7fb0d6" /><line x1={60} y1={24} x2={84} y2={70} stroke="#7fb0d6" />
          <path d="M250 70 Q280 90 310 70 Z" fill="rgba(217,115,79,0.3)" stroke="#d9734f" /><line x1={280} y1={24} x2={256} y2={70} stroke="#d9734f" /><line x1={280} y1={24} x2={304} y2={70} stroke="#d9734f" />
          <text x={60} y={104} fontSize={11} fill="#7fb0d6" textAnchor="middle">{left}</text><text x={280} y={104} fontSize={11} fill="#d9734f" textAnchor="middle">{right}</text>
        </motion.g>
      </svg>
      {cards.map(([t, wt], k) => (
        <div key={k} className="wg-row" style={{ alignItems: 'flex-start' }}>
          <span style={{ flex: 1, lineHeight: 1.5 }}>{t} <span style={{ color: 'rgba(246,241,228,0.45)' }}>（权重 {wt}）</span></span>
          <Btns items={[[-1, left], [0, '—'], [1, right]]} value={where[k] ?? 0} onChange={(v) => setWhere({ ...where, [k]: v as -1 | 0 | 1 })} />
        </div>
      ))}
      <div className="wg-cap">{w === 0 ? '天平持平：证据不足以下结论' : w < 0 ? `偏向「${left}」` : `偏向「${right}」`}</div>
    </div>
  )
}

/* ───────── temperament：冷热干湿 ───────── */
const QUAL: Record<string, [number, number]> = { 火: [1, 1], 土: [-1, 1], 风: [1, -1], 水: [-1, -1] } // [热(+)/冷(−), 干(+)/湿(−)]
const PLANET_QUAL: Record<Planet, [number, number]> = { sun: [1, 1], moon: [-1, -1], mercury: [0, 1], venus: [1, -1], mars: [1, 1], jupiter: [1, -1], saturn: [-1, 1] }
export function TemperamentWidget({ src: src0 = 'einstein' }: { src?: string }) {
  const [src, setSrc] = useState(src0)
  const { chart: c } = useChartOf(src)
  if (!c) return <div className="wg"><CasePicker value={src} onChange={setSrc} /><div className="wg-cap">计算中……</div></div>
  const el = (l: number) => ['水', '火', '土', '风'][signIdx(l) % 4]
  const lord = signRuler(signIdx(c.asc))
  const phase = norm(c.pos.moon.lon - c.pos.sun.lon)
  const moonQ: [number, number] = phase < 90 ? [1, -1] : phase < 180 ? [1, 1] : phase < 270 ? [-1, 1] : [-1, -1]
  const sunSeason = Math.floor(norm(c.pos.sun.lon) / 90)
  // 春热湿、夏热干、秋冷干、冬冷湿
  const seasonQ: [number, number] = [[1, -1], [1, 1], [-1, 1], [-1, -1]][sunSeason] as [number, number]
  const rows: [string, [number, number]][] = [
    [`上升星座（${SIGN_CN[signIdx(c.asc) - 1]}，${el(c.asc)}象）`, QUAL[el(c.asc)]],
    [`命主星${PLANET[lord].name}本身的性质`, PLANET_QUAL[lord]],
    [`命主星所在星座（${SIGN_CN[signIdx(c.pos[lord].lon) - 1]}）`, QUAL[el(c.pos[lord].lon)]],
    [`月亮所在星座（${SIGN_CN[signIdx(c.pos.moon.lon) - 1]}）`, QUAL[el(c.pos.moon.lon)]],
    [`月相（日月相距 ${phase.toFixed(0)}°）`, moonQ],
    [`出生季节（太阳在${['春', '夏', '秋', '冬'][sunSeason]}季象限）`, seasonQ],
  ]
  const hot = rows.reduce((s, [, q]) => s + q[0], 0), dry = rows.reduce((s, [, q]) => s + q[1], 0)
  const name = hot >= 0 ? (dry >= 0 ? '胆汁质（热干）' : '多血质（热湿）') : dry >= 0 ? '抑郁质（冷干）' : '黏液质（冷湿）'
  const q = (v: number, a: string, b: string) => (v > 0 ? a : v < 0 ? b : '—')
  return (
    <div className="wg">
      <CasePicker value={src} onChange={setSrc} />
      <table className="wg-table"><thead><tr><th>因素</th><th>冷热</th><th>干湿</th></tr></thead>
        <tbody>{rows.map(([t, v]) => <tr key={t}><td>{t}</td><td>{q(v[0], '热', '冷')}</td><td>{q(v[1], '干', '湿')}</td></tr>)}</tbody></table>
      <div className="wg-cap">合计：热 {hot > 0 ? '+' : ''}{hot}，干 {dry > 0 ? '+' : ''}{dry} → <b>{name}</b></div>
      <div className="wg-read" style={{ fontSize: 11.5 }}><span>简化版李利方法：每个因素记 1 分，不加权。各家因素和权重不同，结果常常不一致——这正是本课要讲的局限。</span></div>
    </div>
  )
}

/* ───────── emphasis：元素 / 模式 / 半球分布 ───────── */
export function EmphasisWidget({ src: src0 = 'einstein', outer = false }: { src?: string; outer?: boolean }) {
  const [src, setSrc] = useState(src0)
  const [withOuter, setOuter] = useState(outer)
  const { chart: c } = useChartOf(src)
  if (!c) return <div className="wg"><CasePicker value={src} onChange={setSrc} /><div className="wg-cap">计算中……</div></div>
  const list: Body[] = withOuter ? BODIES.filter((b) => b !== 'node') : CLASSICAL
  const count = <K extends string>(keys: K[], f: (l: number) => K) => keys.map((k) => [k, list.filter((b) => f(c.pos[b].lon) === k)] as [K, Body[]])
  const els = count(['火', '土', '风', '水'], (l) => (['水', '火', '土', '风'] as const)[signIdx(l) % 4])
  const mods = count(['开创', '固定', '变动'], (l) => (['变动', '开创', '固定'] as const)[signIdx(l) % 3])
  const east = list.filter((b) => { const d = norm(c.pos[b].lon - c.mc); return d > 0 && d < 180 }), up = list.filter((b) => norm(c.pos[b].lon - c.asc) >= 180)
  const houses = new Map<number, Body[]>()
  list.forEach((b) => { const h = wholeHouse(c.pos[b].lon, c.asc); houses.set(h, [...(houses.get(h) ?? []), b]) })
  const empty = Array.from({ length: 12 }, (_, k) => k + 1).filter((h) => !houses.has(h))
  const cluster = [...houses.entries()].filter(([, v]) => v.length >= 3)
  const bar = (rows: [string, Body[]][], color: string) => rows.map(([k, v]) => (
    <div key={k} className="wg-row"><label>{k}</label><div style={{ flex: 1, height: 10, background: 'rgba(246,241,228,0.08)', borderRadius: 5 }}><motion.div initial={{ width: 0 }} animate={{ width: `${(v.length / list.length) * 100}%` }} style={{ height: 10, background: color, borderRadius: 5 }} /></div><span className="wg-v">{v.map((b) => BODY_SHORT[b]).join('')}</span></div>
  ))
  return (
    <div className="wg">
      <div className="wg-btns" style={{ marginTop: 0 }}><CasePicker value={src} onChange={setSrc} /><Btns items={[[false, '七颗古典行星'], [true, '加上外行星']]} value={withOuter} onChange={setOuter} /></div>
      {bar(els, '#c2a05a')}{bar(mods, '#7fb0d6')}
      <div className="wg-read"><span>东半球（天顶到上升一侧）{east.length} 颗、西半球 {list.length - east.length} 颗；地平线上 {up.length} 颗、下 {list.length - up.length} 颗。</span></div>
      <div className="wg-read"><span>{cluster.length ? `群星：${cluster.map(([h, v]) => `第 ${h} 宫有 ${v.map((b) => BODY_NAME[b]).join('、')}`).join('；')}。` : '没有三颗以上挤在同一宫的群星。'} 空宫：{empty.join('、') || '无'}（空宫看宫主星，例如第 {empty[0] ?? 7} 宫主是{PLANET[signRuler(((signIdx(c.asc) - 1 + (empty[0] ?? 7) - 1) % 12) + 1)].name}）。</span></div>
      <div className="wg-read" style={{ fontSize: 11.5 }}><span>{HOUSE_TOPICS.length} 宫主题见第 5 阶段。外行星每颗一代人都差不多，计入后"强调"会被同龄人共有的因素稀释。</span></div>
    </div>
  )
}
