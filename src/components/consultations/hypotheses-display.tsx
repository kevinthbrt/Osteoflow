'use client'

import { Brain, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type HypothesesPayload,
  type TestResult,
  type ProbabilityEffect,
  recomputeProbabilities,
} from '@/lib/hypotheses'

interface SavedState {
  results?: Record<string, TestResult>
  answers?: Record<string, number | null>
}

interface SavedHypotheses {
  payload: HypothesesPayload
  state?: SavedState
}

const RANK_BAR = ['bg-indigo-500', 'bg-sky-500', 'bg-teal-500']
const RANK_TEXT = [
  'text-indigo-600 dark:text-indigo-400',
  'text-sky-600 dark:text-sky-400',
  'text-teal-600 dark:text-teal-400',
]

/** Parse la valeur stockée en base (`clinical_hypotheses`). Tolère un format absent/invalide. */
function parse(raw?: string | null): SavedHypotheses | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data && Array.isArray(data?.payload?.hypotheses)) return data as SavedHypotheses
    // Repli : ancien format où la racine est directement le payload.
    if (data && Array.isArray(data?.hypotheses)) return { payload: data as HypothesesPayload }
    return null
  } catch {
    return null
  }
}

/**
 * Affichage en lecture seule des hypothèses cliniques enregistrées : classement et
 * probabilités recalculés à partir des tests/réponses saisis lors de la consultation.
 */
export function HypothesesDisplay({ clinicalHypotheses }: { clinicalHypotheses?: string | null }) {
  const data = parse(clinicalHypotheses)
  if (!data) return null

  const { payload, state } = data
  const results = state?.results ?? {}
  const answers = state?.answers ?? {}

  const effects: ProbabilityEffect[] = []
  for (const t of payload.tests ?? []) {
    const r = results[t.test_id]
    if (r === 'positive') effects.push({ targetId: t.targetId, delta: t.deltaPositive })
    else if (r === 'negative') effects.push({ targetId: t.targetId, delta: t.deltaNegative })
  }
  for (const q of payload.questions ?? []) {
    const ai = answers[q.id]
    if (ai != null && q.answers[ai]) effects.push({ targetId: q.answers[ai].targetId, delta: q.answers[ai].delta })
  }

  const probs = recomputeProbabilities(payload.hypotheses, effects)
  const ranked = [...payload.hypotheses].sort(
    (a, b) => (probs[b.id] ?? b.prior) - (probs[a.id] ?? a.prior),
  )

  // Résumé des éléments saisis (tests positifs/négatifs, réponses choisies).
  const answeredTests = (payload.tests ?? []).filter((t) => results[t.test_id])
  const answeredQuestions = (payload.questions ?? [])
    .map((q) => {
      const ai = answers[q.id]
      return ai != null && q.answers[ai] ? { text: q.text, answer: q.answers[ai].label } : null
    })
    .filter((x): x is { text: string; answer: string } => x !== null)

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 dark:border-violet-900 dark:bg-violet-950/20 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <span className="text-sm font-semibold text-violet-900 dark:text-violet-200">Hypothèses cliniques</span>
      </div>

      <div className="space-y-2">
        {ranked.map((h, i) => {
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
                  className={cn('h-full rounded-full', RANK_BAR[i] ?? RANK_BAR[0])}
                  style={{ width: `${p}%` }}
                />
              </div>
              {h.rationale && <p className="text-[11px] leading-snug text-muted-foreground">{h.rationale}</p>}
            </div>
          )
        })}
      </div>

      {(answeredQuestions.length > 0 || answeredTests.length > 0) && (
        <div className="space-y-1 border-t border-violet-200/60 dark:border-violet-900/60 pt-2 text-[11px] leading-snug">
          {answeredQuestions.map((q, idx) => (
            <p key={`q-${idx}`} className="text-muted-foreground">
              <span className="font-medium text-foreground">{q.text}</span> — {q.answer}
            </p>
          ))}
          {answeredTests.map((t) => (
            <p key={t.test_id} className="text-muted-foreground">
              <span className="font-medium text-foreground">{t.name}</span> —{' '}
              {results[t.test_id] === 'positive' ? 'positif' : 'négatif'}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Aide à la décision indicative, non validée cliniquement. La décision relève de la seule
          responsabilité du praticien.
        </span>
      </div>
    </div>
  )
}
