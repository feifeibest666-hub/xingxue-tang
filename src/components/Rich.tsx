import { Fragment, type ReactNode } from 'react'

/** **加粗**；空行分段；"- " 开头为列表；"» " 开头为算式块 */
export function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))
}

export function Rich({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/)
  return (
    <div className="rich">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => l.startsWith('- '))) return <ul key={i}>{lines.map((l, k) => <li key={k}>{inline(l.slice(2))}</li>)}</ul>
        if (lines[0].startsWith('» ')) return <div key={i} className="calc">{lines.map((l) => l.replace(/^» /, '')).join('\n')}</div>
        return <p key={i}>{lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l)}</Fragment>)}</p>
      })}
    </div>
  )
}
