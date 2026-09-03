'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileText, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  deriveAnamnesisVitals,
  isNotCovered,
  isRealItem,
  realItems,
  UNCERTAIN_MARKER,
  type AnamnesisSection,
} from '@/lib/anamnesis'
import { AnamnesisSummaryBar } from '@/components/consultations/anamnesis-summary-bar'

/**
 * Zone de texte qui grandit avec son contenu, pour éditer les lignes des cartes
 * sans tronquer le texte (un <input> mono-ligne coupait les items longs).
 */
function GrowTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('resize-none overflow-hidden bg-transparent outline-none border-0 p-0', className)}
    />
  )
}

/**
 * Habillage des cartes.
 *
 * Une seule couleur veut dire quelque chose. Les cinq teintes décoratives
 * d'origine (une par rubrique) mettaient au même niveau visuel un drapeau rouge
 * et un facteur aggravant : l'œil devait tout parcourir pour trouver le signal.
 * Toutes les cartes sont donc neutres, et la couleur est réservée aux deux
 * états qui exigent une réaction.
 */
const CARD_TONES = {
  neutral: 'bg-muted/30 border-border',
  alert: 'bg-red-50/70 border-red-300 dark:bg-red-950/25 dark:border-red-800',
  clear: 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900',
} as const

const LABEL_TONES = {
  neutral: 'text-muted-foreground',
  alert: 'text-red-600 dark:text-red-400',
  clear: 'text-emerald-700 dark:text-emerald-400',
} as const

type CardTone = keyof typeof CARD_TONES

function toneOf(section: AnamnesisSection): CardTone {
  if (section.id !== 'red_flags') return 'neutral'
  return section.allClear || realItems(section).length === 0 ? 'clear' : 'alert'
}

interface AnamnesisCardsProps {
  reason?: string
  sections: AnamnesisSection[]
  /** Phrase de synthèse. Absente sur les anamnèses structurées avant son ajout. */
  summary?: string | null
  /** Bascule vers l'édition en texte libre (filet de sécurité). */
  onEdit: () => void
  disabled?: boolean
  /** Si fourni, les cartes deviennent éditables et notifient chaque changement. */
  onChange?: (sections: AnamnesisSection[]) => void
  /** Édition du motif (chip 🎯). Disponible uniquement en mode éditable. */
  onReasonChange?: (reason: string) => void
  /** Édition de la phrase de synthèse. Disponible uniquement en mode éditable. */
  onSummaryChange?: (summary: string) => void
}

export function AnamnesisCards({
  reason,
  sections,
  summary,
  onEdit,
  disabled,
  onChange,
  onReasonChange,
  onSummaryChange,
}: AnamnesisCardsProps) {
  const editable = !!onChange && !disabled

  /**
   * Rubriques non abordées que le praticien a choisi de déplier. Cet état est
   * indispensable en édition : dès qu'on ajoute une ligne, elle est vide, donc
   * la rubrique compterait de nouveau comme non abordée et se replierait sous
   * les doigts.
   */
  const [expanded, setExpanded] = useState<string[]>([])

  const vitals = useMemo(() => deriveAnamnesisVitals(sections), [sections])

  const update = (next: AnamnesisSection[]) => onChange?.(next)

  const setItem = (si: number, ii: number, value: string) =>
    update(sections.map((s, i) => (i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? value : it)) } : s)))

  const addItem = (si: number) =>
    update(
      sections.map((s, i) =>
        i === si
          ? {
              ...s,
              // On retire le placeholder « — » dès qu'on ajoute une vraie ligne.
              items: [...s.items.filter((it) => isRealItem(it)), ''],
              ...(s.id === 'red_flags' ? { allClear: false } : {}),
            }
          : s,
      ),
    )

  const removeItem = (si: number, ii: number) =>
    update(sections.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)))

  const setAllClear = (si: number, value: boolean) =>
    update(sections.map((s, i) => (i === si ? { ...s, allClear: value, items: value ? [] : s.items } : s)))

  // Une rubrique vide reste masquée jusqu'à ce qu'on la déplie : c'est la
  // moitié de la surface de l'écran rendue au contenu qui, lui, dit quelque
  // chose. Sa valeur de checklist est préservée par la ligne de rappel en bas.
  const hidden = sections.filter((s) => isNotCovered(s) && !expanded.includes(s.id))
  const hiddenIds = new Set(hidden.map((s) => s.id))
  const visible = sections.filter((s) => !hiddenIds.has(s.id))

  return (
    <div className="space-y-2 group">
      <AnamnesisSummaryBar
        reason={reason}
        summary={summary}
        vitals={vitals}
        onReasonChange={editable ? onReasonChange : undefined}
        onSummaryChange={editable ? onSummaryChange : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {visible.map((section) => {
          const si = sections.indexOf(section)
          const isRedFlags = section.id === 'red_flags'
          const tone = toneOf(section)
          return (
            <div
              key={section.id}
              className={cn('rounded-lg border px-2.5 py-2 text-xs min-w-0', CARD_TONES[tone], isRedFlags && 'sm:col-span-2')}
            >
              <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                <span className="shrink-0">{section.icon}</span>
                <span className={cn('font-semibold uppercase tracking-wide text-[10px] leading-tight break-words min-w-0', LABEL_TONES[tone])}>
                  {section.label}
                </span>
                {isRedFlags && editable && (
                  <label className="ml-auto flex items-center gap-1 text-[10px] font-medium cursor-pointer text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-emerald-600"
                      checked={!!section.allClear}
                      onChange={(e) => setAllClear(si, e.target.checked)}
                    />
                    Aucun identifié
                  </label>
                )}
                {isRedFlags && !editable && section.allClear && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Aucun identifié
                  </span>
                )}
              </div>

              {editable ? (
                <div className="space-y-1">
                  {!(isRedFlags && section.allClear) &&
                    section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <span className="opacity-40 shrink-0 leading-relaxed">·</span>
                        <GrowTextarea
                          value={isRealItem(item) ? item : ''}
                          onChange={(v) => setItem(si, i, v)}
                          placeholder="—"
                          className={cn(
                            'flex-1 leading-relaxed placeholder:text-muted-foreground/50',
                            item.includes(UNCERTAIN_MARKER)
                              ? 'text-amber-800 dark:text-amber-200 font-medium'
                              : 'text-foreground',
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(si, i)}
                          className="shrink-0 mt-0.5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Supprimer la ligne"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  {!(isRedFlags && section.allClear) && (
                    <button
                      type="button"
                      onClick={() => addItem(si)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    >
                      <Plus className="h-2.5 w-2.5" /> ajouter
                    </button>
                  )}
                </div>
              ) : isRedFlags && section.allClear ? (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {realItems(section).map((item, i) => (
                    <span key={i} className="flex items-center gap-1 text-emerald-900 dark:text-emerald-200">
                      <Check className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <ul className="space-y-0.5 list-none pl-0">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className={cn(
                        'leading-relaxed break-words',
                        !isRealItem(item)
                          ? 'text-muted-foreground italic'
                          : item.includes(UNCERTAIN_MARKER)
                            // Souligné et ambré : ce sont les deux ou trois
                            // lignes à confirmer, celles qui méritent l'œil.
                            ? 'text-amber-800 dark:text-amber-200 font-medium decoration-amber-400 underline decoration-dotted underline-offset-2'
                            : 'text-foreground',
                      )}
                    >
                      {isRealItem(item) && <span className="mr-1 opacity-40">·</span>}
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {(hidden.length > 0 || !disabled) && (
        <div className="flex items-start justify-between gap-2">
          {/* Rappel de checklist : ce qui n'a pas été abordé, en une ligne au
              lieu d'une carte vide par rubrique. Chaque libellé déplie sa carte. */}
          {hidden.length > 0 ? (
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground px-0.5">
              <span className="font-medium">Non abordé :</span>
              {hidden.map((section, i) => (
                <span key={section.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => [...prev, section.id])}
                    className="underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
                    title={editable ? 'Déplier pour compléter' : 'Déplier'}
                  >
                    {section.label}
                  </button>
                  {i < hidden.length - 1 && ','}
                </span>
              ))}
            </div>
          ) : (
            <span />
          )}

          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 h-6 px-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onEdit}
            >
              <FileText className="h-3 w-3 mr-1" />
              Texte libre
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
