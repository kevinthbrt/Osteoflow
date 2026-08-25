import { type ClinicalQuestionnaire, band, itemIds, ordinal, sum } from './types'

const SEVERITE = ordinal(['Aucune', 'Légère', 'Moyenne', 'Très importante', 'Extrêmement importante'])
const DEGRE = ordinal(['Aucunement', 'Un peu', 'Moyennement', 'Très', 'Extrêmement'])

/** ISI : sévérité de l'insomnie sur les deux dernières semaines. */
const isi: ClinicalQuestionnaire = {
  id: 'isi',
  name: 'Index de sévérité de l\'insomnie',
  abbreviation: 'ISI',
  category: 'sommeil',
  purpose: 'Sévérité de l\'insomnie et de son retentissement, cotée sur 28.',
  source: 'Morin, Insomnia 1993 — 0-7 absence, 8-14 insomnie légère, 15-21 modérée, 22-28 sévère.',
  target: 'anamnesis',
  keywords: ['insomnie', 'sommeil', 'réveils', 'endormissement'],
  items: [
    {
      id: 'endormissement',
      section: 'Sévérité de vos difficultés de sommeil au cours des deux dernières semaines',
      text: 'Difficulté à vous endormir',
      options: SEVERITE,
    },
    { id: 'maintien', text: 'Difficulté à rester endormi(e)', options: SEVERITE },
    { id: 'reveil-precoce', text: 'Problème de réveil trop tôt le matin', options: SEVERITE },
    {
      id: 'satisfaction',
      section: 'Retentissement',
      text: 'À quel point êtes-vous insatisfait(e) de votre sommeil actuel ?',
      options: ordinal(['Très satisfait(e)', 'Satisfait(e)', 'Plutôt neutre', 'Insatisfait(e)', 'Très insatisfait(e)']),
    },
    {
      id: 'fonctionnement',
      text: 'À quel point vos difficultés de sommeil perturbent-elles votre fonctionnement quotidien (fatigue, concentration, humeur) ?',
      options: DEGRE,
    },
    {
      id: 'visibilite',
      text: 'À quel point vos difficultés de sommeil sont-elles perceptibles par les autres ?',
      options: DEGRE,
    },
    {
      id: 'inquietude',
      text: 'À quel point êtes-vous inquiet(ète) ou préoccupé(e) par vos difficultés de sommeil ?',
      options: DEGRE,
    },
  ],
  score: (answers) => {
    const total = sum(answers, itemIds(isi))
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      total,
      [
        { upTo: 7, result: 'low' },
        { upTo: 14, result: 'moderate' },
        { upTo: 21, result: 'high' },
      ],
      'critical',
    )
    const lecture = band(
      total,
      [
        { upTo: 7, result: 'absence d\'insomnie cliniquement significative' },
        { upTo: 14, result: 'insomnie légère (infraclinique)' },
        { upTo: 21, result: 'insomnie modérée' },
      ],
      'insomnie sévère : orientation médicale recommandée',
    )
    return {
      headline: `${total}/28`,
      level,
      interpretation: `${total}/28 — ${lecture}.`,
    }
  },
}

const EPWORTH_SITUATIONS = [
  'Assis(e) en train de lire',
  'En train de regarder la télévision',
  'Assis(e), inactif(ve), dans un lieu public (cinéma, théâtre, réunion)',
  'Comme passager(ère) d\'une voiture roulant sans arrêt pendant une heure',
  'Allongé(e) l\'après-midi pour vous reposer, quand les circonstances le permettent',
  'Assis(e) en train de parler avec quelqu\'un',
  'Assis(e) au calme après un repas sans alcool',
  'Dans une voiture immobilisée quelques minutes dans un embouteillage',
]

/** Épworth : propension à l'assoupissement dans huit situations de la vie courante. */
const epworth: ClinicalQuestionnaire = {
  id: 'epworth',
  name: 'Échelle de somnolence d\'Épworth',
  abbreviation: 'Épworth',
  category: 'sommeil',
  purpose: 'Somnolence diurne excessive, cotée sur 24.',
  source: 'Johns, Sleep 1991 — score supérieur à 10 : somnolence diurne excessive.',
  target: 'anamnesis',
  keywords: ['somnolence', 'apnée', 'fatigue', 'sommeil', 'SAOS'],
  items: EPWORTH_SITUATIONS.map((text, index) => ({
    id: `q${index + 1}`,
    text,
    section:
      index === 0
        ? 'Quelle est votre probabilité de vous assoupir dans les situations suivantes, en dehors d\'une sensation de fatigue liée au manque de sommeil ?'
        : undefined,
    options: ordinal([
      'Aucune chance de m\'assoupir',
      'Faible chance de m\'assoupir',
      'Chance moyenne de m\'assoupir',
      'Forte chance de m\'assoupir',
    ]),
  })),
  score: (answers) => {
    const total = sum(answers, itemIds(epworth))
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      total,
      [
        { upTo: 10, result: 'low' },
        { upTo: 14, result: 'moderate' },
        { upTo: 17, result: 'high' },
      ],
      'critical',
    )
    const lecture = band(
      total,
      [
        { upTo: 10, result: 'pas de somnolence diurne excessive' },
        { upTo: 14, result: 'somnolence diurne légère' },
        { upTo: 17, result: 'somnolence diurne modérée' },
      ],
      'somnolence diurne sévère : rechercher un trouble respiratoire du sommeil, avis médical recommandé',
    )
    return {
      headline: `${total}/24`,
      level,
      interpretation: `${total}/24 — ${lecture}.`,
    }
  },
}

export const sleepQuestionnaires: ClinicalQuestionnaire[] = [isi, epworth]
