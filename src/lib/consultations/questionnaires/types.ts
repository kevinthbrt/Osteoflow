/**
 * Socle commun de la caisse à outils : un questionnaire est décrit en données
 * (items + options chiffrées) et fournit sa propre fonction de cotation. Cette
 * uniformité permet à l'interface de dessiner n'importe quel outil sans le
 * connaître, et à la cotation de rester fidèle à l'échelle d'origine — une
 * somme simple pour le DN4, un pourcentage pour l'Oswestry, une règle de
 * décision pour Ottawa.
 */

export type QuestionnaireCategory =
  | 'douleur'
  | 'lombaire'
  | 'cervical'
  | 'membre-superieur'
  | 'membre-inferieur'
  | 'psychosocial'
  | 'sommeil'
  | 'drapeaux-rouges'

export const CATEGORY_LABELS: Record<QuestionnaireCategory, string> = {
  douleur: 'Douleur',
  lombaire: 'Rachis lombaire',
  cervical: 'Rachis cervical & céphalées',
  'membre-superieur': 'Membre supérieur',
  'membre-inferieur': 'Membre inférieur',
  psychosocial: 'Psychosocial',
  sommeil: 'Sommeil & fatigue',
  'drapeaux-rouges': 'Drapeaux rouges',
}

/** Champ de la consultation dans lequel le résultat atterrit par défaut. */
export type QuestionnaireTarget = 'anamnesis' | 'examination' | 'advice'

export const TARGET_LABELS: Record<QuestionnaireTarget, string> = {
  anamnesis: 'Anamnèse',
  examination: 'Examen clinique',
  advice: 'Conseils',
}

/**
 * Gravité du résultat. Sert à colorer l'affichage : `info` pour un résultat
 * qui ne se lit pas en termes de sévérité (une échelle numérique brute),
 * `critical` pour ce qui appelle une orientation médicale.
 */
export type QuestionnaireLevel = 'info' | 'low' | 'moderate' | 'high' | 'critical'

export interface QuestionnaireOption {
  label: string
  value: number
}

export interface QuestionnaireItem {
  id: string
  text: string
  /** Précision affichée sous l'énoncé (consigne de passation, exemple). */
  help?: string
  /** Intertitre regroupant les items suivants (« Interrogatoire », « Examen »). */
  section?: string
  options: QuestionnaireOption[]
}

export interface QuestionnaireScore {
  /** Résultat en une expression courte : « 5/10 », « 42 % », « Risque élevé ». */
  headline: string
  level: QuestionnaireLevel
  /** Lecture clinique du score, telle qu'elle sera reportée dans le dossier. */
  interpretation: string
  /** Sous-scores et intermédiaires de calcul à conserver dans le compte rendu. */
  details?: { label: string; value: string }[]
}

export type QuestionnaireAnswers = Record<string, number | undefined>

export interface ClinicalQuestionnaire {
  id: string
  /** Nom complet, tel qu'il est cité dans la littérature. */
  name: string
  /** Sigle usuel affiché en tête de résultat (« DN4 », « ODI »). */
  abbreviation: string
  category: QuestionnaireCategory
  /** Ce que l'outil mesure, en une phrase. */
  purpose: string
  /** Référence de l'échelle et seuil de lecture. */
  source: string
  target: QuestionnaireTarget
  /** Termes supplémentaires pris en compte par la recherche. */
  keywords?: string[]
  /**
   * Nombre de réponses nécessaires avant de coter. Par défaut tous les items :
   * seules les échelles qui tolèrent des items sans objet (Oswestry, QuickDASH)
   * abaissent ce seuil.
   */
  minAnswers?: number
  items: QuestionnaireItem[]
  score: (answers: QuestionnaireAnswers) => QuestionnaireScore
}

/* --------------------------------------------------------------------------
 * Fabriques d'options
 * ----------------------------------------------------------------------- */

/** Oui/Non coté 1/0, dans l'ordre d'affichage Non puis Oui. */
export function yesNo(): QuestionnaireOption[] {
  return [
    { label: 'Non', value: 0 },
    { label: 'Oui', value: 1 },
  ]
}

/** Échelle ordinale : la valeur de chaque option est son rang, décalé de `from`. */
export function ordinal(labels: string[], from = 0): QuestionnaireOption[] {
  return labels.map((label, index) => ({ label, value: index + from }))
}

/** Échelle numérique bornée (0-10 par défaut), une option par graduation. */
export function numeric(min = 0, max = 10): QuestionnaireOption[] {
  const options: QuestionnaireOption[] = []
  for (let value = min; value <= max; value += 1) {
    options.push({ label: String(value), value })
  }
  return options
}

/* --------------------------------------------------------------------------
 * Utilitaires de cotation
 * ----------------------------------------------------------------------- */

/** Somme des réponses fournies ; les items sans réponse valent zéro. */
export function sum(answers: QuestionnaireAnswers, ids?: string[]): number {
  const keys = ids ?? Object.keys(answers)
  return keys.reduce((total, id) => total + (answers[id] ?? 0), 0)
}

/** Nombre d'items effectivement renseignés parmi `ids`. */
export function answered(answers: QuestionnaireAnswers, ids?: string[]): number {
  const keys = ids ?? Object.keys(answers)
  return keys.filter((id) => answers[id] !== undefined).length
}

/** Identifiants de tous les items d'un questionnaire, dans l'ordre. */
export function itemIds(questionnaire: ClinicalQuestionnaire): string[] {
  return questionnaire.items.map((item) => item.id)
}

/** Items cotés strictement au-dessus de zéro, pour la liste des positifs. */
export function positiveItems(
  questionnaire: ClinicalQuestionnaire,
  answers: QuestionnaireAnswers,
): QuestionnaireItem[] {
  return questionnaire.items.filter((item) => (answers[item.id] ?? 0) > 0)
}

/** Libellé de l'option retenue pour un item, ou `null` si l'item est vierge. */
export function answerLabel(item: QuestionnaireItem, answers: QuestionnaireAnswers): string | null {
  const value = answers[item.id]
  if (value === undefined) return null
  return item.options.find((option) => option.value === value)?.label ?? String(value)
}

/** Nombre de réponses attendues avant de pouvoir coter. */
export function requiredAnswers(questionnaire: ClinicalQuestionnaire): number {
  return questionnaire.minAnswers ?? questionnaire.items.length
}

/** Le questionnaire a-t-il reçu assez de réponses pour être coté ? */
export function isScorable(
  questionnaire: ClinicalQuestionnaire,
  answers: QuestionnaireAnswers,
): boolean {
  return answered(answers, itemIds(questionnaire)) >= requiredAnswers(questionnaire)
}

/** Choisit le premier palier dont la borne haute couvre la valeur. */
export function band<T>(value: number, bands: { upTo: number; result: T }[], fallback: T): T {
  for (const { upTo, result } of bands) {
    if (value <= upTo) return result
  }
  return fallback
}
