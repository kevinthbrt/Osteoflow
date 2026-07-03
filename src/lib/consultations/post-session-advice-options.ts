/**
 * Conseils post-séance sélectionnables par le praticien, organisés par
 * catégorie clinique. Chaque item devient une carte dans l'email HTML
 * envoyé au patient (voir createPostSessionAdviceHtmlEmail).
 *
 * Contenu volontairement limité à des recommandations reconnues par les
 * repères de bonnes pratiques en douleur musculo-squelettique (activité
 * plutôt que repos prolongé, éducation à la douleur, signes d'alerte...).
 * On évite délibérément les idées reçues sans fondement (ex. "boire de
 * l'eau pour éliminer les toxines de la séance").
 */

export type AdviceCategory = 'general' | 'acute' | 'chronic' | 'redflags'

export interface AdviceOption {
  id: string
  category: AdviceCategory
  title: string
  text: string
  color: string
}

export const ADVICE_CATEGORY_LABELS: Record<AdviceCategory, string> = {
  general: 'Général — tous patients',
  acute: 'Douleur aiguë / récente',
  chronic: 'Douleur chronique',
  redflags: "Signes d'alerte à surveiller",
}

export const POST_SESSION_ADVICE_OPTIONS: AdviceOption[] = [
  // Général
  {
    id: 'general_progressive_return',
    category: 'general',
    title: 'Reprise progressive',
    text: "Reprenez vos activités habituelles de façon progressive, sans attendre la disparition totale d'éventuelles sensations pour bouger.",
    color: '#22c55e',
  },
  {
    id: 'general_normal_reactions',
    category: 'general',
    title: 'Réactions normales après la séance',
    text: 'Une légère fatigue ou quelques courbatures dans les 24 à 48h suivant la séance sont fréquentes et sans gravité.',
    color: '#a855f7',
  },
  {
    id: 'general_avoid_intense_effort',
    category: 'general',
    title: 'Éviter les efforts intenses les premières 24h',
    text: "Il est préférable d'éviter les efforts physiques intenses ou le sport à forte intensité dans les 24 heures suivant la séance.",
    color: '#eab308',
  },
  {
    id: 'general_sleep',
    category: 'general',
    title: 'Sommeil',
    text: "Un sommeil de bonne qualité favorise la récupération de l'organisme dans les jours qui suivent.",
    color: '#3b82f6',
  },

  // Douleur aiguë / récente
  {
    id: 'acute_stay_active',
    category: 'acute',
    title: 'Rester actif',
    text: 'En cas de douleur aiguë, le repos strict prolongé est déconseillé : mieux vaut rester actif, dans la limite du supportable.',
    color: '#22c55e',
  },
  {
    id: 'acute_ice',
    category: 'acute',
    title: 'Glace en cas de gonflement',
    text: "En cas de gonflement ou d'inflammation visible dans les 48h, l'application de glace (15 à 20 minutes, plusieurs fois par jour) peut soulager.",
    color: '#3b82f6',
  },
  {
    id: 'acute_heat',
    category: 'acute',
    title: 'Chaleur pour les tensions musculaires',
    text: "En l'absence d'inflammation aiguë, la chaleur peut aider à détendre les tensions musculaires.",
    color: '#f97316',
  },
  {
    id: 'acute_adapt_dont_avoid',
    category: 'acute',
    title: 'Adapter plutôt qu\'éviter',
    text: 'Adaptez temporairement les mouvements douloureux plutôt que de les éviter complètement.',
    color: '#eab308',
  },

  // Douleur chronique
  {
    id: 'chronic_regular_activity',
    category: 'chronic',
    title: 'Activité physique régulière',
    text: "Pour une douleur chronique, une activité physique régulière et progressive reste le traitement de fond le plus efficace.",
    color: '#22c55e',
  },
  {
    id: 'chronic_pain_not_damage',
    category: 'chronic',
    title: "Douleur n'est pas synonyme de lésion",
    text: "Ressentir une douleur ne signifie pas systématiquement qu'il existe un dommage tissulaire. Évitez d'éviter les mouvements par crainte excessive de la douleur.",
    color: '#a855f7',
  },
  {
    id: 'chronic_sleep_stress',
    category: 'chronic',
    title: 'Sommeil et gestion du stress',
    text: "La qualité du sommeil et la gestion du stress influencent directement l'intensité des douleurs chroniques.",
    color: '#3b82f6',
  },
  {
    id: 'chronic_progressive_goals',
    category: 'chronic',
    title: 'Objectifs progressifs',
    text: "Fixez-vous des objectifs progressifs plutôt que d'attendre une disparition totale de la douleur avant de reprendre vos activités.",
    color: '#eab308',
  },

  // Signes d'alerte
  {
    id: 'redflags_seek_care',
    category: 'redflags',
    title: "Quand consulter rapidement",
    text: "Consultez rapidement en cas de fièvre associée, de perte de force ou de sensibilité dans un membre, de troubles du contrôle urinaire ou intestinal, de douleur qui s'aggrave la nuit et empêche de dormir, ou suite à un traumatisme important.",
    color: '#f43f5e',
  },
]

export const DEFAULT_ADVICE_IDS: string[] = [
  'general_progressive_return',
  'general_normal_reactions',
  'redflags_seek_care',
]

export function getAdviceOptionsByIds(ids: string[]): AdviceOption[] {
  const set = new Set(ids)
  return POST_SESSION_ADVICE_OPTIONS.filter((o) => set.has(o.id))
}
