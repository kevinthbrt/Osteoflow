import {
  type ClinicalQuestionnaire,
  band,
  itemIds,
  numeric,
  positiveItems,
  sum,
  yesNo,
} from './types'

/** Échelle numérique de la douleur, cotée sur trois temps de mesure. */
const painNumericScale: ClinicalQuestionnaire = {
  id: 'en-douleur',
  name: 'Échelle numérique de la douleur',
  abbreviation: 'EN',
  category: 'douleur',
  purpose: 'Intensité douloureuse actuelle, maximale et habituelle sur les 7 derniers jours.',
  source: 'Échelle numérique (EN/NRS) 0-10 — 0 = aucune douleur, 10 = douleur maximale imaginable.',
  target: 'anamnesis',
  keywords: ['EVA', 'NRS', 'intensité', 'douleur'],
  items: [
    {
      id: 'actuelle',
      text: 'Douleur au moment de la consultation',
      help: '0 = aucune douleur, 10 = douleur maximale imaginable',
      options: numeric(),
    },
    { id: 'maximale', text: 'Douleur la plus forte des 7 derniers jours', options: numeric() },
    { id: 'habituelle', text: 'Douleur habituelle des 7 derniers jours', options: numeric() },
  ],
  score: (answers) => {
    const actuelle = answers.actuelle ?? 0
    const maximale = answers.maximale ?? 0
    const habituelle = answers.habituelle ?? 0
    const moyenne = (actuelle + maximale + habituelle) / 3
    const level = band<'low' | 'moderate' | 'high' | 'critical'>(
      habituelle,
      [
        { upTo: 3, result: 'low' },
        { upTo: 5, result: 'moderate' },
        { upTo: 7, result: 'high' },
      ],
      'critical',
    )
    const intensite = band(
      habituelle,
      [
        { upTo: 0, result: 'absente' },
        { upTo: 3, result: 'légère' },
        { upTo: 5, result: 'modérée' },
        { upTo: 7, result: 'intense' },
      ],
      'très intense',
    )
    return {
      headline: `${actuelle}/10 maintenant`,
      level,
      interpretation: `Douleur habituelle ${intensite} (${habituelle}/10), pic à ${maximale}/10 sur les 7 derniers jours.`,
      details: [
        { label: 'Actuelle', value: `${actuelle}/10` },
        { label: 'Maximale (7 j)', value: `${maximale}/10` },
        { label: 'Habituelle (7 j)', value: `${habituelle}/10` },
        { label: 'Moyenne des trois mesures', value: `${moyenne.toFixed(1)}/10` },
      ],
    }
  },
}

/** DN4 : dépistage de la composante neuropathique, seuil ≥ 4/10. */
const dn4: ClinicalQuestionnaire = {
  id: 'dn4',
  name: 'Douleur neuropathique en 4 questions',
  abbreviation: 'DN4',
  category: 'douleur',
  purpose: 'Dépiste la composante neuropathique d\'une douleur (seuil ≥ 4/10).',
  source: 'Bouhassira et al., Pain 2005 — seuil ≥ 4/10 : sensibilité 83 %, spécificité 90 %.',
  target: 'examination',
  keywords: ['neuropathique', 'brûlure', 'décharge', 'radiculalgie', 'sciatique'],
  items: [
    {
      id: 'brulure',
      section: 'Interrogatoire — la douleur présente-t-elle ces caractéristiques ?',
      text: 'Brûlure',
      options: yesNo(),
    },
    { id: 'froid-douloureux', text: 'Sensation de froid douloureux', options: yesNo() },
    { id: 'decharges', text: 'Décharges électriques', options: yesNo() },
    {
      id: 'fourmillements',
      section: 'Interrogatoire — la douleur est-elle associée, dans la même région, à :',
      text: 'Fourmillements',
      options: yesNo(),
    },
    { id: 'picotements', text: 'Picotements', options: yesNo() },
    { id: 'engourdissement', text: 'Engourdissement', options: yesNo() },
    { id: 'demangeaisons', text: 'Démangeaisons', options: yesNo() },
    {
      id: 'hypoesthesie-tact',
      section: 'Examen — la douleur siège-t-elle dans un territoire où l\'examen retrouve :',
      text: 'Hypoesthésie au tact',
      options: yesNo(),
    },
    { id: 'hypoesthesie-piqure', text: 'Hypoesthésie à la piqûre', options: yesNo() },
    {
      id: 'frottement',
      section: 'Examen — la douleur est-elle provoquée ou augmentée par :',
      text: 'Le frottement',
      options: yesNo(),
    },
  ],
  score: (answers) => {
    const total = sum(answers, itemIds(dn4))
    const positif = total >= 4
    return {
      headline: `${total}/10`,
      level: positif ? 'high' : 'low',
      interpretation: positif
        ? 'Score ≥ 4/10 : douleur neuropathique probable. Une prise en charge purement mécanique risque d\'être insuffisante — orientation médicale à envisager.'
        : 'Score < 4/10 : composante neuropathique peu probable, tableau en faveur d\'une douleur nociceptive.',
      details: [
        {
          label: 'Items positifs',
          value: positiveItems(dn4, answers).map((item) => item.text.toLowerCase()).join(', ') || 'aucun',
        },
      ],
    }
  },
}

/**
 * S-LANSS : versant auto-questionné du dépistage neuropathique, utile quand
 * l'examen sensitif n'est pas réalisable (téléconsultation, douleur diffuse).
 */
const slanss: ClinicalQuestionnaire = {
  id: 's-lanss',
  name: 'S-LANSS (auto-questionnaire de douleur neuropathique)',
  abbreviation: 'S-LANSS',
  category: 'douleur',
  purpose: 'Dépistage neuropathique sans examen sensitif (seuil ≥ 12/24).',
  source: 'Bennett et al., J Pain 2005 — seuil ≥ 12/24 en faveur d\'une douleur à composante neuropathique.',
  target: 'anamnesis',
  keywords: ['neuropathique', 'LANSS', 'allodynie', 'auto-questionnaire'],
  items: [
    {
      id: 'piqures',
      text: 'Douleur ressentie comme des piqûres, des fourmillements ou des épingles',
      options: [
        { label: 'Non', value: 0 },
        { label: 'Oui', value: 5 },
      ],
    },
    {
      id: 'coloration',
      text: 'Modification de la couleur de la peau sur la zone douloureuse (marbrures, rougeur)',
      options: [
        { label: 'Non', value: 0 },
        { label: 'Oui', value: 5 },
      ],
    },
    {
      id: 'sensibilite',
      text: 'Zone anormalement sensible au toucher (effleurer, porter un vêtement est désagréable)',
      options: [
        { label: 'Non', value: 0 },
        { label: 'Oui', value: 3 },
      ],
    },
    {
      id: 'decharges',
      text: 'Douleur qui survient brutalement, par crises, sans raison apparente (décharges, explosions)',
      options: [
        { label: 'Non', value: 0 },
        { label: 'Oui', value: 2 },
      ],
    },
    {
      id: 'brulure',
      text: 'Sensation de chaleur anormale ou de brûlure sur la zone douloureuse',
      options: [
        { label: 'Non', value: 0 },
        { label: 'Oui', value: 1 },
      ],
    },
    {
      id: 'allodynie',
      text: 'Frotter doucement la zone avec du coton déclenche une douleur ou une sensation désagréable',
      help: 'Test d\'allodynie — à comparer avec une zone saine',
      options: [
        { label: 'Non', value: 0 },
        { label: 'Oui', value: 5 },
      ],
    },
    {
      id: 'seuil-piqure',
      text: 'La piqûre est ressentie plus fortement (ou plus faiblement) sur la zone douloureuse que sur une zone saine',
      help: 'Test de seuil à la piqûre',
      options: [
        { label: 'Non', value: 0 },
        { label: 'Oui', value: 3 },
      ],
    },
  ],
  score: (answers) => {
    const total = sum(answers, itemIds(slanss))
    const positif = total >= 12
    return {
      headline: `${total}/24`,
      level: positif ? 'high' : 'low',
      interpretation: positif
        ? 'Score ≥ 12/24 : mécanismes neuropathiques probablement en cause dans la douleur du patient.'
        : 'Score < 12/24 : mécanismes neuropathiques peu probables.',
    }
  },
}

export const painQuestionnaires: ClinicalQuestionnaire[] = [painNumericScale, dn4, slanss]
