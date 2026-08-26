import type { ActionDefinition, HypothesisDefinition, SignalExpr } from '../types'

/**
 * Base de connaissance lombaire.
 *
 * Source de vérité : le document de référence « Base lombaire — moteur
 * d'anamnèse », dont l'architecture en quatre couches est reprise telle
 * quelle — filtre drapeaux rouges, classification en trois catégories,
 * sous-typage pondéré, stratification psychosociale. Chaque valeur chiffrée
 * cite une entrée de `sources.ts`, et chacune a été remontée à sa publication
 * primaire ou marquée comme restant à vérifier.
 *
 * Trois règles du document gouvernent ce fichier :
 *
 *  1. Deux poids asymétriques par cellule (LR+ présent, LR− absent), jamais
 *     dérivés l'un de l'autre par symétrie.
 *  2. Cellule vide = rapport neutre. Un signe non étudié pour une entité n'y
 *     reçoit aucun poids, et surtout pas celui qu'il a ailleurs : un même
 *     signe n'a pas le même pouvoir discriminant d'un diagnostic à l'autre.
 *  3. Priorité au rapport du cluster validé sur le produit des rapports
 *     individuels corrélés — d'où les groupes `correlation`.
 *
 * Ce qui subsiste en `weight` est signalé comme tel : ce sont les priorités
 * structurelles héritées de l'arbre décisionnel historique
 * (`legacy/lumbar-tree.ts`), conservées parce que le test de non-régression
 * les vérifie, et parce qu'aucune publication ne fournit de rapport pour ces
 * profils composites. Ce ne sont pas des mesures et le code ne les présente
 * jamais comme telles.
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
 * Règle de décision de la revue Cochrane : au moins deux drapeaux parmi âge
 * supérieur à 70 ans, traumatisme, corticothérapie et trouble sensitif.
 */
const DEUX_SUR_QUATRE_COCHRANE: SignalExpr = {
  atLeast: 2,
  among: [
    'terrain.age_plus_70',
    'general.traumatisme_recent',
    'terrain.corticotherapie',
    'lombaire.perte_sensitive_ressentie',
  ],
}

const COMBINAISON_FRACTURE: SignalExpr = {
  atLeast: 3,
  among: [
    'terrain.sexe_feminin',
    'terrain.age_plus_70',
    'general.traumatisme_recent',
    'terrain.corticotherapie',
  ],
}

const AGE_ET_SEXE_FRACTURE: SignalExpr = {
  all: ['terrain.age_plus_70', 'terrain.sexe_feminin'],
}

const NEOPLASIE_AVEC_ANTECEDENT: SignalExpr = {
  all: ['terrain.antecedent_cancer', { atLeast: 1, among: [...FACTEURS_NEOPLASIE] }],
}

const NEOPLASIE_SANS_ANTECEDENT: SignalExpr = {
  all: [{ not: 'terrain.antecedent_cancer' }, { atLeast: 2, among: [...FACTEURS_NEOPLASIE] }],
}

const CANCER_ET_PERTE_POIDS: SignalExpr = {
  all: ['terrain.antecedent_cancer', 'general.perte_poids'],
}

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

const INFECTION_FEBRILE: SignalExpr = {
  all: ['general.fievre', { atLeast: 2, among: [...FACTEURS_INFECTION] }],
}

/**
 * Items verbaux critiques du syndrome de la queue de cheval. Un seul suffit :
 * le document interdit explicitement d'attendre une accumulation.
 */
const QUEUE_DE_CHEVAL_VERBAL: SignalExpr = {
  any: [
    'lombaire.queue_de_cheval',
    'lombaire.retention_urinaire',
    'lombaire.anesthesie_selle',
    'lombaire.incontinence_recente',
  ],
}

/** Tableau radiculaire vrai : irradiation basse et jambe plus douloureuse que le dos. */
const RADICULAIRE: SignalExpr = {
  all: [
    'lombaire.irradiation_jambe',
    'lombaire.irradiation_sous_genou',
    'lombaire.jambe_plus_douloureuse',
  ],
}

/**
 * Porte d'entrée du syndrome sténosant. La claudication neurogène y donne
 * accès indépendamment de la latéralité : une sténose se manifeste souvent par
 * une gêne bilatérale, sans jambe « plus douloureuse » que le dos.
 */
const SYNDROME_STENOSANT: SignalExpr = {
  any: [RADICULAIRE, 'lombaire.claudication_neurogene'],
}

/** Voie mécanique : ni radiculaire, ni inflammatoire. */
const MECANIQUE: SignalExpr = {
  all: [{ not: RADICULAIRE }, { not: 'lombaire.rythme_inflammatoire' }],
}

/**
 * Douleur non mécanique : ni modifiée par la position ou le mouvement, ni
 * soulagée par le repos. C'est le déclencheur du filtre viscéral.
 */
const NON_MECANIQUE: SignalExpr = {
  any: ['lombaire.douleur_non_positionnelle', 'general.douleur_repos_constante'],
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

/**
 * Sensibilité focale palpable évoquant un mime périphérique. Devant une
 * douleur de jambe, elle se pèse contre les signes radiculaires objectifs.
 */
const PALPATION_FOCALE_MIME: SignalExpr = {
  any: [
    'lombaire.palpation_trochanter_douloureuse',
    'lombaire.palpation_tuberosite_ischiatique',
    'lombaire.palpation_plantaire_douloureuse',
  ],
}

/** Signes radiculaires objectifs : ce que la palpation focale ne produit jamais. */
const SIGNE_RADICULAIRE_OBJECTIF: SignalExpr = {
  any: [
    'lombaire.deficit_moteur',
    'lombaire.reflexe_achilleen_aboli',
    'lombaire.reflexe_rotulien_aboli',
    'lombaire.douleur_dermatomale',
  ],
}

/**
 * Poids des mimes périphériques (chapitre 7 bis).
 *
 * Le document refuse ici les rapports numériques, que la littérature ne
 * soutient pas pour ces manœuvres, et impose trois niveaux ordinaux. Ce sont
 * donc les seuls poids assumés comme tels du fichier, et ils sont déclarés
 * provisoires et recalibrables par leur propre source.
 */
const POIDS_MIME = { fort: 8, modere: 4, faible: 1 } as const

/**
 * Porte d'entrée commune des mimes périphériques.
 *
 * Le chapitre 7 bis les présente comme une source de faux positifs
 * radiculaires : ils servent à expliquer une douleur de jambe qu'on
 * attribuerait à tort à une racine. Sans douleur de membre, il n'y a rien à
 * expliquer — et proposer de palper une tubérosité ischiatique ou une
 * aponévrose plantaire à quelqu'un qui a mal en barre au bas du dos n'a aucun
 * sens.
 */
const DOULEUR_DE_MEMBRE: SignalExpr = {
  any: ['lombaire.irradiation_jambe', 'lombaire.irradiation_anterieure_cuisse'],
}

/**
 * Règle de rédaction des mimes : tout critère de soutien est conditionné au
 * signe caractéristique du mime.
 *
 * Sans cela, une aggravation en position assise — banale, partagée par la
 * lombalgie commune et la douleur discogénique — suffisait à faire monter une
 * tendinopathie des ischio-jambiers dont personne n'avait palpé la tubérosité.
 * Le document est explicite : le poids d'un mime agit en soustraction du score
 * radiculaire, jamais en confirmation positive absolue.
 */

export const LUMBAR_HYPOTHESES: HypothesisDefinition[] = [
  // ── Couche 1 : drapeaux rouges ────────────────────────────────────────────
  {
    id: 'lombaire.queue-de-cheval',
    label: 'Syndrome de la queue de cheval',
    region: 'lombaire',
    kind: 'red-flag',
    requires: QUEUE_DE_CHEVAL_VERBAL,
    prior: { value: 0.0004, source: 'doc.lombaire' },
    criteria: [
      {
        when: 'lombaire.retention_urinaire',
        alert: 'immediate',
        weight: 100,
        source: 'kuris.2021',
        label: 'rétention urinaire ou dysfonction vésicale récente — item verbal critique',
      },
      {
        when: 'lombaire.anesthesie_selle',
        alert: 'immediate',
        weight: 100,
        source: 'kuris.2021',
        label: 'anesthésie en selle — item verbal critique',
      },
      {
        when: 'lombaire.incontinence_recente',
        alert: 'immediate',
        weight: 100,
        source: 'kuris.2021',
        label: 'incontinence récente — item verbal critique',
      },
      {
        when: 'lombaire.queue_de_cheval',
        alert: 'immediate',
        weight: 100,
        source: 'kuris.2021',
        label: 'signes de compression de la queue de cheval',
      },
      {
        when: 'lombaire.deficit_neuro_progressif',
        alert: 'immediate',
        weight: 100,
        source: 'kuris.2021',
        label: 'déficit neurologique rapidement progressif',
      },
      {
        when: 'lombaire.tonus_anal_diminue',
        alert: 'immediate',
        weight: 40,
        source: 'kuris.2021',
        label: 'tonus anal diminué ou déficit sensitif S3-S5 — signe d\'examen clé',
      },
      {
        when: 'lombaire.areflexie_achilleenne_bilaterale',
        correlation: 'sqc-reflexes',
        label: 'aréflexie achilléenne bilatérale',
        alert: 'elevee',
        lr: { positive: 4.3, source: 'wood.2024' },
      },
      {
        when: 'lombaire.douleur_bilaterale_membres',
        correlation: 'sqc-reflexes',
        label: 'douleur bilatérale des jambes',
        alert: 'vigilance',
        lr: { positive: 2.2, source: 'wood.2024' },
      },
    ],
    actions: ['lombaire.urgence-neurochirurgicale', 'lombaire.irm', 'lombaire.toucher-rectal'],
    note: 'Urgence chirurgicale. Aucune technique manuelle avant avis spécialisé. Un seul item verbal critique suffit : ne pas attendre d\'accumulation.',
  },
  {
    id: 'lombaire.fracture',
    label: 'Fracture vertébrale',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      any: [
        'general.contusion_abrasion',
        COMBINAISON_FRACTURE,
        TRAUMA_AVEC_DEFICIT,
        DEUX_FACTEURS_FRACTURE,
        DEUX_SUR_QUATRE_COCHRANE,
      ],
    },
    prior: { value: 0.024, source: 'reginato.2025' },
    criteria: [
      {
        when: 'general.contusion_abrasion',
        correlation: 'fracture',
        label: 'contusion ou abrasion en regard du rachis',
        alert: 'elevee',
        lr: { positive: 31.09, source: 'han.cochrane.2023' },
      },
      {
        when: TRAUMA_AVEC_DEFICIT,
        correlation: 'fracture',
        cluster: true,
        label: 'traumatisme associé à un déficit neurologique',
        alert: 'elevee',
        lr: { positive: 31.1, source: 'vadod.2022' },
      },
      {
        when: AGE_ET_SEXE_FRACTURE,
        correlation: 'fracture',
        label: 'plus de 70 ans et sexe féminin',
        alert: 'elevee',
        lr: { positive: 16.17, source: 'han.cochrane.2023' },
      },
      {
        when: DEUX_SUR_QUATRE_COCHRANE,
        correlation: 'fracture',
        label: 'au moins deux drapeaux parmi âge, traumatisme, corticothérapie et trouble sensitif',
        alert: 'elevee',
        lr: { positive: 15.48, source: 'han.cochrane.2023' },
      },
      {
        when: 'terrain.corticotherapie',
        correlation: 'fracture',
        label: 'corticothérapie prolongée',
        alert: 'vigilance',
        // Borne basse de l'intervalle publié (3,97–48,50), retenue faute de
        // précision : surestimer un rapport aussi imprécis reviendrait à
        // inventer la valeur qu'on lui préfère.
        lr: { positive: 3.97, source: 'han.cochrane.2023' },
      },
      {
        when: COMBINAISON_FRACTURE,
        weight: 45,
        alert: 'elevee',
        // Probabilité post-test publiée, non convertible en rapport sans la
        // prévalence de l'étude : elle reste un poids, mais sourcé.
        source: 'downie.2013',
        label:
          'au moins trois facteurs parmi sexe féminin, plus de 70 ans, traumatisme et corticothérapie — probabilité post-test 90 % (Downie 2013)',
      },
      {
        when: DEUX_FACTEURS_FRACTURE,
        weight: 20,
        source: 'han.cochrane.2023',
        alert: 'vigilance',
        label: 'au moins deux facteurs de risque de fracture combinés',
      },
    ],
    actions: ['lombaire.radiographie', 'lombaire.avis-medical'],
    note: 'Un facteur isolé n\'est pas informatif : c\'est la combinaison qui alerte. Les rapports proviennent en partie de séries d\'urgence et surestiment probablement le risque en cabinet.',
  },
  {
    id: 'lombaire.neoplasie',
    label: 'Néoplasie ou métastase rachidienne',
    region: 'lombaire',
    kind: 'red-flag',
    requires: { any: [NEOPLASIE_AVEC_ANTECEDENT, NEOPLASIE_SANS_ANTECEDENT] },
    prior: { value: 0.007, source: 'notarangelo.2025' },
    criteria: [
      {
        when: NEOPLASIE_AVEC_ANTECEDENT,
        correlation: 'cancer',
        cluster: true,
        label: 'antécédent de cancer associé à au moins un élément clinique',
        alert: 'elevee',
        lr: { positive: 27.9, source: 'vadod.2022' },
      },
      {
        when: CANCER_ET_PERTE_POIDS,
        correlation: 'cancer',
        label: 'antécédent de cancer et perte de poids inexpliquée',
        alert: 'elevee',
        lr: { positive: 10.25, source: 'notarangelo.2025' },
      },
      {
        when: NEOPLASIE_SANS_ANTECEDENT,
        weight: 20,
        source: 'notarangelo.2025',
        alert: 'vigilance',
        label: 'au moins deux facteurs de risque néoplasique combinés',
      },
    ],
    actions: ['lombaire.irm', 'lombaire.biologie', 'lombaire.avis-medical'],
    note: 'Un drapeau rouge isolé a une spécificité très faible. La perte de poids seule n\'est pas discriminante.',
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
      {
        when: 'terrain.antecedent_cancer',
        weight: 10,
        source: 'notarangelo.2025',
        alert: 'vigilance',
        label: 'antécédent de cancer sans autre élément clinique',
      },
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
        INFECTION_FEBRILE,
        {
          all: [
            { not: 'general.fievre' },
            PORTE_ENTREE_INFECTIEUSE,
            { atLeast: 2, among: [...FACTEURS_INFECTION] },
          ],
        },
      ],
    },
    prior: { value: 0.0001, source: 'doc.lombaire' },
    criteria: [
      {
        when: 'terrain.catheter_infection_recente',
        correlation: 'infection',
        label: 'cathéter vasculaire ou infection récente',
        alert: 'elevee',
        lr: { positive: 15.7, source: 'vadod.2022' },
      },
      {
        when: { all: ['terrain.drogues_iv', PORTE_ENTREE_INFECTIEUSE] },
        correlation: 'infection',
        label: 'usage de drogues intraveineuses avec un autre foyer',
        alert: 'elevee',
        lr: { positive: 13.7, source: 'vadod.2022' },
      },
      {
        when: INFECTION_FEBRILE,
        weight: 30,
        source: 'vadod.2022',
        alert: 'elevee',
        label: 'fièvre associée à au moins un autre facteur infectieux',
      },
    ],
    actions: ['lombaire.biologie', 'lombaire.irm', 'lombaire.avis-medical'],
    note: 'La fièvre seule est insuffisante.',
  },

  // ── Couche 1 bis : filtre viscéral et vasculaire (chapitre 7) ─────────────
  // En accès direct, le thérapeute est le premier filtre médical. Ces
  // hypothèses ne se sous-typent pas : elles bloquent la conclusion de prise en
  // charge manuelle et orientent. Environ 2 % des lombalgies vues en soins
  // primaires sont d'origine viscérale.
  {
    id: 'lombaire.aaa',
    label: 'Anévrisme de l\'aorte abdominale',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      any: [
        'terrain.profil_vasculaire_aaa',
        'terrain.masse_abdominale_pulsatile',
        { all: ['general.douleur_dechirante', 'general.douleur_abdominale_associee'] },
      ],
    },
    criteria: [
      { when: 'terrain.masse_abdominale_pulsatile', weight: 70, alert: 'immediate', source: 'earwood.2025', label: 'masse abdominale pulsatile' },
      {
        when: { all: ['general.douleur_dechirante', 'general.douleur_abdominale_associee'] },
        weight: 70,
        source: 'earwood.2025',
        alert: 'immediate',
        label: 'douleur déchirante abdominale ou dorsale — suspicion de rupture',
      },
      { when: 'terrain.profil_vasculaire_aaa', weight: 60, alert: 'elevee', source: 'earwood.2025', label: 'profil vasculaire évocateur' },
      { when: 'terrain.tabagisme', weight: 4, alert: 'vigilance', source: 'earwood.2025', label: 'tabagisme' },
    ],
    actions: ['lombaire.avis-medical', 'lombaire.echographie-abdominale', 'lombaire.palpation-abdominale'],
    note: 'Douleur déchirante ou masse pulsatile : urgence vasculaire immédiate.',
  },
  {
    id: 'lombaire.origine-renale',
    label: 'Origine rénale ou urologique',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      all: [
        'general.douleur_flanc',
        { any: ['general.hematurie', 'general.troubles_mictionnels', 'general.fievre'] },
      ],
    },
    criteria: [
      { when: 'general.douleur_flanc', weight: 20, alert: 'elevee', source: 'earwood.2025', label: 'douleur de flanc irradiant vers l\'aine' },
      { when: 'general.hematurie', weight: 20, alert: 'elevee', source: 'earwood.2025', label: 'hématurie' },
      { when: 'general.troubles_mictionnels', weight: 10, alert: 'vigilance', source: 'earwood.2025', label: 'troubles mictionnels' },
      { when: 'general.fievre', weight: 15, alert: 'elevee', source: 'earwood.2025', label: 'fièvre associée — pyélonéphrite à évoquer' },
    ],
    actions: ['lombaire.avis-medical'],
    note: 'Colique néphrétique ou pyélonéphrite : bandelette, ECBU, imagerie. Pas de prise en charge manuelle avant élimination.',
  },
  {
    id: 'lombaire.origine-gynecologique',
    label: 'Origine gynécologique',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      all: [
        'terrain.sexe_feminin',
        'general.douleur_abdominale_associee',
        { any: ['general.lien_menstruel', 'general.fievre', 'terrain.grossesse'] },
      ],
    },
    criteria: [
      { when: 'general.lien_menstruel', weight: 20, alert: 'elevee', source: 'earwood.2025', label: 'douleur rythmée par le cycle menstruel' },
      { when: 'general.douleur_abdominale_associee', weight: 10, alert: 'vigilance', source: 'earwood.2025', label: 'douleur pelvienne ou du bas-ventre associée' },
      { when: 'general.fievre', weight: 20, alert: 'elevee', source: 'earwood.2025', label: 'fièvre — salpingite à évoquer' },
      { when: 'terrain.grossesse', weight: 25, alert: 'elevee', source: 'earwood.2025', label: 'grossesse en cours — écarter une grossesse extra-utérine' },
    ],
    actions: ['lombaire.avis-medical'],
    note: 'Endométriose, salpingite, grossesse extra-utérine. Examen médical ou gynécologique.',
  },
  {
    id: 'lombaire.origine-digestive',
    label: 'Origine digestive',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      all: [
        'general.douleur_abdominale_associee',
        { any: ['general.lien_repas', 'general.nausees_vomissements'] },
      ],
    },
    criteria: [
      { when: 'general.lien_repas', weight: 20, alert: 'elevee', source: 'earwood.2025', label: 'douleur liée aux repas' },
      { when: 'general.nausees_vomissements', weight: 12, alert: 'vigilance', source: 'earwood.2025', label: 'nausées ou vomissements' },
      { when: 'general.douleur_dechirante', weight: 15, alert: 'elevee', source: 'earwood.2025', label: 'douleur transfixiante — pancréatite à évoquer' },
    ],
    actions: ['lombaire.avis-medical'],
    note: 'Pancréatite, ulcère, cholécystite. Imagerie abdominale et réorientation médicale.',
  },
  {
    id: 'lombaire.zona',
    label: 'Zona (herpès zoster)',
    region: 'lombaire',
    kind: 'red-flag',
    requires: 'general.eruption_dermatomale',
    criteria: [
      { when: 'general.eruption_dermatomale', weight: 40, alert: 'elevee', source: 'earwood.2025', label: 'éruption vésiculeuse dans le territoire douloureux' },
      { when: 'lombaire.douleur_dermatomale', weight: 6, alert: 'vigilance', source: 'earwood.2025', label: 'douleur unilatérale de topographie dermatomale' },
    ],
    actions: ['lombaire.avis-medical'],
    note: 'Diagnostic clinique. Un traitement antiviral précoce change le pronostic : orienter sans délai.',
  },
  {
    id: 'lombaire.douleur-non-mecanique',
    label: 'Douleur non mécanique — origine extra-rachidienne à écarter',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      all: [
        NON_MECANIQUE,
        { any: ['general.douleur_abdominale_associee', 'general.fievre', 'general.perte_poids', 'general.douleur_nocturne'] },
      ],
    },
    criteria: [
      { when: 'lombaire.douleur_non_positionnelle', weight: 25, alert: 'elevee', source: 'earwood.2025', label: 'douleur non modifiée par la position ni par le mouvement' },
      { when: 'general.douleur_repos_constante', weight: 15, alert: 'vigilance', source: 'earwood.2025', label: 'douleur constante, y compris au repos' },
      { when: 'general.douleur_nocturne', weight: 10, alert: 'vigilance', source: 'earwood.2025', label: 'douleur nocturne indépendante de la posture' },
    ],
    actions: ['lombaire.avis-medical'],
    note: 'Une lombalgie qui ne se modifie ni par la position ni par le mouvement n\'est pas mécanique. Bloquer la conclusion de prise en charge manuelle jusqu\'à réorientation.',
  },

  {
    // Chapitre 7.3 : le discriminant clé contre la sténose. Une douleur de
    // marche qui revient à distance fixe sans dépendre de la posture n'est pas
    // neurogène — et une artériopathie ne relève pas de la thérapie manuelle.
    id: 'lombaire.claudication-vasculaire',
    label: 'Claudication vasculaire',
    region: 'lombaire',
    kind: 'red-flag',
    requires: {
      all: ['lombaire.claudication_distance_fixe', { not: 'lombaire.signe_caddie' }],
    },
    criteria: [
      {
        when: 'lombaire.claudication_distance_fixe',
        weight: 25,
        alert: 'elevee',
        source: 'cashin.2026',
        label: 'douleur de marche à distance fixe, indépendante de la posture',
      },
      {
        when: 'terrain.tabagisme',
        weight: 6,
        alert: 'vigilance',
        source: 'cashin.2026',
        label: 'tabagisme — facteur de risque artériel',
      },
      {
        when: 'terrain.facteurs_vasculaires_50',
        weight: 8,
        alert: 'vigilance',
        source: 'cashin.2026',
        label: 'plus de 50 ans avec facteurs de risque vasculaire',
      },
    ],
    actions: ['lombaire.avis-medical'],
    note: 'À distinguer de la claudication neurogène : celle-ci dépend de la posture et cède en antéflexion. Index cheville-bras et pouls périphériques à faire vérifier.',
  },

  // ── Couche 3 : voie radiculaire ───────────────────────────────────────────
  {
    id: 'lombaire.hernie-discale',
    label: 'Hernie discale lombaire',
    region: 'lombaire',
    kind: 'specific',
    requires: RADICULAIRE,
    criteria: [
      // Priorité structurelle héritée de l'arbre : aucun rapport publié ne
      // couvre ce profil composite.
      { when: PROFIL_DISCAL, weight: 20, label: 'profil discal : au moins deux caractéristiques évocatrices avant 60 ans' },
      {
        when: 'lombaire.rapidh_11plus',
        correlation: 'radiculaire-tension',
        cluster: true,
        label: 'critères RAPIDH ≥ 11/20',
        lr: { positive: 7.1, source: 'genevay.2017' },
      },
      {
        when: 'lombaire.lasegue_croise_positif',
        correlation: 'radiculaire-tension',
        label: 'Lasègue croisé',
        lr: { positive: 2.8, negative: 0.8, source: 'vanderwindt.2010' },
      },
      {
        // Un Lasègue positif ne vaut presque rien (LR+ 1,28), un négatif écarte
        // sérieusement (LR− 0,29). Les paliers d'informativité du moteur font
        // d'eux-mêmes le tri : seul le versant négatif sera retenu.
        when: 'lombaire.lasegue_positif',
        correlation: 'radiculaire-tension',
        label: 'Lasègue',
        lr: { positive: 1.28, negative: 0.29, source: 'vanderwindt.2010' },
      },
      {
        when: 'lombaire.douleur_dermatomale',
        correlation: 'radiculaire-anamnese',
        label: 'douleur radiculaire de topographie dermatomale',
        lr: { positive: 4.1, source: 'bateman.2025' },
      },
      {
        when: 'lombaire.aggrave_toux',
        correlation: 'radiculaire-anamnese',
        label: 'aggravation à la toux ou à l\'éternuement (Valsalva)',
        lr: { positive: 3.2, source: 'bateman.2025' },
      },
      {
        when: 'lombaire.deficit_moteur',
        correlation: 'radiculaire-deficit',
        label: 'déficit moteur objectivé',
        weight: 4,
        source: 'bateman.2025',
      },
      {
        when: 'lombaire.faiblesse_ressentie_jambe',
        correlation: 'radiculaire-deficit',
        label: 'faiblesse ressentie dans le membre',
        lr: { positive: 2.2, source: 'bateman.2025' },
      },
      {
        when: 'lombaire.perte_sensitive_ressentie',
        correlation: 'radiculaire-deficit',
        label: 'perte de sensibilité ressentie dans le membre',
        lr: { positive: 2.1, source: 'bateman.2025' },
      },
      { when: 'lombaire.unilateral', weight: 1, label: 'atteinte unilatérale' },
      { when: 'lombaire.aggrave_assis', weight: 1, label: 'aggravation en position assise' },
      { when: 'lombaire.debut_brutal', weight: 1, label: 'début brutal' },
    ],
    actions: [
      'lombaire.lasegue',
      'lombaire.lasegue-croise',
      'lombaire.examen-neurologique',
      'lombaire.rapidh',
      'lombaire.dn4',
      'lombaire.irm-si-persistant',
    ],
    note: 'Les rapports proviennent de populations de soins secondaires : la performance réelle en cabinet est probablement inférieure.',
  },
  {
    id: 'lombaire.stenose',
    label: 'Sténose spinale lombaire',
    region: 'lombaire',
    kind: 'specific',
    requires: SYNDROME_STENOSANT,
    criteria: [
      {
        // Profil composite hérité de l'arbre. Il recouvre les items posturaux
        // de Suri — il les contient littéralement — et se déclare donc comme
        // leur cluster : quand il est vérifié, il les remplace au lieu de
        // s'y ajouter. Sans cela, le signe du caddie serait compté deux fois.
        // À remplacer par le score composite validé du document
        // (seuil ≥ 7 : LR+ 3,3 · LR− 0,10) le jour où il sera implémenté.
        when: PROFIL_STENOSE,
        correlation: 'stenose-syndrome',
        cluster: true,
        weight: 15,
        label: 'profil sténosant : au moins trois caractéristiques évocatrices',
      },
      {
        when: 'lombaire.demarche_base_elargie',
        correlation: 'stenose-examen',
        label: 'démarche à base élargie',
        lr: { positive: 13, negative: 0.6, source: 'suri.2010' },
      },
      {
        when: 'lombaire.romberg_anormal',
        correlation: 'stenose-examen',
        label: 'signe de Romberg anormal',
        lr: { positive: 4.2, negative: 0.67, source: 'suri.2010' },
      },
      {
        when: 'lombaire.pas_de_douleur_assis',
        correlation: 'stenose-syndrome',
        label: 'absence de douleur en position assise',
        lr: { positive: 7.4, negative: 0.57, source: 'suri.2010' },
      },
      {
        when: 'lombaire.signe_caddie',
        correlation: 'stenose-syndrome',
        label: 'amélioration en se penchant en avant (signe du caddie)',
        lr: { positive: 6.4, negative: 0.52, source: 'suri.2010' },
      },
      {
        when: 'lombaire.trouble_urinaire_inexplique',
        label: 'trouble urinaire inexpliqué',
        lr: { positive: 6.9, negative: 0.88, source: 'suri.2010' },
      },
      {
        when: 'lombaire.douleur_bilaterale_membres',
        label: 'douleur bilatérale des fesses ou des jambes',
        lr: { positive: 6.3, negative: 0.54, source: 'suri.2010' },
      },
      {
        // Le meilleur élément d'exclusion de toute la région : son absence
        // fait plus pour écarter la sténose que sa présence pour la retenir.
        when: 'lombaire.claudication_neurogene',
        correlation: 'stenose-syndrome',
        label: 'claudication neurogène',
        lr: { positive: 3.7, negative: 0.23, source: 'suri.2010' },
      },
      {
        when: 'terrain.age_plus_65',
        correlation: 'stenose-syndrome',
        label: 'âge supérieur à 65 ans',
        lr: { positive: 2.5, negative: 0.34, source: 'suri.2010' },
      },
      {
        when: 'lombaire.aggrave_marche',
        correlation: 'stenose-syndrome',
        weight: 1,
        label: 'aggravation à la marche',
      },
    ],
    actions: [
      'lombaire.romberg',
      'lombaire.extension-lombaire',
      'lombaire.examen-neurologique',
      'lombaire.irm-si-persistant',
    ],
    note: 'Distinguer la claudication vasculaire : celle-ci survient à distance de marche fixe, sans dépendre de la posture, avec des pouls diminués.',
  },
  {
    id: 'lombaire.radiculopathie',
    label: 'Radiculopathie lombaire, niveau à préciser',
    region: 'lombaire',
    kind: 'specific',
    requires: RADICULAIRE,
    criteria: [
      // Priorité structurelle héritée de l'arbre.
      { when: RADICULAIRE, weight: 10, label: 'irradiation sous le genou avec jambe plus douloureuse que le dos' },
      {
        when: 'lombaire.deficit_moteur',
        correlation: 'radiculaire-deficit',
        label: 'déficit moteur objectivé',
        weight: 4,
        source: 'bateman.2025',
      },
      {
        when: 'lombaire.demarche_steppage',
        correlation: 'radiculaire-deficit',
        label: 'démarche en steppage — déficit du releveur, réorientation justifiée',
        weight: 12,
        source: 'khorami.2021',
      },
      {
        when: 'lombaire.reflexe_achilleen_aboli',
        correlation: 'radiculaire-deficit',
        label: 'réflexe achilléen aboli (S1)',
        weight: 4,
        source: 'bateman.2025',
      },
      {
        when: 'lombaire.reflexe_rotulien_aboli',
        correlation: 'radiculaire-deficit',
        label: 'réflexe rotulien aboli (L4)',
        weight: 4,
        source: 'bateman.2025',
      },
      {
        when: 'lombaire.faiblesse_ressentie_jambe',
        correlation: 'radiculaire-deficit',
        label: 'faiblesse ressentie dans la jambe',
        lr: { positive: 2.2, source: 'bateman.2025' },
      },
      {
        // Calibration du chapitre 7 bis : une douleur de jambe sans aucun
        // signe radiculaire objectif mais avec un point douloureux focal doit
        // faire baisser le score radiculaire. Elle ne l'exclut jamais — mime
        // et radiculopathie coexistent dans 18 à 35 % des cas.
        when: { all: [PALPATION_FOCALE_MIME, { not: SIGNE_RADICULAIRE_OBJECTIF }] },
        weight: -POIDS_MIME.fort,
        source: 'jorgensen.2025',
        label: 'sensibilité focale palpable sans aucun signe radiculaire objectif — mime périphérique à explorer',
      },
    ],
    actions: [
      'lombaire.lasegue',
      'lombaire.examen-neurologique',
      'lombaire.rapidh',
      'lombaire.dn4',
    ],
    note: 'Hypothèse résiduelle de la branche radiculaire : ce qu\'on retient quand aucun sous-type ne se détache. Les items discriminants — douleur dermatomale, Valsalva, préférence directionnelle — appartiennent aux entités qu\'elle chapeaute, pas à elle. L5 et S1 font environ 95 % des radiculopathies, et l\'absence de déficit moteur n\'abaisse pas sensiblement la probabilité.',
  },

  // ── Couche 3 : voie inflammatoire ─────────────────────────────────────────
  {
    id: 'lombaire.spa-radiographique',
    label: 'Spondylarthrite ankylosante (sacroiliite radiographique)',
    region: 'lombaire',
    kind: 'specific',
    requires: { all: ['lombaire.rythme_inflammatoire', 'lombaire.sacroiliite_radiographique'] },
    criteria: [
      { when: 'lombaire.sacroiliite_radiographique', weight: 20, source: 'cashin.2026', label: 'sacroiliite objectivée en radiographie' },
      { when: 'lombaire.criteres_asas_4plus', weight: 2, source: 'cashin.2026', label: 'au moins 4 critères ASAS' },
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
      { when: 'lombaire.tableau_clinique_spa', weight: 15, source: 'cashin.2026', label: 'tableau clinique ASAS de spondyloarthrite axiale' },
      { when: 'lombaire.hla_b27', weight: 2, source: 'cashin.2026', label: 'HLA-B27 positif' },
      { when: 'lombaire.manifestations_extra_articulaires', weight: 2, source: 'cashin.2026', label: 'manifestations extra-articulaires' },
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
      { when: 'lombaire.rythme_inflammatoire', weight: 10, source: 'cashin.2026', label: 'rachialgie de rythme inflammatoire' },
    ],
    actions: ['lombaire.irm-sacro-iliaque', 'lombaire.biologie', 'lombaire.rhumatologie'],
    note: 'Douleur fessière alternante, raideur matinale de plus de 30 minutes, réveil en seconde partie de nuit, amélioration à l\'exercice, début avant 45 ans.',
  },

  // ── Couche 3 : voie mécanique ─────────────────────────────────────────────
  {
    id: 'lombaire.sacro-iliaque',
    label: 'Dysfonction sacro-iliaque',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [MECANIQUE, 'lombaire.localisation_fessiere'] },
    criteria: [
      // Priorité structurelle héritée de l'arbre.
      { when: 'lombaire.localisation_fessiere', weight: 20, label: 'douleur fessière ou sacro-iliaque' },
      {
        when: 'lombaire.cluster_laslett_3plus',
        correlation: 'si-provocation',
        cluster: true,
        label: 'au moins trois tests de provocation positifs (cluster de Laslett)',
        lr: { positive: 2.44, negative: 0.31, source: 'han.eclinm.2023' },
      },
      {
        when: 'lombaire.distraction_positif',
        correlation: 'si-provocation',
        label: 'test de distraction positif',
        lr: { positive: 2.18, negative: 0.73, source: 'han.eclinm.2023' },
      },
      {
        when: { not: 'lombaire.localisation_mediane' },
        label: 'absence de douleur lombaire médiane',
        lr: { positive: 2.41, negative: 0.35, source: 'han.eclinm.2023' },
      },
    ],
    actions: ['lombaire.cluster-si'],
    note: 'Un cluster négatif a une forte valeur d\'exclusion. Les tests isolés autres que la distraction ont un rapport proche de 1 : ils ne confirment rien.',
  },
  {
    id: 'lombaire.discogenique',
    label: 'Douleur discogénique',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [MECANIQUE, 'lombaire.localisation_mediane', 'lombaire.centralisation'] },
    criteria: [
      // Priorité structurelle héritée de l'arbre.
      { when: 'lombaire.centralisation', weight: 20, label: 'phénomène de centralisation aux mouvements répétés' },
      {
        when: 'lombaire.preference_directionnelle',
        correlation: 'disque-mouvements',
        label: 'préférence directionnelle au testing répété',
        lr: { positive: 7.65, negative: 0.56, source: 'deneuville.2025' },
      },
      {
        when: 'lombaire.centralisation',
        correlation: 'disque-mouvements',
        label: 'centralisation aux mouvements répétés',
        // Borne basse de l'intervalle publié (3,06–5,57).
        lr: { positive: 3.06, negative: 0.66, source: 'deneuville.2025' },
      },
      {
        when: 'lombaire.tonosu_31plus',
        label: 'questionnaire d\'entretien de Tonosu ≥ 31/47',
        lr: { positive: 3.5, source: 'tonosu.2016' },
      },
    ],
    actions: ['lombaire.mouvements-repetes', 'lombaire.tonosu'],
    note: 'Centralisation et préférence directionnelle sont les seuls items d\'examen à rapport informatif. Le score de Tonosu à 100 % de sensibilité écarte fortement quand il est bas, mais son rapport négatif ponctuel est nul et son intervalle large : il n\'est pas codé.',
  },
  {
    id: 'lombaire.facettaire',
    label: 'Syndrome facettaire lombaire',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [MECANIQUE, 'lombaire.localisation_paravertebrale'] },
    criteria: [
      // Priorité structurelle héritée de l'arbre.
      { when: 'lombaire.localisation_paravertebrale', weight: 20, label: 'douleur paravertébrale' },
      { when: 'lombaire.criteres_revel_3plus', weight: 2, source: 'revel.1998', label: 'au moins 3 critères de Revel' },
      {
        when: { any: ['lombaire.aggrave_extension', 'lombaire.extension_reproduit_douleur'] },
        weight: 2,
        source: 'knezevic.2021',
        label: 'aggravation en extension',
      },
    ],
    actions: ['lombaire.revel', 'lombaire.extension-rotation'],
    note: 'Aucune manœuvre clinique n\'a une bonne exactitude pour la source facettaire isolée : les poids restent faibles à dessein.',
  },
  {
    id: 'lombaire.spondylolisthesis',
    label: 'Spondylolisthésis ou instabilité lombaire',
    region: 'lombaire',
    kind: 'mechanical',
    requires: {
      any: [
        'lombaire.step_off_palpable',
        'lombaire.low_midline_sill_sign',
        'lombaire.interspinous_gap_change',
      ],
    },
    criteria: [
      {
        when: 'lombaire.low_midline_sill_sign',
        correlation: 'listhesis-palpation',
        label: 'low midline sill sign',
        lr: { positive: 7.5, negative: 0.21, source: 'ahn.2015' },
      },
      {
        when: 'lombaire.step_off_palpable',
        correlation: 'listhesis-palpation',
        label: 'décrochage palpable sur les épineuses',
        weight: 12,
        source: 'moller.2000',
      },
      {
        when: 'lombaire.interspinous_gap_change',
        label: 'variation de l\'écart interépineux en flexion-extension',
        lr: { positive: 2.1, negative: 0.29, source: 'ahn.2015' },
      },
    ],
    actions: ['lombaire.palpation-epineuses', 'lombaire.radiographie-dynamique'],
    note: 'L\'anamnèse verbale du spondylolisthésis adulte est superposable à celle de la lombalgie non spécifique : le diagnostic repose sur la palpation et l\'imagerie dynamique, jamais sur le récit seul.',
  },

  // ── Chapitre 7 bis : mimes périphériques ──────────────────────────────────
  // Ces hypothèses n'excluent jamais une radiculopathie : elles coexistent
  // avec elle dans une part importante des cas. Leur intérêt est d'expliquer
  // une douleur de jambe sans signe radiculaire objectif, et d'éviter le faux
  // positif radiculaire.
  {
    id: 'lombaire.grand-trochanter',
    label: 'Syndrome douloureux du grand trochanter',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [DOULEUR_DE_MEMBRE, 'lombaire.palpation_trochanter_douloureuse'] },
    criteria: [
      {
        when: 'lombaire.palpation_trochanter_douloureuse',
        weight: POIDS_MIME.fort,
        source: 'jorgensen.2025',
        label: 'palpation du grand trochanter douloureuse et reproductible — meilleur discriminant du groupe',
      },
      {
        when: {
          all: ['lombaire.palpation_trochanter_douloureuse', 'lombaire.douleur_decubitus_lateral'],
        },
        weight: POIDS_MIME.modere,
        source: 'jorgensen.2025',
        label: 'douleur en décubitus latéral sur le côté atteint',
      },
      {
        when: { all: ['lombaire.palpation_trochanter_douloureuse', 'terrain.sexe_feminin'] },
        weight: POIDS_MIME.faible,
        source: 'jorgensen.2025',
        label: 'sexe féminin',
      },
    ],
    actions: ['lombaire.palpation-trochanter'],
    note: 'Imite une radiculopathie L3-L5. Coexiste avec elle dans 18 à 35 % des cas : ne l\'écarte pas.',
  },
  {
    id: 'lombaire.ischio-jambiers',
    label: 'Tendinopathie proximale des ischio-jambiers',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [DOULEUR_DE_MEMBRE, 'lombaire.palpation_tuberosite_ischiatique'] },
    criteria: [
      {
        when: 'lombaire.palpation_tuberosite_ischiatique',
        weight: POIDS_MIME.fort,
        source: 'jorgensen.2025',
        label: 'palpation de la tubérosité ischiatique douloureuse et reproductible',
      },
      {
        when: { all: ['lombaire.palpation_tuberosite_ischiatique', 'lombaire.aggrave_assis'] },
        weight: POIDS_MIME.modere,
        source: 'jorgensen.2025',
        label: 'aggravation en position assise prolongée',
      },
    ],
    actions: ['lombaire.palpation-ischiatique'],
    note: 'Imite une radiculopathie S1 : fesse basse et face postérieure de cuisse.',
  },
  {
    id: 'lombaire.meralgie',
    label: 'Méralgie paresthésique',
    region: 'lombaire',
    kind: 'mechanical',
    requires: {
      all: [
        DOULEUR_DE_MEMBRE,
        'lombaire.paresthesies_anterolaterale_cuisse',
        { not: 'lombaire.deficit_moteur' },
      ],
    },
    criteria: [
      {
        when: 'lombaire.paresthesies_anterolaterale_cuisse',
        weight: POIDS_MIME.modere,
        source: 'jorgensen.2025',
        label: 'paresthésies purement sensitives de la face antérolatérale de cuisse',
      },
      {
        when: {
          all: [
            'lombaire.paresthesies_anterolaterale_cuisse',
            { not: 'lombaire.irradiation_sous_genou' },
          ],
        },
        weight: POIDS_MIME.modere,
        source: 'jorgensen.2025',
        label: 'paresthésies de cuisse sans extension sous le genou',
      },
    ],
    actions: ['lombaire.examen-neurologique'],
    note: 'Imite une radiculopathie L2-L3. Tableau purement sensitif, topographie non dermatomale, sans déficit moteur ni réflexe.',
  },
  {
    id: 'lombaire.fasciite-plantaire',
    label: 'Fasciite plantaire',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: [DOULEUR_DE_MEMBRE, 'lombaire.douleur_plantaire_premiers_pas'] },
    criteria: [
      {
        when: 'lombaire.douleur_plantaire_premiers_pas',
        correlation: 'plantaire',
        weight: POIDS_MIME.modere,
        source: 'jorgensen.2025',
        label: 'douleur plantaire aux premiers pas',
      },
      {
        when: 'lombaire.palpation_plantaire_douloureuse',
        correlation: 'plantaire',
        weight: POIDS_MIME.fort,
        source: 'jorgensen.2025',
        label: 'douleur plantaire reproduite à la palpation',
      },
      {
        when: {
          all: ['lombaire.douleur_plantaire_premiers_pas', { not: 'lombaire.irradiation_jambe' }],
        },
        weight: POIDS_MIME.modere,
        source: 'jorgensen.2025',
        label: 'douleur plantaire sans trajet proximal',
      },
    ],
    actions: ['lombaire.palpation-plantaire'],
    note: 'Imite une radiculopathie S1.',
  },
  {
    id: 'lombaire.hanche',
    label: 'Pathologie de hanche (coxarthrose)',
    region: 'lombaire',
    kind: 'mechanical',
    requires: { all: ['lombaire.douleur_inguinale', { not: 'lombaire.deficit_moteur' }] },
    criteria: [
      { when: 'lombaire.douleur_inguinale', weight: POIDS_MIME.modere, source: 'jorgensen.2025', label: 'douleur inguinale' },
      {
        when: {
          all: ['lombaire.douleur_inguinale', 'lombaire.irradiation_anterieure_cuisse'],
        },
        weight: POIDS_MIME.modere,
        source: 'jorgensen.2025',
        label: 'douleur de la cuisse antéro-latérale',
      },
      {
        when: {
          all: ['lombaire.douleur_inguinale', 'lombaire.limitation_amplitude_hanche'],
        },
        weight: POIDS_MIME.modere,
        source: 'jorgensen.2025',
        label: 'douleur inguinale avec limitation d\'amplitude de hanche',
      },
    ],
    actions: ['lombaire.amplitudes-hanche'],
    note: 'Imite une radiculopathie L2-L4, parfois sous le genou. Sensible mais peu spécifique : douleur inguinale et limitation d\'amplitude ensemble sont évocatrices.',
  },

  // ── Chapitre 10 : population pédiatrique et sportive ──────────────────────
  {
    id: 'lombaire.spondylolyse',
    label: 'Spondylolyse (fracture de stress du pars)',
    region: 'lombaire',
    kind: 'specific',
    requires: {
      all: [
        'terrain.adolescent_sportif',
        {
          any: [
            'lombaire.aggrave_extension',
            'lombaire.extension_reproduit_douleur',
            'lombaire.sport_hyperextension_rotation',
          ],
        },
      ],
    },
    criteria: [
      { when: 'terrain.adolescent_sportif', weight: POIDS_MIME.modere, source: 'macdonald.2017', label: 'adolescent ou jeune sportif — atteinte des éléments postérieurs plus fréquente que la pathologie discale' },
      { when: 'lombaire.sport_hyperextension_rotation', weight: POIDS_MIME.modere, source: 'macdonald.2017', label: 'sport en hyperextension ou rotation répétée' },
      {
        when: { any: ['lombaire.aggrave_extension', 'lombaire.extension_reproduit_douleur'] },
        weight: POIDS_MIME.modere,
        source: 'macdonald.2017',
        label: 'douleur reproduite en extension',
      },
      { when: 'lombaire.test_cigogne_positif', weight: POIDS_MIME.faible, source: 'macdonald.2017', label: 'test de la cigogne positif — peu spécifique isolément' },
      { when: 'lombaire.step_off_palpable', weight: POIDS_MIME.fort, source: 'macdonald.2017', label: 'décrochage palpable' },
    ],
    actions: ['lombaire.test-cigogne', 'lombaire.palpation-epineuses', 'lombaire.avis-medical'],
    note: 'Chez le jeune athlète, la spondylolyse est plus fréquente que la pathologie discale. Drapeaux rouges pédiatriques propres : âge inférieur à 5 ans, symptômes au-delà de 4 semaines, signes systémiques, douleur nocturne.',
  },

  // ── Couche 2 : diagnostic résiduel ────────────────────────────────────────
  {
    id: 'lombaire.non-specifique',
    label: 'Lombalgie non spécifique',
    region: 'lombaire',
    kind: 'exclusion',
    requires: MECANIQUE,
    criteria: [
      { when: MECANIQUE, label: 'absence d\'argument pour une cause spécifique' },
      {
        when: 'lombaire.localisation_diffuse',
        label: 'douleur axiale diffuse, sans siège précis — présentation la plus courante',
      },
      { when: 'lombaire.duree_aigue', label: 'épisode aigu — évolution favorable attendue' },
      {
        when: { not: 'lombaire.duree_aigue' },
        label: 'épisode installé au-delà de la phase aiguë',
      },
      {
        // Une irradiation qui s'arrête à la fesse ou à la cuisse postérieure
        // est une douleur référée, pas une douleur radiculaire : c'est le
        // tableau attendu de la lombalgie commune.
        when: {
          all: ['lombaire.irradiation_fessiere', { not: 'lombaire.irradiation_sous_genou' }],
        },
        label: 'douleur référée à la fesse, sans extension sous le genou',
      },
      { when: 'lombaire.episodes_anterieurs', label: 'épisodes antérieurs — la récidive est la règle dans la lombalgie commune' },
      { when: 'lombaire.geste_declenchant', label: 'geste ou effort déclenchant' },
    ],
    actions: ['lombaire.start-back', 'lombaire.eifel', 'lombaire.pas-imagerie'],
    note: 'Diagnostic d\'exclusion : 80 à 90 % des lombalgies. Il ne se score pas — il est ce qui reste quand rien de spécifique n\'a été retenu.',
  },

  // ── Couche 4 : stratification psychosociale ───────────────────────────────
  {
    id: 'lombaire.chronicisation',
    label: 'Risque de chronicisation',
    region: 'lombaire',
    kind: 'profil',
    criteria: [
      { when: 'psychosocial.risque_chronicisation', weight: 10, source: 'cashin.2026', label: 'risque de chronicisation identifié au questionnaire' },
      { when: DRAPEAUX_JAUNES, weight: 6, source: 'cashin.2026', label: 'au moins deux drapeaux jaunes relevés à l\'interrogatoire' },
      { when: 'psychosocial.drapeaux_jaunes_2plus', weight: 6, source: 'cashin.2026', label: 'drapeaux jaunes au premier plan — abord cognitif à associer au traitement' },
      { when: 'psychosocial.arret_travail', weight: 4, source: 'cashin.2026', label: 'arrêt de travail en cours — prédicteur d\'incapacité prolongée' },
    ],
    actions: ['lombaire.start-back', 'lombaire.tsk', 'lombaire.pcs', 'lombaire.hads'],
    note: 'Un drapeau jaune isolé ne pèse pas : c\'est leur accumulation qui prédit. Environ un tiers des lombalgies aiguës se chronicisent, et les facteurs psychosociaux le prédisent mieux que les facteurs biomécaniques. Le STarT Back prédit l\'incapacité future plus que la douleur chronique elle-même.',
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
    resolves: [
      'lombaire.deficit_moteur',
      'lombaire.reflexe_achilleen_aboli',
      'lombaire.reflexe_rotulien_aboli',
      'lombaire.areflexie_achilleenne_bilaterale',
    ],
    note: 'Dorsiflexion et flexion plantaire, rotulien et achilléen, territoires L4, L5 et S1. L5 et S1 font environ 95 % des radiculopathies.',
  },
  {
    id: 'lombaire.rapidh',
    kind: 'test',
    label: 'Critères RAPIDH (douleur monoradiculaire 6, Lasègue < 60° 4, réflexe unilatéral 4, déficit moteur 3, douleur de jambe unilatérale 3)',
    performance: 'Seuil ≥ 11/20 : Sn 0,71 · Sp 0,90',
    resolves: ['lombaire.rapidh_11plus'],
  },
  {
    id: 'lombaire.romberg',
    kind: 'test',
    label: 'Romberg et analyse de la démarche',
    performance: 'Démarche à base élargie LR+ 13 · Romberg anormal LR+ 4,2',
    resolves: [
      'lombaire.romberg_anormal',
      'lombaire.demarche_base_elargie',
      'lombaire.demarche_steppage',
    ],
  },
  {
    id: 'lombaire.extension-lombaire',
    kind: 'test',
    label: 'Extension lombaire — reproduit-elle la douleur ?',
    resolves: ['lombaire.extension_reproduit_douleur'],
  },
  {
    id: 'lombaire.cluster-si',
    kind: 'test',
    label: 'Cluster sacro-iliaque (distraction, compression, thrust sacré, Gaenslen, FABER, thigh thrust)',
    performance: 'Au moins 3 tests positifs : LR+ 2,44 · LR− 0,31',
    resolves: ['lombaire.cluster_laslett_3plus', 'lombaire.distraction_positif'],
  },
  {
    id: 'lombaire.mouvements-repetes',
    kind: 'test',
    label: 'Mouvements répétés en flexion et en extension (McKenzie)',
    performance: 'Préférence directionnelle LR+ 7,65 · centralisation LR+ 3,06',
    resolves: ['lombaire.centralisation', 'lombaire.preference_directionnelle'],
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
  {
    id: 'lombaire.palpation-epineuses',
    kind: 'test',
    label: 'Palpation des épineuses : décrochage, low midline sill sign, écart interépineux en flexion-extension',
    performance: 'Low midline sill sign LR+ 7,5 · LR− 0,21',
    resolves: [
      'lombaire.step_off_palpable',
      'lombaire.low_midline_sill_sign',
      'lombaire.interspinous_gap_change',
      'general.douleur_mediane_epineuse',
    ],
  },
  {
    id: 'lombaire.test-cigogne',
    kind: 'test',
    label: 'Test de la cigogne (extension en appui unipodal)',
    performance: 'Sn 0,50-0,73 · Sp 0,17-0,32 — peu spécifique',
    resolves: ['lombaire.test_cigogne_positif'],
  },
  {
    id: 'lombaire.palpation-trochanter',
    kind: 'test',
    label: 'Palpation du grand trochanter',
    resolves: ['lombaire.palpation_trochanter_douloureuse'],
  },
  {
    id: 'lombaire.palpation-ischiatique',
    kind: 'test',
    label: 'Palpation de la tubérosité ischiatique et mise en tension des ischio-jambiers',
    resolves: ['lombaire.palpation_tuberosite_ischiatique'],
  },
  {
    id: 'lombaire.palpation-plantaire',
    kind: 'test',
    label: 'Palpation de l\'aponévrose plantaire',
    resolves: ['lombaire.palpation_plantaire_douloureuse'],
  },
  {
    id: 'lombaire.palpation-abdominale',
    kind: 'test',
    label: 'Palpation abdominale — masse pulsatile ?',
    resolves: ['terrain.masse_abdominale_pulsatile'],
  },
  {
    // L'orientation ne l'attend pas : l'item verbal suffit. Le test reste
    // proposé, mais après elle — le classement des actions urgentes met la
    // réorientation en premier.
    id: 'lombaire.toucher-rectal',
    kind: 'test',
    label: 'Tonus anal et sensibilité S3-S5',
    resolves: ['lombaire.tonus_anal_diminue'],
    note: 'Utilité du toucher rectal isolé discutée : c\'est l\'item verbal qui déclenche l\'orientation.',
  },
  {
    id: 'lombaire.amplitudes-hanche',
    kind: 'test',
    label: 'Amplitudes de hanche et FADIR',
    resolves: ['lombaire.limitation_amplitude_hanche'],
  },
  { id: 'lombaire.schober', kind: 'test', label: 'Test de Schober' },
  { id: 'lombaire.expansion-thoracique', kind: 'test', label: 'Mesure de l\'expansion thoracique' },
  {
    id: 'lombaire.tonosu',
    kind: 'questionnaire',
    label: 'Tonosu — entretien orienté douleur discogénique',
    performance: 'Seuil ≥ 31/47 : Se 100 % · Sp 71 %',
    resolves: ['lombaire.tonosu_31plus'],
  },
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
    id: 'lombaire.tsk',
    kind: 'questionnaire',
    label: 'TSK-11 — kinésiophobie',
    questionnaireId: 'tsk-11',
  },
  {
    id: 'lombaire.pcs',
    kind: 'questionnaire',
    label: 'PCS — catastrophisme',
    questionnaireId: 'pcs',
  },
  {
    id: 'lombaire.hads',
    kind: 'questionnaire',
    label: 'HADS — anxiété et dépression',
    questionnaireId: 'hads',
  },
  {
    id: 'lombaire.eifel',
    kind: 'questionnaire',
    label: 'EIFEL — retentissement fonctionnel de référence',
    questionnaireId: 'eifel',
  },
  { id: 'lombaire.irm', kind: 'exam', label: 'IRM lombaire', urgency: 'urgent' },
  {
    id: 'lombaire.irm-si-persistant',
    kind: 'exam',
    label: 'IRM lombaire',
    urgency: 'if_persistent',
    note: 'Si déficit neurologique sévère ou progressif, ou symptômes au-delà de 6 à 8 semaines. Imagerie de routine non recommandée.',
  },
  {
    id: 'lombaire.irm-sacro-iliaque',
    kind: 'exam',
    label: 'IRM des sacro-iliaques',
    urgency: 'if_persistent',
    note: 'Critère ASAS de référence pour la forme non radiographique',
  },
  {
    id: 'lombaire.radiographie',
    kind: 'exam',
    label: 'Radiographies du rachis lombaire',
    urgency: 'urgent',
    resolves: ['lombaire.sacroiliite_radiographique'],
  },
  {
    id: 'lombaire.radiographie-dynamique',
    kind: 'exam',
    label: 'Radiographies dynamiques en flexion-extension',
    urgency: 'if_persistent',
    note: 'Examen de référence du spondylolisthésis et de l\'instabilité',
  },
  {
    id: 'lombaire.echographie-abdominale',
    kind: 'exam',
    label: 'Échographie abdominale',
    urgency: 'urgent',
  },
  {
    id: 'lombaire.biologie',
    kind: 'exam',
    label: 'Bilan biologique : NFS, VS, CRP',
    urgency: 'if_persistent',
    resolves: ['lombaire.hla_b27'],
  },
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
