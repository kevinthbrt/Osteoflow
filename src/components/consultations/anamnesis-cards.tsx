'use client'

import { Check, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type AnamnesisSection, SECTION_STYLES } from '@/components/consultations/anamnesis-recorder'

interface AnamnesisCardsProps {
  reason?: string
  sections: AnamnesisSection[]
  onEdit: () => void
  disabled?: boolean
}

export function AnamnesisCards({ reason, sections, onEdit, disabled }: AnamnesisCardsProps) {
  return (
    <div className="space-y-2 relative group">
      {reason && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full px-3 py-1">
            🎯 {reason}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {sections.map((section) => {
          const styles = SECTION_STYLES[section.color] ?? SECTION_STYLES.blue
          const isRedFlags = section.id === 'red_flags'
          return (
            <div
              key={section.id}
              className={cn(
                'rounded-lg border px-2.5 py-2 text-xs',
                styles.card,
                isRedFlags && 'col-span-2'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span>{section.icon}</span>
                <span className={cn('font-semibold uppercase tracking-wide text-[10px]', styles.label)}>
                  {section.label}
                </span>
                {isRedFlags && section.allClear && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" /> Aucun identifié
                  </span>
                )}
              </div>
              {isRedFlags && section.allClear ? (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {section.items.filter(i => i !== '—').map((item, i) => (
                    <span key={i} className={cn('flex items-center gap-1', styles.item)}>
                      <Check className="h-2.5 w-2.5 text-green-500 shrink-0" />
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <ul className="space-y-0.5 list-none pl-0">
                  {section.items.map((item, i) => (
                    <li key={i} className={cn('leading-relaxed', item === '—' ? 'text-muted-foreground italic' : styles.item)}>
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
          <Pencil className="h-3 w-3 mr-1" />
          Modifier
        </Button>
      )}
    </div>
  )
}
