import React from 'react'

// Minimal md→React for our own reports: h1-h4, code fences, pipe tables,
// bullets/numbers, bold, inline code, hr. No user HTML is ever rendered.
function inline(text: string, key: number): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`'))
      return <code key={`${key}-${i}`} className="px-1 bg-dark-800 text-neon-cyan text-[0.9em]">{p.slice(1, -1)}</code>
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={`${key}-${i}`} className="text-white">{p.slice(2, -2)}</strong>
    return <React.Fragment key={`${key}-${i}`}>{p}</React.Fragment>
  })
}

export function Markdown({ src }: { src: string }) {
  const lines = src.split('\n')
  const out: React.ReactNode[] = []
  let i = 0, k = 0

  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++])
      i++
      out.push(
        <pre key={k++} className="border border-dark-600 bg-black/70 p-3 my-3 text-[9px] sm:text-[10px] font-mono text-gray-300 overflow-x-auto leading-relaxed">
          {buf.join('\n')}
        </pre>
      )
      continue
    }
    if (l.startsWith('|') && lines[i + 1]?.match(/^\|[\s:-]+\|/)) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim())
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells)
        i++
      }
      out.push(
        <table key={k++} className="my-3 border border-dark-600 text-[9px] sm:text-[10px] font-mono w-full">
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className={ri === 0 ? 'bg-dark-800 text-neon-green' : 'text-gray-400 border-t border-dark-600'}>
                {r.map((c, ci) => <td key={ci} className="px-2 py-1.5">{inline(c, ci)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )
      continue
    }
    const h = l.match(/^(#{1,4})\s+(.*)/)
    if (h) {
      const lvl = h[1].length
      const cls = lvl === 1
        ? 'text-sm sm:text-lg font-arcade text-neon-green mt-5 mb-2'
        : lvl === 2
          ? 'text-xs sm:text-sm font-arcade text-neon-cyan mt-4 mb-2 border-b border-dark-600 pb-1'
          : 'text-[10px] sm:text-xs font-arcade text-white mt-3 mb-1.5'
      out.push(<div key={k++} className={cls}>{inline(h[2], k)}</div>)
      i++; continue
    }
    if (/^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)) {
      const items: { text: string; n: number | null }[] = []
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const m = lines[i].match(/^\s*(?:[-*]|(\d+)\.)\s+(.*)/)
        items.push({ text: m![2], n: m![1] ? parseInt(m![1]) : null })
        i++
      }
      out.push(
        <ul key={k++} className="my-2 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 text-[10px] sm:text-xs text-gray-400 leading-relaxed">
              <span className="text-neon-green shrink-0">{it.n ? `${it.n}.` : '▸'}</span>
              <span>{inline(it.text, ii)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }
    if (/^---+\s*$/.test(l)) { out.push(<hr key={k++} className="border-dark-600 my-4" />); i++; continue }
    if (l.trim() === '') { i++; continue }
    out.push(<p key={k++} className="my-2 text-[10px] sm:text-xs text-gray-400 leading-relaxed">{inline(l, k)}</p>)
    i++
  }
  return <div>{out}</div>
}
