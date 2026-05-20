import { cn } from '@/lib/utils'

interface MarkdownTextProps {
  text: string
  className?: string
}

export function MarkdownText({ text, className }: MarkdownTextProps) {
  if (!text) return null
  return (
    <div className={cn('text-sm whitespace-pre-wrap leading-relaxed', className)}>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        const parts = line.split(/\*\*(.+?)\*\*/g)
        return (
          <p key={i} className="leading-relaxed">
            {parts.map((part, j) =>
              j % 2 === 1
                ? <strong key={j} className="font-semibold">{part}</strong>
                : <span key={j}>{part}</span>
            )}
          </p>
        )
      })}
    </div>
  )
}
