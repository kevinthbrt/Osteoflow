'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Mic, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AXES, getAxis, type AxisId, type LiveLine } from '@/lib/anamnesis-live'

/**
 * Le fil de l'anamnèse : une ligne par fait, dans l'ordre de lecture clinique.
 *
 * Deux règles de composition.
 *
 * La couleur ne porte que l'alerte. Si tout est coloré, plus rien ne l'est, et
 * l'œil se retrouve à tout parcourir, ce qui est le problème d'origine sous une
 * autre forme.
 *
 * La hiérarchie passe donc par la TAILLE et la GRAISSE, pas par la teinte : le
 * motif est le titre de la consultation et se lit comme tel, les faits viennent
 * ensuite, le verbatim se retire. Sans cela, un motif et un facteur aggravant
 * ont exactement le même poids visuel.
 */

interface LiveLineFeedProps {
  lines: LiveLine[]
  /** Texte en cours de reconnaissance, affiché en fin de fil. */
  interim?: string
  onEdit: (id: string, text: string) => void
  onRemove: (id: string) => void
  /** Ajout d'une ligne à la main, sans passer par la dictée. */
  onAdd: (axis: AxisId, text: string) => void
  /** Démarrage de la dictée depuis l'écran d'accueil. */
  onStart: () => void
  isRecording: boolean
}

/** Fenêtre pendant laquelle une ligne modifiée reste signalée. */
const FLASH_MS = 2500

function LineRow({
  line,
  headline,
  onEdit,
  onRemove,
}: {
  line: LiveLine
  /** Le motif : titre de la consultation, pas une ligne parmi les autres. */
  headline?: boolean
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

  const textSize = headline
    ? 'text-[20px] font-semibold leading-[1.35] tracking-tight'
    : 'text-[16px] leading-[1.6]'

  return (
    <li
      className={cn(
        'group/line flex items-start gap-3.5 rounded-lg px-3 transition-colors',
        headline ? 'py-2' : 'py-2.5',
        'hover:bg-muted/40',
        fresh && 'animate-in fade-in slide-in-from-left-1 duration-300',
        isRedFlag && 'bg-red-50/70 dark:bg-red-950/25',
      )}
    >
      <span
        className={cn('shrink-0 select-none leading-none', headline ? 'pt-1 text-[19px]' : 'pt-1.5 text-[17px]')}
        title={axis?.label}
        aria-hidden="true"
      >
        {axis?.icon}
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
            className={cn(
              'w-full resize-none overflow-hidden border-b border-primary/40 bg-transparent p-0 outline-none',
              textSize,
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              'block w-full break-words text-left',
              textSize,
              isRedFlag
                ? 'font-medium text-red-800 dark:text-red-200'
                : isUncertain
                  ? 'text-amber-800 underline decoration-amber-400 decoration-dotted underline-offset-4 dark:text-amber-200'
                  : 'text-foreground',
            )}
          >
            {line.text}
          </button>
        )}

        {/* Les mots du patient, sous la ligne dont ils lèvent le doute. */}
        {isUncertain && line.verbatim && !editing && (
          <p className="mt-1 break-words text-[12px] italic leading-snug text-muted-foreground">
            « {line.verbatim} »
          </p>
        )}
      </div>

      <div className={cn('flex shrink-0 items-center gap-1', headline ? 'pt-2' : 'pt-1.5')}>
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
              className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/line:opacity-100"
              aria-label="Corriger la ligne"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(line.id)}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/line:opacity-100"
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

/** Ajout d'une ligne à la main : la dictée n'est pas le seul chemin. */
function ManualEntry({ onAdd }: { onAdd: (axis: AxisId, text: string) => void }) {
  const [axis, setAxis] = useState<AxisId>('motif')
  const [text, setText] = useState('')

  const submit = () => {
    const value = text.trim()
    if (!value) return
    onAdd(axis, value)
    setText('')
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
      <select
        value={axis}
        onChange={(e) => setAxis(e.target.value as AxisId)}
        aria-label="Rubrique de la ligne"
        className="shrink-0 rounded-lg border bg-background px-2 py-1 text-xs text-muted-foreground outline-none focus:border-primary"
      >
        {AXES.map((a) => (
          <option key={a.id} value={a.id}>{a.icon} {a.label}</option>
        ))}
      </select>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder="Ajouter un élément à la main"
        aria-label="Texte de la ligne"
        className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.6] outline-none placeholder:text-muted-foreground/50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        aria-label="Ajouter la ligne"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Écran d'accueil. Le micro est l'action unique à ce moment : il devient le
 * centre de gravité, au lieu d'un petit bouton perdu dans un coin de l'en-tête.
 */
function StartInvitation({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <button
        type="button"
        onClick={onStart}
        className={cn(
          'flex h-24 w-24 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg shadow-primary/25',
          'transition-transform hover:scale-105 active:scale-100',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        )}
        aria-label="Démarrer la dictée"
      >
        <Mic className="h-9 w-9" />
      </button>
      <p className="mt-6 text-[17px] font-medium">Lancez la dictée et laissez parler le patient.</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Les éléments se posent ici au fur et à mesure, ou s’ajoutent à la main ci-dessous.
      </p>
    </div>
  )
}

export function LiveLineFeed({
  lines,
  interim,
  onEdit,
  onRemove,
  onAdd,
  onStart,
  isRecording,
}: LiveLineFeedProps) {
  const reason = lines.find((l) => l.axis === 'motif')
  const facts = lines.filter((l) => l.axis !== 'motif')
  const empty = lines.length === 0 && !interim

  return (
    /* Colonne de lecture bornée : sur un grand écran, des lignes qui courent
       d'un bord à l'autre se lisent mal et se composent mal. */
    <div className="mx-auto w-full max-w-[46rem] px-4 py-5 sm:px-6">
      {empty && !isRecording && <StartInvitation onStart={onStart} />}

      {reason && (
        <ul className="mb-2 list-none border-b pb-2 pl-0">
          <LineRow line={reason} headline onEdit={onEdit} onRemove={onRemove} />
        </ul>
      )}

      <ul className="list-none space-y-0.5 pl-0">
        {facts.map((line) => (
          <LineRow key={line.id} line={line} onEdit={onEdit} onRemove={onRemove} />
        ))}
      </ul>

      {interim && (
        <p className="px-3 py-2.5 text-[16px] italic leading-[1.6] text-muted-foreground/60">{interim}</p>
      )}

      <ManualEntry onAdd={onAdd} />
    </div>
  )
}
