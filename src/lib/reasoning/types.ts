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

/**
 * Rapport de vraisemblance publié.
 *
 * C'est la forme sous laquelle la littérature diagnostique s'exprime, et la
 * seule qui permette d'ajouter une hypothèse sans réétalonner toutes les
 * autres : un rapport se multiplie, il ne se compare pas.
 *
 * La source est obligatoire. Une valeur sans référence est refusée par les
 * tests : c'est ce qui distingue un chiffre d'une intuition.
 */
export interface Likelihood {
  /** Rapport de vraisemblance quand le critère est vrai (LR+). */
  positive: number
  /**
   * Rapport quand il est faux (LR−). Omis si l'étude ne le fournit pas — un
   * critère faux reste alors muet, comme un critère ordinaire.
   */
  negative?: number
  /** Référence exacte de la valeur. */
  source: string
}

export interface Criterion {
  when: SignalExpr
  /**
   * Poids ordinal : une priorité clinique, pas une probabilité. À n'employer
   * que faute de rapport de vraisemblance publié. Seules les expressions
   * vraies comptent — une expression fausse n'est pas un argument.
   */
  weight?: number
  /**
   * Rapport de vraisemblance sourcé. Quand il est présent il remplace le
   * poids, et un critère faux pèse aussi si le LR− est connu.
   */
  lr?: Likelihood
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
  /**
   * Prévalence de départ dans la population vue en cabinet. Sans elle, aucune
   * probabilité post-test n'est calculée : mieux vaut pas de chiffre qu'un
   * chiffre bâti sur une prévalence supposée.
   */
  prior?: { value: number; source: string }
  /** Précaution ou rappel affiché avec l'hypothèse. */
  note?: string
}

export type ActionKind = 'question' | 'choice' | 'test' | 'questionnaire' | 'exam' | 'referral'

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
  /** Réponses possibles d'une question à choix — une seule peut être vraie. */
  options?: { signal: SignalId; label: string }[]
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
  /**
   * Probabilité post-test, calculée seulement si l'hypothèse porte une
   * prévalence sourcée et que tout ce qui a pesé vient d'un rapport de
   * vraisemblance publié. Absente le reste du temps, et c'est voulu.
   */
  probability?: number
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
  /**
   * Actions déjà réalisées : un questionnaire rempli ou un test fait ne se
   * repropose pas, même s'il reste pertinent pour l'hypothèse.
   */
  done?: string[]
  /** Nombre d'actions proposées. Trois par défaut : au-delà, on noie le praticien. */
  actionLimit?: number
}
