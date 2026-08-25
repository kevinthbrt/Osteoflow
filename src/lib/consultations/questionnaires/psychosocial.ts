import { type ClinicalQuestionnaire, band, itemIds, ordinal, sum } from './types'

const TSK_ITEMS = [
  'J\'ai peur de me blesser si je fais de l\'exercice physique',
  'Si je passais outre ma douleur, elle augmenterait',
  'Mon corps me dit que quelque chose ne va vraiment pas chez moi',
  'On ne prend pas mon problème de santé suffisamment au sérieux',
  'Mon accident ou mon problème a mis mon corps en danger pour le restant de mes jours',
  'La douleur signifie toujours que je me suis blessé(e)',
  'Faire simplement attention à ne pas effectuer de mouvements inutiles est ce que je peux faire de plus sûr pour éviter que ma douleur n\'augmente',
  'Je n\'aurais pas autant mal s\'il ne se passait pas quelque chose de potentiellement dangereux dans mon corps',
  'La douleur me prévient qu\'il faut arrêter l\'exercice pour ne pas me blesser',
  'Ce n\'est vraiment pas prudent, pour une personne dans mon état, d\'être physiquement actif(ve)',
  'Je ne peux pas faire tout ce que font les gens normaux, parce que je me blesse trop facilement',
]

const ACCORD = ordinal(
  ['Pas du tout d\'accord', 'Pas d\'accord', 'D\'accord', 'Tout à fait d\'accord'],
  1,
)

/** TSK-11 : peur du mouvement, sans item inversé (contrairement au TSK-17). */
const tsk11: ClinicalQuestionnaire = {
  id: 'tsk-11',
  name: 'Échelle de kinésiophobie de Tampa (11 items)',
  abbreviation: 'TSK-11',
  category: 'psychosocial',
  purpose: 'Peur du mouvement et croyances d\'évitement, cotée de 11 à 44.',
  source: 'Woby et al., Pain 2005 — seuil usuel de kinésiophobie élevée : score supérieur à 25.',
  target: 'anamnesis',
  keywords: ['kinésiophobie', 'peur', 'évitement', 'croyances', 'chronicisation'],
  items: TSK_ITEMS.map((text, index) => ({
    id: `q${index + 1}`,
    text,
    section: index === 0 ? 'Dans quelle mesure êtes-vous d\'accord avec chaque affirmation ?' : undefined,
    options: ACCORD,
  })),
  score: (answers) => {
    const total = sum(answers, itemIds(tsk11))
    const eleve = total > 25
    return {
      headline: `${total}/44`,
      level: eleve ? 'high' : 'low',
      interpretation: eleve
        ? `${total}/44 — kinésiophobie élevée : les croyances d'évitement freinent la reprise du mouvement. Éducation à la douleur et exposition graduée à privilégier.`
        : `${total}/44 — kinésiophobie faible : pas de frein majeur à la reprise de l'activité.`,
    }
  },
}

const PCS_ITEMS = [
  'J\'ai peur qu\'il n\'y ait pas de fin à la douleur',
  'Je sens que je ne peux plus continuer',
  'C\'est terrible et je pense que ça ne va jamais aller mieux',
  'C\'est affreux et je sens que la douleur me domine',
  'Je sens que je ne peux plus supporter la douleur',
  'J\'ai peur que la douleur empire',
  'Je pense sans arrêt à d\'autres expériences douloureuses',
  'J\'attends avec impatience que la douleur cesse',
  'Je ne peux m\'empêcher d\'y penser',
  'Je pense sans arrêt à quel point ça fait mal',
  'Je pense sans arrêt à quel point j\'ai envie que la douleur cesse',
  'Il n\'y a rien que je puisse faire pour réduire l\'intensité de la douleur',
  'Je me demande si quelque chose de grave peut se produire',
]

const FREQUENCE = ordinal(['Pas du tout', 'Un peu', 'Modérément', 'Beaucoup', 'Tout le temps'])

/** PCS : dramatisation de la douleur, avec ses trois sous-échelles. */
const pcs: ClinicalQuestionnaire = {
  id: 'pcs',
  name: 'Échelle de dramatisation de la douleur',
  abbreviation: 'PCS',
  category: 'psychosocial',
  purpose: 'Rumination, amplification et impuissance face à la douleur, cotées sur 52.',
  source: 'Sullivan et al., Psychol Assess 1995 — seuil de pertinence clinique : 30/52.',
  target: 'anamnesis',
  keywords: ['catastrophisme', 'dramatisation', 'rumination', 'chronicisation'],
  items: PCS_ITEMS.map((text, index) => ({
    id: `q${index + 1}`,
    text,
    section: index === 0 ? 'Quand j\'ai mal…' : undefined,
    options: FREQUENCE,
  })),
  score: (answers) => {
    const total = sum(answers, itemIds(pcs))
    const rumination = sum(answers, ['q8', 'q9', 'q10', 'q11'])
    const amplification = sum(answers, ['q6', 'q7', 'q13'])
    const impuissance = sum(answers, ['q1', 'q2', 'q3', 'q4', 'q5', 'q12'])
    const eleve = total >= 30
    return {
      headline: `${total}/52`,
      level: eleve ? 'high' : band<'low' | 'moderate'>(total, [{ upTo: 19, result: 'low' }], 'moderate'),
      interpretation: eleve
        ? `${total}/52 — dramatisation cliniquement significative : facteur de risque reconnu de chronicisation et de mauvaise réponse au traitement.`
        : `${total}/52 — dramatisation en dessous du seuil de pertinence clinique (30/52).`,
      details: [
        { label: 'Rumination', value: `${rumination}/16` },
        { label: 'Amplification', value: `${amplification}/12` },
        { label: 'Impuissance', value: `${impuissance}/24` },
      ],
    }
  },
}

const HADS_ANXIETY_IDS = ['a1', 'a3', 'a5', 'a7', 'a9', 'a11', 'a13']
const HADS_DEPRESSION_IDS = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12', 'd14']

/** Lecture commune aux deux sous-échelles de la HADS. */
function hadsBand(score: number): { level: 'low' | 'moderate' | 'high'; label: string } {
  if (score <= 7) return { level: 'low', label: 'absence de symptomatologie' }
  if (score <= 10) return { level: 'moderate', label: 'symptomatologie douteuse' }
  return { level: 'high', label: 'symptomatologie certaine' }
}

/** HADS : anxiété et dépression, deux sous-scores de 0 à 21 lus séparément. */
const hads: ClinicalQuestionnaire = {
  id: 'hads',
  name: 'Hospital Anxiety and Depression Scale',
  abbreviation: 'HADS',
  category: 'psychosocial',
  purpose: 'Dépiste anxiété et dépression, chaque sous-échelle cotée sur 21.',
  source: 'Zigmond & Snaith, Acta Psychiatr Scand 1983 — par sous-échelle : 0-7 absence, 8-10 douteux, 11-21 certain.',
  target: 'anamnesis',
  keywords: ['anxiété', 'dépression', 'humeur', 'thymie', 'psychologique'],
  items: [
    {
      id: 'a1',
      section: 'Comment vous êtes-vous senti(e) au cours de la semaine passée ?',
      text: 'Je me sens tendu(e) ou énervé(e)',
      options: [
        { label: 'Jamais', value: 0 },
        { label: 'De temps en temps', value: 1 },
        { label: 'Souvent', value: 2 },
        { label: 'La plupart du temps', value: 3 },
      ],
    },
    {
      id: 'd2',
      text: 'Je prends plaisir aux mêmes choses qu\'autrefois',
      options: [
        { label: 'Oui, tout autant', value: 0 },
        { label: 'Pas autant', value: 1 },
        { label: 'Un peu seulement', value: 2 },
        { label: 'Presque plus', value: 3 },
      ],
    },
    {
      id: 'a3',
      text: 'J\'ai une sensation de peur, comme si quelque chose d\'horrible allait m\'arriver',
      options: [
        { label: 'Pas du tout', value: 0 },
        { label: 'Un peu, mais cela ne m\'inquiète pas', value: 1 },
        { label: 'Oui, mais ce n\'est pas trop grave', value: 2 },
        { label: 'Oui, très nettement', value: 3 },
      ],
    },
    {
      id: 'd4',
      text: 'Je ris facilement et vois le bon côté des choses',
      options: [
        { label: 'Autant que par le passé', value: 0 },
        { label: 'Plus autant qu\'avant', value: 1 },
        { label: 'Vraiment moins qu\'avant', value: 2 },
        { label: 'Plus du tout', value: 3 },
      ],
    },
    {
      id: 'a5',
      text: 'Je me fais du souci',
      options: [
        { label: 'Très occasionnellement', value: 0 },
        { label: 'Occasionnellement', value: 1 },
        { label: 'Assez souvent', value: 2 },
        { label: 'Très souvent', value: 3 },
      ],
    },
    {
      id: 'd6',
      text: 'Je suis de bonne humeur',
      options: [
        { label: 'La plupart du temps', value: 0 },
        { label: 'Assez souvent', value: 1 },
        { label: 'Rarement', value: 2 },
        { label: 'Jamais', value: 3 },
      ],
    },
    {
      id: 'a7',
      text: 'Je peux rester tranquillement assis(e) à ne rien faire et me sentir décontracté(e)',
      options: [
        { label: 'Oui, quoi qu\'il arrive', value: 0 },
        { label: 'Oui, en général', value: 1 },
        { label: 'Rarement', value: 2 },
        { label: 'Jamais', value: 3 },
      ],
    },
    {
      id: 'd8',
      text: 'J\'ai l\'impression de fonctionner au ralenti',
      options: [
        { label: 'Jamais', value: 0 },
        { label: 'Parfois', value: 1 },
        { label: 'Très souvent', value: 2 },
        { label: 'Presque toujours', value: 3 },
      ],
    },
    {
      id: 'a9',
      text: 'J\'éprouve des sensations de peur et j\'ai l\'estomac noué',
      options: [
        { label: 'Jamais', value: 0 },
        { label: 'Parfois', value: 1 },
        { label: 'Assez souvent', value: 2 },
        { label: 'Très souvent', value: 3 },
      ],
    },
    {
      id: 'd10',
      text: 'Je ne m\'intéresse plus à mon apparence',
      options: [
        { label: 'J\'y prête autant d\'attention que par le passé', value: 0 },
        { label: 'Il se peut que je n\'y fasse plus autant attention', value: 1 },
        { label: 'Je n\'y accorde pas autant d\'attention que je le devrais', value: 2 },
        { label: 'Plus du tout', value: 3 },
      ],
    },
    {
      id: 'a11',
      text: 'J\'ai la bougeotte et n\'arrive pas à tenir en place',
      options: [
        { label: 'Pas du tout', value: 0 },
        { label: 'Pas tellement', value: 1 },
        { label: 'Un peu', value: 2 },
        { label: 'Oui, c\'est tout à fait le cas', value: 3 },
      ],
    },
    {
      id: 'd12',
      text: 'Je me réjouis d\'avance à l\'idée de faire certaines choses',
      options: [
        { label: 'Autant qu\'avant', value: 0 },
        { label: 'Un peu moins qu\'avant', value: 1 },
        { label: 'Bien moins qu\'avant', value: 2 },
        { label: 'Presque jamais', value: 3 },
      ],
    },
    {
      id: 'a13',
      text: 'J\'éprouve des sensations soudaines de panique',
      options: [
        { label: 'Jamais', value: 0 },
        { label: 'Pas très souvent', value: 1 },
        { label: 'Assez souvent', value: 2 },
        { label: 'Vraiment très souvent', value: 3 },
      ],
    },
    {
      id: 'd14',
      text: 'Je peux prendre plaisir à un bon livre ou à une bonne émission',
      options: [
        { label: 'Souvent', value: 0 },
        { label: 'Parfois', value: 1 },
        { label: 'Rarement', value: 2 },
        { label: 'Très rarement', value: 3 },
      ],
    },
  ],
  score: (answers) => {
    const anxiete = sum(answers, HADS_ANXIETY_IDS)
    const depression = sum(answers, HADS_DEPRESSION_IDS)
    const lectureA = hadsBand(anxiete)
    const lectureD = hadsBand(depression)
    const pire = Math.max(anxiete, depression)
    return {
      headline: `A ${anxiete}/21 · D ${depression}/21`,
      level: hadsBand(pire).level,
      interpretation: `Anxiété ${anxiete}/21 (${lectureA.label}), dépression ${depression}/21 (${lectureD.label}). Un sous-score de 11 ou plus justifie d'en parler avec le médecin traitant.`,
      details: [
        { label: 'Sous-score anxiété', value: `${anxiete}/21 — ${lectureA.label}` },
        { label: 'Sous-score dépression', value: `${depression}/21 — ${lectureD.label}` },
      ],
    }
  },
}

export const psychosocialQuestionnaires: ClinicalQuestionnaire[] = [tsk11, pcs, hads]
