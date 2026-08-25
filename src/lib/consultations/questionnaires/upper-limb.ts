import { type ClinicalQuestionnaire, answered, band, itemIds, numeric, ordinal, sum } from './types'

const DIFFICULTE = ordinal(
  ['Aucune difficulté', 'Difficulté légère', 'Difficulté moyenne', 'Difficulté importante', 'Impossible'],
  1,
)

/** QuickDASH : version courte du DASH, cotée de 0 (aucune gêne) à 100. */
const quickDash: ClinicalQuestionnaire = {
  id: 'quick-dash',
  name: 'QuickDASH',
  abbreviation: 'QuickDASH',
  category: 'membre-superieur',
  purpose: 'Gêne fonctionnelle du membre supérieur, cotée de 0 à 100.',
  source: 'Beaton et al., J Bone Joint Surg 2005 — au moins 10 items sur 11 sont nécessaires. Différence cliniquement pertinente : 8 points.',
  target: 'anamnesis',
  keywords: ['épaule', 'coude', 'poignet', 'main', 'DASH', 'bras'],
  minAnswers: 10,
  items: [
    {
      id: 'bocal',
      section: 'Capacité à effectuer les activités suivantes au cours de la semaine passée',
      text: 'Ouvrir un bocal neuf ou dont le couvercle est serré',
      options: DIFFICULTE,
    },
    { id: 'menage', text: 'Effectuer des tâches ménagères lourdes (laver les murs, les sols)', options: DIFFICULTE },
    { id: 'sac', text: 'Porter un sac à provisions ou une mallette', options: DIFFICULTE },
    { id: 'dos', text: 'Se laver le dos', options: DIFFICULTE },
    { id: 'couteau', text: 'Couper la nourriture avec un couteau', options: DIFFICULTE },
    {
      id: 'loisirs',
      text: 'Activités de loisir demandant de la force ou exposant à des chocs au niveau de l\'épaule, du bras ou de la main (bricolage, tennis, golf…)',
      options: DIFFICULTE,
    },
    {
      id: 'social',
      text: 'À quel point votre épaule, votre bras ou votre main vous ont-ils gêné(e) dans vos relations avec votre famille, vos amis ou vos voisins ?',
      options: ordinal(['Pas du tout', 'Un peu', 'Moyennement', 'Beaucoup', 'Extrêmement'], 1),
    },
    {
      id: 'travail',
      text: 'Avez-vous été limité(e) dans votre travail ou une autre activité quotidienne à cause de votre problème d\'épaule, de bras ou de main ?',
      options: ordinal(
        ['Pas limité(e) du tout', 'Un peu limité(e)', 'Moyennement limité(e)', 'Très limité(e)', 'Incapable'],
        1,
      ),
    },
    {
      id: 'douleur',
      section: 'Intensité des symptômes au cours de la semaine passée',
      text: 'Douleur de l\'épaule, du bras ou de la main',
      options: ordinal(['Aucune', 'Légère', 'Moyenne', 'Importante', 'Extrême'], 1),
    },
    {
      id: 'picotements',
      text: 'Picotements ou fourmillements douloureux de l\'épaule, du bras ou de la main',
      options: ordinal(['Aucun', 'Légers', 'Moyens', 'Importants', 'Extrêmes'], 1),
    },
    {
      id: 'sommeil',
      text: 'Difficulté à dormir à cause de la douleur de l\'épaule, du bras ou de la main',
      options: ordinal(
        [
          'Aucune difficulté',
          'Difficulté légère',
          'Difficulté moyenne',
          'Difficulté importante',
          'Tellement difficile que je ne peux pas dormir',
        ],
        1,
      ),
    },
  ],
  score: (answers) => {
    const ids = itemIds(quickDash)
    const repondus = answered(answers, ids)
    const total = sum(answers, ids)
    const score = repondus > 0 ? ((total / repondus - 1) * 25) : 0
    const arrondi = Math.round(score * 10) / 10
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      arrondi,
      [
        { upTo: 20, result: 'low' },
        { upTo: 40, result: 'moderate' },
        { upTo: 60, result: 'high' },
      ],
      'critical',
    )
    const lecture = band(
      arrondi,
      [
        { upTo: 20, result: 'gêne fonctionnelle minime' },
        { upTo: 40, result: 'gêne fonctionnelle modérée' },
        { upTo: 60, result: 'gêne fonctionnelle importante' },
      ],
      'gêne fonctionnelle majeure du membre supérieur',
    )
    return {
      headline: `${arrondi}/100`,
      level,
      interpretation: `${arrondi}/100 — ${lecture} (0 = aucune gêne, 100 = gêne extrême). Une évolution de 8 points signe un changement réel.`,
      details: [{ label: 'Items cotés', value: `${repondus}/11` }],
    }
  },
}

const SPADI_PAIN_IDS = ['pire', 'couche', 'etagere', 'nuque', 'pousser']
const SPADI_DISABILITY_IDS = [
  'cheveux',
  'dos',
  'pull',
  'chemise',
  'pantalon',
  'poser',
  'porter',
  'poche',
]

/** SPADI : douleur et incapacité d'épaule, chaque item coté de 0 à 10. */
const spadi: ClinicalQuestionnaire = {
  id: 'spadi',
  name: 'Shoulder Pain and Disability Index',
  abbreviation: 'SPADI',
  category: 'membre-superieur',
  purpose: 'Douleur et incapacité de l\'épaule, avec deux sous-scores en pourcentage.',
  source: 'Roach et al., Arthritis Care Res 1991 — score global = moyenne des sous-scores douleur et incapacité. Différence cliniquement pertinente : 8 à 13 points.',
  target: 'anamnesis',
  keywords: ['épaule', 'coiffe', 'tendinopathie', 'capsulite'],
  items: [
    {
      id: 'pire',
      section: 'Douleur — à quel point la douleur a-t-elle été forte cette semaine (0 = aucune, 10 = la pire imaginable) ?',
      text: 'Au pire',
      options: numeric(),
    },
    { id: 'couche', text: 'En vous allongeant du côté atteint', options: numeric() },
    { id: 'etagere', text: 'En attrapant un objet sur une étagère haute', options: numeric() },
    { id: 'nuque', text: 'En touchant l\'arrière de votre nuque', options: numeric() },
    { id: 'pousser', text: 'En poussant avec le bras atteint', options: numeric() },
    {
      id: 'cheveux',
      section: 'Incapacité — quelle difficulté avez-vous eue cette semaine (0 = aucune, 10 = tellement difficile qu\'une aide est nécessaire) ?',
      text: 'Vous laver les cheveux',
      options: numeric(),
    },
    { id: 'dos', text: 'Vous laver le dos', options: numeric() },
    { id: 'pull', text: 'Enfiler un maillot de corps ou un pull', options: numeric() },
    { id: 'chemise', text: 'Mettre une chemise boutonnée sur le devant', options: numeric() },
    { id: 'pantalon', text: 'Mettre votre pantalon', options: numeric() },
    { id: 'poser', text: 'Poser un objet sur une étagère haute', options: numeric() },
    { id: 'porter', text: 'Porter un objet de 5 kg ou plus', options: numeric() },
    { id: 'poche', text: 'Sortir un objet de votre poche arrière', options: numeric() },
  ],
  score: (answers) => {
    const douleur = (sum(answers, SPADI_PAIN_IDS) / 50) * 100
    const incapacite = (sum(answers, SPADI_DISABILITY_IDS) / 80) * 100
    const global = Math.round(((douleur + incapacite) / 2) * 10) / 10
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      global,
      [
        { upTo: 20, result: 'low' },
        { upTo: 40, result: 'moderate' },
        { upTo: 60, result: 'high' },
      ],
      'critical',
    )
    const lecture = band(
      global,
      [
        { upTo: 20, result: 'atteinte minime' },
        { upTo: 40, result: 'atteinte modérée' },
        { upTo: 60, result: 'atteinte importante' },
      ],
      'atteinte majeure de l\'épaule',
    )
    return {
      headline: `${global} %`,
      level,
      interpretation: `${global} % — ${lecture} (0 % = épaule indolore et fonctionnelle, 100 % = atteinte maximale).`,
      details: [
        { label: 'Sous-score douleur', value: `${Math.round(douleur * 10) / 10} %` },
        { label: 'Sous-score incapacité', value: `${Math.round(incapacite * 10) / 10} %` },
      ],
    }
  },
}

export const upperLimbQuestionnaires: ClinicalQuestionnaire[] = [quickDash, spadi]
