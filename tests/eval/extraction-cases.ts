import type { SignalId } from '@/lib/reasoning'

/**
 * Cas d'évaluation de l'extraction.
 *
 * Chaque cas est une anamnèse telle qu'elle sort de la dictée — langage parlé,
 * hésitations comprises — avec les signaux qu'un praticien s'attendrait à voir
 * relevés. `attendus` sert au rappel, `interdits` à la précision : ce sont les
 * confusions plausibles qu'un modèle trop pressé commettrait.
 */
export interface CasExtraction {
  nom: string
  motif: string
  anamnese: string
  attendus: Partial<Record<SignalId, boolean>>
  interdits?: SignalId[]
}

export const CAS_EXTRACTION: CasExtraction[] = [
  {
    nom: 'sciatique aiguë, début brutal',
    motif: 'Lombalgie avec sciatique droite',
    anamnese:
      "Alors voilà, ça a commencé il y a trois jours, j'ai soulevé une caisse dans le garage et j'ai senti comme un craquement. Depuis, la douleur descend dans la jambe droite jusqu'au pied. Franchement la jambe me fait plus mal que le dos. Quand je tousse ça me réveille la douleur, et rester assis c'est le pire. Pas de fièvre, je n'ai pas perdu de poids, jamais eu de cancer.",
    attendus: {
      'lombaire.debut_brutal': true,
      'lombaire.geste_declenchant': true,
      'lombaire.irradiation_jambe': true,
      'lombaire.irradiation_sous_genou': true,
      'lombaire.jambe_plus_douloureuse': true,
      'lombaire.aggrave_toux': true,
      'lombaire.aggrave_assis': true,
      'general.fievre': false,
      'general.perte_poids': false,
      'terrain.antecedent_cancer': false,
    },
    interdits: ['lombaire.rythme_inflammatoire', 'lombaire.queue_de_cheval'],
  },
  {
    nom: 'lombalgie chronique, profil psychosocial',
    motif: 'Lombalgie chronique',
    anamnese:
      "Ça fait bien six mois que j'ai mal en bas du dos, c'est diffus des deux côtés. Ça ne descend pas dans les jambes. Je suis en arrêt depuis deux mois et honnêtement j'ose plus bouger, j'ai peur d'aggraver. Je me demande s'il n'y a pas quelque chose de cassé. Le repos me soulage un peu, les anti-inflammatoires aussi. Mon boulot c'est de la manutention, je porte des charges toute la journée.",
    attendus: {
      'lombaire.duree_aigue': false,
      'lombaire.localisation_diffuse': true,
      'lombaire.irradiation_jambe': false,
      'psychosocial.arret_travail': true,
      'psychosocial.peur_mouvement': true,
      'psychosocial.croyance_lesion_grave': true,
      'general.soulage_repos': true,
      'traitement.ains': true,
      'contexte.charges_travail': true,
    },
    interdits: ['general.douleur_persistante_traitement'],
  },
  {
    nom: 'les antalgiques soulagent',
    motif: 'Lombalgie commune',
    anamnese:
      "J'ai mal depuis une dizaine de jours, c'est supportable. Le paracétamol me soulage bien, dès que j'en prends ça passe. Je dors correctement, pas de réveil la nuit à cause du dos.",
    attendus: {
      'general.douleur_persistante_traitement': false,
      'general.sommeil_perturbe': false,
      'general.douleur_nocturne': false,
    },
  },
  {
    nom: 'rachialgie inflammatoire',
    motif: 'Lombalgie de rythme inflammatoire',
    anamnese:
      "J'ai 28 ans, ça fait presque un an que j'ai mal au bas du dos. Le matin je suis complètement rouillé, il me faut une bonne heure pour me dérouiller. Et curieusement, plus je bouge mieux c'est. Je me réveille en fin de nuit à cause de la douleur. J'ai fait une uvéite l'an dernier.",
    attendus: {
      'lombaire.rythme_inflammatoire': true,
      'lombaire.manifestations_extra_articulaires': true,
      'facteur.soulage_mouvement': true,
      'rythme.matinal': true,
      'lombaire.duree_aigue': false,
    },
    interdits: ['lombaire.irradiation_sous_genou'],
  },
  {
    nom: 'drapeau rouge néoplasique',
    motif: 'Lombalgie persistante',
    anamnese:
      "J'ai 68 ans, j'ai eu un cancer du sein il y a six ans. Depuis deux mois j'ai mal dans le bas du dos, ça me réveille en deuxième partie de nuit et j'ai perdu cinq kilos sans faire exprès. Le traitement du médecin ne change rien.",
    attendus: {
      'terrain.antecedent_cancer': true,
      'general.douleur_nocturne': true,
      'general.perte_poids': true,
      'general.douleur_persistante_traitement': true,
    },
  },
  {
    nom: 'cervicalgie post-whiplash',
    motif: 'Cervicalgie après accident de la route',
    anamnese:
      "J'ai été percutée par l'arrière au feu rouge il y a cinq jours. Depuis j'ai le cou raide, ça tire vers l'omoplate droite. Pas de fourmillement dans les bras, pas de vertige, pas de trouble de la vue. Je tourne la tête mais c'est limité à droite.",
    attendus: {
      'cervical.whiplash': true,
      'general.traumatisme_recent': true,
      'cervical.irradiation_omoplate': true,
      'cervical.limitation_ressentie': true,
      'cervical.paresthesies_bras': false,
      'cervical.vertiges': false,
    },
    interdits: ['cervical.cephalee_brutale', 'cervical.signes_neuro_dissection'],
  },
  {
    nom: 'céphalée cervicogénique',
    motif: 'Céphalées et cervicalgie',
    anamnese:
      "J'ai des maux de tête presque tous les jours, ça part de la nuque et ça remonte derrière le crâne, toujours du même côté. Je travaille huit heures par jour devant l'écran. Le soir c'est pire. Pas de nausée, pas de gêne à la lumière.",
    attendus: {
      'cervical.cephalees': true,
      'cervical.localisation_suboccipitale': true,
      'cervical.irradiation_occiput': true,
      'contexte.travail_ecran': true,
      'rythme.vesperal': true,
    },
    interdits: ['cervical.cephalee_brutale'],
  },
  {
    nom: 'anamnèse pauvre, ne rien inventer',
    motif: 'Mal de dos',
    anamnese: "J'ai mal au dos depuis quelques jours. Voilà.",
    attendus: {},
    interdits: [
      'lombaire.irradiation_jambe',
      'lombaire.debut_brutal',
      'general.fievre',
      'lombaire.rythme_inflammatoire',
      'psychosocial.peur_mouvement',
    ],
  },
]
