'use client'

import { Check, FileText, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type AnamnesisSection, SECTION_STYLES } from '@/components/consultations/anamnesis-recorder'

interface AnamnesisCardsProps {
  reason?: string
  sections: AnamnesisSection[]
  /** Bascule vers l'édition en texte libre (filet de sécurité). */
  onEdit: () => void
  disabled?: boolean
  /** Si fourni, les cartes deviennent éditables et notifient chaque changement. */
  onChange?: (sections: AnamnesisSection[]) => void
  /** Édition du motif (chip 🎯). Disponible uniquement en mode éditable. */
  onReasonChange?: (reason: string) => void
}

export function AnamnesisCards({ reason, sections, onEdit, disabled, onChange, onReasonChange }: AnamnesisCardsProps) {
  const editable = !!onChange && !disabled

  const update = (next: AnamnesisSection[]) => onChange?.(next)

  const setItem = (si: number, ii: number, value: string) =>
    update(sections.map((s, i) => (i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? value : it)) } : s)))

  const addItem = (si: number) =>
    update(
      sections.map((s, i) =>
        i === si
          ? {
              ...s,
              // On retire le placeholder "—" dès qu'on ajoute une vraie ligne.
              items: [...s.items.filter((it) => it !== '—'), ''],
              ...(s.id === 'red_flags' ? { allClear: false } : {}),
            }
          : s,
      ),
    )

  const removeItem = (si: number, ii: number) =>
    update(sections.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)))

  const setAllClear = (si: number, value: boolean) =>
    update(sections.map((s, i) => (i === si ? { ...s, allClear: value, items: value ? [] : s.items } : s)))

  return (
    <div className="space-y-2 relative group">
      {(reason || editable) && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 max-w-full break-words bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full px-3 py-1">
            🎯
            {editable && onReasonChange ? (
              <input
                value={reason ?? ''}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Motif principal"
                className="bg-transparent outline-none border-0 p-0 text-xs font-semibold placeholder:text-red-400/70 min-w-[8rem]"
              />
            ) : (
              reason
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {sections.map((section, si) => {
          const isRedFlags = section.id === 'red_flags'
          const effectiveColor = isRedFlags ? (section.allClear ? 'green' : 'red') : section.color
          const styles = SECTION_STYLES[effectiveColor] ?? SECTION_STYLES.slate
          return (
            <div
              key={section.id}
              className={cn('rounded-lg border px-2.5 py-2 text-xs min-w-0', styles.card, isRedFlags && 'sm:col-span-2')}
            >
              <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                <span className="shrink-0">{section.icon}</span>
                <span className={cn('font-semibold uppercase tracking-wide text-[10px] leading-tight break-words min-w-0', styles.label)}>
                  {section.label}
                </span>
                {isRedFlags && editable && (
                  <label className="ml-auto flex items-center gap-1 text-[10px] font-medium cursor-pointer text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-green-600"
                      checked={!!section.allClear}
                      onChange={(e) => setAllClear(si, e.target.checked)}
                    />
                    Aucun identifié
                  </label>
                )}
                {isRedFlags && !editable && section.allClear && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" /> Aucun identifié
                  </span>
                )}
              </div>

              {editable ? (
                <div className="space-y-1">
                  {!(isRedFlags && section.allClear) &&
                    section.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="opacity-40 shrink-0">·</span>
                        <input
                          value={item === '—' ? '' : item}
                          onChange={(e) => setItem(si, i, e.target.value)}
                          placeholder="—"
                          className={cn(
                            'flex-1 bg-transparent outline-none border-0 p-0 leading-relaxed placeholder:text-muted-foreground/50',
                            styles.item,
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(si, i)}
                          className="shrink-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
                  {section.items.filter((i) => i !== '—').map((item, i) => (
                    <span key={i} className={cn('flex items-center gap-1', styles.item)}>
                      <Check className="h-2.5 w-2.5 text-green-500 shrink-0" />
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <ul className="space-y-0.5 list-none pl-0">
                  {section.items.map((item, i) => (
                    <li key={i} className={cn('leading-relaxed break-words', item === '—' ? 'text-muted-foreground italic' : styles.item)}>
                      {item !== '—' && <span className="mr-1 opacity-40">·</span>}
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute top-0 right-0 h-6 px-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onEdit}
        >
          <FileText className="h-3 w-3 mr-1" />
          Texte libre
        </Button>
      )}
    </div>
  )
}
