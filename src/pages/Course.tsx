import { useState } from 'react'
import { scheduleInfo, useStore } from '../lib/store'
import { OUTLINE, STAGES, isBuilt } from '../data/curriculum'
import { KIND_LABEL } from '../data/types'
import { LearningMap, PatternSvg, stageProgress } from '../components/LearningMap'

export function CoursePage() {
  const s = useStore()
  const next = scheduleInfo(s).next ?? 700
  const [view, setView] = useState<'map' | 'list'>('map')
  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">学程</div><h1>700 天 · 17 个阶段</h1></div>
        <div className="seg">
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>星路</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>列表</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>每个阶段是一幅小星座，学完一课亮一点。所有课都能直接点开，没有锁。</p>
      {view === 'map' ? <LearningMap s={s} current={next} /> : (
        <div className="stage-cards">
          {STAGES.map((st) => {
            const { done, total } = stageProgress(s, st.n)
            return (
              <a key={st.n} href={`#/stage/${st.n}`} className="stage-card">
                <span className="sc-n"><PatternSvg n={st.n} lit={done ? Math.max(1, Math.round((done / total) * 7)) : 0} size={40} /></span>
                <div className="grow">
                  <h3>{st.n}. {st.name}</h3>
                  <div className="sc-meta">{st.sub} · 第 {st.from}–{st.to} 天 · {done}/{total}{st.n === 1 ? '' : ' · 制作中'}</div>
                  <div className="sc-bar"><i style={{ width: `${(done / total) * 100}%` }} /></div>
                </div>
                <span className="ll-arrow">›</span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function StagePage({ n }: { n: number }) {
  const s = useStore()
  const st = STAGES[n - 1] ?? STAGES[0]
  const next = scheduleInfo(s).next
  const { done, total } = stageProgress(s, st.n)
  const lessons = OUTLINE.filter((l) => l.stage === st.n)
  const weeks: (typeof lessons)[] = []
  lessons.forEach((l, k) => { (weeks[Math.floor(k / 7)] ??= []).push(l) })
  return (
    <div>
      <div className="lesson-head" style={{ marginBottom: 12 }}>
        <a className="back" href="#/course" aria-label="返回">‹</a>
        <div className="lh-mid"><div className="lh-day">第 {st.n} / 17 阶段</div><div className="lh-title">{st.name}</div></div>
        <span style={{ width: 38 }} />
      </div>
      <div className="stage-hero">
        <PatternSvg n={st.n} lit={done ? Math.max(1, Math.round((done / total) * 7)) : 0} className="sh-pattern" />
        <div className="sh-meta">第 {st.from}–{st.to} 天 · {total} 课 · 已学 {done}</div>
        <h1>{st.name}</h1>
        <div className="sh-sub">{st.sub}</div>
        <p>{st.goal}</p>
      </div>
      {st.canExplain.length > 0 && (
        <>
          <h3 className="section-title">学完能讲清 <small>阶段末尾要讲给"我"听</small></h3>
          <ul className="can-explain">{st.canExplain.map((c, k) => <li key={k}>{c}</li>)}</ul>
        </>
      )}
      {weeks.map((w, k) => (
        <div key={k}>
          <div className="week-title">第 {k + 1} 周</div>
          <div className="lesson-list">
            {w.map((l) => (
              <a key={l.day} href={`#/lesson/${l.day}`} className={`ll ${s.completed[l.day] ? 'done' : ''} ${next === l.day ? 'today' : ''}`}>
                <span className="ll-day">{l.day}</span>
                <div className="ll-main">
                  <div className="ll-title">{l.title}</div>
                  <div className="ll-sub">
                    <span className={`ll-kind k-${l.kind}`}>{KIND_LABEL[l.kind]}</span>
                    {s.completed[l.day] ? <span>已学 ✦</span> : next === l.day ? <span className="gold">今天这课</span> : !isBuilt(l.day) ? <span>即将上线</span> : null}
                  </div>
                </div>
                <span className="ll-arrow">›</span>
              </a>
            ))}
          </div>
        </div>
      ))}
      <div className="nav-btns">
        {st.n > 1 ? <a className="btn" href={`#/stage/${st.n - 1}`}>‹ 上一阶段</a> : <span />}
        {st.n < 17 ? <a className="btn" href={`#/stage/${st.n + 1}`}>下一阶段 ›</a> : <span />}
      </div>
    </div>
  )
}
