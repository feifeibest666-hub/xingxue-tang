import { motion } from 'motion/react'
import { AXES, ELEMENT_COLOR, ELEMENT_QUAL, SIGNS, TERMS, element, modality, polarity } from '../data/zodiac'
import { useLessons } from '../data/curriculum'
import { Widget } from '../components/widgets'
import { Glyph } from '../components/Glyph'
import { Starfield } from '../components/Starfield'

const TABS: [string, string][] = [['sim', '天空模拟器'], ['atlas', '星典'], ['tools', '小工具'], ['soon', '即将上线']]
const TOOLS: [string, string, string, Record<string, unknown>?][] = [
  ['sunDate', '生日太阳在哪个星座', '输入日期，用真实星历算出太阳黄经', { mode: 'attrs' }],
  ['seasons', '今年的二分二至', '春分、夏至、秋分、冬至的准确时刻'],
  ['ring', '黄道环与节气', '十二宫和二十四节气是同一把尺子', { terms: true }],
  ['signsVsConst', '星座 ≠ 星宿', '十二宫和真实星座的错位'],
  ['precession', '岁差', '春分点 2.6 万年转一圈'],
  ['web', '十二宫关系网', '任意两宫隔几个，就有什么关系'],
  ['myBirth', '我的出生资料', '填一次，星盘、行运、小限等工具都会用它'],
  ['chart', '本命盘', '案例库或自己的盘；切换宫位制、按主题高亮'],
]
const SOON = [['星盘绘制', '第 3 阶段起'], ['宫位计算', '第 4 阶段'], ['相位查找', '第 5 阶段'], ['行运与推运', '第 10 阶段起'], ['合盘对照', '第 13 阶段']]

export function SkyPage({ tab = 'sim', sign }: { tab?: string; sign?: number }) {
  if (tab === 'atlas' && sign) return <SignDetail i={sign} />
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow">星图工作台</div><h1>{tab === 'atlas' ? '十二星座星典' : tab === 'tools' ? '小工具' : tab === 'soon' ? '后面会有的' : '此刻的天空'}</h1></div></div>
      <div className="tool-tabs">
        {TABS.map(([k, l]) => <a key={k} href={`#/sky/${k}`} className={`chip ${tab === k ? 'on' : ''}`} style={{ padding: '6px 14px', fontSize: 13 }}>{l}</a>)}
      </div>
      {tab === 'sim' && (
        <>
          <p className="muted">以你所在地的头顶为中心，整片天空摊成一个圆：中间那圈是地平线，外面一圈是地平线下看不到的部分。拖动时间，看黄道和行星怎么转。</p>
          <Widget name="sim" />
        </>
      )}
      {tab === 'atlas' && (
        <>
          <p className="muted">点任意一个星座，看它的季节、极性、元素、模式，以及这些属性是怎么推出来的。</p>
          <div className="atlas-grid">
            {SIGNS.map((s, k) => (
              <motion.a key={s.i} href={`#/sky/atlas/${s.i}`} className="atlas-cell" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.03 }} whileTap={{ scale: 0.96 }}>
                <div style={{ display: 'grid', placeItems: 'center' }}><Glyph i={s.i} size={38} color={ELEMENT_COLOR[element(s.i)]} width={7} /></div>
                <div className="ac-n">{s.name}</div>
                <div className="ac-m">{element(s.i)}象 · {modality(s.i)} · {(s.i - 1) * 30}°起</div>
              </motion.a>
            ))}
          </div>
        </>
      )}
      {tab === 'tools' && TOOLS.map(([w, t, d, args]) => (
        <details key={w} className="card" style={{ marginTop: 10 }}>
          <summary style={{ listStyle: 'none', cursor: 'pointer' }}><h3 style={{ margin: 0 }}>{t}</h3><div className="muted small">{d}</div></summary>
          <Widget name={w} args={args} />
        </details>
      ))}
      {tab === 'soon' && (
        <div className="card">
          {SOON.map(([t, w]) => <div key={t} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}><span className="grow serif">{t}</span><span className="chip">{w}</span></div>)}
          <p className="muted small" style={{ marginTop: 10 }}>这些工具会随课程进度一起上线：学到哪里，工具就开到哪里。</p>
        </div>
      )}
    </div>
  )
}

function SignDetail({ i }: { i: number }) {
  const { lessons, ready } = useLessons()
  const s = SIGNS[i - 1]
  const el = element(i), mo = modality(i), po = polarity(i)
  const axis = AXES.find(([a, b]) => a === i || b === i)!
  const opp = axis[0] === i ? axis[1] : axis[0]
  const termIdx = (i - 1) * 2
  const related = (ready ? lessons : []).filter((l) => l.title.includes(s.name)).slice(0, 4)
  return (
    <div>
      <div className="lesson-head" style={{ marginBottom: 12 }}>
        <a className="back" href="#/sky/atlas" aria-label="返回">‹</a>
        <div className="lh-mid"><div className="lh-day">星典 · 第 {i} 宫</div><div className="lh-title">{s.name}座 {s.en}</div></div>
        <span style={{ width: 38 }} />
      </div>
      <div className="sign-detail" style={{ position: 'relative', overflow: 'hidden' }}>
        <Starfield />
        <div style={{ position: 'relative' }}>
          <div className="row" style={{ alignItems: 'center', gap: 16 }}>
            <Glyph key={i} i={i} size={84} color="#c2a05a" draw width={6} />
            <div>
              <h2>{s.name}座</h2>
              <div className="small" style={{ color: 'rgba(246,241,228,.7)' }}>黄经 {(i - 1) * 30}°–{i * 30}° · {s.season}</div>
              <div className="small" style={{ color: 'rgba(246,241,228,.55)' }}>符号来自：{s.image}</div>
            </div>
          </div>
          <div className="attr-row">
            <div className="attr"><small>极性</small><b>{po}</b></div>
            <div className="attr"><small>元素</small><b style={{ color: ELEMENT_COLOR[el] }}>{el}</b></div>
            <div className="attr"><small>模式</small><b>{mo}</b></div>
          </div>
          <div className="chips">{s.keywords.map((k) => <span key={k} className="chip" style={{ background: 'rgba(246,241,228,.08)', color: 'var(--star)', borderColor: 'rgba(246,241,228,.2)' }}>{k}</span>)}</div>
        </div>
      </div>
      <h3 className="section-title">这些属性怎么来的</h3>
      <div className="card rich">
        <p><span className="tag tag-推导">推导</span> 第 {i} 个星座：{i} 是{i % 2 ? '奇' : '偶'}数 → <b>{po}</b>；{i} 除以 4 余 {i % 4} → <b>{el}象</b>（{ELEMENT_QUAL[el]}）；{i} 除以 3 余 {i % 3} → <b>{mo}</b>。</p>
        <p><span className="tag tag-天文">天文</span> 太阳每年在<b>{TERMS[termIdx]}</b>前后进入{s.name}座 0°，{TERMS[termIdx + 1]}时走到 15°。</p>
        <p><span className="tag tag-推导">推导</span> 正对面（隔 6 个）是<b>{SIGNS[opp - 1].name}座</b>，两者组成「{axis[2]} — {axis[3]}」这根轴。</p>
        <p><span className="tag tag-约定">约定</span> 关键词是古典传统和现代占星的归纳，不是天文事实；不同流派会有出入。</p>
      </div>
      {related.length > 0 && (
        <>
          <h3 className="section-title">相关课程</h3>
          <div className="card mini-list">{related.map((l) => <a key={l.day} href={`#/lesson/${l.day}`}><span className="md">第{l.day}天</span><span className="grow serif">{l.title}</span><span className="ll-arrow">›</span></a>)}</div>
        </>
      )}
      <div className="nav-btns">
        <a className="btn" href={`#/sky/atlas/${i === 1 ? 12 : i - 1}`}>‹ {SIGNS[(i + 10) % 12].name}</a>
        <a className="btn" href={`#/sky/atlas/${i === 12 ? 1 : i + 1}`}>{SIGNS[i % 12].name} ›</a>
      </div>
    </div>
  )
}
