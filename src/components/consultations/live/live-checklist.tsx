'use client'

import { useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, Flag, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AXES, missingAxes, RED_FLAG_CHECKS, type AxisId, type LiveLine } from '@/lib/anamnesis-live'
import { AxisIcon } from '@/components/consultations/live/axis-icon'

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
  /** Axes que le praticien a jugés sans objet pour ce patient. */
  dismissedAxes: AxisId[]
  onDismissAxis: (axis: AxisId) => void
  onRestoreAxes: () => void
}

export function LiveChecklist({
  lines,
  redFlagsCleared,
  onClearRedFlags,
  dismissedAxes,
  onDismissAxis,
  onRestoreAxes,
}: LiveChecklistProps) {
  const [showRedFlagList, setShowRedFlagList] = useState(false)
  const flagged = lines.filter((l) => l.axis === 'red_flag')
  // Un axe sans objet pour ce patient resterait réclamé indéfiniment et
  // transformerait le pense-bête en bruit de fond, qu'on finit par ne plus lire.
  const missing = missingAxes(lines).filter((a) => !dismissedAxes.includes(a.id))
  const total = missing.length

  return (
    <div className="flex min-h-full flex-col gap-6 px-5 py-5">
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
                <Flag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Drapeaux rouges
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
        <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {total > 0 ? `Pas encore abordé (${total})` : 'Interrogatoire complet'}
          {/* La mention de prudence occupait quatre lignes en permanence au bas
              d'une colonne qui défile. Elle reste, à la demande. */}
          <span
            title="Aide-mémoire de complétude d'interrogatoire. Aucune orientation diagnostique, aucune valeur de recommandation clinique."
            className="cursor-help text-muted-foreground/60"
          >
            <Info className="h-3 w-3" aria-hidden="true" />
          </span>
          <span className="sr-only">
            Aide-mémoire de complétude d’interrogatoire. Aucune orientation diagnostique,
            aucune valeur de recommandation clinique.
          </span>
        </h2>

        {total === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Check className="h-4 w-4 shrink-0" />
            Tous les axes sont couverts.
          </div>
        ) : (
          <ul className="space-y-1 list-none pl-0">
            {missing.map((axis) => (
              <li
                key={axis.id}
                className={cn(
                  'group/axis flex items-start gap-2.5 rounded-lg px-2.5 py-2',
                  'text-[13px] leading-snug text-muted-foreground hover:bg-muted/50',
                )}
              >
                <span className="shrink-0 pt-0.5 text-muted-foreground/60">
                  <AxisIcon axis={axis.id} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground/80">{axis.label}</span>
                  <span className="block text-xs leading-snug">{axis.prompt}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onDismissAxis(axis.id)}
                  className="mt-0.5 shrink-0 opacity-0 transition-opacity hover:text-foreground group-hover/axis:opacity-100"
                  aria-label={`Marquer « ${axis.label} » sans objet`}
                  title="Sans objet pour ce patient"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dismissedAxes.length > 0 && (
        <button
          type="button"
          onClick={onRestoreAxes}
          className="self-start text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
        >
          {dismissedAxes.length} axe{dismissedAxes.length > 1 ? 's' : ''} écarté{dismissedAxes.length > 1 ? 's' : ''}, rétablir
        </button>
      )}

    </div>
  )
}
