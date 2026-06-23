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

/** Une réponse possible à une question, avec son effet indicatif sur une hypothèse. */
export interface QuestionAnswer {
  label: string
  targetId: number
  delta: number
}

/** Question à poser au patient ; chaque réponse influence le classement en direct. */
export interface ClinicalQuestion {
  id: string
  text: string
  answers: QuestionAnswer[]
}

export interface HypothesesPayload {
  hypotheses: Hypothesis[]
  tests: HypothesisTest[]
  /** 0–3 questions interactives à poser au patient (optionnel). */
  questions?: ClinicalQuestion[]
}

export type TestResult = 'positive' | 'negative' | null

/** Un effet appliqué à une hypothèse (issu d'un test coché ou d'une réponse). */
export interface ProbabilityEffect {
  targetId: number
  delta: number
}

/**
 * Recalcule les probabilités à partir des a priori et des effets actifs (tests
 * cochés + réponses aux questions). Heuristique simple et transparente : on applique
 * chaque delta à l'hypothèse ciblée, on borne chaque score à 1–99 %, puis on
 * renormalise pour sommer à 100 %.
 */
export function recomputeProbabilities(
  hypotheses: Hypothesis[],
  effects: ProbabilityEffect[],
): Record<number, number> {
  const scores: Record<number, number> = {}
  for (const h of hypotheses) scores[h.id] = h.prior

  for (const e of effects) {
    if (scores[e.targetId] === undefined) continue
    scores[e.targetId] += e.delta
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
