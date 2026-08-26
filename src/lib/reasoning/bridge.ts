import type { TreeState } from './legacy/lumbar-tree'
import type { NeckTreeState } from './legacy/cervical-tree'
import type { SignalId } from './signals'

type SignalSet = Partial<Record<SignalId, boolean>>

/**
 * Passerelle entre les arbres décisionnels historiques et le vocabulaire de
 * signaux. Elle sert deux usages : rejouer un parcours d'arbre dans le moteur
 * pour vérifier qu'il conclut pareil, et — plus tard — reprendre un arbre
 * commencé dans la modale sans perdre les réponses déjà données.
 *
 * Règle de lecture : une étape n'est considérée comme renseignée que si l'arbre
 * l'a effectivement franchie. Tant qu'elle ne l'est pas, les signaux
 * correspondants restent inconnus plutôt que d'être présumés absents.
 */

/** Réponse d'arbre (`'yes' | 'no' | null`) vers booléen ternaire. */
function tri(answer: string | null | undefined): boolean | undefined {
  if (answer === 'yes') return true
  if (answer === 'no') return false
  return undefined
}

/** Applique une liste de cases à cocher : tout ce qui n'est pas coché est faux. */
function applyChecks(
  target: SignalSet,
  checks: string[],
  mapping: Record<string, SignalId | SignalId[]>,
) {
  for (const [value, signal] of Object.entries(mapping)) {
    const present = checks.includes(value)
    for (const id of Array.isArray(signal) ? signal : [signal]) target[id] = present
  }
}

export function lumbarTreeStateToSignals(state: TreeState): SignalSet {
  const signals: SignalSet = {}

  if (state.q_duration) signals['lombaire.duree_aigue'] = state.q_duration === 'acute'
  signals['lombaire.queue_de_cheval'] = tri(state.q1_cauda_equina)
  // L'arbre posait la question en bloc — troubles sphinctériens, anesthésie en
  // selle, déficit progressif. Le moteur les distingue désormais : une réponse
  // globale renseigne donc chacun d'eux, sans quoi l'hypothèse resterait en
  // attente là où l'arbre l'avait écartée.
  signals['lombaire.retention_urinaire'] = tri(state.q1_cauda_equina)
  signals['lombaire.anesthesie_selle'] = tri(state.q1_cauda_equina)
  signals['lombaire.incontinence_recente'] = tri(state.q1_cauda_equina)

  if (state.q2_fracture !== null) {
    applyChecks(signals, state.q2_checks, {
      trauma: 'general.traumatisme_recent',
      neuro: 'general.deficit_neuro_post_traumatique',
      age70: 'terrain.age_plus_70',
      steroids: 'terrain.corticotherapie',
      osteo: 'terrain.osteoporose',
      medial_pain: 'general.douleur_mediane_epineuse',
    })
  }

  if (state.q3_neoplasia !== null) {
    applyChecks(signals, state.q3_checks, {
      cancer_hx: 'terrain.antecedent_cancer',
      weight_loss: 'general.perte_poids',
      night_pain: 'general.douleur_nocturne',
      age50: 'terrain.age_50_facteurs_cancer',
      persistent: 'general.douleur_persistante_traitement',
    })
  }

  if (state.q4_infection !== null) {
    applyChecks(signals, state.q4_checks, {
      fever: 'general.fievre',
      immuno: 'terrain.immunodepression',
      iv_drugs: 'terrain.drogues_iv',
      catheter: 'terrain.catheter_infection_recente',
      rest_pain: 'general.douleur_repos_constante',
    })
  }

  signals['terrain.profil_vasculaire_aaa'] = tri(state.q5_aaa)

  signals['lombaire.irradiation_jambe'] = tri(state.q6_radiation)
  signals['lombaire.irradiation_sous_genou'] = tri(state.q6_below_knee)
  signals['lombaire.jambe_plus_douloureuse'] = tri(state.q6_leg_worse)

  signals['terrain.age_moins_60'] = tri(state.q7_age_under60)
  signals['lombaire.unilateral'] = tri(state.q7_unilateral)
  signals['lombaire.aggrave_assis'] = tri(state.q7_worse_sitting)
  signals['lombaire.aggrave_marche'] = tri(state.q7_worse_walking)
  signals['lombaire.signe_caddie'] = tri(state.q7_shopping_cart)
  signals['lombaire.debut_brutal'] = tri(state.q7_sudden_onset)
  signals['lombaire.aggrave_toux'] = tri(state.q7_cough_sneeze)

  signals['lombaire.rythme_inflammatoire'] = tri(state.q9_inflammatory)
  if (state.q9_inflammatory !== null) {
    signals['lombaire.criteres_asas_4plus'] = state.q9_criteria >= 4
    signals['lombaire.manifestations_extra_articulaires'] = state.q9_extra_articular
  }
  signals['lombaire.sacroiliite_radiographique'] = tri(state.q9_spa_sacroiliitis)
  signals['lombaire.hla_b27'] = tri(state.q9_spa_hlab27)
  signals['lombaire.tableau_clinique_spa'] = tri(state.q9_spa_clinical_picture)

  if (state.q10_location) {
    signals['lombaire.localisation_mediane'] = state.q10_location === 'medial'
    signals['lombaire.localisation_paravertebrale'] = state.q10_location === 'paravertebral'
    signals['lombaire.localisation_fessiere'] = state.q10_location === 'gluteal'
    signals['lombaire.localisation_diffuse'] = state.q10_location === 'diffuse'
  }

  signals['lombaire.centralisation'] = tri(state.q11_centralization)
  if (state.q12_facet !== null) signals['lombaire.criteres_revel_3plus'] = state.q13_tests_positive >= 3

  if (state.q_chronic_risk !== null) {
    signals['psychosocial.drapeaux_jaunes_2plus'] = state.q_yellow_flags.length >= 2
  }
  signals['psychosocial.risque_chronicisation'] = tri(state.q_chronic_risk)

  return signals
}

export function cervicalTreeStateToSignals(state: NeckTreeState): SignalSet {
  const signals: SignalSet = {}

  if (state.q_duration) signals['cervical.duree_aigue'] = state.q_duration === 'acute'

  // L'étape myélopathie est franchie dès que la suivante a été renseignée.
  if (state.q2_fracture !== null) {
    signals['cervical.symptomes_myelopathie'] = state.q1_symptom_checks.length > 0
    signals['cervical.signes_mns_2plus'] = state.q1_sign_checks.length >= 2

    // L'arbre cervical regroupe corticoïdes et ostéoporose dans une seule case :
    // les deux signaux prennent donc la même valeur.
    applyChecks(signals, state.q2_checks, {
      trauma: 'general.traumatisme_recent',
      age65: 'terrain.age_plus_65',
      steroids_osteo: ['terrain.corticotherapie', 'terrain.osteoporose'],
      focal_pain: 'cervical.douleur_focale_epineuse',
    })
  }

  if (state.q3_neoplasia !== null) {
    applyChecks(signals, state.q3_checks, {
      cancer_hx: 'terrain.antecedent_cancer',
      weight_loss: 'general.perte_poids',
      night_pain: 'general.douleur_nocturne',
      age50_persistent: 'general.douleur_persistante_traitement',
    })
  }

  if (state.q4_infection !== null) {
    applyChecks(signals, state.q4_checks, {
      fever: 'general.fievre',
      immuno: 'terrain.immunodepression',
      iv_drugs: 'terrain.drogues_iv',
      recent_surgery: 'terrain.chirurgie_rachis_recente',
      vertebral_pain: 'general.douleur_repos_constante',
    })
  }

  if (state.q5_dissection !== null) {
    applyChecks(signals, state.q5_checks, {
      sudden_headache: 'cervical.cephalee_brutale',
      neuro_signs: 'cervical.signes_neuro_dissection',
      recent_trauma: 'cervical.traumatisme_mineur_recent',
      age50_vasc: 'terrain.facteurs_vasculaires_50',
      pulsatile_tinnitus: 'cervical.acouphene_pulsatile',
    })
  }

  signals['cervical.irradiation_bras'] = tri(state.q6_arm_radiation)
  signals['cervical.paresthesies_bras'] = tri(state.q6_paresthesias)
  signals['cervical.bras_plus_douloureux'] = tri(state.q6_arm_worse)
  signals['cervical.cephalees'] = tri(state.q7_headache)

  // L'arbre ne retient un tableau de whiplash qu'une fois le grade établi.
  if (state.q8_wad !== null) {
    signals['cervical.whiplash'] = state.q8_wad_grade > 0
    signals['cervical.wad_grade_3'] = state.q8_wad_grade >= 3
  }

  signals['cervical.rythme_inflammatoire'] = tri(state.q9_inflammatory)

  if (state.q10_location) {
    signals['cervical.localisation_suboccipitale'] = state.q10_location === 'suboccipital'
    signals['cervical.localisation_paravertebrale'] = state.q10_location === 'paravertebral'
  }

  if (state.q11_facet_criteria > 0 || state.q10_location === 'paravertebral') {
    signals['cervical.criteres_facettaires_2plus'] = state.q11_facet_criteria >= 2
  }

  if (state.q12_criteria_checks.length > 0 || state.q7_headache !== null) {
    signals['cervical.criteres_cephalee_1plus'] = state.q12_criteria_checks.length >= 1
    signals['cervical.criteres_cephalee_3plus'] = state.q12_criteria_checks.length >= 3
  }

  if (state.q_chronic_risk !== null) {
    signals['psychosocial.drapeaux_jaunes_2plus'] = state.q_yellow_flags.length >= 2
  }
  signals['psychosocial.risque_chronicisation'] = tri(state.q_chronic_risk)

  return signals
}
