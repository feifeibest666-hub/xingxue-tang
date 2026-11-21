import { useEffect, useState } from 'react'
import { Btns, Note, PlayBtn, Slider, useLoop, usePlaying, wheel } from './common'
import { PlanetAt } from '../PlanetGlyph'
import { GlyphAt } from '../Glyph'
import {
  aspects, birthUT, chartAt, chartFacts, meanNode, norm, sep, signIdx, signRuler, wholeHouse,
  type Chart,
} from '../../lib/natal'
import {
  ASPECTS, BENEFIC, HOUSE_TOPICS, JOY, MOTION, PLANET, SECT, TRIPLICITY, dignityOf,
  type Planet,
} from '../../data/classical'
import { element, fmtLon, polarity } from '../../data/zodiac'
import { loadAstro, sunLongitude } from '../../lib/astro'
import type { WidgetMap } from './common'

const P: Planet[] = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon']
const aboveHor = (lon: number, asc: number) => norm(lon - asc) >= 180

interface Ex { id: string; place: string; date: string; time: string; tz: number; lat: number; lon: number }
const EX: Ex[] = [
  { id: '甲', place: '北京', date: '1990-05-12', time: '08:30', tz: 8, lat: 39.9, lon: 116.4 },
  { id: '乙', place: '北京', date: '1990-05-12', time: '22:30', tz: 8, lat: 39.9, lon: 116.4 },
  { id: '丙', place: '上海', date: '1985-11-03', time: '14:10', tz: 8, lat: 31.2, lon: 121.5 },
  { id: '丁', place: '广州', date: '2001-01-20', time: '03:45', tz: 8, lat: 23.1, lon: 113.3 },
  { id: '戊', place: '成都', date: '1976-08-08', time: '18:20', tz: 8, lat: 30.7, lon: 104.1 },
  { id: '爱因斯坦', place: '乌尔姆', date: '1879-03-14', time: '11:30', tz: 10 / 15, lat: 48.4, lon: 10.0 },
]
const findEx = (id: string) => EX.find((x) => x.id === id) ?? EX[0]

function useEx(id: string) {
  const b = findEx(id)
  const [c, setC] = useState<Chart | null>(null)
  useEffect(() => {
    let ok = true
    setC(null)
    chartAt(birthUT(b), b.lat, b.lon).then((x) => { if (ok) setC(x) })
    return () => { ok = false }
  }, [b])
  return { b, c }
}

function mercSect(sun: number, mer: number): 'day' | 'night' {
  const d = norm(sun - mer)
  return d > 0 && d <= 180 ? 'day' : 'night'
}
function pSect(p: Planet, sun: number, mer: number): 'day' | 'night' {
  if (p === 'mercury') return mercSect(sun, mer)
  return SECT[p] === 'night' ? 'night' : 'day'
}
function hayzOf(p: Planet, c: Chart) {
  const lon = c.pos[p].lon
  const ps = pSect(p, c.pos.sun.lon, c.pos.mercury.lon)
  const inSect = (ps === 'day') === c.isDay
  const above = aboveHor(lon, c.asc)
  const hemi = ps === 'day' ? above : !above
  const masc = polarity(signIdx(lon)) === '阳'
  const gender = ps === 'day' ? masc : !masc
  const house = wholeHouse(lon, c.asc)
  return { inSect, hemi, gender, ok: inSect && hemi && gender, house, joy: JOY[p] === house, above, ps, lon }
}

const STARS: { name: string; lon: number; lat: number; royal?: boolean; nature: string }[] = [
  { name: '毕宿五', lon: 69.79, lat: -5.5, royal: true, nature: '托勒密：性质如火星' },
  { name: '轩辕十四', lon: 149.83, lat: 0.5, royal: true, nature: '托勒密：性质如火星与木星' },
  { name: '心宿二', lon: 249.76, lat: -4.6, royal: true, nature: '托勒密：性质如火星，略带木星' },
  { name: '北落师门', lon: 333.86, lat: -21.1, royal: true, nature: '托勒密：性质如金星与水星' },
  { name: '角宿一', lon: 203.84, lat: -2.1, nature: '托勒密：性质如金星与火星' },
  { name: '北河三', lon: 113.21, lat: 6.7, nature: '亮星' },
  { name: '娄宿三', lon: 37.66, lat: 10, nature: '亮星' },
  { name: '天狼', lon: 104.08, lat: -39.6, nature: '黄纬约 −40°，不宜当黄道合相' },
  { name: '大角', lon: 204.23, lat: 30.7, nature: '黄纬偏北' },
]
const starLon = (lon: number, year: number) => norm(lon + (year - 2000) * (50.3 / 3600))

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const span = norm(a1 - a0)
  const [x0, y0] = wheel(cx, cy, r, a0)
  const [x1, y1] = wheel(cx, cy, r, a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

/* ── 日夜分界 ── */
function HorizonWidget() {
  const [rel, setRel] = useState(270)
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setRel((v) => (v + dt * 28) % 360))
  const house = Math.floor(rel / 30) + 1
  const day = rel >= 180
  const [sx, sy] = wheel(170, 128, 78, rel)
  return (
    <div className="wg">
      <Note>等宫示意</Note>
      <svg className="wg-svg" viewBox="0 0 340 230">
        <path d={arcPath(170, 128, 78, 180, 360)} fill="rgba(194,160,90,0.16)" stroke="none" />
        <path d={arcPath(170, 128, 78, 0, 180)} fill="rgba(91,127,168,0.16)" stroke="none" />
        <circle cx={170} cy={128} r={78} fill="none" stroke="rgba(246,241,228,0.35)" />
        <line x1={92} y1={128} x2={248} y2={128} stroke="#f6f1e4" strokeDasharray="3 3" />
        <text x={170} y={118} textAnchor="middle" fill="#c2a05a" fontSize={11}>地平线以上 · 7–12 宫</text>
        <text x={170} y={150} textAnchor="middle" fill="#8eafd4" fontSize={11}>地平线以下 · 1–6 宫</text>
        {[0, 90, 180, 270].map((a) => {
          const [x, y] = wheel(170, 128, 90, a)
          const label = a === 0 ? '上升' : a === 90 ? '天底' : a === 180 ? '下降' : '天顶'
          return <text key={a} x={x} y={y} textAnchor="middle" fill="rgba(246,241,228,0.7)" fontSize={10}>{label}</text>
        })}
        <circle cx={sx} cy={sy} r={7} fill="#e2b34f" />
        <PlanetAt p="sun" x={sx} y={sy} size={16} color="#1a1408" width={8} />
      </svg>
      <Slider label="太阳" min={0} max={359} value={Math.round(rel)} onChange={setRel} fmt={(v) => `+${v}°`} />
      <div className="wg-btns"><PlayBtn playing={playing} set={setPlaying} /></div>
      <div className="wg-read">等宫第 <b>{house}</b> 宫 · <b>{day ? '日盘' : '夜盘'}</b></div>
      <div className="wg-cap">从上升度数起算。整宫只看星座，边界上会和这条线差几度。</div>
    </div>
  )
}

/* ── 冷热调和 ── */
function TemperWidget() {
  const [day, setDay] = useState(true)
  const sat = day ? '#c2a05a' : '#7f92ad'
  const mar = day ? '#ff5a2a' : '#8d4038'
  return (
    <div className="wg">
      <Note>性质示意，不是真实温度</Note>
      <svg className="wg-svg" viewBox="0 0 340 168">
        <rect x={16} y={16} width={148} height={120} rx={16} fill={day ? 'rgba(194,160,90,0.14)' : 'rgba(91,127,168,0.18)'} stroke="rgba(246,241,228,0.2)" />
        <rect x={176} y={16} width={148} height={120} rx={16} fill={day ? 'rgba(255,90,42,0.12)' : 'rgba(141,64,56,0.2)'} stroke="rgba(246,241,228,0.2)" />
        <PlanetAt p="saturn" x={90} y={68} size={42} color={sat} width={6} />
        <PlanetAt p="mars" x={250} y={68} size={42} color={mar} width={6} />
        <text x={90} y={118} textAnchor="middle" fill={sat} fontSize={12}>{day ? '土星被日光缓和' : '土星冷上加冷'}</text>
        <text x={250} y={118} textAnchor="middle" fill={mar} fontSize={12}>{day ? '火星热上加热' : '火星被夜色缓和'}</text>
      </svg>
      <Btns items={[[true, '日盘'], [false, '夜盘']]} value={day} onChange={setDay} />
      <div className="wg-cap">{day ? '区分外的凶星是火星。' : '区分外的凶星是土星。'} 颜色只表示传统的冷热，不表示行星表面温度。</div>
    </div>
  )
}

/* ── 水星晨昏 ── */
function MercuryWidget() {
  const [elong, setElong] = useState(-12)
  const morning = elong < 0
  const x = 170 + (elong / 28) * 90
  return (
    <div className="wg">
      <Note>最大距角约 28°</Note>
      <svg className="wg-svg" viewBox="0 0 340 150">
        <line x1={40} y1={78} x2={300} y2={78} stroke="rgba(246,241,228,0.35)" />
        <text x={70} y={28} fill="#8eafd4" fontSize={12}>西 · 先升起</text>
        <text x={250} y={28} fill="#c2a05a" fontSize={12}>东 · 后落下</text>
        <PlanetAt p="sun" x={170} y={78} size={28} color="#e2b34f" />
        <PlanetAt p="mercury" x={x} y={78} size={24} color="#9fbccb" />
      </svg>
      <Slider label="距角" min={-28} max={28} step={1} value={elong} onChange={setElong} fmt={(v) => `${v}°`} />
      <div className="wg-read">
        {morning ? <><b>晨星 · 东出</b> · 属昼</> : <><b>昏星 · 西入</b> · 属夜</>}
      </div>
      <div className="wg-cap">水星在太阳西侧（黄经更小）会先升起，属昼。距角为 0 时黄经相等，不算晨星，按昏星记。肉眼看不见。</div>
    </div>
  )
}

/* ── 三者一致 ── */
function HayzWidget() {
  const [id, setId] = useState('爱因斯坦')
  const [p, setP] = useState<Planet>('jupiter')
  const { c } = useEx(id)
  const h = c ? hayzOf(p, c) : null
  return (
    <div className="wg">
      <Note>三者都要中</Note>
      <Btns items={[['爱因斯坦', '爱因斯坦'], ['甲', '示例甲'], ['乙', '示例乙']]} value={id} onChange={setId} />
      <Btns items={P.map((q) => [q, PLANET[q].name.slice(0, 1)] as [Planet, string])} value={p} onChange={setP} />
      {!h || !c ? <div className="wg-cap">计算中…</div> : (
        <>
          <div className="wg-read">
            <span>本区分 <b>{h.inSect ? '是' : '否'}</b></span>
            <span>半球 <b>{h.hemi ? '是' : '否'}</b>（{h.above ? '地平线上' : '地平线下'}）</span>
            <span>阴阳 <b>{h.gender ? '是' : '否'}</b></span>
            <span>喜乐宫 <b>{h.joy ? '在' : '不在'}</b>（第 {JOY[p]} 宫）</span>
          </div>
          <div className="wg-cap">{h.ok ? '三者一致。' : '还没凑齐三件。'} 喜乐宫是第 5 阶段的另一件事，不算进这三件。这张盘是{c.isDay ? '日盘' : '夜盘'}。</div>
        </>
      )}
    </div>
  )
}

/* ── 五张盘 ── */
function DrillWidget() {
  const [id, setId] = useState('甲')
  const [open, setOpen] = useState(false)
  const { b, c } = useEx(id)
  const sunH = c ? wholeHouse(c.pos.sun.lon, c.asc) : 0
  return (
    <div className="wg">
      <Note>示例盘，坐标取整</Note>
      <Btns items={['甲', '乙', '丙', '丁', '戊'].map((k) => [k, k] as [string, string])} value={id} onChange={(v) => { setId(v); setOpen(false) }} />
      {!c ? <div className="wg-cap">计算中…</div> : (
        <>
          <div className="wg-read">
            <span>{b.place} {b.date} {b.time}</span>
            <span>太阳 <b>{fmtLon(c.pos.sun.lon)}</b> · 第 {sunH} 宫</span>
            <span>上升 <b>{fmtLon(c.asc)}</b></span>
          </div>
          <div className="wg-btns"><button className="wg-btn" onClick={() => setOpen((v) => !v)}>{open ? '收起判断' : '对一下'}</button></div>
          {open && (
            <div className="wg-cap">
              {c.isDay ? '日盘' : '夜盘'}。区分内吉星是{c.isDay ? '木星' : '金星'}，区分外凶星是{c.isDay ? '火星' : '土星'}。
              水星{mercSect(c.pos.sun.lon, c.pos.mercury.lon) === 'day' ? '晨星，属昼' : '昏星，属夜'}。
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── 福点 = 月相角平移 ── */
function FortuneWidget({ focus = 'fortune' }: { focus?: string }) {
  const [day, setDay] = useState(true)
  const [mode, setMode] = useState<'sect' | 'ptolemy'>(focus === 'ptolemy' ? 'ptolemy' : 'sect')
  const [asc, setAsc] = useState(100)
  const [sun, setSun] = useState(10)
  const [moon, setMoon] = useState(70)
  const reverse = mode === 'sect' && !day
  const span = reverse ? norm(sun - moon) : norm(moon - sun)
  const from = reverse ? moon : sun
  const fort = norm(asc + span)
  const spirit = norm(asc - span)
  const showSpirit = focus === 'spirit'
  const mark = showSpirit ? spirit : fort
  return (
    <div className="wg">
      <Note>{mode === 'ptolemy' ? '托勒密：不对调' : '瓦伦斯一派：夜盘对调'}</Note>
      <svg className="wg-svg" viewBox="0 0 340 210">
        <circle cx={170} cy={104} r={72} fill="none" stroke="rgba(246,241,228,0.28)" />
        <path d={arcPath(170, 104, 72, from, norm(from + span))} fill="none" stroke="#c2a05a" strokeWidth={3} />
        <path d={arcPath(170, 104, 58, asc, mark)} fill="none" stroke="#8eafd4" strokeWidth={3} />
        <PlanetAt p="sun" x={wheel(170, 104, 72, sun)[0]} y={wheel(170, 104, 72, sun)[1]} size={18} color="#e2b34f" />
        <PlanetAt p="moon" x={wheel(170, 104, 72, moon)[0]} y={wheel(170, 104, 72, moon)[1]} size={18} color="#dcd6c6" />
        {(() => { const [x, y] = wheel(170, 104, 58, asc); return <circle cx={x} cy={y} r={4} fill="#f6f1e4" /> })()}
        {(() => { const [x, y] = wheel(170, 104, 58, mark); return <circle cx={x} cy={y} r={5} fill={showSpirit ? '#8eafd4' : '#c2a05a'} /> })()}
      </svg>
      <Slider label="上升" min={0} max={359} value={asc} onChange={setAsc} fmt={(v) => fmtLon(v)} />
      <Slider label="太阳" min={0} max={359} value={sun} onChange={setSun} fmt={(v) => fmtLon(v)} />
      <Slider label="月亮" min={0} max={359} value={moon} onChange={setMoon} fmt={(v) => fmtLon(v)} />
      <Btns items={[[true, '日盘'], [false, '夜盘']]} value={day} onChange={setDay} />
      <Btns items={[['sect', '按区分对调'], ['ptolemy', '托勒密不对调']]} value={mode} onChange={setMode} />
      <div className="wg-read">
        <span>弧长 <b>{span.toFixed(1)}°</b></span>
        <span>福点 <b>{fmtLon(fort)}</b></span>
        <span>精神点 <b>{fmtLon(spirit)}</b></span>
      </div>
      <div className="wg-cap">金弧是发光体之间的夹角，蓝弧是同一段从上升点量出去。{showSpirit ? '现在看的是精神点。' : '现在看的是福点。'}</div>
    </div>
  )
}

function lotNumbers(day: boolean, asc: number, sun: number, moon: number, venus: number, mercury: number, mars: number, jupiter: number, saturn: number) {
  const fort = norm(day ? asc + moon - sun : asc + sun - moon)
  const spirit = norm(day ? asc + sun - moon : asc + moon - sun)
  return [
    ['福点', fort, '身体、际遇'],
    ['精神点', spirit, '心智、行动'],
    ['爱点', norm(day ? asc + venus - spirit : asc + spirit - venus), '欲求'],
    ['必然点', norm(day ? asc + fort - mercury : asc + mercury - fort), '不得不'],
    ['勇气点', norm(day ? asc + fort - mars : asc + mars - fort), '胆量'],
    ['胜利点', norm(day ? asc + jupiter - spirit : asc + spirit - jupiter), '争胜'],
    ['复仇点', norm(day ? asc + fort - saturn : asc + saturn - fort), '报应'],
  ] as const
}

/* ── 手算核对 ── */
function LotCalcWidget() {
  const [id, setId] = useState('甲')
  const [open, setOpen] = useState(false)
  const { b, c } = useEx(id)
  return (
    <div className="wg">
      <Note>与星盘引擎核对</Note>
      <Btns items={['甲', '乙', '丙', '丁', '戊'].map((k) => [k, k] as [string, string])} value={id} onChange={(v) => { setId(v); setOpen(false) }} />
      {!c ? <div className="wg-cap">计算中…</div> : (
        <>
          <div className="wg-read">
            <span>{b.place} {b.time} · {c.isDay ? '日盘' : '夜盘'}</span>
            <span>上升 <b>{c.asc.toFixed(2)}°</b></span>
            <span>日 <b>{c.pos.sun.lon.toFixed(2)}°</b></span>
            <span>月 <b>{c.pos.moon.lon.toFixed(2)}°</b></span>
          </div>
          <div className="wg-btns"><button className="wg-btn" onClick={() => setOpen((v) => !v)}>{open ? '先藏起来' : '展开算式'}</button></div>
          {open && (
            <div className="wg-cap">
              福点 = {c.fortune.toFixed(2)}°（{fmtLon(c.fortune)}）。精神点 = {c.spirit.toFixed(2)}°（{fmtLon(c.spirit)}）。
              引擎按{c.isDay ? '上升 + 月 − 日' : '上升 + 日 − 月'}，夜盘对调。
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── 赫尔墨斯七点 ── */
function HermeticWidget() {
  const [day, setDay] = useState(true)
  const [asc, setAsc] = useState(100)
  const [sun, setSun] = useState(40)
  const [moon, setMoon] = useState(160)
  const rows = lotNumbers(day, asc, sun, moon, 200, 55, 280, 230, 310)
  return (
    <div className="wg">
      <Note>保罗的日盘公式</Note>
      <Slider label="上升" min={0} max={359} value={asc} onChange={setAsc} fmt={(v) => `${v}°`} />
      <Slider label="太阳" min={0} max={359} value={sun} onChange={setSun} fmt={(v) => `${v}°`} />
      <Slider label="月亮" min={0} max={359} value={moon} onChange={setMoon} fmt={(v) => `${v}°`} />
      <Btns items={[[true, '日盘'], [false, '夜盘对调']]} value={day} onChange={setDay} />
      <table className="wg-table">
        <tbody>
          {rows.map(([name, lon, mean]) => (
            <tr key={name}><td>{name}</td><td>{fmtLon(lon)}</td><td>{mean}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="wg-cap">金星 200°、水星 55°、火星 280°、木星 230°、土星 310° 是这张示意盘的固定值。夜盘公式各家抄本不完全一样。</div>
    </div>
  )
}

function LotFloodWidget() {
  const [n, setN] = useState(7)
  return (
    <div className="wg">
      <Note>约定</Note>
      <Slider label="书里的点" min={7} max={120} value={n} onChange={setN} />
      <div className="wg-cap">{n <= 7 ? '赫尔墨斯七点，保罗列得清。' : n < 40 ? '中世纪常用表已经比七点多出一截。' : '上百个点以后，多数是后来为每个题目配的公式。'} 本课程正式用的仍是前面 7 个。</div>
    </div>
  )
}

/* ── 点的读法 ── */
function LotReadWidget() {
  const [id, setId] = useState('甲')
  const { c } = useEx(id)
  if (!c) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const lon = c.fortune
  const sign = signIdx(lon)
  const house = wholeHouse(lon, c.asc)
  const lord = signRuler(sign)
  const hits = (['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as Planet[]).flatMap((p) => {
    const d = sep(lon, c.pos[p].lon)
    const hit = ASPECTS.find((a) => Math.abs(d - a.deg) <= (p === 'sun' || p === 'moon' ? 8 : 6))
    return hit ? [`${PLANET[p].name}${hit.name}`] : []
  })
  return (
    <div className="wg">
      <Note>先读福点</Note>
      <Btns items={['甲', '戊', '爱因斯坦'].map((k) => [k, k] as [string, string])} value={id} onChange={setId} />
      <div className="wg-read">
        <span>福点 <b>{fmtLon(lon)}</b></span>
        <span>第 <b>{house}</b> 宫 · {HOUSE_TOPICS[house - 1]}</span>
        <span>主星 <b>{PLANET[lord].name}</b>（{fmtLon(c.pos[lord].lon)}，第 {wholeHouse(c.pos[lord].lon, c.asc)} 宫）</span>
      </div>
      <div className="wg-cap">落到这个度数上的相位：{hits.length ? hits.join('、') : '容许度内没有古典相位'}。空着的点自己不行动，传统上让主星代言。</div>
    </div>
  )
}

/* ── 从福点起宫 ── */
function FromFortuneWidget() {
  const [sign, setSign] = useState(1)
  const cells = Array.from({ length: 12 }, (_, i) => ((sign - 1 + i) % 12) + 1)
  return (
    <div className="wg">
      <Note>瓦伦斯的数法</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        <circle cx={170} cy={108} r={78} fill="none" stroke="rgba(246,241,228,0.25)" />
        {cells.map((s, i) => {
          const [x, y] = wheel(170, 108, 78, (4 - i) * 30)
          const on = i === 0 || i === 9 || i === 10
          return (
            <g key={s}>
              <circle cx={x} cy={y} r={on ? 13 : 10} fill={i === 10 ? 'rgba(194,160,90,0.85)' : i === 9 ? 'rgba(91,127,168,0.7)' : 'rgba(246,241,228,0.06)'} />
              <GlyphAt i={s} x={x} y={y} size={16} color={on ? '#1a1408' : '#c2a05a'} width={8} />
            </g>
          )
        })}
      </svg>
      <Slider label="福点星座" min={1} max={12} value={sign} onChange={setSign} fmt={(v) => ['', '白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'][v]} />
      <div className="wg-cap">金色是从福点数的第 11 宫，瓦伦斯叫它“获得”。蓝色是第 10 宫，用法不如第 11 宫固定。</div>
    </div>
  )
}

/* ── 岁差 ── */
function PrecessWidget() {
  const [year, setYear] = useState(2026)
  const royal = STARS.filter((s) => s.royal)
  return (
    <div className="wg">
      <Note>回归黄道</Note>
      <svg className="wg-svg" viewBox="0 0 340 220">
        <circle cx={170} cy={108} r={70} fill="none" stroke="rgba(246,241,228,0.3)" />
        {Array.from({ length: 12 }, (_, i) => {
          const [x, y] = wheel(170, 108, 86, i * 30 + 15)
          return <GlyphAt key={i} i={i + 1} x={x} y={y} size={14} color="rgba(194,160,90,0.8)" width={8} />
        })}
        {royal.map((s) => {
          const lon = starLon(s.lon, year)
          const [x, y] = wheel(170, 108, 70, lon)
          return <circle key={s.name} cx={x} cy={y} r={4} fill="#f6f1e4" />
        })}
      </svg>
      <Slider label="年份" min={-2000} max={2100} step={1} value={year} onChange={setYear} />
      <div className="wg-read">
        {royal.map((s) => <span key={s.name}>{s.name} <b>{fmtLon(starLon(s.lon, year))}</b></span>)}
      </div>
      <div className="wg-cap">每年约 50.3 角秒。50.3×72=3622 角秒，约 1°。轩辕十四在 2000 年是 149.83°，距处女 0°（150°）还有 612 角秒，612÷50.3≈12.2 年，约在 2012 年进入处女。不含自行。</div>
    </div>
  )
}

/* ── 恒星合相 ── */
function StarHitWidget() {
  const [id, setId] = useState('戊')
  const { b, c } = useEx(id)
  if (!c) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const year = Number(b.date.slice(0, 4)) + 0.5
  const pts: [string, number][] = [
    ['太阳', c.pos.sun.lon], ['月亮', c.pos.moon.lon], ['水星', c.pos.mercury.lon], ['金星', c.pos.venus.lon],
    ['火星', c.pos.mars.lon], ['木星', c.pos.jupiter.lon], ['土星', c.pos.saturn.lon], ['上升', c.asc], ['天顶', c.mc], ['福点', c.fortune],
  ]
  const hits = STARS.flatMap((s) => {
    const lon = starLon(s.lon, year)
    return pts.flatMap(([name, p]) => {
      const d = sep(p, lon)
      return d <= 1 ? [{ star: s, name, d, lon }] : []
    })
  })
  return (
    <div className="wg">
      <Note>容许度 1°</Note>
      <Btns items={['戊', '丁', '甲', '爱因斯坦'].map((k) => [k, k] as [string, string])} value={id} onChange={setId} />
      {hits.length === 0 && <div className="wg-cap">黄经 1° 以内没有表上的这些亮星。</div>}
      {hits.map((h) => (
        <div key={h.star.name + h.name} className="wg-read">
          <span><b>{h.star.name}</b> {fmtLon(h.lon)}</span>
          <span>合 {h.name} · 黄经差 {h.d.toFixed(2)}°</span>
          <span>黄纬 {h.star.lat.toFixed(1)}° {Math.abs(h.star.lat) > 8 ? '· 离黄道远' : '· 贴近黄道'}</span>
        </div>
      ))}
      <div className="wg-cap">{b.place} {b.date}。黄经按岁差从 2000 年位置推，不含自行。黄纬超过约 8° 的，不当成黄道上的合相。</div>
    </div>
  )
}

/* ── 月交点与食 ── */
function NodesWidget() {
  const [lam, setLam] = useState(18)
  const [phase, setPhase] = useState<'new' | 'full'>('new')
  const [playing, setPlaying] = usePlaying(false)
  useLoop(playing, (dt) => setLam((v) => (v + dt * 40) % 360))
  const lat = 5.1 * Math.sin(lam * Math.PI / 180)
  const eclipse = Math.abs(lat) < 1.2
  const x = 30 + (lam / 360) * 280
  const sunLam = phase === 'new' ? lam : norm(lam + 180)
  const sx = 30 + (sunLam / 360) * 280
  const nodeNow = meanNode(new Date())
  return (
    <div className="wg">
      <Note>倾角放大了看</Note>
      <svg className="wg-svg" viewBox="0 0 340 180">
        <line x1={30} y1={90} x2={310} y2={90} stroke="#c2a05a" />
        <path d={Array.from({ length: 73 }, (_, i) => {
          const L = i * 5
          const y = 90 - 5.1 * Math.sin(L * Math.PI / 180) * 8
          return `${i ? 'L' : 'M'} ${30 + (L / 360) * 280} ${y}`
        }).join(' ')} fill="none" stroke="#8eafd4" />
        <circle cx={30} cy={90} r={4} fill="#f6f1e4" />
        <circle cx={170} cy={90} r={4} fill="#f6f1e4" />
        <text x={30} y={112} textAnchor="middle" fill="#f6f1e4" fontSize={10}>北交</text>
        <text x={170} y={112} textAnchor="middle" fill="#f6f1e4" fontSize={10}>南交</text>
        <circle cx={sx} cy={78} r={7} fill="#e2b34f" />
        <circle cx={x} cy={90 - lat * 8} r={6} fill="#dcd6c6" />
      </svg>
      <Slider label="月亮黄经" min={0} max={359} value={Math.round(lam)} onChange={setLam} fmt={(v) => `${v}°`} />
      <div className="wg-btns">
        <Btns items={[['new', '新月'], ['full', '满月']]} value={phase} onChange={setPhase} />
        <PlayBtn playing={playing} set={setPlaying} />
      </div>
      <div className="wg-read">黄纬 <b>{lat.toFixed(1)}°</b> · {eclipse ? (phase === 'new' ? '靠近交点的新月 → 可以发生日食' : '靠近交点的满月 → 可以发生月食') : '离交点远，影子擦不到'}</div>
      <div className="wg-cap">此刻平均北交点约在 {fmtLon(nodeNow)}。约 18.6 年逆行一圈，每年大约退 19.3°。屏上“可以发生食”只是黄纬接近 0 的示意。真实食限是约数：日食大约离交点 15°–18°，月食大约 10°–12°，还要看月亮远近。</div>
    </div>
  )
}

function SarosWidget() {
  const [n, setN] = useState(1)
  return (
    <div className="wg">
      <Note>示意</Note>
      <Slider label="第几个沙罗" min={0} max={5} value={n} onChange={setN} />
      <div className="wg-read">
        <span>间隔 <b>{(n * 6585.3).toFixed(0)}</b> 天</span>
        <span>约 <b>{(n * 18).toFixed(0)}</b> 年 <b>{n * 11}</b> 天</span>
        <span>经度大约错开 <b>{(n * 120) % 360}°</b></span>
      </div>
      <div className="wg-cap">223 个会合月 ≈ 242 个交点月 ≈ 6585.3 天。多出来的约 8 小时，让下一次食在地球上偏开大约 120° 经度。</div>
    </div>
  )
}

/* ── 产前朔望 ── */
function SyzygyWidget() {
  const [id, setId] = useState('爱因斯坦')
  const { b, c } = useEx(id)
  const [row, setRow] = useState<{ kind: string; when: string; lon: string } | null>(null)
  useEffect(() => {
    let ok = true
    setRow(null)
    if (!c) return
    ;(async () => {
      const A = await loadAstro()
      const start = new Date(c.ut.getTime() - 32 * 86400000)
      const phase = norm(c.pos.moon.lon - c.pos.sun.lon)
      const target = phase < 180 ? 0 : 180
      const hit = A.SearchMoonPhase(target, start, 40)
      if (!hit || !ok) return
      const t = hit.date
      if (t.getTime() > c.ut.getTime()) return
      const sun = await sunLongitude(t)
      const local = new Date(t.getTime() + b.tz * 3600000)
      const when = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')} ${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`
      if (ok) setRow({ kind: target === 0 ? '产前新月' : '产前满月', when, lon: fmtLon(sun) })
    })()
    return () => { ok = false }
  }, [c, b.tz])
  return (
    <div className="wg">
      <Note>出生前最近的朔或望</Note>
      <Btns items={['爱因斯坦', '甲', '丁'].map((k) => [k, k] as [string, string])} value={id} onChange={setId} />
      {!c || !row ? <div className="wg-cap">计算中…</div> : (
        <div className="wg-read">
          <span>{c.isDay ? '日盘' : '夜盘'} · 月相角 {(norm(c.pos.moon.lon - c.pos.sun.lon)).toFixed(0)}°</span>
          <span><b>{row.kind}</b></span>
          <span>{row.when}（钟表时间）</span>
          <span>太阳在 <b>{row.lon}</b></span>
        </div>
      )}
      <div className="wg-cap">月相角小于 180° 用前面的新月，大于 180° 用前面的满月。满月取太阳的黄经，月亮在对冲。</div>
    </div>
  )
}

function EclipseWidget() {
  const [id, setId] = useState('爱因斯坦')
  const { b, c } = useEx(id)
  const [rows, setRows] = useState<{ t: string; kind: string; at: string }[]>([])
  useEffect(() => {
    let ok = true
    setRows([])
    if (!c) return
    ;(async () => {
      const A = await loadAstro()
      const start = new Date(c.ut.getTime() - 200 * 86400000)
      const end = c.ut.getTime() + 200 * 86400000
      const out: { ms: number; kind: string; when: Date }[] = []
      let s = A.SearchGlobalSolarEclipse(start)
      let l = A.SearchLunarEclipse(start)
      for (let i = 0; i < 8; i++) {
        if (s.peak.date.getTime() < end) out.push({ ms: s.peak.date.getTime(), kind: `日食·${s.kind}`, when: s.peak.date })
        if (l.peak.date.getTime() < end) out.push({ ms: l.peak.date.getTime(), kind: `月食·${l.kind}`, when: l.peak.date })
        s = A.NextGlobalSolarEclipse(s.peak)
        l = A.NextLunarEclipse(l.peak)
      }
      const shown = []
      for (const e of out.filter((e) => e.ms > start.getTime()).sort((p, q) => p.ms - q.ms)) {
        const lon = await sunLongitude(e.when)
        const local = new Date(e.when.getTime() + b.tz * 3600000)
        const stamp = `${local.getUTCMonth() + 1}月${local.getUTCDate()}日`
        const cn = e.kind
          .replace('penumbral', '半影').replace('partial', '偏食').replace('annular', '环食').replace('total', '全食')
        shown.push({ t: stamp, kind: cn, at: fmtLon(lon) })
      }
      if (ok) setRows(shown)
    })()
    return () => { ok = false }
  }, [c, b.tz])
  return (
    <div className="wg">
      <Note>前后约 200 天</Note>
      <Btns items={['爱因斯坦', '甲'].map((k) => [k, k] as [string, string])} value={id} onChange={setId} />
      {rows.length === 0 ? <div className="wg-cap">计算中…</div> : (
        <table className="wg-table">
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.t}</td><td>{r.kind}</td><td>{r.at}</td></tr>)}</tbody>
        </table>
      )}
      <div className="wg-cap">时间按出生地钟表。日食只在一条窄带里能看见全食或环食；占星传统常常仍使用食点的黄经。</div>
    </div>
  )
}

/* ── 状态清单 ── */
function StateWidget() {
  const [id, setId] = useState('爱因斯坦')
  const [p, setP] = useState<Planet>('mars')
  const { c } = useEx(id)
  if (!c) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const lon = c.pos[p].lon
  const sign = signIdx(lon)
  const house = wholeHouse(lon, c.asc)
  const dig = dignityOf(p, lon, c.isDay)
  const h = hayzOf(p, c)
  const sunSep = p === 'sun' ? null : sep(lon, c.pos.sun.lon)
  const beam = sunSep == null ? '—' : sunSep < 0.283 ? '在日心（17′ 内）' : sunSep < 8.5 ? '焦伤（< 8.5°）' : sunSep < 15 ? '在光束下（< 15°）' : '离开光束'
  const trip = TRIPLICITY[element(sign)][c.isDay ? 0 : 1]
  const speed = c.pos[p].speed
  const hits = aspects(c.pos).filter((a) => a.a === p || a.b === p).slice(0, 3)
  return (
    <div className="wg">
      <Note>一张行星的状态</Note>
      <Btns items={['爱因斯坦', '甲', '乙'].map((k) => [k, k] as [string, string])} value={id} onChange={setId} />
      <Btns items={P.map((q) => [q, PLANET[q].name.slice(0, 1)] as [Planet, string])} value={p} onChange={setP} />
      <div className="wg-read">
        <span>{fmtLon(lon)} · 第 {house} 宫 · {['角宫', '续宫', '果宫'][(house - 1) % 3]}</span>
        <span>必然尊贵 <b>{dig.length ? dig.map((d) => d.name).join('、') : '无庙旺三分界'}</b></span>
        <span>三分主（{c.isDay ? '日' : '夜'}）<b>{PLANET[trip].name}</b></span>
        <span>{h.ps === 'day' ? '昼行星' : '夜行星'} · {h.inSect ? '本区分' : '区分外'} · {BENEFIC[p]}</span>
        <span>速度 {speed.toFixed(2)}°/天（平均 {MOTION[p].daily}）· {speed < 0 ? '逆行' : '顺行'}</span>
        <span>光束 {beam}</span>
        <span>喜乐宫 {h.joy ? '在' : '不在'} · 三者一致 {h.ok ? '是' : '否'}</span>
        <span>相位 {hits.length ? hits.map((a) => `${PLANET[a.a === p ? a.b as Planet : a.a as Planet].name}${a.name}`).join('、') : '无'}</span>
      </div>
      <div className="wg-cap">宫位主题：{HOUSE_TOPICS[house - 1]}。焦伤和“在日心”是中世纪收紧的档，希腊化多只说太阳的光束约 15°。</div>
    </div>
  )
}

function scoreAt(p: Planet, lon: number, day: boolean, positive: boolean) {
  return dignityOf(p, lon, day).reduce((n, d) => n + (positive && d.score < 0 ? 0 : d.score), 0)
}

/* ── 三种主人 ── */
function RulerWidget() {
  const [id, setId] = useState('爱因斯坦')
  const { c } = useEx(id)
  if (!c) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const lord = signRuler(signIdx(c.asc))
  const light: Planet = c.isDay ? 'sun' : 'moon'
  const pts = [c.asc, c.pos.sun.lon, c.pos.moon.lon, c.fortune]
  const rows = (['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as Planet[]).map((p) => ({
    p,
    net: pts.reduce((n, lon) => n + scoreAt(p, lon, c.isDay, false), 0),
    pos: pts.reduce((n, lon) => n + scoreAt(p, lon, c.isDay, true), 0),
  })).sort((a, b) => b.net - a.net)
  return (
    <div className="wg">
      <Note>三种算法</Note>
      <Btns items={['爱因斯坦', '甲', '丁'].map((k) => [k, k] as [string, string])} value={id} onChange={setId} />
      <div className="wg-read">
        <span>命主星（上升庙主）<b>{PLANET[lord].name}</b></span>
        <span>区分发光体 <b>{PLANET[light].name}</b></span>
        <span>计分第一 <b>{PLANET[rows[0].p].name}</b>（净分 {rows[0].net}，只加正分 {rows[0].pos}）</span>
      </div>
      <div className="wg-cap">计分点是上升、太阳、月亮、福点。这是简化的中世纪算法，换一份点的清单，第一名可以换人。本课程 v1 采用上升庙主。</div>
    </div>
  )
}

function HylegWidget() {
  const { c } = useEx('爱因斯坦')
  return (
    <div className="wg">
      <Note>只认名字，不算年数</Note>
      {!c ? <div className="wg-cap">计算中…</div> : (
        <div className="wg-read">
          <span>区分发光体 <b>{c.isDay ? '太阳' : '月亮'}</b> · {fmtLon(c.isDay ? c.pos.sun.lon : c.pos.moon.lon)}</span>
          <span>上升 <b>{fmtLon(c.asc)}</b> · 庙主 {PLANET[signRuler(signIdx(c.asc))].name}</span>
        </div>
      )}
      <div className="wg-cap">古人会从这些候选里再挑“生命主”，用主限去估寿命。本课程停在这里：不计算、不对真人做生死判断。</div>
    </div>
  )
}

const FLOW = [
  ['区分', '日盘还是夜盘；区分内的吉星、区分外的凶星。'],
  ['上升与命主', '上升星座，以及它的庙主在哪、状态如何。'],
  ['发光体', '日盘看太阳，夜盘看月亮。'],
  ['行星状态', '七颗星各过一遍清单，先抓住最强的和最难调和的。'],
  ['点', '福点、精神点的星座、宫位和主星。'],
  ['主题宫', '问题落在哪一宫，就看那一宫和宫主。'],
]

function FlowWidget() {
  const [i, setI] = useState(0)
  return (
    <div className="wg">
      <Note>教学顺序，不是古书的编号</Note>
      <Btns items={FLOW.map((f, k) => [k, `${k + 1} ${f[0]}`] as [number, string])} value={i} onChange={setI} />
      <div className="wg-cap">{FLOW[i][1]} {i === 5 ? `宫位主题举例：第 10 宫是「${HOUSE_TOPICS[9]}」。` : ''}</div>
    </div>
  )
}

function CaseWidget() {
  const [id, setId] = useState('爱因斯坦')
  const { b, c } = useEx(id)
  if (!c) return <div className="wg"><div className="wg-cap">计算中…</div></div>
  const f = chartFacts(c)
  const hayz = (['jupiter', 'saturn', 'mars', 'sun', 'moon', 'venus', 'mercury'] as Planet[]).filter((p) => hayzOf(p, c).ok)
  return (
    <div className="wg">
      <Note>{b.place} {b.date} {b.time}</Note>
      <Btns items={['爱因斯坦', '甲'].map((k) => [k, k] as [string, string])} value={id} onChange={setId} />
      <div className="wg-read">
        <span><b>{f.sect}</b></span>
        <span>上升 {f.asc} · 命主 {PLANET[f.ascLord].name}</span>
        <span>福点 {f.fortune} · 精神点 {f.spirit}</span>
      </div>
      <table className="wg-table">
        <tbody>
          {f.rows.filter((r) => r.body !== 'uranus' && r.body !== 'neptune' && r.body !== 'pluto').map((r) => (
            <tr key={r.body}><td>{r.name}</td><td>{r.at}</td><td>第 {r.house} 宫</td><td>{r.dig.join('、') || '—'}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="wg-cap">三者一致：{hayz.length ? hayz.map((p) => PLANET[p].name).join('、') : '无'}。区分外的凶星是{c.isDay ? '火星' : '土星'}。</div>
    </div>
  )
}

const MILES: [number, string, string, '古' | '今'][] = [
  [-410, '巴比伦', '已有楔形文字的出生天宫图。', '古'],
  [-300, '托勒密王朝', '希腊语占星在埃及成形，吸收巴比伦的黄道。', '古'],
  [75, '多罗修斯', '《占星之歌》。希腊原文大部分佚失，靠阿拉伯译本留存。', '古'],
  [160, '瓦伦斯、托勒密', '《选集》与《四书》。同在 2 世纪，福点等人算法并不相同。', '古'],
  [360, '费尔米库斯、保罗', '拉丁文《数学八书》与保罗的《导论》。', '古'],
  [850, '阿拉伯', '阿布·马谢尔等人把希腊材料收进阿拉伯传统。', '古'],
  [1277, '博纳提', '拉丁传统里一本很厚的手册。', '古'],
  [1647, '李利', '《基督教占星》。英国实践派的常用手册。', '古'],
  [1993, 'Project Hindsight', '施密特、汉德等把希腊化文本译成现代英语。这是 20 世纪的翻译运动。', '今'],
  [2017, '布伦南', '《希腊化占星》把这套材料整理成现代课程。是复兴，不是古书。', '今'],
]

function HistoryWidget({ era = 'all' }: { era?: string }) {
  const rows = MILES.filter((m) => (era === 'early' ? m[0] < 500 : era === 'later' ? m[0] >= 1900 : true))
  const [i, setI] = useState(0)
  const safe = Math.min(i, rows.length - 1)
  const m = rows[safe]
  return (
    <div className="wg">
      <Note>{m[3] === '古' ? '古代' : '现代复兴'}</Note>
      <Btns items={rows.map((r, k) => [k, r[1]] as [number, string])} value={safe} onChange={setI} />
      <div className="wg-cap">{m[0] < 0 ? `公元前 ${-m[0]} 年前后` : `${m[0]} 年前后`} · {m[2]}</div>
    </div>
  )
}

export const W06: WidgetMap = {
  's6-horizon': () => <HorizonWidget />,
  's6-temper': () => <TemperWidget />,
  's6-mercury': () => <MercuryWidget />,
  's6-hayz': () => <HayzWidget />,
  's6-drill': () => <DrillWidget />,
  's6-fortune': (a) => <FortuneWidget focus={typeof a.focus === 'string' ? a.focus : 'fortune'} />,
  's6-lotcalc': () => <LotCalcWidget />,
  's6-hermetic': () => <HermeticWidget />,
  's6-lotflood': () => <LotFloodWidget />,
  's6-lotread': () => <LotReadWidget />,
  's6-from-fortune': () => <FromFortuneWidget />,
  's6-precess': () => <PrecessWidget />,
  's6-stars': () => <StarHitWidget />,
  's6-nodes': () => <NodesWidget />,
  's6-saros': () => <SarosWidget />,
  's6-syzygy': () => <SyzygyWidget />,
  's6-eclipse': () => <EclipseWidget />,
  's6-state': () => <StateWidget />,
  's6-ruler': () => <RulerWidget />,
  's6-hyleg': () => <HylegWidget />,
  's6-flow': () => <FlowWidget />,
  's6-case': () => <CaseWidget />,
  's6-history': (a) => <HistoryWidget era={typeof a.era === 'string' ? a.era : 'all'} />,
}
