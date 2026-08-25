import {
  type ClinicalQuestionnaire,
  answered,
  band,
  itemIds,
  ordinal,
  positiveItems,
  sum,
  yesNo,
} from './types'

const NDI_SECTIONS: { id: string; text: string; options: string[] }[] = [
  {
    id: 'douleur',
    text: 'Intensité de la douleur',
    options: [
      'Je n\'ai pas de douleur en ce moment',
      'La douleur est très légère en ce moment',
      'La douleur est modérée en ce moment',
      'La douleur est assez forte en ce moment',
      'La douleur est très forte en ce moment',
      'La douleur est la pire que l\'on puisse imaginer',
    ],
  },
  {
    id: 'soins',
    text: 'Soins personnels (se laver, s\'habiller)',
    options: [
      'Je prends soin de moi normalement, sans augmenter la douleur',
      'Je prends soin de moi normalement, mais cela augmente la douleur',
      'Prendre soin de moi est douloureux : je le fais lentement et avec précaution',
      'J\'ai besoin d\'aide, mais je fais l\'essentiel de ma toilette seul(e)',
      'J\'ai besoin d\'aide tous les jours pour la plupart des gestes de toilette',
      'Je ne m\'habille pas, je me lave avec difficulté et je reste au lit',
    ],
  },
  {
    id: 'charges',
    text: 'Port de charges',
    options: [
      'Je peux porter des charges lourdes sans augmenter la douleur',
      'Je peux porter des charges lourdes, mais cela augmente la douleur',
      'La douleur m\'empêche de soulever des charges lourdes du sol, mais j\'y arrive si elles sont bien placées (sur une table)',
      'La douleur m\'empêche de soulever des charges lourdes ; je porte des charges légères à moyennes bien placées',
      'Je ne peux soulever que des charges très légères',
      'Je ne peux ni soulever ni porter quoi que ce soit',
    ],
  },
  {
    id: 'lecture',
    text: 'Lecture',
    options: [
      'Je peux lire autant que je veux, sans douleur au cou',
      'Je peux lire autant que je veux, avec une légère douleur au cou',
      'Je peux lire autant que je veux, avec une douleur modérée au cou',
      'Je ne peux pas lire autant que je veux à cause d\'une douleur modérée au cou',
      'Je peux à peine lire à cause d\'une forte douleur au cou',
      'Je ne peux pas lire du tout',
    ],
  },
  {
    id: 'cephalees',
    text: 'Maux de tête',
    options: [
      'Je n\'ai pas mal à la tête',
      'J\'ai de légers maux de tête, peu fréquents',
      'J\'ai des maux de tête modérés, peu fréquents',
      'J\'ai des maux de tête modérés, fréquents',
      'J\'ai des maux de tête sévères, fréquents',
      'J\'ai mal à la tête presque tout le temps',
    ],
  },
  {
    id: 'concentration',
    text: 'Concentration',
    options: [
      'Je me concentre pleinement, sans difficulté',
      'Je me concentre pleinement, avec une légère difficulté',
      'J\'ai une difficulté modérée à me concentrer',
      'J\'ai beaucoup de difficulté à me concentrer',
      'J\'ai énormément de difficulté à me concentrer',
      'Je ne peux pas me concentrer du tout',
    ],
  },
  {
    id: 'travail',
    text: 'Travail',
    options: [
      'Je peux travailler autant que je veux',
      'Je peux faire mon travail habituel, mais pas plus',
      'Je peux faire la plus grande partie de mon travail habituel, mais pas plus',
      'Je ne peux pas faire mon travail habituel',
      'Je peux à peine travailler',
      'Je ne peux pas travailler du tout',
    ],
  },
  {
    id: 'conduite',
    text: 'Conduite automobile',
    options: [
      'Je peux conduire sans douleur au cou',
      'Je peux conduire aussi longtemps que je veux, avec une légère douleur au cou',
      'Je peux conduire aussi longtemps que je veux, avec une douleur modérée au cou',
      'Je ne peux pas conduire autant que je veux à cause d\'une douleur modérée au cou',
      'Je peux à peine conduire à cause d\'une forte douleur au cou',
      'Je ne peux pas conduire du tout',
    ],
  },
  {
    id: 'sommeil',
    text: 'Sommeil',
    options: [
      'Je n\'ai aucun trouble du sommeil',
      'Mon sommeil est très légèrement perturbé (moins d\'une heure d\'insomnie)',
      'Mon sommeil est légèrement perturbé (1 à 2 heures d\'insomnie)',
      'Mon sommeil est modérément perturbé (2 à 3 heures d\'insomnie)',
      'Mon sommeil est fortement perturbé (3 à 5 heures d\'insomnie)',
      'Mon sommeil est complètement perturbé (5 à 7 heures d\'insomnie)',
    ],
  },
  {
    id: 'loisirs',
    text: 'Loisirs',
    options: [
      'Je pratique toutes mes activités de loisir sans douleur au cou',
      'Je pratique toutes mes activités de loisir avec une certaine douleur au cou',
      'Je pratique la plupart, mais pas toutes, de mes activités de loisir habituelles',
      'Je ne pratique que quelques-unes de mes activités de loisir habituelles',
      'Je peux à peine pratiquer mes activités de loisir',
      'Je ne pratique aucune activité de loisir',
    ],
  },
]

/** NDI : décalque cervical de l'Oswestry, coté sur 50 puis en pourcentage. */
const ndi: ClinicalQuestionnaire = {
  id: 'ndi',
  name: 'Neck Disability Index',
  abbreviation: 'NDI',
  category: 'cervical',
  purpose: 'Retentissement fonctionnel d\'une cervicalgie, coté sur 50 points.',
  source: 'Vernon & Mior, JMPT 1991 — version française validée. Différence cliniquement pertinente : 7 points.',
  target: 'anamnesis',
  keywords: ['cervicalgie', 'nuque', 'incapacité', 'whiplash'],
  items: NDI_SECTIONS.map((section) => ({
    id: section.id,
    text: section.text,
    options: ordinal(section.options),
  })),
  score: (answers) => {
    const ids = itemIds(ndi)
    const sections = answered(answers, ids)
    const total = sum(answers, ids)
    const percent = sections > 0 ? Math.round((total / (sections * 5)) * 100) : 0
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      total,
      [
        { upTo: 14, result: 'low' },
        { upTo: 24, result: 'moderate' },
        { upTo: 34, result: 'high' },
      ],
      'critical',
    )
    const lecture = band(
      total,
      [
        { upTo: 4, result: 'aucune incapacité' },
        { upTo: 14, result: 'incapacité légère' },
        { upTo: 24, result: 'incapacité modérée' },
        { upTo: 34, result: 'incapacité sévère' },
      ],
      'incapacité complète',
    )
    return {
      headline: `${total}/50`,
      level,
      interpretation: `${total}/50 (${percent} %) — ${lecture}. Une évolution de 7 points signe un changement réel.`,
      details: [{ label: 'Sections cotées', value: `${sections}/10` }],
    }
  },
}

const HIT6_OPTIONS = [
  { label: 'Jamais', value: 6 },
  { label: 'Rarement', value: 8 },
  { label: 'Parfois', value: 10 },
  { label: 'Très souvent', value: 11 },
  { label: 'Toujours', value: 13 },
]

/** HIT-6 : impact des céphalées sur les quatre dernières semaines. */
const hit6: ClinicalQuestionnaire = {
  id: 'hit-6',
  name: 'Headache Impact Test',
  abbreviation: 'HIT-6',
  category: 'cervical',
  purpose: 'Retentissement des céphalées sur la vie quotidienne des 4 dernières semaines.',
  source: 'Kosinski et al., Qual Life Res 2003 — score de 36 à 78, seuil d\'impact important à 56.',
  target: 'anamnesis',
  keywords: ['céphalée', 'migraine', 'mal de tête'],
  items: [
    {
      id: 'severite',
      section: 'Au cours des 4 dernières semaines',
      text: 'Quand vous avez des maux de tête, la douleur est-elle sévère ?',
      options: HIT6_OPTIONS,
    },
    {
      id: 'activites',
      text: 'Vos maux de tête limitent-ils vos activités quotidiennes (travail, tâches ménagères, études, vie sociale) ?',
      options: HIT6_OPTIONS,
    },
    {
      id: 'allonger',
      text: 'Quand vous avez mal à la tête, souhaitez-vous pouvoir vous allonger ?',
      options: HIT6_OPTIONS,
    },
    {
      id: 'fatigue',
      text: 'Vous êtes-vous senti(e) trop fatigué(e) pour travailler ou pour vos activités quotidiennes à cause de vos maux de tête ?',
      options: HIT6_OPTIONS,
    },
    {
      id: 'irritabilite',
      text: 'Vous êtes-vous senti(e) excédé(e) ou irrité(e) à cause de vos maux de tête ?',
      options: HIT6_OPTIONS,
    },
    {
      id: 'concentration',
      text: 'Vos maux de tête ont-ils limité votre capacité à vous concentrer sur votre travail ou vos activités quotidiennes ?',
      options: HIT6_OPTIONS,
    },
  ],
  score: (answers) => {
    const total = sum(answers, itemIds(hit6))
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      total,
      [
        { upTo: 49, result: 'low' },
        { upTo: 55, result: 'moderate' },
        { upTo: 59, result: 'high' },
      ],
      'critical',
    )
    const lecture = band(
      total,
      [
        { upTo: 49, result: 'impact faible ou nul sur la vie quotidienne' },
        { upTo: 55, result: 'impact modéré' },
        { upTo: 59, result: 'impact important' },
      ],
      'impact très important : les céphalées dominent le quotidien, avis médical recommandé',
    )
    return {
      headline: `${total}/78`,
      level,
      interpretation: `${total}/78 — ${lecture}.`,
    }
  },
}

/**
 * Règle canadienne du rachis cervical : trois étapes enchaînées, d'où une
 * cotation par règle. Elle ne s'applique qu'au patient vigilant et stable
 * après traumatisme.
 */
const canadianCSpine: ClinicalQuestionnaire = {
  id: 'canadian-c-spine',
  name: 'Canadian C-Spine Rule',
  abbreviation: 'C-Spine',
  category: 'drapeaux-rouges',
  purpose: 'Décide de la nécessité d\'une imagerie cervicale après traumatisme.',
  source: 'Stiell et al., JAMA 2001 — patient vigilant (Glasgow 15) et stable sur le plan hémodynamique.',
  target: 'examination',
  keywords: ['traumatisme', 'whiplash', 'coup du lapin', 'imagerie', 'radiographie', 'cervical'],
  items: [
    {
      id: 'age65',
      section: 'Étape 1 — facteurs de haut risque imposant l\'imagerie',
      text: 'Âge de 65 ans ou plus',
      options: yesNo(),
    },
    {
      id: 'mecanisme',
      text: 'Mécanisme dangereux (chute de plus d\'un mètre ou de 5 marches, plongeon, choc à plus de 100 km/h, éjection, accident de deux-roues motorisé)',
      options: yesNo(),
    },
    { id: 'paresthesies', text: 'Paresthésies des extrémités', options: yesNo() },
    {
      id: 'choc-arriere',
      section: 'Étape 2 — facteurs de bas risque autorisant à tester la mobilité',
      text: 'Simple collision par l\'arrière (hors poids lourd, bus, véhicule projeté ou à grande vitesse)',
      options: yesNo(),
    },
    { id: 'assis', text: 'Patient en position assise à son arrivée', options: yesNo() },
    { id: 'ambulatoire', text: 'Patient ayant pu marcher à un moment quelconque depuis le traumatisme', options: yesNo() },
    { id: 'douleur-retardee', text: 'Douleur cervicale d\'apparition retardée', options: yesNo() },
    { id: 'sans-douleur-mediane', text: 'Absence de douleur à la palpation de la ligne médiane cervicale postérieure', options: yesNo() },
    {
      id: 'rotation',
      section: 'Étape 3 — mobilité active',
      text: 'Le patient peut tourner activement la tête de 45° à droite et à gauche',
      options: yesNo(),
    },
  ],
  score: (answers) => {
    const hautRisque = positiveItems(canadianCSpine, answers).filter((item) =>
      ['age65', 'mecanisme', 'paresthesies'].includes(item.id),
    )
    const basRisque = positiveItems(canadianCSpine, answers).filter((item) =>
      ['choc-arriere', 'assis', 'ambulatoire', 'douleur-retardee', 'sans-douleur-mediane'].includes(item.id),
    )
    const rotationOk = (answers.rotation ?? 0) > 0

    if (hautRisque.length > 0) {
      return {
        headline: 'Imagerie indiquée',
        level: 'critical',
        interpretation: `Facteur de haut risque présent (${hautRisque.map((item) => item.text.toLowerCase()).join(', ')}) : imagerie cervicale nécessaire, aucune technique cervicale avant élimination d\'une lésion.`,
      }
    }
    if (basRisque.length === 0) {
      return {
        headline: 'Imagerie indiquée',
        level: 'critical',
        interpretation: 'Aucun facteur de bas risque : la mobilité cervicale ne peut pas être testée en sécurité, imagerie cervicale nécessaire.',
      }
    }
    if (!rotationOk) {
      return {
        headline: 'Imagerie indiquée',
        level: 'critical',
        interpretation: 'Rotation active de 45° impossible d\'un côté ou des deux : imagerie cervicale nécessaire.',
      }
    }
    return {
      headline: 'Imagerie non indiquée',
      level: 'low',
      interpretation: 'Règle négative : aucun facteur de haut risque, au moins un facteur de bas risque et rotation active de 45° bilatérale conservée. Imagerie cervicale non requise selon la règle.',
      details: [{ label: 'Facteurs de bas risque', value: basRisque.map((item) => item.text.toLowerCase()).join(' ; ') }],
    }
  },
}

export const cervicalQuestionnaires: ClinicalQuestionnaire[] = [ndi, hit6, canadianCSpine]
