'use client'

import { useMemo, useState } from 'react'
import { Stethoscope, X, AlertTriangle, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type HypothesesPayload,
  type TestResult,
  recomputeProbabilities,
} from '@/lib/hypotheses'

interface HypothesesCardProps {
  payload: HypothesesPayload
  onClose?: () => void
}

const RANK_BAR = ['bg-indigo-500', 'bg-sky-500', 'bg-teal-500']
const RANK_TEXT = ['text-indigo-600 dark:text-indigo-400', 'text-sky-600 dark:text-sky-400', 'text-teal-600 dark:text-teal-400']

export function HypothesesCard({ payload, onClose }: HypothesesCardProps) {
  const [results, setResults] = useState<Record<string, TestResult>>({})

  const probs = useMemo(
    () => recomputeProbabilities(payload.hypotheses, payload.tests, results),
    [payload, results],
  )

  const setResult = (testId: string, value: TestResult) =>
    setResults(prev => ({ ...prev, [testId]: prev[testId] === value ? null : value }))

  const labelById = (id: number) => payload.hypotheses.find(h => h.id === id)?.label ?? `Hypothèse ${id}`

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 dark:border-violet-900 dark:bg-violet-950/20 p-3 space-y-3 relative">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <span className="font-semibold text-sm text-violet-900 dark:text-violet-200">Hypothèses cliniques</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-muted-foreground/60 hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Avertissement de responsabilité */}
      <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Aide à la décision. Hypothèses et pourcentages <strong>indicatifs</strong>, non validés
          cliniquement et basés sur le seul interrogatoire. L&apos;examen, l&apos;interprétation et la décision
          relèvent de la <strong>seule responsabilité du praticien</strong>.
        </span>
      </div>

      {/* Hypothèses avec probabilité en direct */}
      <div className="space-y-2">
        {payload.hypotheses.map((h, i) => {
          const p = probs[h.id] ?? h.prior
          return (
            <div key={h.id} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className={cn('text-[10px] font-bold', RANK_TEXT[i] ?? RANK_TEXT[0])}>#{i + 1}</span>
                <span className="text-xs font-medium flex-1">{h.label}</span>
                <span className={cn('text-sm font-bold tabular-nums', RANK_TEXT[i] ?? RANK_TEXT[0])}>{p}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-300', RANK_BAR[i] ?? RANK_BAR[0])}
                  style={{ width: `${p}%` }}
                />
              </div>
              {h.rationale && <p className="text-[11px] text-muted-foreground leading-snug">{h.rationale}</p>}
            </div>
          )
        })}
      </div>

      {/* Tests préconisés avec impact interactif */}
      {payload.tests.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tests à réaliser — cochez le résultat
          </p>
          {payload.tests.map((t) => {
            const r = results[t.test_id] ?? null
            return (
              <div key={t.test_id} className="rounded-md border bg-background px-2.5 py-2 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  {t.region && <span className="text-[10px] text-muted-foreground">· {t.region}</span>}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {t.rationale} <span className="opacity-70">→ {labelById(t.targetId)}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setResult(t.test_id, 'positive')}
                    className={cn(
                      'rounded px-2 py-0.5 text-[11px] font-medium border transition-colors',
                      r === 'positive'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400',
                    )}
                  >
                    Positif {t.deltaPositive > 0 ? `+${t.deltaPositive}%` : `${t.deltaPositive}%`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResult(t.test_id, 'negative')}
                    className={cn(
                      'rounded px-2 py-0.5 text-[11px] font-medium border transition-colors',
                      r === 'negative'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400',
                    )}
                  >
                    Négatif {t.deltaNegative}%
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Questions à poser pour compléter l'anamnèse */}
      {payload.missing_questions && payload.missing_questions.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <HelpCircle className="h-3 w-3" /> Questions à poser
          </p>
          <ul className="space-y-0.5 list-none pl-0">
            {payload.missing_questions.map((q, i) => (
              <li key={i} className="text-xs leading-snug flex gap-1.5">
                <span className="text-violet-500 shrink-0">•</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
