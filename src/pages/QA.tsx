import { useMemo, useState } from 'react'
import { QA_ALL, lessonByDay } from '../data/curriculum'
import { TAGS, type Tag } from '../data/types'
import { addMyQ, removeMyQ, toggleMyQ, useStore } from '../lib/store'
import { inline } from '../components/Rich'

export function QAPage() {
  const s = useStore()
  const [tab, setTab] = useState<'lib' | 'mine'>('lib')
  const [kw, setKw] = useState('')
  const [tag, setTag] = useState<Tag | null>(null)
  const [limit, setLimit] = useState(30)
  const [text, setText] = useState('')
  const [day, setDay] = useState('')
  const [toast, setToast] = useState('')
  const list = useMemo(() => {
    const k = kw.trim()
    return QA_ALL.filter((q) => (!tag || q.tag === tag) && (!k || q.q.includes(k) || q.a.includes(k) || q.lessonTitle.includes(k)))
  }, [kw, tag])
  const copy = (t: string, d?: number) => {
    const l = d ? lessonByDay(d) : undefined
    const ctx = l ? `\n\n背景：我在学「星学堂」第 ${l.day} 天「${l.title}」。本课问题：${l.question}` : ''
    navigator.clipboard?.writeText(`${t}${ctx}\n请用初学者能懂的话解释，并说明哪些是天文事实、哪些是传统约定。`).then(() => { setToast('已复制，可以粘贴给老师或 AI'); setTimeout(() => setToast(''), 1800) })
  }
  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow">问答</div><h1>{tab === 'lib' ? '问答库' : '我的疑问本'}</h1></div>
        <div className="seg">
          <button className={tab === 'lib' ? 'on' : ''} onClick={() => setTab('lib')}>问答库</button>
          <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>疑问本</button>
        </div>
      </div>
      {tab === 'lib' ? (
        <>
          <div className="search">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input value={kw} onChange={(e) => { setKw(e.target.value); setLimit(30) }} placeholder={`搜 ${QA_ALL.length} 条问答，比如"岁差""水瓶"`} />
          </div>
          <div className="chips" style={{ marginBottom: 6 }}>
            <button className={`chip ${!tag ? 'on' : ''}`} onClick={() => setTag(null)}>全部</button>
            {TAGS.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>{t}</button>)}
          </div>
          <p className="muted small">找到 {list.length} 条</p>
          {list.slice(0, limit).map((q) => (
            <div key={q.id} className="qa-item">
              <h3>{q.q}</h3>
              <p>{inline(q.a)}</p>
              <div className="qa-meta">{q.tag && <span className={`tag tag-${q.tag}`} style={{ height: 19, fontSize: 11 }}>{q.tag}</span>}<a href={`#/lesson/${q.day}`}>第 {q.day} 天 · {q.lessonTitle}</a></div>
            </div>
          ))}
          {list.length > limit && <button className="btn block" onClick={() => setLimit(limit + 30)}>再看 30 条</button>}
          {list.length === 0 && <div className="empty">没找到。可以把问题记进「疑问本」。</div>}
        </>
      ) : (
        <>
          <div className="card">
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="学的时候冒出来的问题，先记下来……" style={{ minHeight: 80 }} />
            <div className="row" style={{ marginTop: 8 }}>
              <input value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="哪一天的课（可不填）" style={{ flex: 1 }} />
              <button className="btn primary" disabled={!text.trim()} onClick={() => { addMyQ(text.trim(), day ? Number(day) : undefined); setText(''); setDay('') }}>记下</button>
            </div>
          </div>
          {s.myQs.length === 0 ? <div className="empty">疑问本还是空的。</div> : s.myQs.map((q) => (
            <div key={q.id} className={`myq ${q.solved ? 'solved' : ''}`}>
              <button className="btn sm" onClick={() => toggleMyQ(q.id)}>{q.solved ? '已解决' : '未解决'}</button>
              <div className="grow">
                <div className="myq-t">{q.text}</div>
                <div className="small muted">{q.created}{q.day ? ` · 第 ${q.day} 天` : ''}</div>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  <button className="btn sm ghost" onClick={() => copy(q.text, q.day)}>带上下文复制</button>
                  <button className="btn sm ghost" onClick={() => removeMyQ(q.id)}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
