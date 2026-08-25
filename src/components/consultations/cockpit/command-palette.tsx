'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'

export interface Command {
  id: string
  label: string
  hint?: string
  shortcut?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: Command[]
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Tout ce qui n'est pas le geste courant vit ici. C'est ce qui permet à l'écran
 * de rester nu sans rien perdre : les outils ne sont pas supprimés, ils sont à
 * une frappe.
 */
export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean)
    if (terms.length === 0) return commands
    return commands.filter((command) => {
      const haystack = normalize(`${command.label} ${command.hint ?? ''}`)
      return terms.every((term) => haystack.includes(term))
    })
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
    }
  }, [open])

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(results.length - 1, 0)))
  }, [results.length])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((current) => (current + 1) % Math.max(results.length, 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((current) => (current - 1 + results.length) % Math.max(results.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const command = results[cursor]
      if (command) {
        onClose()
        command.run()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden top-[22%] translate-y-0">
        <DialogTitle className="sr-only">Palette de commandes</DialogTitle>
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border/50">
          <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Que voulez-vous faire ?"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground/60">
              Rien ne correspond.
            </p>
          )}
          {results.map((command, index) => (
            <button
              key={command.id}
              type="button"
              data-active={index === cursor}
              onMouseEnter={() => setCursor(index)}
              onClick={() => { onClose(); command.run() }}
              className={cn(
                'w-full text-left px-4 py-2 flex items-center gap-3 transition-colors',
                index === cursor ? 'bg-primary/[0.07]' : 'hover:bg-foreground/[0.03]',
              )}
            >
              <span className="text-[13px] flex-1">{command.label}</span>
              {command.hint && (
                <span className="text-[11px] text-muted-foreground/50">{command.hint}</span>
              )}
              {command.shortcut && (
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground/60">
                  {command.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
