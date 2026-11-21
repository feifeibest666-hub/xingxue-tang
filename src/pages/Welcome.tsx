import { motion } from 'motion/react'
import { finishOnboarding } from '../lib/store'
import { TAGS } from '../data/types'

const art = (n: string) => `${import.meta.env.BASE_URL}art/${n}.webp`

const PROMISES = [
  ['一', '每天一课，20 分钟', '700 天、17 个阶段。从"天为什么会转"讲起，一直到能独立看懂一张星盘。'],
  ['二', '每个结论都有来路', '先看天空里的事实，再一步步推出来；哪些是天文、哪些是古人定下的约定、哪些至今有争议，都贴着标签。'],
  ['三', '边玩边懂', '拖一拖、转一转天球和地球；做完小题点亮一颗星，连续学习的日子会连成星座。'],
]

export function WelcomePage() {
  const go = (to: string) => { finishOnboarding(); window.location.hash = to }
  return (
    <div className="welcome">
      <div className="wl-hero">
        <motion.img src={art('hero-welcome')} alt="星学堂：一个人站在夜空下看着黄道" initial={{ scale: 1.08, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.6, ease: [0.22, 0.7, 0.3, 1] }} />
        <motion.div className="wl-title" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.9 }}>
          <h1>星学堂</h1>
          <div className="wl-sub">从天空的几何，学懂西方占星</div>
          <div className="wl-en">XING · XUE · TANG</div>
        </motion.div>
        <motion.div className="wl-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.7 }}>
          <button className="btn primary xl" onClick={() => go('/lesson/1')}>从这里开始 · 第 1 天</button>
          <button className="wl-skip" onClick={() => go('/today')}>我已经学过一些，直接进入</button>
        </motion.div>
      </div>
      <div className="wl-body">
        <div className="eyebrow">怎么学</div>
        {PROMISES.map(([n, t, d], k) => (
          <motion.div className="promise" key={n} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: k * 0.1 }}>
            <span className="pn">{n}</span>
            <div><h3>{t}</h3><p>{d}</p></div>
          </motion.div>
        ))}
        <div className="eyebrow" style={{ marginTop: 22 }}>七种标签</div>
        <p className="muted">课程里每段话都带一个标签，一眼分清它是事实、推理，还是人定的规矩：</p>
        <div className="tag-legend">{TAGS.map((t) => <span key={t} className={`tag tag-${t}`}>{t}</span>)}</div>
        <p className="muted small" style={{ marginTop: 8 }}>天文 = 可观测的事实；推导 = 从事实推出来的；传统 = 古人的说法；约定 = 人为规定，换一种也行；争议 = 至今说法不一；类比 = 帮你理解的比方；小结 = 回顾。</p>
        <button className="btn primary block xl" style={{ marginTop: 24 }} onClick={() => go('/lesson/1')}>开始第 1 天：占星到底在做什么？</button>
      </div>
    </div>
  )
}
