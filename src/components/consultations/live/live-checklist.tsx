'use client'

import { useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { missingAxes, RED_FLAG_CHECKS, type LiveLine } from '@/lib/anamnesis-live'

/**
 * Le copilote : ce qui n'a pas encore été abordé.
 *
 * Il ne dit jamais ce que c'est. Un panneau qui affiche une hypothèse à la
 * quarantième seconde oriente la suite de l'interrogatoire vers sa confirmation,
 * ce qui rétrécit le raisonnement au lieu de l'ouvrir. Il dit seulement ce qui
 * manque, ce qui est à la fois plus utile pendant que le patient est là, et sans
 * effet d'ancrage.
 *
 * La liste est fixe et versionnée dans `lib/anamnesis-live`, jamais improvisée
 * par le modèle : un pense-bête qui change d'avis d'une consultation à l'autre
 * n'est pas un pense-bête, et un oubli silencieux sur un drapeau rouge coûte
 * cher.
 */

interface LiveChecklistProps {
  lines: LiveLine[]
  redFlagsCleared: boolean
  onClearRedFlags: (cleared: boolean) => void
}

export function LiveChecklist({ lines, redFlagsCleared, onClearRedFlags }: LiveChecklistProps) {
  const [showRedFlagList, setShowRedFlagList] = useState(false)
  const missing = missingAxes(lines)
  const flagged = lines.filter((l) => l.axis === 'red_flag')
  const total = missing.length

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 py-5">
      {/* Drapeaux rouges en premier : c'est le seul point dont l'oubli est grave. */}
      <section>
        {flagged.length > 0 ? (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {flagged.length} drapeau{flagged.length > 1 ? 'x' : ''} rouge{flagged.length > 1 ? 's' : ''}
            </div>
            <ul className="mt-2 space-y-1 list-none pl-0 text-[13px] leading-snug text-red-800 dark:text-red-200">
              {flagged.map((line) => (
                <li key={line.id}>{line.text}</li>
              ))}
            </ul>
          </div>
        ) : redFlagsCleared ? (
          <button
            type="button"
            onClick={() => onClearRedFlags(false)}
            className="flex w-full items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          >
            <Check className="h-4 w-4 shrink-0" />
            Drapeaux rouges dépistés, aucun retenu
          </button>
        ) : (
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowRedFlagList((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
              >
                {showRedFlagList ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                🚩 Drapeaux rouges
              </button>
              <button
                type="button"
                onClick={() => onClearRedFlags(true)}
                className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Aucun
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Dépistage non tranché</p>
            {showRedFlagList && (
              <ul className="mt-2 space-y-1 list-none pl-0 text-[12px] leading-snug text-muted-foreground">
                {RED_FLAG_CHECKS.map((check) => (
                  <li key={check} className="flex gap-1.5">
                    <span className="opacity-40">·</span>
                    {check}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Ce qui n'a pas encore été abordé. */}
      <section className="flex-1">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {total > 0 ? `Pas encore abordé (${total})` : 'Interrogatoire complet'}
        </h2>

        {total === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Check className="h-4 w-4 shrink-0" />
            Tous les axes sont couverts.
          </div>
        ) : (
          <ul className="space-y-0.5 list-none pl-0">
            {missing.map((axis) => (
              <li
                key={axis.id}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg px-2.5 py-1.5',
                  'text-[13px] leading-snug text-muted-foreground',
                )}
              >
                <span className="shrink-0 opacity-60" aria-hidden="true">{axis.icon}</span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground/80">{axis.label}</span>
                  <span className="block text-xs">{axis.prompt}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] leading-snug text-muted-foreground/70">
        Aide-mémoire de complétude d’interrogatoire. Aucune orientation diagnostique,
        aucune valeur de recommandation clinique.
      </p>
    </div>
  )
}
