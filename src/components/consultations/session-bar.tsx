'use client'

import { useEffect, useState } from 'react'
import { Check, CloudOff, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Commandes de séance, logées dans la barre d'actions en bas de la
 * consultation : état du brouillon, plein écran (menu et en-tête masqués) et
 * raccourcis clavier Ctrl + S, Ctrl + Entrée, Échap.
 */
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
  return `il y a ${Math.floor(seconds / 60)} min`
}

export function SessionControls({
  draftStatus,
  onSave,
  onFinish,
}: {
  /** Absent en modification : la consultation existe déjà, pas de brouillon */
  draftStatus?: DraftStatus
  onSave: () => void
  onFinish: () => void
}) {
  const [focusMode, setFocusMode] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (draftStatus?.state !== 'saved') return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [draftStatus])

  useEffect(() => {
    const root = document.documentElement
    if (focusMode) root.setAttribute(FOCUS_MODE_ATTR, '')
    else root.removeAttribute(FOCUS_MODE_ATTR)
    return () => root.removeAttribute(FOCUS_MODE_ATTR)
  }, [focusMode])

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
      } else if (event.key === 'Escape' && focusMode) {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSave, onFinish, focusMode])

  return (
    <div className="mr-auto flex min-w-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setFocusMode((value) => !value)}
        aria-pressed={focusMode}
        aria-label={focusMode ? 'Quitter le plein écran' : 'Plein écran'}
        title={focusMode ? 'Quitter le plein écran (Échap)' : 'Plein écran : masque le menu pendant la séance'}
      >
        {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
      {draftStatus && draftStatus.state !== 'idle' && (
        <span
          role="status"
          title="Le brouillon s’enregistre tout seul pendant la saisie (Ctrl + S pour forcer)"
          className={cn(
            'flex min-w-0 items-center gap-1.5 truncate text-[13px]',
            draftStatus.state === 'error' ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {draftStatus.state === 'saving' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
          {draftStatus.state === 'saved' && <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={3} />}
          {draftStatus.state === 'error' && <CloudOff className="h-3.5 w-3.5 shrink-0" />}
          {draftStatus.state === 'saving'
            ? 'Enregistrement…'
            : draftStatus.state === 'saved'
              ? `Brouillon enregistré ${elapsedLabel(draftStatus.at, now)}`
              : 'Brouillon non enregistré'}
        </span>
      )}
    </div>
  )
}
