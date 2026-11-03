'use client'

import { useEffect, useState } from 'react'
import { Check, CloudOff, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Barre « mode séance » de la consultation : sommaire des sections avec leur
 * état, indicateur de sauvegarde du brouillon, raccourcis clavier et mode
 * plein écran (menu et en-tête masqués pendant la saisie).
 */
export interface SessionSection {
  id: string
  label: string
  done: boolean
}

export type DraftStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; at: number }
  | { state: 'error' }

const FOCUS_MODE_ATTR = 'data-focus-mode'

function elapsedLabel(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 5) return 'à l’instant'
  if (seconds < 60) return `il y a ${seconds} s`
  const minutes = Math.floor(seconds / 60)
  return `il y a ${minutes} min`
}

export function SessionBar({
  sections,
  draftStatus,
  onSave,
  onFinish,
}: {
  sections: SessionSection[]
  /** Absent en modification : la consultation existe déjà, pas de brouillon */
  draftStatus?: DraftStatus
  onSave: () => void
  onFinish: () => void
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id)
  const [focusMode, setFocusMode] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Horloge pour « il y a 12 s »
  useEffect(() => {
    if (draftStatus?.state !== 'saved') return
    const timer = setInterval(() => setNow(Date.now()), 5000)
    setNow(Date.now())
    return () => clearInterval(timer)
  }, [draftStatus])

  // Section visible à l'écran
  const sectionIds = sections.map((s) => s.id).join(',')
  useEffect(() => {
    const elements = sectionIds
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (elements.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-120px 0px -55% 0px' }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sectionIds])

  // Mode plein écran : un attribut sur <html>, le CSS global masque le reste
  useEffect(() => {
    const root = document.documentElement
    if (focusMode) root.setAttribute(FOCUS_MODE_ATTR, '')
    else root.removeAttribute(FOCUS_MODE_ATTR)
    return () => root.removeAttribute(FOCUS_MODE_ATTR)
  }, [focusMode])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  // Raccourcis : Ctrl S, Ctrl Entrée, Alt ↑ / Alt ↓
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Une fenêtre (finalisation, tests…) est ouverte : on la laisse gérer.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        onSave()
      } else if (mod && event.key === 'Enter') {
        event.preventDefault()
        onFinish()
      } else if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault()
        const index = sections.findIndex((s) => s.id === activeId)
        const nextIndex = event.key === 'ArrowDown'
          ? Math.min(index + 1, sections.length - 1)
          : Math.max(index - 1, 0)
        const target = sections[nextIndex]
        if (target) {
          scrollTo(target.id)
          const field = document.getElementById(target.id)?.querySelector<HTMLElement>('textarea, input, [contenteditable="true"]')
          field?.focus({ preventScroll: true })
        }
      } else if (event.key === 'Escape' && focusMode) {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sections, activeId, onSave, onFinish, focusMode])

  const doneCount = sections.filter((s) => s.done).length

  return (
    <div className="sticky top-16 z-20 -mx-1 px-1 pb-2 pt-1 bg-background [html[data-focus-mode]_&]:top-0">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
        <nav aria-label="Sections de la consultation" className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="px-2 text-xs font-semibold text-muted-foreground tabular-nums">
            {doneCount} / {sections.length}
          </span>
          {sections.map((section, index) => {
            const active = section.id === activeId
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollTo(section.id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors',
                  active ? 'bg-accent font-semibold text-accent-foreground' : 'font-medium text-foreground/80 hover:bg-muted'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    section.done
                      ? 'bg-success-soft text-success'
                      : active
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-input text-muted-foreground'
                  )}
                >
                  {section.done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                </span>
                {section.label}
                <span className="sr-only">{section.done ? '(rempli)' : '(à remplir)'}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {draftStatus && draftStatus.state !== 'idle' && (
            <span
              role="status"
              title="Le brouillon est enregistré automatiquement pendant la saisie"
              className={cn(
                'flex items-center gap-1.5 px-1 text-[13px]',
                draftStatus.state === 'error' ? 'text-destructive' : draftStatus.state === 'saved' ? 'text-success' : 'text-muted-foreground'
              )}
            >
              {draftStatus.state === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {draftStatus.state === 'saved' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              {draftStatus.state === 'error' && <CloudOff className="h-3.5 w-3.5" />}
              {draftStatus.state === 'saving'
                ? 'Enregistrement…'
                : draftStatus.state === 'saved'
                  ? `Enregistré ${elapsedLabel(draftStatus.at, now)}`
                  : 'Brouillon non enregistré'}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setFocusMode((value) => !value)}
            aria-pressed={focusMode}
            title={focusMode ? 'Quitter le plein écran (Échap)' : 'Masquer le menu pendant la séance'}
          >
            {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden 2xl:inline">{focusMode ? 'Quitter le plein écran' : 'Plein écran'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
