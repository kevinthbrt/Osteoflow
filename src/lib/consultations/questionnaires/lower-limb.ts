import { type ClinicalQuestionnaire, band, itemIds, positiveItems, sum, yesNo } from './types'

const LEFS_ITEMS = [
  'Faire votre travail habituel, vos tâches ménagères ou vos activités scolaires',
  'Pratiquer vos activités de loisir habituelles, votre sport ou vos passe-temps',
  'Entrer dans le bain ou en sortir',
  'Marcher d\'une pièce à l\'autre',
  'Mettre vos chaussures ou vos chaussettes',
  'Vous accroupir',
  'Soulever un objet posé au sol, comme un sac de courses',
  'Effectuer des activités légères à la maison',
  'Effectuer des activités lourdes à la maison',
  'Monter dans une voiture ou en descendre',
  'Marcher sur 300 mètres environ',
  'Marcher sur 1,5 kilomètre environ',
  'Monter ou descendre dix marches (environ un étage)',
  'Rester debout pendant une heure',
  'Rester assis(e) pendant une heure',
  'Courir sur terrain plat',
  'Courir sur terrain irrégulier',
  'Faire des virages serrés en courant vite',
  'Sauter',
  'Vous retourner dans votre lit',
]

const LEFS_OPTIONS = [
  { label: 'Difficulté extrême ou incapable', value: 0 },
  { label: 'Beaucoup de difficulté', value: 1 },
  { label: 'Difficulté modérée', value: 2 },
  { label: 'Un peu de difficulté', value: 3 },
  { label: 'Aucune difficulté', value: 4 },
]

/**
 * LEFS : à l'inverse des échelles d'incapacité, le score monte avec la
 * fonction — 80/80 correspond à un membre inférieur pleinement fonctionnel.
 */
const lefs: ClinicalQuestionnaire = {
  id: 'lefs',
  name: 'Lower Extremity Functional Scale',
  abbreviation: 'LEFS',
  category: 'membre-inferieur',
  purpose: 'Capacité fonctionnelle du membre inférieur, cotée sur 80 points.',
  source: 'Binkley et al., Phys Ther 1999 — 80 = fonction maximale. Différence cliniquement pertinente : 9 points.',
  target: 'anamnesis',
  keywords: ['hanche', 'genou', 'cheville', 'pied', 'fonction', 'marche'],
  items: LEFS_ITEMS.map((text, index) => ({
    id: `q${index + 1}`,
    text,
    section: index === 0 ? 'Aujourd\'hui, avez-vous des difficultés à :' : undefined,
    options: LEFS_OPTIONS,
  })),
  score: (answers) => {
    const total = sum(answers, itemIds(lefs))
    const percent = Math.round((total / 80) * 100)
    const level = band<'critical' | 'high' | 'moderate' | 'low'>(
      total,
      [
        { upTo: 30, result: 'critical' },
        { upTo: 50, result: 'high' },
        { upTo: 65, result: 'moderate' },
      ],
      'low',
    )
    const lecture = band(
      total,
      [
        { upTo: 30, result: 'limitation fonctionnelle majeure' },
        { upTo: 50, result: 'limitation fonctionnelle importante' },
        { upTo: 65, result: 'limitation fonctionnelle modérée' },
        { upTo: 75, result: 'limitation fonctionnelle légère' },
      ],
      'fonction quasi normale',
    )
    return {
      headline: `${total}/80`,
      level,
      interpretation: `${total}/80 (${percent} % de la fonction maximale) — ${lecture}. Une évolution de 9 points signe un changement réel.`,
    }
  },
}

/** Règles d'Ottawa cheville et pied : deux règles distinctes, une par zone. */
const ottawaAnkle: ClinicalQuestionnaire = {
  id: 'ottawa-cheville',
  name: 'Règles d\'Ottawa — cheville et pied',
  abbreviation: 'Ottawa cheville',
  category: 'drapeaux-rouges',
  purpose: 'Décide de la nécessité d\'une radiographie après traumatisme de cheville ou de pied.',
  source: 'Stiell et al., JAMA 1993 — sensibilité proche de 100 % pour les fractures cliniquement significatives.',
  target: 'examination',
  keywords: ['entorse', 'cheville', 'pied', 'fracture', 'radiographie', 'traumatisme'],
  items: [
    {
      id: 'zone-malleolaire',
      section: 'Cheville',
      text: 'Douleur dans la zone malléolaire',
      options: yesNo(),
    },
    {
      id: 'malleole-externe',
      text: 'Douleur à la palpation du bord postérieur ou de la pointe de la malléole externe (6 cm distaux)',
      options: yesNo(),
    },
    {
      id: 'malleole-interne',
      text: 'Douleur à la palpation du bord postérieur ou de la pointe de la malléole interne (6 cm distaux)',
      options: yesNo(),
    },
    {
      id: 'zone-mediotarsienne',
      section: 'Pied',
      text: 'Douleur dans la zone médio-tarsienne',
      options: yesNo(),
    },
    { id: 'base-m5', text: 'Douleur à la palpation de la base du 5e métatarsien', options: yesNo() },
    { id: 'naviculaire', text: 'Douleur à la palpation de l\'os naviculaire', options: yesNo() },
    {
      id: 'appui-impossible',
      section: 'Mise en charge',
      text: 'Incapacité de faire quatre pas en appui, juste après le traumatisme et au moment de l\'examen',
      options: yesNo(),
    },
  ],
  score: (answers) => {
    const appui = (answers['appui-impossible'] ?? 0) > 0
    const cheville =
      (answers['zone-malleolaire'] ?? 0) > 0 &&
      ((answers['malleole-externe'] ?? 0) > 0 || (answers['malleole-interne'] ?? 0) > 0 || appui)
    const pied =
      (answers['zone-mediotarsienne'] ?? 0) > 0 &&
      ((answers['base-m5'] ?? 0) > 0 || (answers.naviculaire ?? 0) > 0 || appui)

    if (cheville || pied) {
      const zones = [cheville ? 'cheville' : null, pied ? 'pied' : null].filter(Boolean).join(' et ')
      return {
        headline: `Radiographie indiquée (${zones})`,
        level: 'critical',
        interpretation: `Règle d'Ottawa positive pour ${zones} : radiographie nécessaire avant toute prise en charge manuelle.`,
      }
    }
    return {
      headline: 'Radiographie non indiquée',
      level: 'low',
      interpretation: 'Règles d\'Ottawa négatives pour la cheville et le pied : fracture cliniquement significative très improbable.',
    }
  },
}

/** Règle d'Ottawa du genou : un seul critère positif suffit. */
const ottawaKnee: ClinicalQuestionnaire = {
  id: 'ottawa-genou',
  name: 'Règle d\'Ottawa — genou',
  abbreviation: 'Ottawa genou',
  category: 'drapeaux-rouges',
  purpose: 'Décide de la nécessité d\'une radiographie après traumatisme du genou.',
  source: 'Stiell et al., Ann Emerg Med 1995 — un seul critère positif impose la radiographie.',
  target: 'examination',
  keywords: ['genou', 'fracture', 'radiographie', 'traumatisme', 'entorse'],
  items: [
    { id: 'age', text: 'Âge de 55 ans ou plus', options: yesNo() },
    { id: 'patella', text: 'Douleur isolée à la palpation de la patella', options: yesNo() },
    { id: 'fibula', text: 'Douleur à la palpation de la tête de la fibula', options: yesNo() },
    { id: 'flexion', text: 'Impossibilité de fléchir le genou à 90°', options: yesNo() },
    {
      id: 'appui-impossible',
      text: 'Incapacité de faire quatre pas en appui, juste après le traumatisme et au moment de l\'examen',
      options: yesNo(),
    },
  ],
  score: (answers) => {
    const positifs = positiveItems(ottawaKnee, answers)
    if (positifs.length > 0) {
      return {
        headline: 'Radiographie indiquée',
        level: 'critical',
        interpretation: `Règle d'Ottawa du genou positive : radiographie nécessaire avant toute prise en charge manuelle.`,
        details: [{ label: 'Critères positifs', value: positifs.map((item) => item.text.toLowerCase()).join(' ; ') }],
      }
    }
    return {
      headline: 'Radiographie non indiquée',
      level: 'low',
      interpretation: 'Aucun critère d\'Ottawa positif : fracture du genou très improbable.',
    }
  },
}

export const lowerLimbQuestionnaires: ClinicalQuestionnaire[] = [lefs, ottawaAnkle, ottawaKnee]
