import { painQuestionnaires } from './pain'
import { lumbarQuestionnaires } from './lumbar'
import { cervicalQuestionnaires } from './cervical'
import { upperLimbQuestionnaires } from './upper-limb'
import { lowerLimbQuestionnaires } from './lower-limb'
import { psychosocialQuestionnaires } from './psychosocial'
import { sleepQuestionnaires } from './sleep'
import {
  CATEGORY_LABELS,
  type ClinicalQuestionnaire,
  type QuestionnaireAnswers,
  type QuestionnaireCategory,
  answerLabel,
  isScorable,
} from './types'

export * from './types'

/** Catalogue complet de la caisse à outils, dans l'ordre d'affichage. */
export const CLINICAL_QUESTIONNAIRES: ClinicalQuestionnaire[] = [
  ...painQuestionnaires,
  ...lumbarQuestionnaires,
  ...cervicalQuestionnaires,
  ...upperLimbQuestionnaires,
  ...lowerLimbQuestionnaires,
  ...psychosocialQuestionnaires,
  ...sleepQuestionnaires,
]

/** Catégories réellement représentées dans le catalogue, dans l'ordre déclaré. */
export const QUESTIONNAIRE_CATEGORIES = (Object.keys(CATEGORY_LABELS) as QuestionnaireCategory[]).filter(
  (category) => CLINICAL_QUESTIONNAIRES.some((questionnaire) => questionnaire.category === category),
)

export function getQuestionnaire(id: string): ClinicalQuestionnaire | undefined {
  return CLINICAL_QUESTIONNAIRES.find((questionnaire) => questionnaire.id === id)
}

/** Normalise pour une comparaison insensible à la casse et aux accents. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Recherche sur le nom, le sigle, l'objet et les mots-clés. Chaque terme de la
 * requête doit être retrouvé, ce qui permet d'affiner en tapant « dn4 » comme
 * « douleur neuro ».
 */
export function searchQuestionnaires(
  query: string,
  category?: QuestionnaireCategory | null,
): ClinicalQuestionnaire[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return CLINICAL_QUESTIONNAIRES.filter((questionnaire) => {
    if (category && questionnaire.category !== category) return false
    if (terms.length === 0) return true
    const haystack = normalize(
      [
        questionnaire.name,
        questionnaire.abbreviation,
        questionnaire.purpose,
        CATEGORY_LABELS[questionnaire.category],
        ...(questionnaire.keywords ?? []),
      ].join(' '),
    )
    return terms.every((term) => haystack.includes(term))
  })
}

export interface FormatOptions {
  /** Ajoute le détail item par item sous le résultat. */
  detailed?: boolean
}

/**
 * Met en forme le résultat pour le compte rendu de consultation. Le texte est
 * volontairement plat : il atterrit dans les mêmes champs libres que les tests
 * orthopédiques, et doit rester lisible tel quel dans un export ou un courrier.
 */
export function formatQuestionnaireResult(
  questionnaire: ClinicalQuestionnaire,
  answers: QuestionnaireAnswers,
  options: FormatOptions = {},
): string {
  if (!isScorable(questionnaire, answers)) return ''
  const result = questionnaire.score(answers)
  const lines: string[] = [
    `=== ${questionnaire.abbreviation} — ${questionnaire.name} ===`,
    `Score : ${result.headline}`,
    result.interpretation,
  ]

  for (const detail of result.details ?? []) {
    if (!detail.value) continue
    lines.push(`• ${detail.label} : ${detail.value}`)
  }

  if (options.detailed) {
    lines.push('Détail des réponses :')
    for (const item of questionnaire.items) {
      const label = answerLabel(item, answers)
      if (label === null) continue
      lines.push(`  - ${item.text} : ${label}`)
    }
  }

  lines.push(`Source : ${questionnaire.source}`)
  return lines.join('\n')
}
