'use client'

import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GrowTextarea } from '@/components/consultations/anamnesis-cards'
import type { AnamnesisSection } from '@/components/consultations/anamnesis-recorder'

/**
 * L'anamnèse en relevé plutôt qu'en cartes.
 *
 * Mêmes données, autre densité. Les cartes donnent une checklist — sept blocs
 * toujours présents, y compris vides, pour rappeler ce qui reste à demander.
 * Le relevé donne un compte rendu : une ligne par rubrique renseignée, rien
 * pour les autres. En pleine consultation, l'un se balaie du regard, l'autre se
 * lit. C'est un goût, pas une hiérarchie — d'où le réglage.
 *
 * Les drapeaux rouges font exception et restent visibles même vides : « aucun
 * drapeau rouge identifié » est une information, pas une absence.
 */
interface AnamnesisSummaryViewProps {
  reason?: string
  sections: AnamnesisSection[]
  disabled?: boolean
  /** Si fourni, le relevé devient éditable et notifie chaque changement. */
  onChange?: (sections: AnamnesisSection[]) => void
  onReasonChange?: (reason: string) => void
}

/** Une rubrique mérite-t-elle une ligne ? */
function aQuelqueChose(section: AnamnesisSection): boolean {
  if (section.id === 'red_flags') return true
  return section.items.some((item) => item.trim() && item !== '—')
}

export function AnamnesisSummaryView({
  reason,
  sections,
  disabled,
  onChange,
  onReasonChange,
}: AnamnesisSummaryViewProps) {
  const editable = !!onChange && !disabled
  const update = (next: AnamnesisSection[]) => onChange?.(next)

  const setItem = (si: number, ii: number, value: string) =>
    update(
      sections.map((s, i) =>
        i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? value : it)) } : s,
      ),
    )

  const addItem = (si: number) =>
    update(
      sections.map((s, i) =>
        i === si
          ? {
              ...s,
              items: [...s.items.filter((it) => it !== '—'), ''],
              ...(s.id === 'red_flags' ? { allClear: false } : {}),
            }
          : s,
      ),
    )

  const removeItem = (si: number, ii: number) =>
    update(
      sections.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)),
    )

  // En lecture, les rubriques vides disparaissent. En édition elles restent :
  // c'est là qu'on ajoute ce que la dictée n'a pas capté.
  const visibles = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => editable || aQuelqueChose(section))

  if (visibles.length === 0) return null

  return (
    <div className="space-y-2.5">
      {reason &&
        (editable && onReasonChange ? (
          <div className="flex items-start gap-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/45 w-28 shrink-0 pt-[3px]">
              Motif
            </span>
            <GrowTextarea
              value={reason}
              onChange={onReasonChange}
              placeholder="Motif principal"
              className="flex-1 text-[13px] font-medium"
            />
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/45 w-28 shrink-0 pt-[2px]">
              Motif
            </span>
            <p className="flex-1 text-[13px] font-medium leading-relaxed">{reason}</p>
          </div>
        ))}

      {visibles.map(({ section, index }) => {
        const isRedFlags = section.id === 'red_flags'
        const items = section.items.filter((item) => item.trim() && item !== '—')
        const rasSurDrapeaux = isRedFlags && (section.allClear || items.length === 0)

        return (
          <div key={section.id} className="flex items-start gap-3">
            <span
              className={cn(
                'text-[10.5px] font-semibold uppercase tracking-[0.06em] w-28 shrink-0 pt-[3px]',
                isRedFlags && !rasSurDrapeaux
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground/45',
              )}
            >
              {section.label}
            </span>

            <div className="flex-1 min-w-0">
              {rasSurDrapeaux ? (
                <p className="text-[13px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                  Aucun drapeau rouge identifié
                </p>
              ) : editable ? (
                <div className="space-y-0.5">
                  {section.items.map((item, ii) => (
                    <div key={ii} className="flex items-start gap-1.5 group/item">
                      <GrowTextarea
                        value={item}
                        onChange={(value) => setItem(index, ii, value)}
                        placeholder="…"
                        className={cn(
                          'flex-1 text-[13px] leading-relaxed',
                          isRedFlags && 'text-red-700 dark:text-red-300',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(index, ii)}
                        className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity text-muted-foreground/50 hover:text-foreground mt-[3px]"
                        aria-label="Retirer cet élément"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem(index)}
                    className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter
                  </button>
                </div>
              ) : (
                <p
                  className={cn(
                    'text-[13px] leading-relaxed',
                    isRedFlags && 'text-red-700 dark:text-red-300 font-medium',
                  )}
                >
                  {items.join(' · ')}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
