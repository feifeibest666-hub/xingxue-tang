import { useRef, useState } from 'react'
import { exportBackup, importBackup, resetAll, setSettings, update, useStore } from '../lib/store'
import { PLACES } from '../components/widgets/tools'

export function SettingsPage() {
  const s = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000) }
  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `星学堂备份-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div>
      <div className="lesson-head" style={{ marginBottom: 12 }}>
        <a className="back" href="#/today" aria-label="返回">‹</a>
        <div className="lh-mid"><div className="lh-title">设置</div></div>
        <span style={{ width: 38 }} />
      </div>

      <div className="card">
        <label className="row" style={{ justifyContent: 'space-between' }}>
          <div><h3 style={{ margin: 0 }}>周易对照卡</h3><div className="muted small">课里偶尔出现的"和周易比一比"</div></div>
          <input type="checkbox" checked={s.settings.showYi} onChange={(e) => setSettings({ showYi: e.target.checked })} style={{ width: 22, height: 22, accentColor: 'var(--ink)' }} />
        </label>
      </div>
      <div className="card">
        <h3>黄道</h3>
        <div className="seg">
          <button className={s.settings.zodiac === 'tropical' ? 'on' : ''} onClick={() => setSettings({ zodiac: 'tropical' })}>回归黄道（西方常用）</button>
          <button className={s.settings.zodiac === 'sidereal' ? 'on' : ''} onClick={() => setSettings({ zodiac: 'sidereal' })}>恒星黄道</button>
        </div>
        <p className="muted small">只影响"今日天象"的显示。两者的区别在第 17–20 天讲。</p>
      </div>
      <div className="card">
        <h3>所在地</h3>
        <select value={s.settings.place} onChange={(e) => { const p = PLACES.find((x) => x.name === e.target.value)!; setSettings({ place: p.name, lat: p.lat, lon: p.lon }) }}>
          {PLACES.map((p) => <option key={p.name}>{p.name}</option>)}
        </select>
        <p className="muted small">用于天空模拟器和正午太阳高度的计算。</p>
      </div>
      <div className="card">
        <h3>开始日期</h3>
        <input type="date" value={s.startDate} onChange={(e) => e.target.value && update((st) => { st.startDate = e.target.value })} />
        <p className="muted small">"还没学的"按这一天起算。</p>
      </div>
      <div className="card">
        <h3>备份</h3>
        <p className="muted small">学习记录只存在这台设备的浏览器里。换手机或清缓存前，先导出一份。</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={download}>导出备份</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>导入备份</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            flash(importBackup(await f.text()) ? '已导入' : '文件格式不对')
            e.target.value = ''
          }} />
        </div>
      </div>
      <div className="card">
        <h3>其他</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <a className="btn" href="#/welcome">重看欢迎页</a>
          <button className="btn" style={{ color: 'var(--red)' }} onClick={() => { if (confirm('确定清空全部学习记录？此操作无法撤销。')) { resetAll(); flash('已清空') } }}>清空记录</button>
        </div>
      </div>
      <p className="muted small center" style={{ marginTop: 18 }}>星学堂 · 不联网、不收集数据 · 所有计算在本机完成</p>
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
