import type { SignalId } from './signals'

/**
 * Valeur d'un fait clinique. La distinction entre « non » et « pas encore
 * exploré » est ce qui permet au moteur de dire ce qu'il reste à chercher au
 * lieu de conclure trop vite.
 */
export type Tribool = 'yes' | 'no' | 'unknown'

/**
 * Expression booléenne à trois valeurs sur les signaux. La forme raccourcie —
 * un identifiant de signal seul — se lit « ce signal est vrai ».
 */
export type SignalExpr =
  | SignalId
  | { not: SignalExpr }
  | { all: SignalExpr[] }
  | { any: SignalExpr[] }
  | { atLeast: number; among: SignalExpr[] }

export interface Criterion {
  when: SignalExpr
  /**
   * Poids dans le score. Positif : argument en faveur. Négatif : argument
   * contre. Seules les expressions vraies comptent — une expression fausse
   * n'est pas un argument, elle est simplement muette.
   */
  weight: number
  /** Formulation clinique de l'argument, reprise telle quelle à l'affichage. */
  label: string
}

export type Region = 'lombaire' | 'cervical'

export type HypothesisKind =
  | 'red-flag'
  | 'specific'
  | 'mechanical'
  | 'exclusion'

export interface HypothesisDefinition {
  id: string
  label: string
  region: Region
  kind: HypothesisKind
  /**
   * Condition d'entrée. Fausse, l'hypothèse est écartée ; inconnue, elle reste
   * en attente et ne peut pas passer devant une hypothèse retenue.
   */
  requires?: SignalExpr
  criteria: Criterion[]
  /** Actions du catalogue que cette hypothèse appelle. */
  actions?: string[]
  /** Précaution ou rappel affiché avec l'hypothèse. */
  note?: string
}

export type ActionKind = 'question' | 'test' | 'questionnaire' | 'exam' | 'referral'

export interface ActionDefinition {
  id: string
  kind: ActionKind
  label: string
  /** Signaux que l'action renseigne — c'est ce qui la rend informative. */
  resolves?: SignalId[]
  /** Performances connues, reportées telles quelles dans le compte rendu. */
  performance?: string
  /** Outil de la caisse à outils à ouvrir, le cas échéant. */
  questionnaireId?: string
  urgency?: 'urgent' | 'if_persistent' | 'not_indicated'
  note?: string
}

export type HypothesisStatus = 'retained' | 'pending' | 'excluded'

export interface ScoredHypothesis {
  id: string
  label: string
  region: Region
  kind: HypothesisKind
  status: HypothesisStatus
  score: number
  /** Score encore atteignable si tout ce qui est inconnu tombait en faveur. */
  potential: number
  argumentsFor: string[]
  argumentsAgainst: string[]
  /** Critères encore inconnus : ce qu'il reste à explorer pour trancher. */
  unexplored: string[]
  note?: string
}

export interface SuggestedAction {
  action: ActionDefinition
  /** Hypothèses que l'action contribue à départager. */
  discriminates: string[]
  /** Poids en jeu — sert au classement, pas à l'affichage. */
  value: number
}

export interface ReasoningResult {
  /** Drapeaux rouges actifs, toujours en tête et jamais mêlés au différentiel. */
  redFlags: ScoredHypothesis[]
  /** Différentiel trié : retenues d'abord, puis en attente. */
  hypotheses: ScoredHypothesis[]
  /** Hypothèses écartées, conservées pour tracer ce qui a été éliminé. */
  excluded: ScoredHypothesis[]
  /** Prochaines actions, de la plus discriminante à la moins utile. */
  nextActions: SuggestedAction[]
}

export interface ReasoningInput {
  signals: Partial<Record<SignalId, boolean>>
  hypotheses: HypothesisDefinition[]
  actions?: ActionDefinition[]
  /** Nombre d'actions proposées. Trois par défaut : au-delà, on noie le praticien. */
  actionLimit?: number
}
