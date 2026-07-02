import React from 'react'

interface Props {
  content: string
  className?: string
}

// Rendu markdown léger, sans dépendance externe — reflète le format utilisé
// pour les sections des articles OsteoUpgrade (mêmes règles que leur propre
// renderer : #, **gras**, *italique*, listes, citations).
export function MarkdownContent({ content, className = '' }: Props) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') { i++; continue }

    const h2 = line.match(/^## (.+)/)
    if (h2) { elements.push(<h4 key={i} className="text-base font-semibold mt-4 mb-1.5">{inlineRender(h2[1])}</h4>); i++; continue }
    const h3 = line.match(/^### (.+)/)
    if (h3) { elements.push(<h4 key={i} className="text-sm font-semibold mt-3 mb-1">{inlineRender(h3[1])}</h4>); i++; continue }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <blockquote key={i} className="border-l-4 border-primary/40 pl-4 py-1 my-3 bg-primary/5 rounded-r-lg italic text-muted-foreground">
          {quoteLines.map((l, j) => <p key={j}>{inlineRender(l)}</p>)}
        </blockquote>
      )
      continue
    }

    if (/^[-*+] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={i} className="my-3 space-y-1.5 list-none pl-0">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{inlineRender(it)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      elements.push(
        <ol key={i} className="my-3 space-y-1.5 list-none pl-0">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{j + 1}</span>
              <span>{inlineRender(it)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{2,3} /.test(lines[i]) &&
      !/^[-*+] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^> /.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }

    if (paraLines.length > 0) {
      elements.push(
        <p key={i} className="leading-relaxed my-2">
          {paraLines.map((l, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {inlineRender(l)}
            </React.Fragment>
          ))}
        </p>
      )
    }
  }

  return <div className={className}>{elements}</div>
}

function inlineRender(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)

    const candidates = [
      boldMatch && { match: boldMatch, tag: 'bold' },
      italicMatch && { match: italicMatch, tag: 'italic' },
    ].filter(Boolean) as Array<{ match: RegExpMatchArray; tag: string }>

    if (candidates.length === 0) {
      parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>)
      break
    }

    const earliest = candidates.reduce((a, b) =>
      (a.match.index ?? Infinity) < (b.match.index ?? Infinity) ? a : b
    )

    const { match, tag } = earliest
    const idx = match.index!

    if (idx > 0) {
      parts.push(<React.Fragment key={key++}>{remaining.slice(0, idx)}</React.Fragment>)
    }

    const inner = match[1]
    if (tag === 'bold') parts.push(<strong key={key++} className="font-semibold">{inner}</strong>)
    else if (tag === 'italic') parts.push(<em key={key++} className="italic">{inner}</em>)

    remaining = remaining.slice(idx + match[0].length)
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}
