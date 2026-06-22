/**
 * Aide à la décision « Hypothèses cliniques » — éphémère, générée à la demande
 * à partir de l'anamnèse seule. Le praticien coche le résultat de chaque test et
 * les probabilités sont recalculées localement (heuristique indicative, NON validée
 * cliniquement). La décision relève de la seule responsabilité du praticien.
 */

export interface Hypothesis {
  id: number
  label: string
  /** Probabilité a priori estimée (%), d'après l'interrogatoire seul. */
  prior: number
  rationale: string
}

export interface HypothesisTest {
  test_id: string
  name: string
  region: string
  /** Hypothèse que le test discrimine le mieux. */
  targetId: number
  /** Effet indicatif (points de %) si le test est positif (> 0). */
  deltaPositive: number
  /** Effet indicatif (points de %) si le test est négatif (< 0). */
  deltaNegative: number
  rationale: string
}

export interface HypothesesPayload {
  hypotheses: Hypothesis[]
  tests: HypothesisTest[]
}

export type TestResult = 'positive' | 'negative' | null

/**
 * Recalcule les probabilités à partir des a priori et des résultats de tests cochés.
 * Heuristique simple et transparente : on applique le delta du test à l'hypothèse
 * ciblée, on borne chaque score à 1–99 %, puis on renormalise pour sommer à 100 %.
 */
export function recomputeProbabilities(
  hypotheses: Hypothesis[],
  tests: HypothesisTest[],
  results: Record<string, TestResult>,
): Record<number, number> {
  const scores: Record<number, number> = {}
  for (const h of hypotheses) scores[h.id] = h.prior

  for (const t of tests) {
    const r = results[t.test_id]
    if (!r) continue
    if (scores[t.targetId] === undefined) continue
    scores[t.targetId] += r === 'positive' ? t.deltaPositive : t.deltaNegative
  }

  for (const id of Object.keys(scores)) {
    const n = Number(id)
    scores[n] = Math.min(99, Math.max(1, scores[n]))
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  const out: Record<number, number> = {}
  for (const id of Object.keys(scores)) {
    const n = Number(id)
    out[n] = total > 0 ? Math.round((scores[n] / total) * 100) : 0
  }
  return out
}
