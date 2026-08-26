import type { ActionDefinition, HypothesisDefinition, SignalExpr } from '../types'

/**
 * Base de connaissance cervicale, transposée de l'arbre décisionnel historique
 * (`src/lib/reasoning/legacy/cervical-tree.ts`), sur le même principe que le
 * lombaire : mêmes seuils, mêmes combinaisons, ordre de priorité clinique
 * reproduit par les poids et vérifié par les tests de non-régression.
 */

const CORTICO_OU_OSTEOPOROSE: SignalExpr = {
  any: ['terrain.corticotherapie', 'terrain.osteoporose'],
}

const FACTEURS_FRACTURE = [
  'general.traumatisme_recent',
  'terrain.age_plus_65',
  CORTICO_OU_OSTEOPOROSE,
  'cervical.douleur_focale_epineuse',
] as SignalExpr[]

const FACTEURS_NEOPLASIE = [
  'general.perte_poids',
  'general.douleur_nocturne',
  'general.douleur_persistante_traitement',
] as SignalExpr[]

const FACTEURS_INFECTION = [
  'general.fievre',
  'terrain.immunodepression',
  'terrain.drogues_iv',
  'terrain.chirurgie_rachis_recente',
  'general.douleur_repos_constante',
] as SignalExpr[]

const FACTEURS_DISSECTION = [
  'cervical.cephalee_brutale',
  'cervical.signes_neuro_dissection',
  'cervical.traumatisme_mineur_recent',
  'terrain.facteurs_vasculaires_50',
  'cervical.acouphene_pulsatile',
] as SignalExpr[]

/** Tableau radiculaire cervical : irradiation dans le bras, bras plus douloureux que le cou. */
const RADICULAIRE: SignalExpr = {
  all: ['cervical.irradiation_bras', 'cervical.bras_plus_douloureux'],
}

/**
 * Cluster de Wainner (2003) pour la radiculopathie cervicale : Spurling,
 * distraction, tension neurale et rotation limitée à moins de 60°. Trois
 * critères sur quatre donnent un LR+ de 6,1 ; les quatre, un LR+ de 30,3 pour
 * une spécificité de 0,99. Aucun de ces tests ne vaut cela isolément.
 */
const CLUSTER_WAINNER = [
  'cervical.spurling_positif',
  'cervical.distraction_positif',
  'cervical.ulnt_positif',
  'cervical.rotation_limitee_60',
] as SignalExpr[]

const CEPHALEE_CERVICOGENIQUE: SignalExpr = {
  all: [
    { any: ['cervical.localisation_suboccipitale', 'cervical.cephalees'] },
    'cervical.criteres_cephalee_1plus',
  ],
}

export const CERVICAL_HYPOTHESES: HypothesisDefinition[] = [
  // ── Drapeaux rouges ───────────────────────────────────────────────────────
  {
    id: 'cervical.myelopathie',
    label: 'Myélopathie cervicale dégénérative',
    region: 'cervical',
    // Drapeau rouge par sa gravité, mais c'est aussi le diagnostic : elle reste
    // dans le différentiel, en tête, avec une orientation urgente en action.
    kind: 'specific',
    requires: 'cervical.signes_mns_2plus',
    criteria: [
      { when: 'cervical.signes_mns_2plus', weight: 30, label: 'au moins deux signes de motoneurone supérieur' },
      { when: 'cervical.symptomes_myelopathie', weight: 2, label: 'maladresse des mains, troubles de la marche ou signe de Lhermitte' },
    ],
    actions: ['cervical.neurochirurgie', 'cervical.irm'],
    note: 'Évaluation neurochirurgicale. Aucune manipulation cervicale.',
  },
  {
    id: 'cervical.fracture',
    label: 'Fracture cervicale',
    region: 'cervical',
    kind: 'red-flag',
    requires: {
      any: [
        'general.traumatisme_recent',
        { all: ['terrain.age_plus_65', { atLeast: 2, among: FACTEURS_FRACTURE }] },
      ],
    },
    criteria: [
      { when: 'general.traumatisme_recent', weight: 30, label: 'traumatisme cervical récent' },
      { when: { all: ['terrain.age_plus_65', { atLeast: 2, among: FACTEURS_FRACTURE }] }, weight: 20, label: 'âge supérieur à 65 ans associé à un autre facteur de risque' },
    ],
    actions: ['cervical.regle-ottawa-cspine', 'cervical.radiographie', 'cervical.avis-medical'],
    note: 'Critères NEXUS et règle canadienne du rachis cervical.',
  },
  {
    id: 'cervical.neoplasie',
    label: 'Néoplasie ou métastase cervicale',
    region: 'cervical',
    kind: 'red-flag',
    requires: {
      any: [
        { all: ['terrain.antecedent_cancer', { atLeast: 1, among: FACTEURS_NEOPLASIE }] },
        { all: [{ not: 'terrain.antecedent_cancer' }, { atLeast: 2, among: FACTEURS_NEOPLASIE }] },
      ],
    },
    criteria: [
      { when: { all: ['terrain.antecedent_cancer', { atLeast: 1, among: FACTEURS_NEOPLASIE }] }, weight: 40, label: 'antécédent de cancer associé à au moins un élément clinique' },
      { when: { atLeast: 2, among: FACTEURS_NEOPLASIE }, weight: 20, label: 'au moins deux facteurs de risque néoplasique combinés' },
    ],
    actions: ['cervical.irm', 'cervical.biologie', 'cervical.avis-medical'],
  },
  {
    id: 'cervical.neoplasie-surveillance',
    label: 'Antécédent de cancer isolé — surveillance rapprochée',
    region: 'cervical',
    kind: 'red-flag',
    requires: {
      all: ['terrain.antecedent_cancer', { not: { atLeast: 1, among: FACTEURS_NEOPLASIE } }],
    },
    criteria: [
      { when: 'terrain.antecedent_cancer', weight: 10, label: 'antécédent de cancer sans autre élément clinique' },
    ],
  },
  {
    id: 'cervical.infection',
    label: 'Infection rachidienne cervicale',
    region: 'cervical',
    kind: 'red-flag',
    requires: {
      any: [
        { all: ['general.fievre', { atLeast: 2, among: FACTEURS_INFECTION }] },
        {
          all: [
            { not: 'general.fievre' },
            { any: ['terrain.drogues_iv', 'terrain.chirurgie_rachis_recente'] },
            { atLeast: 2, among: FACTEURS_INFECTION },
          ],
        },
      ],
    },
    criteria: [
      { when: { all: ['general.fievre', { atLeast: 2, among: FACTEURS_INFECTION }] }, weight: 30, label: 'fièvre associée à au moins un autre facteur infectieux' },
      { when: 'terrain.chirurgie_rachis_recente', weight: 8, label: 'chirurgie rachidienne récente' },
      { when: 'terrain.drogues_iv', weight: 8, label: 'usage de drogues intraveineuses' },
    ],
    actions: ['cervical.biologie', 'cervical.irm', 'cervical.avis-medical'],
  },
  {
    id: 'cervical.dissection',
    label: 'Dissection artérielle cervicale',
    region: 'cervical',
    kind: 'red-flag',
    requires: {
      any: [
        { all: ['cervical.cephalee_brutale', 'cervical.signes_neuro_dissection'] },
        { atLeast: 2, among: FACTEURS_DISSECTION },
      ],
    },
    criteria: [
      { when: { all: ['cervical.cephalee_brutale', 'cervical.signes_neuro_dissection'] }, weight: 60, label: 'céphalée brutale associée à des signes neurologiques' },
      { when: { atLeast: 2, among: FACTEURS_DISSECTION }, weight: 40, label: 'au moins deux facteurs évocateurs de dissection' },
    ],
    actions: ['cervical.urgence-vasculaire'],
    note: 'Urgence vasculaire. Contre-indication formelle à toute manipulation cervicale.',
  },

  // ── Différentiel ──────────────────────────────────────────────────────────
  {
    id: 'cervical.radiculopathie',
    label: 'Radiculopathie cervicale',
    region: 'cervical',
    kind: 'specific',
    requires: RADICULAIRE,
    criteria: [
      { when: RADICULAIRE, weight: 20, label: 'irradiation dans le bras, plus douloureuse que la cervicalgie' },
      { when: { atLeast: 4, among: CLUSTER_WAINNER }, weight: 8, label: 'cluster de Wainner complet — LR+ 30,3, Sp 0,99 (Wainner 2003)' },
      { when: { all: [{ atLeast: 3, among: CLUSTER_WAINNER }, { not: { atLeast: 4, among: CLUSTER_WAINNER } }] }, weight: 4, label: 'trois critères de Wainner sur quatre — LR+ 6,1 (Wainner 2003)' },
      { when: 'cervical.paresthesies_bras', weight: 1, label: 'paresthésies du membre supérieur' },
    ],
    actions: [
      'cervical.spurling',
      'cervical.distraction',
      'cervical.ulnt',
      'cervical.rotation',
      'cervical.bakody',
      'cervical.traction',
      'cervical.dn4',
    ],
  },
  {
    id: 'cervical.wad-iii',
    label: 'WAD grade III — atteinte neurologique',
    region: 'cervical',
    kind: 'specific',
    requires: { all: ['cervical.whiplash', 'cervical.wad_grade_3'] },
    criteria: [
      { when: 'cervical.wad_grade_3', weight: 18, label: 'déficit neurologique objectivé après coup du lapin' },
    ],
    actions: ['cervical.regle-ottawa-cspine', 'cervical.ndi', 'cervical.avis-medical'],
  },
  {
    id: 'cervical.wad-i-ii',
    label: 'WAD grade I-II',
    region: 'cervical',
    kind: 'specific',
    requires: 'cervical.whiplash',
    criteria: [
      { when: 'cervical.whiplash', weight: 15, label: 'cervicalgie post-traumatique sans déficit neurologique' },
    ],
    actions: ['cervical.regle-ottawa-cspine', 'cervical.ndi'],
  },
  {
    id: 'cervical.spa',
    label: 'Suspicion de spondyloarthrite axiale — atteinte cervicale',
    region: 'cervical',
    kind: 'specific',
    requires: 'cervical.rythme_inflammatoire',
    criteria: [
      { when: 'cervical.rythme_inflammatoire', weight: 12, label: 'cervicalgie de rythme inflammatoire' },
    ],
    actions: ['cervical.biologie', 'cervical.rhumatologie'],
  },
  {
    id: 'cervical.cephalee-cervicogenique',
    label: 'Céphalée cervicogénique',
    region: 'cervical',
    kind: 'specific',
    requires: CEPHALEE_CERVICOGENIQUE,
    criteria: [
      { when: CEPHALEE_CERVICOGENIQUE, weight: 8, label: 'céphalée d\'origine cervicale : au moins un critère présent' },
      { when: 'cervical.criteres_cephalee_3plus', weight: 2, label: 'au moins trois critères de céphalée cervicogénique' },
      { when: 'cervical.frt_positif', weight: 4, label: 'flexion-rotation test positif — Sn 0,91 · Sp 0,90 pour une atteinte C1-C2 (Hall & Robinson 2004)' },
    ],
    actions: ['cervical.frt', 'cervical.hit6'],
  },
  {
    id: 'cervical.facettaire',
    label: 'Syndrome facettaire cervical',
    region: 'cervical',
    kind: 'mechanical',
    requires: {
      all: ['cervical.localisation_paravertebrale', 'cervical.criteres_facettaires_2plus'],
    },
    criteria: [
      { when: 'cervical.criteres_facettaires_2plus', weight: 6, label: 'au moins deux critères facettaires cervicaux' },
    ],
    actions: ['cervical.extension-rotation'],
  },
  {
    id: 'cervical.non-specifique',
    label: 'Cervicalgie non spécifique',
    region: 'cervical',
    kind: 'exclusion',
    criteria: [
      { when: { not: RADICULAIRE }, weight: 3, label: 'absence d\'argument pour une cause spécifique' },
      {
        when: 'psychosocial.risque_chronicisation',
        weight: 2,
        label: 'facteurs de risque de chronicisation identifiés',
      },
      {
        when: {
          atLeast: 2,
          among: [
            'psychosocial.peur_mouvement',
            'psychosocial.croyance_lesion_grave',
            'psychosocial.stress_anxiete',
            'psychosocial.insatisfaction_travail',
            'psychosocial.arret_travail',
          ],
        },
        weight: 2,
        label: 'au moins deux drapeaux jaunes relevés à l\'interrogatoire',
      },
    ],
    actions: ['cervical.ndi', 'cervical.pas-imagerie'],
    note: 'Diagnostic d\'exclusion.',
  },
]

export const CERVICAL_ACTIONS: ActionDefinition[] = [
  {
    id: 'cervical.spurling',
    kind: 'test',
    label: 'Test de Spurling',
    performance: 'Sn 0,38-0,50 · Sp 0,86-0,95 — à lire dans le cluster de Wainner',
    resolves: ['cervical.spurling_positif'],
  },
  {
    id: 'cervical.distraction',
    kind: 'test',
    label: 'Test de distraction cervicale',
    performance: 'Critère du cluster de Wainner',
    resolves: ['cervical.distraction_positif'],
  },
  {
    id: 'cervical.rotation',
    kind: 'test',
    label: 'Rotation cervicale active du côté atteint — atteint-elle 60° ?',
    performance: 'Critère du cluster de Wainner',
    resolves: ['cervical.rotation_limitee_60'],
  },
  {
    id: 'cervical.ulnt',
    kind: 'test',
    label: 'ULNT — les 4 tests de tension neurale',
    performance: 'Sn 0,97 · Sp 0,51 — un négatif écarte, un positif ne confirme pas',
    resolves: ['cervical.ulnt_positif'],
  },
  { id: 'cervical.bakody', kind: 'test', label: 'Abduction d\'épaule (signe de Bakody)', performance: 'Sn 49 %, Sp 76 %' },
  { id: 'cervical.traction', kind: 'test', label: 'Traction cervicale manuelle', performance: 'SMD −0,66' },
  {
    id: 'cervical.frt',
    kind: 'test',
    label: 'Flexion-rotation test',
    performance: 'Sn 0,91 · Sp 0,90 pour une atteinte C1-C2 (Hall & Robinson 2004)',
    resolves: ['cervical.frt_positif'],
  },
  {
    id: 'cervical.extension-rotation',
    kind: 'test',
    label: 'Extension avec rotation ipsilatérale',
    note: 'Un des critères facettaires cervicaux',
  },
  {
    id: 'cervical.regle-ottawa-cspine',
    kind: 'questionnaire',
    label: 'Règle canadienne du rachis cervical — imagerie nécessaire ?',
    questionnaireId: 'canadian-c-spine',
  },
  { id: 'cervical.ndi', kind: 'questionnaire', label: 'NDI — retentissement fonctionnel de référence', questionnaireId: 'ndi' },
  { id: 'cervical.hit6', kind: 'questionnaire', label: 'HIT-6 — impact des céphalées', questionnaireId: 'hit-6' },
  { id: 'cervical.dn4', kind: 'questionnaire', label: 'DN4 — dépistage d\'une composante neuropathique', questionnaireId: 'dn4' },
  { id: 'cervical.irm', kind: 'exam', label: 'IRM cervicale', urgency: 'urgent' },
  { id: 'cervical.radiographie', kind: 'exam', label: 'Radiographies du rachis cervical', urgency: 'urgent' },
  { id: 'cervical.biologie', kind: 'exam', label: 'Bilan biologique : NFS, VS, CRP', urgency: 'if_persistent' },
  { id: 'cervical.pas-imagerie', kind: 'exam', label: 'Pas d\'imagerie en routine', urgency: 'not_indicated' },
  { id: 'cervical.urgence-vasculaire', kind: 'referral', label: 'Orientation en urgence — suspicion de dissection artérielle', urgency: 'urgent' },
  { id: 'cervical.neurochirurgie', kind: 'referral', label: 'Évaluation neurochirurgicale', urgency: 'urgent' },
  { id: 'cervical.avis-medical', kind: 'referral', label: 'Avis médical avant poursuite de la prise en charge', urgency: 'urgent' },
  { id: 'cervical.rhumatologie', kind: 'referral', label: 'Orientation en rhumatologie', urgency: 'if_persistent' },
]
