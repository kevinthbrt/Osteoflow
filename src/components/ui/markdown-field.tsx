'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  className?: string
  id?: string
}

function renderMarkdown(text: string) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />
    // Replace **text** with bold
    const parts = line.split(/\*\*(.+?)\*\*/g)
    const rendered = parts.map((part, j) =>
      j % 2 === 1
        ? <strong key={j} className="font-semibold text-foreground">{part}</strong>
        : <span key={j}>{part}</span>
    )
    return <p key={i} className="leading-relaxed">{rendered}</p>
  })
}

export function MarkdownField({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 4,
  className,
  id,
}: MarkdownFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
      autoResize(textareaRef.current)
    }
  }, [isEditing])

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const hasContent = value.trim().length > 0

  if (isEditing || !hasContent) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          data-autoresize
          value={value}
          onChange={(e) => { onChange(e.target.value); autoResize(e.target) }}
          onInput={(e) => autoResize(e.currentTarget)}
          onBlur={() => { if (hasContent) setIsEditing(false) }}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          className={cn(
            'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-none overflow-hidden transition-[height] duration-200',
            className
          )}
        />
        {hasContent && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 px-1.5 text-xs text-muted-foreground"
            onClick={() => setIsEditing(false)}
          >
            <Eye className="h-3 w-3 mr-1" />
            Aperçu
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="relative group">
      <div
        className={cn(
          'min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground cursor-text',
          className
        )}
        onClick={() => !disabled && setIsEditing(true)}
      >
        {renderMarkdown(value)}
      </div>
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 px-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3 w-3 mr-1" />
          Modifier
        </Button>
      )}
    </div>
  )
}
