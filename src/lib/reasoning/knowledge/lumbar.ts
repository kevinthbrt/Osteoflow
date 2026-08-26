import type { ActionDefinition, HypothesisDefinition, SignalExpr } from '../types'

/**
 * Base de connaissance lombaire, transposée de l'arbre décisionnel historique
 * (`src/lib/reasoning/legacy/lumbar-tree.ts`). Les seuils, les combinaisons de
 * facteurs et les rapports de vraisemblance sont repris à l'identique : le
 * fichier `tests/unit/reasoning-lumbar-regression.test.ts` vérifie que le
 * moteur retient bien la même hypothèse que l'arbre sur toutes les
 * combinaisons discriminantes.
 *
 * Les poids ne prétendent pas être des probabilités. Ils reproduisent l'ordre
 * de priorité clinique de l'arbre : une hypothèse spécifique passe devant le
 * diagnostic d'exclusion, un profil complet passe devant un profil partiel.
 */

const FACTEURS_FRACTURE = [
  'general.traumatisme_recent',
  'general.deficit_neuro_post_traumatique',
  'terrain.age_plus_70',
  'terrain.corticotherapie',
  'terrain.osteoporose',
  'general.douleur_mediane_epineuse',
] as const

const FACTEURS_NEOPLASIE = [
  'general.perte_poids',
  'general.douleur_nocturne',
  'terrain.age_50_facteurs_cancer',
  'general.douleur_persistante_traitement',
] as const

const FACTEURS_INFECTION = [
  'general.fievre',
  'terrain.immunodepression',
  'terrain.drogues_iv',
  'terrain.catheter_infection_recente',
  'general.douleur_repos_constante',
] as const

/** Traumatisme avec déficit neurologique : le signe le plus spécifique (LR+ 31,1). */
const TRAUMA_AVEC_DEFICIT: SignalExpr = {
  all: ['general.traumatisme_recent', 'general.deficit_neuro_post_traumatique'],
}

const DEUX_FACTEURS_FRACTURE: SignalExpr = { atLeast: 2, among: [...FACTEURS_FRACTURE] }

/**
 * Combinaison validée par Downie et al. (BMJ 2013) : au moins trois de ces
 * quatre facteurs portent la probabilité post-test de fracture à 90 %. Aucun
 * d'entre eux ne vaut grand-chose isolément.
 */
const COMBINAISON_FRACTURE: SignalExpr = {
  atLeast: 3,
  among: [
    'terrain.sexe_feminin',
    'terrain.age_plus_70',
    'general.traumatisme_recent',
    'terrain.corticotherapie',
  ],
}

const NEOPLASIE_AVEC_ANTECEDENT: SignalExpr = {
  all: ['terrain.antecedent_cancer', { atLeast: 1, among: [...FACTEURS_NEOPLASIE] }],
}

const NEOPLASIE_SANS_ANTECEDENT: SignalExpr = {
  all: [{ not: 'terrain.antecedent_cancer' }, { atLeast: 2, among: [...FACTEURS_NEOPLASIE] }],
}

/**
 * Drapeaux jaunes relevés à l'interrogatoire. Le STarT Back les mesure mieux,
 * mais il n'est pas toujours passé : deux de ces éléments dans l'anamnèse
 * suffisent à faire pencher la prise en charge vers un abord cognitif.
 */
const DRAPEAUX_JAUNES: SignalExpr = {
  atLeast: 2,
  among: [
    'psychosocial.peur_mouvement',
    'psychosocial.croyance_lesion_grave',
    'psychosocial.stress_anxiete',
    'psychosocial.insatisfaction_travail',
    'psychosocial.arret_travail',
  ],
}

const PORTE_ENTREE_INFECTIEUSE: SignalExpr = {
  any: ['terrain.drogues_iv', 'terrain.catheter_infection_recente'],
}

/** Tableau radiculaire vrai : irradiation basse et jambe plus douloureuse que le dos. */
const RADICULAIRE: SignalExpr = {
  all: [
    'lombaire.irradiation_jambe',
    'lombaire.irradiation_sous_genou',
    'lombaire.jambe_plus_douloureuse',
  ],
}

/** Voie mécanique : ni radiculaire, ni inflammatoire. */
const MECANIQUE: SignalExpr = {
  all: [{ not: RADICULAIRE }, { not: 'lombaire.rythme_inflammatoire' }],
}

const PROFIL_DISCAL: SignalExpr = {
  all: [
    {
      atLeast: 2,
      among: [
        'lombaire.unilateral',
        'lombaire.aggrave_assis',
        'lombaire.debut_brutal',
        'lombaire.aggrave_toux',
      ],
    },
    'terrain.age_moins_60',
  ],
}

const PROFIL_STENOSE: SignalExpr = {
  atLeast: 3,
  among: [
    { not: 'terrain.age_moins_60' },
    { not: 'lombaire.unilateral' },
    { not: 'lombaire.aggrave_assis' },
    'lombaire.aggrave_marche',
    'lombaire.signe_caddie',
  ],
}

export const LUMBAR_HYPOTHESES: HypothesisDefinition[] = [
  // ── Drapeaux rouges ───────────────────────────────────────────────────────
  {
    id: 'lombaire.queue-de-cheval',
    label: 'Syndrome de la queue de cheval',
    region: 'lombaire',
    kind: 'red-flag',
    requires: 'lombaire.queue_de_cheval',
    criteria: [
      { when: 'lombaire.queue_de_cheval', weight: 100, label: 'signes de compression de la queue de cheval' },
    ],
    actions: ['lombaire.urgence-neurochirurgicale'],
    note: 'Urgence chirurgicale. Aucune technique manuelle avant avis spécialisé.',
  },
  {
    id: 'lombaire.fracture',
    label: 'Fracture vertébrale',
    region: 'lombaire',
    kind: 'red-flag',
    requires: { any: ['general.contusion_abrasion', COMBINAISON_FRACTURE, TRAUMA_AVEC_DEFICIT, DEUX_FACTEURS_FRACTURE] },
    criteria: [
      { when: 'general.contusion_abrasion', weight: 45, label: 'contusion ou abrasion en regard du rachis — probabilité post-test de fracture 62 % (Downie 2013)' },
      { when: COMBINAISON_FRACTURE, weight: 45, label: 'au moins trois facteurs parmi sexe féminin, plus de 70 ans, traumatisme et corticothérapie — probabilité post-test 90 % (Downie 2013)' },
      { when: TRAUMA_AVEC_DEFICIT, weight: 40, label: 'traumatisme associé à un déficit neurologique — probabilité post-test 43 % (Downie 2013)' },
      { when: DEUX_FACTEURS_FRACTURE, weight: 20, label: 'au moins deux facteurs de risque de fracture combinés' },
      { when: 'terrain.age_plus_70', weight: 2, label: 'âge supérieur à 70 ans' },
      { when: 'terrain.osteoporose', weight: 2, label: 'ostéoporose connue' },
      { when: 'terrain.corticotherapie', weight: 2, label: 'corticothérapie au long cours' },
    ],
    actions: ['lombaire.radiographie', 'lombaire.avis-medical'],
    note: 'Un facteur isolé n\'est pas informatif : c\'est la combinaison qui alerte.',
  },
  {
    id: 'lombaire.neoplasie',
    label: 'Néoplasie ou métastase rachidienne',
    region: 'lombaire',
    kind: 'red-flag',
    requires: { any: [NEOPLASIE_AVEC_ANTECEDENT, NEOPLASIE_SANS_ANTECEDENT] },
    criteria: [
      { when: NEOPLASIE_AVEC_ANTECEDENT, weight: 40, label: 'antécédent de cancer associé à au moins un élément clinique (LR+ 27,9)' },
      { when: NEOPLASIE_SANS_ANTECEDENT, weight: 20, label: 'au moins deux facteurs de risque néoplasique combinés' },
    ],
    actions: ['lombaire.irm', 'lombaire.biologie', 'lombaire.avis-medical'],
    note: 'Un drapeau rouge isolé a une spécificité très faible (plus de 96 % de faux positifs).',
  },
  {
    id: 'lombaire.neoplasie-surveillance',
    label: 'Antécédent de cancer isolé — surveillance rapprochée',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      all: ['terrain.antecedent_cancer', { not: { atLeast: 1, among: [...FACTEURS_NEOPLASIE] } }],
    },
    criteria: [
      { when: 'terrain.antecedent_cancer', weight: 10, label: 'antécédent de cancer sans autre élément clinique' },
    ],
    note: 'Spécificité insuffisante pour un bilan immédiat. Reconsidérer devant une douleur nocturne, une perte de poids ou une aggravation sous traitement.',
  },
  {
    id: 'lombaire.infection',
    label: 'Infection spinale (spondylodiscite, abcès épidural)',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      any: [
        { all: ['general.fievre', { atLeast: 2, among: [...FACTEURS_INFECTION] }] },
        {
          all: [
            { not: 'general.fievre' },
            PORTE_ENTREE_INFECTIEUSE,
            { atLeast: 2, among: [...FACTEURS_INFECTION] },
          ],
        },
      ],
    },
    criteria: [
      { when: { all: ['general.fievre', { atLeast: 2, among: [...FACTEURS_INFECTION] }] }, weight: 30, label: 'fièvre associée à au moins un autre facteur infectieux' },
      { when: 'terrain.drogues_iv', weight: 8, label: 'usage de drogues intraveineuses (LR+ 13,7 avec un autre foyer)' },
      { when: 'terrain.catheter_infection_recente', weight: 8, label: 'cathéter vasculaire ou infection récente (LR+ 15,7)' },
    ],
    actions: ['lombaire.biologie', 'lombaire.irm', 'lombaire.avis-medical'],
    note: 'La fièvre seule est insuffisante.',
  },
  {
    id: 'lombaire.aaa',
    label: 'Anévrisme de l\'aorte abdominale',
    region: 'lombaire',
    kind: 'red-flag',
    requires: 'terrain.profil_vasculaire_aaa',
    criteria: [
      { when: 'terrain.profil_vasculaire_aaa', weight: 60, label: 'profil vasculaire évocateur' },
    ],
    actions: ['lombaire.avis-medical'],
  },

  // ── Voie radiculaire ──────────────────────────────────────────────────────
  {
    id: 'lombaire.hernie-discale',
    label: 'Hernie discale lombaire',
    region: 'lombaire',
    kind: 'specific',
    requires: RADICULAIRE,
    criteria: [
      { when: PROFIL_DISCAL, weight: 20, label: 'profil discal : au moins deux caractéristiques évocatrices avant 60 ans' },
      {
        when: 'lombaire.lasegue_croise_positif',
        label: 'Lasègue croisé',
        lr: {
          positive: 2.8,
          negative: 0.8,
          source: 'van der Windt et al., Cochrane 2010, CD007431 — Sn 0,28 · Sp 0,90',
        },
      },
      {
        // Un Lasègue positif ne vaut presque rien (LR+ 1,28), un négatif écarte
        // sérieusement (LR− 0,29). Le rapport dit ce que la seule sensibilité
        // laissait mal lire.
        when: 'lombaire.lasegue_positif',
        label: 'Lasègue',
        lr: {
          positive: 1.28,
          negative: 0.29,
          source: 'van der Windt et al., Cochrane 2010, CD007431 — Sn 0,92 · Sp 0,28',
        },
      },
      { when: 'lombaire.deficit_moteur', weight: 4, label: 'déficit moteur objectivé' },
      { when: 'lombaire.unilateral', weight: 1, label: 'atteinte unilatérale' },
      { when: 'lombaire.aggrave_assis', weight: 1, label: 'aggravation en position assise' },
      { when: 'lombaire.debut_brutal', weight: 1, label: 'début brutal' },
      { when: 'lombaire.aggrave_toux', weight: 1, label: 'aggravation à la toux ou à l\'éternuement' },
    ],
    actions: [
      'lombaire.lasegue',
      'lombaire.lasegue-croise',
      'lombaire.examen-neurologique',
      'lombaire.dn4',
      'lombaire.irm-si-persistant',
    ],
  },
  {
    id: 'lombaire.stenose',
    label: 'Sténose spinale lombaire',
    region: 'lombaire',
    kind: 'specific',
    requires: RADICULAIRE,
    criteria: [
      { when: PROFIL_STENOSE, weight: 15, label: 'profil sténosant : au moins trois caractéristiques évocatrices' },
      { when: 'lombaire.aggrave_marche', weight: 1, label: 'aggravation à la marche' },
      { when: 'lombaire.signe_caddie', weight: 1, label: 'soulagement en antéflexion (signe du caddie)' },
      { when: { not: 'terrain.age_moins_60' }, weight: 1, label: 'âge supérieur à 60 ans' },
    ],
    actions: ['lombaire.romberg', 'lombaire.extension-lombaire', 'lombaire.examen-neurologique'],
  },
  {
    id: 'lombaire.radiculopathie',
    label: 'Radiculopathie lombaire, niveau à préciser',
    region: 'lombaire',
    kind: 'specific',
    requires: RADICULAIRE,
    criteria: [
      { when: RADICULAIRE, weight: 10, label: 'irradiation sous le genou avec jambe plus douloureuse que le dos' },
      { when: 'lombaire.faiblesse_ressentie_jambe', weight: 2, label: 'faiblesse ressentie dans la jambe' },
      { when: 'lombaire.deficit_moteur', weight: 4, label: 'déficit moteur objectivé' },
    ],
    actions: ['lombaire.lasegue', 'lombaire.examen-neurologique', 'lombaire.dn4'],
  },

  // ── Voie inflammatoire ────────────────────────────────────────────────────
  {
    id: 'lombaire.spa-radiographique',
    label: 'Spondylarthrite ankylosante (sacroiliite radiographique)',
    region: 'lombaire',
    kind: 'specific',
    requires: { all: ['lombaire.rythme_inflammatoire', 'lombaire.sacroiliite_radiographique'] },
    criteria: [
      { when: 'lombaire.sacroiliite_radiographique', weight: 20, label: 'sacroiliite objectivée en radiographie' },
      { when: 'lombaire.criteres_asas_4plus', weight: 2, label: 'au moins 4 critères ASAS' },
    ],
    actions: ['lombaire.schober', 'lombaire.expansion-thoracique', 'lombaire.rhumatologie'],
  },
  {
    id: 'lombaire.spa-non-radiographique',
    label: 'Spondyloarthrite axiale non radiographique',
    region: 'lombaire',
    kind: 'specific',
    requires: { all: ['lombaire.rythme_inflammatoire', 'lombaire.tableau_clinique_spa'] },
    criteria: [
      { when: 'lombaire.tableau_clinique_spa', weight: 15, label: 'tableau clinique ASAS de spondyloarthrite axiale' },
      { when: 'lombaire.hla_b27', weight: 2, label: 'HLA-B27 positif' },
      { when: 'lombaire.manifestations_extra_articulaires', weight: 2, label: 'manifestations extra-articulaires' },
    ],
    actions: ['lombaire.irm-sacro-iliaque', 'lombaire.schober', 'lombaire.rhumatologie'],
  },
  {
    id: 'lombaire.spa-suspicion',
    label: 'Suspicion de spondyloarthrite axiale',
    region: 'lombaire',
    kind: 'specific',
    requires: 'lombaire.rythme_inflammatoire',
    criteria: [
      { when: 'lombaire.rythme_inflammatoire', weight: 10, label: 'rachialgie de rythme inflammatoire' },
    ],
    actions: ['lombaire.irm-sacro-iliaque', 'lombaire.biologie', 'lombaire.rhumatologie'],
  },

  // ── Voie mécanique ────────────────────────────────────────────────────────
  {
    id: 'lombaire.sacro-iliaque',
    label: 'Dysfonction sacro-iliaque',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [MECANIQUE, 'lombaire.localisation_fessiere'] },
    criteria: [
      { when: 'lombaire.localisation_fessiere', weight: 20, label: 'douleur fessière ou sacro-iliaque' },
    ],
    actions: ['lombaire.cluster-si'],
  },
  {
    id: 'lombaire.discogenique',
    label: 'Douleur discogénique',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [MECANIQUE, 'lombaire.localisation_mediane', 'lombaire.centralisation'] },
    criteria: [
      { when: 'lombaire.centralisation', weight: 20, label: 'phénomène de centralisation aux mouvements répétés' },
    ],
    actions: ['lombaire.mouvements-repetes'],
  },
  {
    id: 'lombaire.facettaire',
    label: 'Syndrome facettaire lombaire',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [MECANIQUE, 'lombaire.localisation_paravertebrale'] },
    criteria: [
      { when: 'lombaire.localisation_paravertebrale', weight: 20, label: 'douleur paravertébrale' },
      { when: 'lombaire.criteres_revel_3plus', weight: 2, label: 'au moins 3 critères de Revel (Sp 66-91 %)' },
    ],
    actions: ['lombaire.revel', 'lombaire.extension-rotation'],
  },
  {
    id: 'lombaire.non-specifique',
    label: 'Lombalgie non spécifique',
    region: 'lombaire',
    kind: 'exclusion',
    requires: MECANIQUE,
    criteria: [
      { when: MECANIQUE, weight: 5, label: 'absence d\'argument pour une cause spécifique' },
      {
        when: 'psychosocial.risque_chronicisation',
        weight: 2,
        label: 'facteurs de risque de chronicisation identifiés',
      },
      {
        when: 'psychosocial.drapeaux_jaunes_2plus',
        weight: 2,
        label: 'drapeaux jaunes au premier plan — abord cognitif à associer au traitement',
      },
      {
        when: 'psychosocial.arret_travail',
        weight: 2,
        label: 'arrêt de travail en cours — prédicteur d\'incapacité prolongée',
      },
      {
        when: 'lombaire.episodes_anterieurs',
        weight: 1,
        label: 'épisodes antérieurs — la récidive est la règle dans la lombalgie commune',
      },
      {
        when: DRAPEAUX_JAUNES,
        weight: 2,
        label: 'au moins deux drapeaux jaunes relevés à l\'interrogatoire',
      },
    ],
    actions: ['lombaire.start-back', 'lombaire.eifel', 'lombaire.pas-imagerie'],
    note: 'Diagnostic d\'exclusion : 80 à 90 % des lombalgies.',
  },
]

export const LUMBAR_ACTIONS: ActionDefinition[] = [
  {
    id: 'lombaire.lasegue',
    kind: 'test',
    label: 'Lasègue ipsilatéral (SLR)',
    performance: 'Sn 0,92 · Sp 0,28 — un négatif écarte, un positif ne confirme pas',
    resolves: ['lombaire.lasegue_positif'],
  },
  {
    id: 'lombaire.lasegue-croise',
    kind: 'test',
    label: 'Lasègue croisé',
    performance: 'Sn 0,28 · Sp 0,90 — un positif pèse, un négatif n\'écarte rien',
    resolves: ['lombaire.lasegue_croise_positif'],
  },
  {
    id: 'lombaire.examen-neurologique',
    kind: 'test',
    label: 'Examen neurologique du membre inférieur (force, réflexes, sensibilité)',
    resolves: ['lombaire.deficit_moteur'],
    note: 'Dorsiflexion et flexion plantaire, rotulien et achilléen, territoires L4, L5 et S1',
  },
  {
    id: 'lombaire.romberg',
    kind: 'test',
    label: 'Romberg et démarche élargie',
    performance: 'Sp > 90 %',
  },
  {
    id: 'lombaire.extension-lombaire',
    kind: 'test',
    label: 'Extension lombaire — reproduit-elle la douleur ?',
    note: 'Une extension reproductrice renforce l\'hypothèse sténosante',
  },
  {
    id: 'lombaire.cluster-si',
    kind: 'test',
    label: 'Cluster sacro-iliaque (distraction, compression, thrust sacré, Gaenslen, FABER, thigh thrust)',
    performance: 'Au moins 3 tests positifs : Sn 80-91 %, Sp 63-79 %',
  },
  {
    id: 'lombaire.mouvements-repetes',
    kind: 'test',
    label: 'Mouvements répétés en flexion et en extension (McKenzie)',
    resolves: ['lombaire.centralisation'],
  },
  {
    id: 'lombaire.revel',
    kind: 'test',
    label: 'Critères de Revel',
    performance: 'Au moins 3 critères sur 7 : Sp 66-91 %',
    resolves: ['lombaire.criteres_revel_3plus'],
  },
  {
    id: 'lombaire.extension-rotation',
    kind: 'test',
    label: 'Extension avec rotation ipsilatérale — reproduit-elle la douleur ?',
  },
  { id: 'lombaire.schober', kind: 'test', label: 'Test de Schober' },
  { id: 'lombaire.expansion-thoracique', kind: 'test', label: 'Mesure de l\'expansion thoracique' },
  {
    id: 'lombaire.dn4',
    kind: 'questionnaire',
    label: 'DN4 — dépistage d\'une composante neuropathique',
    questionnaireId: 'dn4',
  },
  {
    id: 'lombaire.start-back',
    kind: 'questionnaire',
    label: 'STarT Back — risque de chronicisation',
    questionnaireId: 'start-back',
    resolves: ['psychosocial.risque_chronicisation', 'psychosocial.drapeaux_jaunes_2plus'],
  },
  {
    id: 'lombaire.eifel',
    kind: 'questionnaire',
    label: 'EIFEL — retentissement fonctionnel de référence',
    questionnaireId: 'eifel',
  },
  {
    id: 'lombaire.irm',
    kind: 'exam',
    label: 'IRM lombaire',
    urgency: 'urgent',
  },
  {
    id: 'lombaire.irm-si-persistant',
    kind: 'exam',
    label: 'IRM lombaire',
    urgency: 'if_persistent',
    note: 'Si déficit neurologique sévère ou progressif, ou symptômes au-delà de 6 à 8 semaines',
  },
  {
    id: 'lombaire.irm-sacro-iliaque',
    kind: 'exam',
    label: 'IRM des sacro-iliaques',
    urgency: 'if_persistent',
    note: 'Critère ASAS de référence pour la forme non radiographique',
  },
  { id: 'lombaire.radiographie', kind: 'exam', label: 'Radiographies du rachis lombaire', urgency: 'urgent' },
  { id: 'lombaire.biologie', kind: 'exam', label: 'Bilan biologique : NFS, VS, CRP', urgency: 'if_persistent' },
  {
    id: 'lombaire.pas-imagerie',
    kind: 'exam',
    label: 'Pas d\'imagerie en routine',
    urgency: 'not_indicated',
  },
  {
    id: 'lombaire.urgence-neurochirurgicale',
    kind: 'referral',
    label: 'Orientation neurochirurgicale en urgence',
    urgency: 'urgent',
  },
  { id: 'lombaire.avis-medical', kind: 'referral', label: 'Avis médical avant poursuite de la prise en charge', urgency: 'urgent' },
  { id: 'lombaire.rhumatologie', kind: 'referral', label: 'Orientation en rhumatologie', urgency: 'if_persistent' },
]
