/**
 * Vocabulaire fermé des faits cliniques.
 *
 * C'est la pièce centrale du dispositif : tout ce qui entre dans le moteur —
 * anamnèse dictée, réponse à une question, résultat d'un test, score d'un
 * questionnaire — doit se traduire en signaux de cette liste. Rien d'autre
 * n'est interprétable. C'est ce qui rend le raisonnement reproductible : deux
 * passages sur la même anamnèse produisent les mêmes signaux, donc les mêmes
 * hypothèses.
 *
 * Un signal vaut vrai, faux, ou reste inconnu — et « inconnu » n'est jamais
 * traité comme « faux » : c'est précisément ce qui reste à explorer.
 */

export type SignalGroup =
  | 'terrain'
  | 'general'
  | 'douleur'
  | 'topographie'
  | 'neurologique'
  | 'examen'
  | 'psychosocial'

export interface SignalDefinition {
  /**
   * Signaux nécessairement vrais si celui-ci l'est. Une douleur qui descend
   * sous le genou descend dans la jambe : inutile de poser les deux questions.
   */
  implies?: string[]
  /** Formulation affirmative, telle qu'elle sera reprise dans le compte rendu. */
  label: string
  group: SignalGroup
  /**
   * Formulation interrogative. Un signal qui en possède une peut être proposé
   * comme question à poser quand il manque ; les autres ne se renseignent que
   * par un test ou un examen.
   */
  question?: string
}

const definitions = {
  // ── Terrain ───────────────────────────────────────────────────────────────
  'terrain.age_moins_60': { label: 'âge inférieur à 60 ans', group: 'terrain' },
  'terrain.age_plus_65': { label: 'âge supérieur à 65 ans', group: 'terrain' },
  'terrain.age_plus_70': { label: 'âge supérieur à 70 ans', group: 'terrain' },
  'terrain.age_50_facteurs_cancer': {
    label: 'plus de 50 ans avec facteurs de risque de cancer',
    group: 'terrain',
    question: 'Y a-t-il un tabagisme ou des expositions professionnelles à risque ?',
  },
  'terrain.antecedent_cancer': {
    label: 'antécédent de cancer',
    group: 'terrain',
    question: 'Y a-t-il un antécédent de cancer ?',
  },
  'terrain.corticotherapie': {
    label: 'corticothérapie au long cours',
    group: 'terrain',
    question: 'Le patient prend-il des corticoïdes au long cours ?',
  },
  'terrain.osteoporose': {
    label: 'ostéoporose connue',
    group: 'terrain',
    question: 'Une ostéoporose est-elle connue ?',
  },
  'terrain.immunodepression': {
    label: 'immunodépression',
    group: 'terrain',
    question: 'Y a-t-il une immunodépression (VIH, corticoïdes, immunosuppresseurs) ?',
  },
  'terrain.drogues_iv': { label: 'usage de drogues intraveineuses', group: 'terrain' },
  'terrain.catheter_infection_recente': {
    label: 'cathéter vasculaire ou infection bactérienne récente',
    group: 'terrain',
  },
  'terrain.chirurgie_rachis_recente': {
    label: 'chirurgie cervicale ou rachidienne récente',
    group: 'terrain',
    question: 'Y a-t-il eu une chirurgie du rachis récente ?',
  },
  'terrain.profil_vasculaire_aaa': {
    label: 'profil vasculaire évocateur d\'anévrisme (homme de plus de 50 ans, tabagisme)',
    group: 'terrain',
  },
  'terrain.facteurs_vasculaires_50': {
    label: 'plus de 50 ans avec facteurs de risque vasculaire',
    group: 'terrain',
  },

  // ── Signes généraux ───────────────────────────────────────────────────────
  'general.perte_poids': {
    label: 'perte de poids inexpliquée récente',
    group: 'general',
    question: 'Y a-t-il eu une perte de poids inexpliquée récemment ?',
  },
  'general.fievre': { label: 'fièvre', group: 'general', question: 'Y a-t-il de la fièvre ?' },
  'general.douleur_nocturne': {
    label: 'douleur nocturne réveillant en seconde partie de nuit',
    group: 'douleur',
    question: 'La douleur réveille-t-elle en seconde partie de nuit ?',
  },
  'general.douleur_repos_constante': {
    label: 'douleur constante au repos, sans position antalgique',
    group: 'douleur',
    question: 'Existe-t-il une position qui soulage, ou la douleur est-elle constante ?',
  },
  'general.douleur_persistante_traitement': {
    label: 'douleur persistante ou aggravée malgré le traitement depuis plus d\'un mois',
    group: 'douleur',
    question: 'La douleur persiste-t-elle ou s\'aggrave-t-elle malgré le traitement ?',
  },
  'general.traumatisme_recent': {
    label: 'traumatisme récent',
    group: 'general',
    question: 'Y a-t-il eu un traumatisme récent, même mineur ?',
  },
  'general.deficit_neuro_post_traumatique': {
    label: 'déficit neurologique associé au traumatisme',
    group: 'neurologique',
  },
  'general.douleur_mediane_epineuse': {
    label: 'douleur très localisée sur les épineuses',
    group: 'examen',
  },

  // ── Rachis lombaire ───────────────────────────────────────────────────────
  'lombaire.duree_aigue': {
    label: 'épisode aigu de moins de 8 semaines',
    group: 'douleur',
    question: 'Depuis combien de temps la douleur évolue-t-elle ?',
  },
  'lombaire.queue_de_cheval': {
    label: 'signes de syndrome de la queue de cheval',
    group: 'neurologique',
    question: 'Y a-t-il des troubles urinaires, une anesthésie en selle ou une faiblesse des deux jambes ?',
  },
  'lombaire.irradiation_jambe': {
    label: 'irradiation dans la jambe',
    group: 'topographie',
    question: 'La douleur descend-elle dans la jambe ?',
  },
  'lombaire.irradiation_sous_genou': {
    label: 'irradiation sous le genou',
    group: 'topographie',
    question: 'La douleur descend-elle sous le genou ?',
    implies: ['lombaire.irradiation_jambe'],
  },
  'lombaire.jambe_plus_douloureuse': {
    label: 'douleur de jambe plus intense que la douleur lombaire',
    group: 'topographie',
    question: 'Qu\'est-ce qui fait le plus mal : le dos ou la jambe ?',
  },
  'lombaire.unilateral': {
    label: 'atteinte unilatérale',
    group: 'topographie',
    question: 'La douleur touche-t-elle une seule jambe ?',
  },
  'lombaire.aggrave_assis': {
    label: 'aggravation en position assise',
    group: 'douleur',
    question: 'La position assise aggrave-t-elle la douleur ?',
  },
  'lombaire.aggrave_marche': {
    label: 'aggravation à la marche',
    group: 'douleur',
    question: 'La marche aggrave-t-elle la douleur ?',
  },
  'lombaire.signe_caddie': {
    label: 'soulagement en antéflexion (signe du caddie)',
    group: 'douleur',
    question: 'Le patient est-il soulagé penché en avant, sur un caddie par exemple ?',
  },
  'lombaire.debut_brutal': {
    label: 'début brutal',
    group: 'douleur',
    question: 'La douleur est-elle apparue brutalement ?',
  },
  'lombaire.aggrave_toux': {
    label: 'aggravation à la toux ou à l\'éternuement',
    group: 'douleur',
    question: 'La toux ou l\'éternuement réveillent-ils la douleur ?',
  },
  'lombaire.rythme_inflammatoire': {
    label: 'rythme inflammatoire (raideur matinale prolongée, réveils nocturnes, amélioration à l\'effort)',
    group: 'douleur',
    question: 'La raideur matinale dure-t-elle plus de 30 minutes ? La douleur s\'améliore-t-elle à l\'activité ?',
  },
  'lombaire.criteres_asas_4plus': {
    label: 'au moins 4 critères ASAS de rachialgie inflammatoire',
    group: 'douleur',
  },
  'lombaire.manifestations_extra_articulaires': {
    label: 'manifestations extra-articulaires (uvéite, psoriasis, MICI)',
    group: 'general',
    question: 'Y a-t-il une uvéite, un psoriasis ou une maladie inflammatoire de l\'intestin ?',
  },
  'lombaire.sacroiliite_radiographique': {
    label: 'sacroiliite visible en radiographie',
    group: 'examen',
  },
  'lombaire.hla_b27': { label: 'HLA-B27 positif', group: 'examen' },
  'lombaire.tableau_clinique_spa': {
    label: 'tableau clinique de spondyloarthrite (critères ASAS cliniques)',
    group: 'general',
  },
  'lombaire.localisation_mediane': { label: 'douleur médiane, sur les épineuses', group: 'topographie' },
  'lombaire.localisation_paravertebrale': { label: 'douleur paravertébrale', group: 'topographie' },
  'lombaire.localisation_fessiere': { label: 'douleur fessière ou sacro-iliaque', group: 'topographie' },
  'lombaire.localisation_diffuse': { label: 'douleur paravertébrale bilatérale diffuse', group: 'topographie' },
  'lombaire.centralisation': {
    label: 'phénomène de centralisation aux mouvements répétés',
    group: 'examen',
  },
  'lombaire.criteres_revel_3plus': {
    label: 'au moins 3 critères de Revel sur 7',
    group: 'examen',
  },

  // ── Rachis cervical ───────────────────────────────────────────────────────
  'cervical.duree_aigue': {
    label: 'épisode aigu de moins de 8 semaines',
    group: 'douleur',
    question: 'Depuis combien de temps la douleur cervicale évolue-t-elle ?',
  },
  'cervical.symptomes_myelopathie': {
    label: 'symptômes évocateurs de myélopathie (maladresse des mains, troubles de la marche, Lhermitte)',
    group: 'neurologique',
    question: 'Y a-t-il une maladresse des mains, des troubles de l\'équilibre ou des décharges en flexion du cou ?',
  },
  'cervical.signes_mns_2plus': {
    label: 'au moins 2 signes de motoneurone supérieur',
    group: 'examen',
  },
  'cervical.douleur_focale_epineuse': {
    label: 'douleur très localisée sur une épineuse cervicale',
    group: 'examen',
  },
  'cervical.irradiation_bras': {
    label: 'irradiation dans le bras',
    group: 'topographie',
    question: 'La douleur descend-elle dans le bras ?',
  },
  'cervical.paresthesies_bras': {
    label: 'paresthésies du membre supérieur',
    group: 'neurologique',
    question: 'Y a-t-il des fourmillements dans le bras ou la main ?',
  },
  'cervical.bras_plus_douloureux': {
    label: 'douleur de bras plus intense que la douleur cervicale',
    group: 'topographie',
    question: 'Qu\'est-ce qui fait le plus mal : le cou ou le bras ?',
  },
  'cervical.cephalees': {
    label: 'céphalées associées',
    group: 'douleur',
    question: 'Y a-t-il des maux de tête associés ?',
  },
  'cervical.whiplash': {
    label: 'mécanisme de coup du lapin (whiplash)',
    group: 'general',
    question: 'La douleur fait-elle suite à un coup du lapin ?',
  },
  'cervical.wad_grade_3': {
    label: 'atteinte neurologique objectivée (WAD grade III)',
    group: 'neurologique',
    implies: ['cervical.whiplash'],
  },
  'cervical.rythme_inflammatoire': {
    label: 'rythme inflammatoire cervical',
    group: 'douleur',
    question: 'La raideur cervicale matinale dure-t-elle plus de 30 minutes ?',
  },
  'cervical.localisation_suboccipitale': { label: 'douleur sous-occipitale', group: 'topographie' },
  'cervical.localisation_paravertebrale': { label: 'douleur paravertébrale cervicale', group: 'topographie' },
  'cervical.criteres_cephalee_1plus': {
    label: 'au moins 1 critère de céphalée cervicogénique',
    group: 'examen',
  },
  'cervical.criteres_cephalee_3plus': {
    label: 'au moins 3 critères de céphalée cervicogénique',
    group: 'examen',
    implies: ['cervical.criteres_cephalee_1plus'],
  },
  'cervical.criteres_facettaires_2plus': {
    label: 'au moins 2 critères facettaires cervicaux',
    group: 'examen',
  },
  'cervical.traumatisme_mineur_recent': {
    label: 'traumatisme cervical récent, même mineur (manipulation, sport, coup du lapin)',
    group: 'general',
    question: 'Y a-t-il eu un mouvement ou un choc cervical récent, même anodin ?',
  },
  'cervical.cephalee_brutale': {
    label: 'céphalée brutale inhabituelle et sévère',
    group: 'douleur',
    question: 'La céphalée est-elle apparue brutalement, en coup de tonnerre ?',
  },
  'cervical.signes_neuro_dissection': {
    label: 'troubles visuels, vertiges, diplopie, dysphagie ou dysarthrie',
    group: 'neurologique',
    question: 'Y a-t-il des troubles visuels, des vertiges, une difficulté à avaler ou à articuler ?',
  },
  'cervical.acouphene_pulsatile': {
    label: 'acouphène pulsatile unilatéral',
    group: 'general',
    question: 'Y a-t-il un acouphène pulsatile d\'un seul côté ?',
  },

  // ── Psychosocial ──────────────────────────────────────────────────────────
  'psychosocial.drapeaux_jaunes_2plus': {
    label: 'au moins 2 drapeaux jaunes',
    group: 'psychosocial',
  },
  'psychosocial.risque_chronicisation': {
    label: 'facteurs de risque de chronicisation',
    group: 'psychosocial',
  },
} as const satisfies Record<string, SignalDefinition>

export const SIGNALS: Record<string, SignalDefinition> = definitions

/** Identifiant de signal — typé sur le vocabulaire, pas sur `string`. */
export type SignalId = keyof typeof definitions

/** Relevé courant. Une clé absente ou `undefined` signifie « pas encore exploré ». */
export type SignalSet = Partial<Record<SignalId, boolean>>

export function signalLabel(id: SignalId): string {
  return definitions[id]?.label ?? id
}

export function signalQuestion(id: SignalId): string | undefined {
  return (definitions[id] as SignalDefinition | undefined)?.question
}

/**
 * Enregistre une réponse et propage ce qu'elle implique. Répondre « oui, ça
 * descend sous le genou » répond du même coup à « est-ce que ça descend dans la
 * jambe » — sans quoi le copilote reposerait aussitôt une question déjà réglée.
 *
 * L'implication ne joue que dans le sens affirmatif : « non, pas sous le
 * genou » ne dit rien de l'irradiation dans la cuisse.
 */
export function applySignal(
  signals: SignalSet,
  id: SignalId,
  value: boolean,
): SignalSet {
  const next: SignalSet = { ...signals, [id]: value }
  if (!value) return next
  const queue = [...((definitions[id] as SignalDefinition | undefined)?.implies ?? [])]
  const seen = new Set<string>([id])
  while (queue.length > 0) {
    const implied = queue.shift()!
    if (seen.has(implied) || !(implied in definitions)) continue
    seen.add(implied)
    next[implied as SignalId] = true
    queue.push(...((definitions[implied as SignalId] as SignalDefinition).implies ?? []))
  }
  return next
}
