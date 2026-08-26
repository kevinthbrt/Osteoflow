import type { SignalId } from './signals'
import type { SourceKey } from './sources'

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
  /** Clé de la bibliographie. Une valeur sans référence résolvable est refusée. */
  source: SourceKey
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
  /**
   * Groupe de signes corrélés au sein d'une même hypothèse.
   *
   * Les signes lombaires ne sont pas conditionnellement indépendants : une
   * douleur dermatomale, un Lasègue positif et un réflexe aboli décrivent en
   * grande partie le même phénomène. Les multiplier revient à compter trois
   * fois la même observation. Au sein d'un groupe, le moteur ne retient qu'une
   * seule contribution.
   */
  correlation?: string
  /**
   * Règle de décision validée sur l'ensemble du groupe corrélé. Quand elle est
   * tranchée, elle prend la place de tous ses membres : le rapport publié du
   * cluster vaut mieux que le produit des rapports individuels.
   */
  cluster?: boolean
  /**
   * Référence d'un critère qui ne s'exprime pas en rapport de vraisemblance —
   * une probabilité post-test publiée, une règle de décision. La provenance
   * doit rester traçable même quand la valeur n'est pas multipliable.
   */
  source?: SourceKey
  /**
   * Conduite qu'impose ce critère quand il est vrai, sur un drapeau rouge.
   * L'hypothèse retient le niveau le plus haut de ses critères vérifiés.
   */
  alert?: AlertLevel
  /** Formulation clinique de l'argument, reprise telle quelle à l'affichage. */
  label: string
}

export type Region = 'lombaire' | 'cervical'

/**
 * Niveau d'alerte d'un drapeau rouge (chapitre 3 du document de référence).
 *
 * Un score continu n'a pas de sens ici : sur une prévalence de départ de
 * quelques pour mille, même un rapport élevé laisse une probabilité post-test
 * modeste. Ce qui compte n'est pas « quelle probabilité », mais « quelle
 * conduite » — et il n'y en a que trois.
 */
export type AlertLevel =
  /** Un seul élément suffit : réorientation sans attendre d'accumulation. */
  | 'immediate'
  /** Combinaison validée à rapport élevé : imagerie ou adressage rapide. */
  | 'elevee'
  /** Drapeau isolé peu spécifique : réévaluer, chercher activement un second. */
  | 'vigilance'

export type HypothesisKind =
  | 'red-flag'
  | 'specific'
  | 'mechanical'
  /** Diagnostic résiduel : ce qui reste faute de mieux, jamais scoré. */
  | 'exclusion'
  /**
   * Stratification pronostique (couche 4). Ne concourt pas au différentiel :
   * les drapeaux jaunes prédisent l'évolution, pas la nature de la lésion.
   */
  | 'profil'

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
  prior?: { value: number; source: SourceKey }
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
  /** Conduite à tenir sur un drapeau rouge retenu. */
  alert?: AlertLevel
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
  /**
   * Stratification pronostique, tenue à part du différentiel. Un risque élevé
   * de chronicisation oriente la prise en charge sans rien dire du diagnostic.
   */
  profiles: ScoredHypothesis[]
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
