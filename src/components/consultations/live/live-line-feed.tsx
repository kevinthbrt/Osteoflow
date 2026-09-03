'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAxis, type LiveLine } from '@/lib/anamnesis-live'

/**
 * Le fil de l'anamnèse : une ligne par fait, dans l'ordre de lecture clinique.
 *
 * Parti pris de lisibilité : le symbole en tête de ligne porte le repérage, la
 * couleur ne porte que l'alerte. Si tout est coloré, plus rien ne l'est, et
 * l'œil se retrouve à tout parcourir, ce qui est le problème d'origine sous une
 * autre forme. Le texte reste donc neutre partout, sauf le rouge d'un drapeau et
 * l'ambre d'un terme mal entendu.
 */

interface LiveLineFeedProps {
  lines: LiveLine[]
  /** Texte en cours de reconnaissance, affiché en fin de fil. */
  interim?: string
  onEdit: (id: string, text: string) => void
  onRemove: (id: string) => void
}

/** Fenêtre pendant laquelle une ligne modifiée reste signalée. */
const FLASH_MS = 2500

function LineRow({
  line,
  onEdit,
  onRemove,
}: {
  line: LiveLine
  onEdit: (id: string, text: string) => void
  onRemove: (id: string) => void
}) {
  const axis = getAxis(line.axis)
  const isRedFlag = line.axis === 'red_flag'
  const isUncertain = line.confidence === 'low'

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(line.text)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Une ligne réécrite par l'IA pendant qu'on la corrige effacerait la saisie en
  // cours : la synchronisation ne s'applique qu'en dehors de l'édition.
  useEffect(() => { if (!editing) setDraft(line.text) }, [line.text, editing])

  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== line.text) onEdit(line.id, next)
    else setDraft(line.text)
  }

  const fresh = !!line.touchedAt && Date.now() - line.touchedAt < FLASH_MS

  return (
    <li
      className={cn(
        'group/line flex items-start gap-3 rounded-lg px-3 py-2 transition-colors',
        'hover:bg-muted/40',
        fresh && 'animate-in fade-in slide-in-from-left-1 duration-300',
        isRedFlag && 'bg-red-50/70 dark:bg-red-950/25',
      )}
    >
      <span className="shrink-0 text-base leading-6 select-none" title={axis?.label} aria-hidden="true">
        {axis?.icon ?? '·'}
      </span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
              if (e.key === 'Escape') { setDraft(line.text); setEditing(false) }
            }}
            className="w-full resize-none overflow-hidden bg-transparent p-0 text-[15px] leading-6 outline-none border-b border-primary/40"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              'block w-full text-left text-[15px] leading-6 break-words',
              isRedFlag
                ? 'font-medium text-red-800 dark:text-red-200'
                : isUncertain
                  ? 'text-amber-800 dark:text-amber-200 underline decoration-dotted decoration-amber-400 underline-offset-4'
                  : 'text-foreground',
            )}
          >
            {line.text}
          </button>
        )}

        {/* Les mots du patient, sous la ligne dont ils lèvent le doute. */}
        {isUncertain && line.verbatim && !editing && (
          <p className="mt-0.5 text-xs italic text-muted-foreground break-words">« {line.verbatim} »</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        {line.edited && (
          <span title="Corrigé par vous, l'IA ne le réécrira plus">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          </span>
        )}
        {!editing && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="opacity-0 transition-opacity group-hover/line:opacity-100 text-muted-foreground hover:text-foreground"
              aria-label="Corriger la ligne"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(line.id)}
              className="opacity-0 transition-opacity group-hover/line:opacity-100 text-muted-foreground hover:text-destructive"
              aria-label="Supprimer la ligne"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function LiveLineFeed({ lines, interim, onEdit, onRemove }: LiveLineFeedProps) {
  if (lines.length === 0 && !interim) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Lancez la dictée et laissez parler le patient.
          <br />
          Les éléments se posent ici au fur et à mesure.
        </p>
      </div>
    )
  }

  return (
    <div className="px-2 py-2">
      <ul className="space-y-0.5 list-none pl-0">
        {lines.map((line) => (
          <LineRow key={line.id} line={line} onEdit={onEdit} onRemove={onRemove} />
        ))}
      </ul>

      {interim && (
        <p className="px-3 py-2 text-[15px] leading-6 italic text-muted-foreground/60">{interim}</p>
      )}
    </div>
  )
}
