import {
  type ClinicalQuestionnaire,
  type QuestionnaireItem,
  answered,
  band,
  itemIds,
  ordinal,
  positiveItems,
  sum,
  yesNo,
} from './types'

/** Les dix sections de l'Oswestry, chacune cotée de 0 à 5. */
const ODI_SECTIONS: { id: string; text: string; options: string[] }[] = [
  {
    id: 'douleur',
    text: 'Intensité de la douleur',
    options: [
      'Je n\'ai pas mal en ce moment',
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
    text: 'Soulever des charges',
    options: [
      'Je peux soulever des charges lourdes sans augmenter la douleur',
      'Je peux soulever des charges lourdes, mais cela augmente la douleur',
      'La douleur m\'empêche de soulever des charges lourdes du sol, mais j\'y arrive si elles sont bien placées (sur une table)',
      'La douleur m\'empêche de soulever des charges lourdes ; je soulève des charges légères à moyennes bien placées',
      'Je ne peux soulever que des charges très légères',
      'Je ne peux ni soulever ni porter quoi que ce soit',
    ],
  },
  {
    id: 'marche',
    text: 'Marche',
    options: [
      'La douleur ne limite pas la distance que je peux parcourir',
      'La douleur m\'empêche de marcher plus de 1,5 km',
      'La douleur m\'empêche de marcher plus de 750 m',
      'La douleur m\'empêche de marcher plus de 100 m',
      'Je ne peux marcher qu\'avec une canne ou des béquilles',
      'Je reste au lit la plupart du temps et je me traîne jusqu\'aux toilettes',
    ],
  },
  {
    id: 'assis',
    text: 'Position assise',
    options: [
      'Je peux rester assis(e) sur n\'importe quel siège aussi longtemps que je veux',
      'Je peux rester assis(e) aussi longtemps que je veux sur mon siège préféré',
      'La douleur m\'empêche de rester assis(e) plus d\'une heure',
      'La douleur m\'empêche de rester assis(e) plus de 30 minutes',
      'La douleur m\'empêche de rester assis(e) plus de 10 minutes',
      'La douleur m\'empêche de m\'asseoir',
    ],
  },
  {
    id: 'debout',
    text: 'Position debout',
    options: [
      'Je peux rester debout aussi longtemps que je veux sans augmenter la douleur',
      'Je peux rester debout aussi longtemps que je veux, mais cela augmente la douleur',
      'La douleur m\'empêche de rester debout plus d\'une heure',
      'La douleur m\'empêche de rester debout plus de 30 minutes',
      'La douleur m\'empêche de rester debout plus de 10 minutes',
      'La douleur m\'empêche de rester debout',
    ],
  },
  {
    id: 'sommeil',
    text: 'Sommeil',
    options: [
      'Mon sommeil n\'est jamais perturbé par la douleur',
      'Mon sommeil est parfois perturbé par la douleur',
      'À cause de la douleur, je dors moins de 6 heures',
      'À cause de la douleur, je dors moins de 4 heures',
      'À cause de la douleur, je dors moins de 2 heures',
      'La douleur m\'empêche complètement de dormir',
    ],
  },
  {
    id: 'sexualite',
    text: 'Vie sexuelle (section facultative)',
    options: [
      'Ma vie sexuelle est normale et n\'augmente pas la douleur',
      'Ma vie sexuelle est normale mais augmente la douleur',
      'Ma vie sexuelle est presque normale mais très douloureuse',
      'Ma vie sexuelle est fortement limitée par la douleur',
      'Ma vie sexuelle est presque inexistante à cause de la douleur',
      'La douleur m\'interdit toute vie sexuelle',
    ],
  },
  {
    id: 'social',
    text: 'Vie sociale',
    options: [
      'Ma vie sociale est normale et n\'augmente pas la douleur',
      'Ma vie sociale est normale mais augmente la douleur',
      'La douleur ne modifie ma vie sociale que pour les activités physiques (sport…)',
      'La douleur a limité ma vie sociale : je sors moins souvent',
      'La douleur limite ma vie sociale à mon domicile',
      'Je n\'ai plus de vie sociale à cause de la douleur',
    ],
  },
  {
    id: 'deplacements',
    text: 'Déplacements et trajets',
    options: [
      'Je peux me déplacer partout sans augmenter la douleur',
      'Je peux me déplacer partout, mais cela augmente la douleur',
      'La douleur est pénible mais je supporte des trajets de plus de 2 heures',
      'La douleur me limite à des trajets de moins d\'une heure',
      'La douleur me limite aux trajets indispensables de moins de 30 minutes',
      'La douleur m\'empêche tout déplacement, sauf pour aller consulter',
    ],
  },
]

const odiItems: QuestionnaireItem[] = ODI_SECTIONS.map((section) => ({
  id: section.id,
  text: section.text,
  options: ordinal(section.options),
}))

/**
 * Oswestry : le score est un pourcentage d'incapacité rapporté aux seules
 * sections renseignées, ce qui autorise à laisser de côté une section sans
 * objet (la vie sexuelle, le plus souvent) sans fausser le résultat.
 */
const odi: ClinicalQuestionnaire = {
  id: 'odi',
  name: 'Oswestry Disability Index',
  abbreviation: 'ODI',
  category: 'lombaire',
  purpose: 'Retentissement fonctionnel d\'une lombalgie, en pourcentage d\'incapacité.',
  source: 'Fairbank & Pynsent, Spine 2000 — version 2.1a. Différence cliniquement pertinente : 10 points.',
  target: 'anamnesis',
  keywords: ['lombalgie', 'incapacité', 'fonction', 'dos'],
  minAnswers: 9,
  items: odiItems,
  score: (answers) => {
    const ids = itemIds(odi)
    const sections = answered(answers, ids)
    const total = sum(answers, ids)
    const percent = sections > 0 ? Math.round((total / (sections * 5)) * 100) : 0
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      percent,
      [
        { upTo: 20, result: 'low' },
        { upTo: 40, result: 'moderate' },
        { upTo: 60, result: 'high' },
      ],
      'critical',
    )
    const lecture = band(
      percent,
      [
        { upTo: 20, result: 'incapacité minime : gestion par les conseils, l\'activité et l\'hygiène de vie' },
        { upTo: 40, result: 'incapacité modérée : douleur et gêne dans les activités quotidiennes, prise en charge conservatrice indiquée' },
        { upTo: 60, result: 'incapacité sévère : la douleur est le problème principal, bilan approfondi nécessaire' },
        { upTo: 80, result: 'handicap majeur : retentissement important sur tous les aspects de la vie quotidienne' },
      ],
      'patient alité ou majoration des symptômes : évaluation médicale requise',
    )
    return {
      headline: `${percent} %`,
      level,
      interpretation: `${percent} % d'incapacité — ${lecture}.`,
      details: [
        { label: 'Score brut', value: `${total}/${sections * 5}` },
        { label: 'Sections cotées', value: `${sections}/10` },
      ],
    }
  },
}

const EIFEL_ITEMS = [
  'Je reste à la maison la plupart du temps à cause de mon dos',
  'Je change souvent de position pour soulager mon dos',
  'Je marche plus lentement que d\'habitude à cause de mon dos',
  'À cause de mon dos, je n\'effectue aucune des tâches que je fais d\'habitude à la maison',
  'À cause de mon dos, je m\'aide de la rampe pour monter les escaliers',
  'À cause de mon dos, je m\'allonge plus souvent pour me reposer',
  'À cause de mon dos, je suis obligé(e) de prendre un appui pour sortir d\'un fauteuil',
  'À cause de mon dos, j\'essaie d\'obtenir que d\'autres personnes fassent les choses à ma place',
  'Je m\'habille plus lentement que d\'habitude à cause de mon dos',
  'Je ne reste debout que de courts moments à cause de mon dos',
  'À cause de mon dos, j\'essaie de ne pas me baisser ni de m\'agenouiller',
  'J\'ai du mal à me lever d\'une chaise à cause de mon dos',
  'J\'ai mal au dos la plupart du temps',
  'J\'ai du mal à me retourner dans mon lit à cause de mon dos',
  'J\'ai moins d\'appétit à cause de mon mal de dos',
  'J\'ai du mal à mettre mes chaussettes (ou bas, ou collants) à cause de mon dos',
  'Je ne peux marcher que sur de courtes distances à cause de mon mal de dos',
  'Je dors moins bien à cause de mon dos',
  'À cause de mon mal de dos, je m\'habille avec de l\'aide',
  'Je reste assis(e) la plus grande partie de la journée à cause de mon dos',
  'J\'évite de faire de gros travaux à la maison à cause de mon dos',
  'À cause de mon mal de dos, je suis plus irritable et de moins bonne humeur que d\'habitude',
  'À cause de mon dos, je monte les escaliers plus lentement que d\'habitude',
  'Je reste au lit la plupart du temps à cause de mon dos',
]

/** EIFEL : adaptation française du Roland-Morris, 24 propositions vrai/faux. */
const eifel: ClinicalQuestionnaire = {
  id: 'eifel',
  name: 'Échelle d\'incapacité fonctionnelle pour l\'évaluation des lombalgies',
  abbreviation: 'EIFEL',
  category: 'lombaire',
  purpose: 'Incapacité fonctionnelle du lombalgique, cotée sur 24 propositions du jour même.',
  source: 'Coste et al., Rev Rhum 1993 — adaptation française du Roland-Morris. Différence cliniquement pertinente : 4 à 5 points.',
  target: 'anamnesis',
  keywords: ['lombalgie', 'Roland-Morris', 'incapacité', 'dos'],
  items: EIFEL_ITEMS.map((text, index) => ({
    id: `q${index + 1}`,
    text,
    section: index === 0 ? 'Cochez « Oui » pour chaque proposition qui décrit votre journée d\'aujourd\'hui' : undefined,
    options: yesNo(),
  })),
  score: (answers) => {
    const total = sum(answers, itemIds(eifel))
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      total,
      [
        { upTo: 4, result: 'low' },
        { upTo: 9, result: 'moderate' },
        { upTo: 14, result: 'high' },
      ],
      'critical',
    )
    const lecture = band(
      total,
      [
        { upTo: 4, result: 'retentissement minime sur la vie quotidienne' },
        { upTo: 9, result: 'retentissement léger' },
        { upTo: 14, result: 'retentissement modéré' },
        { upTo: 19, result: 'retentissement important' },
      ],
      'retentissement majeur, patient très limité au quotidien',
    )
    return {
      headline: `${total}/24`,
      level,
      interpretation: `${total}/24 — ${lecture}. Une évolution de 4 à 5 points entre deux séances signe un changement réel.`,
    }
  },
}

/** STarT Back : stratification du risque de passage à la chronicité. */
const startBack: ClinicalQuestionnaire = {
  id: 'start-back',
  name: 'STarT Back Screening Tool',
  abbreviation: 'STarT Back',
  category: 'lombaire',
  purpose: 'Stratifie le risque de chronicisation d\'une lombalgie en trois niveaux.',
  source: 'Hill et al., Arthritis Rheum 2008 — sous-score psychosocial sur les items 5 à 9.',
  target: 'anamnesis',
  keywords: ['lombalgie', 'chronicisation', 'pronostic', 'jaune', 'psychosocial'],
  items: [
    {
      id: 'q1',
      section: 'Ces deux dernières semaines',
      text: 'Ma douleur s\'est propagée dans la ou les jambe(s) à un moment donné',
      options: yesNo(),
    },
    { id: 'q2', text: 'J\'ai eu mal à l\'épaule ou à la nuque à un moment donné', options: yesNo() },
    { id: 'q3', text: 'Je n\'ai marché que sur de courtes distances à cause de mon mal de dos', options: yesNo() },
    { id: 'q4', text: 'Je me suis habillé(e) plus lentement que d\'habitude à cause de mon mal de dos', options: yesNo() },
    {
      id: 'q5',
      section: 'Sous-échelle psychosociale',
      text: 'Ce n\'est vraiment pas prudent, pour une personne dans mon état, d\'être physiquement actif(ve)',
      options: yesNo(),
    },
    { id: 'q6', text: 'Je me suis fait beaucoup de souci à propos de mon mal de dos', options: yesNo() },
    { id: 'q7', text: 'J\'ai l\'impression que mon mal de dos est terrible et que cela ne s\'améliorera jamais', options: yesNo() },
    { id: 'q8', text: 'En général, je n\'ai pas apprécié toutes les choses dont j\'avais l\'habitude de profiter', options: yesNo() },
    {
      id: 'q9',
      text: 'Globalement, à quel point avez-vous été gêné(e) par votre mal de dos ces deux dernières semaines ?',
      help: 'Seules les réponses « Beaucoup » et « Extrêmement » comptent un point',
      options: [
        { label: 'Pas du tout', value: 0 },
        { label: 'Un peu', value: 0 },
        { label: 'Modérément', value: 0 },
        { label: 'Beaucoup', value: 1 },
        { label: 'Extrêmement', value: 1 },
      ],
    },
  ],
  score: (answers) => {
    const total = sum(answers, itemIds(startBack))
    const psychosocial = sum(answers, ['q5', 'q6', 'q7', 'q8', 'q9'])
    if (total <= 3) {
      return {
        headline: 'Risque faible',
        level: 'low',
        interpretation: 'Risque faible de chronicisation : information rassurante, reprise de l\'activité et conseils suffisent généralement.',
        details: [
          { label: 'Score total', value: `${total}/9` },
          { label: 'Sous-score psychosocial', value: `${psychosocial}/5` },
        ],
      }
    }
    if (psychosocial <= 3) {
      return {
        headline: 'Risque moyen',
        level: 'moderate',
        interpretation: 'Risque moyen : le retentissement physique domine. Prise en charge active centrée sur la fonction et le réentraînement.',
        details: [
          { label: 'Score total', value: `${total}/9` },
          { label: 'Sous-score psychosocial', value: `${psychosocial}/5` },
        ],
      }
    }
    return {
      headline: 'Risque élevé',
      level: 'high',
      interpretation: 'Risque élevé : facteurs psychosociaux au premier plan (peur du mouvement, catastrophisme, humeur). Prise en charge combinant traitement actif et abord cognitif, réévaluation rapprochée.',
      details: [
        { label: 'Score total', value: `${total}/9` },
        { label: 'Sous-score psychosocial', value: `${psychosocial}/5` },
      ],
    }
  },
}

/**
 * Drapeaux rouges lombaires : ce n'est pas une échelle mais une liste de
 * vérification. Tout item positif suffit à orienter, d'où une cotation par
 * règle plutôt que par somme.
 */
const lumbarRedFlags: ClinicalQuestionnaire = {
  id: 'drapeaux-rouges-lombaires',
  name: 'Drapeaux rouges de la lombalgie',
  abbreviation: 'Drapeaux rouges',
  category: 'drapeaux-rouges',
  purpose: 'Repère les signes d\'alerte imposant une orientation médicale avant tout traitement.',
  source: 'Recommandations HAS 2019 sur la prise en charge du patient lombalgique.',
  target: 'examination',
  keywords: ['red flags', 'urgence', 'cauda equina', 'fracture', 'infection', 'tumeur'],
  items: [
    {
      id: 'cauda-equina',
      section: 'Signes imposant un avis en urgence',
      text: 'Anesthésie en selle, troubles sphinctériens ou rétention urinaire (syndrome de la queue de cheval)',
      options: yesNo(),
    },
    { id: 'deficit-moteur', text: 'Déficit moteur progressif ou déficit neurologique étendu', options: yesNo() },
    {
      id: 'traumatisme',
      section: 'Signes en faveur d\'une cause spécifique',
      text: 'Traumatisme important, ou traumatisme mineur chez un patient ostéoporotique ou âgé',
      options: yesNo(),
    },
    { id: 'age', text: 'Première lombalgie avant 20 ans ou après 55 ans', options: yesNo() },
    { id: 'cancer', text: 'Antécédent de cancer', options: yesNo() },
    { id: 'amaigrissement', text: 'Amaigrissement inexpliqué, altération de l\'état général', options: yesNo() },
    { id: 'fievre', text: 'Fièvre, frissons, immunodépression, toxicomanie intraveineuse', options: yesNo() },
    { id: 'nocturne', text: 'Douleur strictement nocturne, non soulagée par le décubitus', options: yesNo() },
    { id: 'inflammatoire', text: 'Raideur matinale de plus de 30 minutes, réveils en seconde partie de nuit (rythme inflammatoire)', options: yesNo() },
    { id: 'corticoides', text: 'Corticothérapie prolongée', options: yesNo() },
  ],
  score: (answers) => {
    const positifs = positiveItems(lumbarRedFlags, answers)
    const urgence = (answers['cauda-equina'] ?? 0) > 0 || (answers['deficit-moteur'] ?? 0) > 0
    if (urgence) {
      return {
        headline: 'Orientation urgente',
        level: 'critical',
        interpretation: 'Signe neurologique d\'alerte présent : pas de traitement manuel, orientation médicale en urgence.',
        details: [{ label: 'Drapeaux relevés', value: positifs.map((item) => item.text).join(' ; ') }],
      }
    }
    if (positifs.length > 0) {
      return {
        headline: `${positifs.length} drapeau${positifs.length > 1 ? 'x' : ''} rouge${positifs.length > 1 ? 's' : ''}`,
        level: 'high',
        interpretation: 'Au moins un drapeau rouge : rechercher une cause spécifique et adresser au médecin traitant avant de poursuivre.',
        details: [{ label: 'Drapeaux relevés', value: positifs.map((item) => item.text).join(' ; ') }],
      }
    }
    return {
      headline: 'Aucun drapeau rouge',
      level: 'low',
      interpretation: 'Aucun drapeau rouge relevé : lombalgie commune, prise en charge conservatrice possible.',
    }
  },
}

export const lumbarQuestionnaires: ClinicalQuestionnaire[] = [odi, eifel, startBack, lumbarRedFlags]
