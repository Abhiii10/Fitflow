import type { ReactNode } from 'react'

export function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-cyber-green">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <span key={i} className="text-cyber-cyan">{part.slice(1, -1)}</span>
    return part
  })
}

export function renderMarkdown(text: string): ReactNode {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  lines.forEach((line, i) => {
    if (line.startsWith('## '))
      nodes.push(<div key={i} className="font-mono font-bold text-cyber-green text-xs uppercase tracking-wider mt-3 mb-1">{line.slice(3)}</div>)
    else if (line.startsWith('# '))
      nodes.push(<div key={i} className="font-semibold text-cyber-text mt-2 mb-1">{line.slice(2)}</div>)
    else if (line.startsWith('- ') || line.startsWith('• '))
      nodes.push(<div key={i} className="flex gap-2 my-0.5"><span className="text-cyber-cyan flex-shrink-0">•</span><span>{renderInline(line.slice(2))}</span></div>)
    else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/)
      if (match) nodes.push(<div key={i} className="flex gap-2 my-0.5"><span className="text-cyber-cyan font-mono text-xs flex-shrink-0 w-4">{match[1]}.</span><span>{renderInline(match[2])}</span></div>)
    } else if (line === '')
      nodes.push(<div key={i} className="h-1.5" />)
    else
      nodes.push(<div key={i}>{renderInline(line)}</div>)
  })
  return <>{nodes}</>
}
