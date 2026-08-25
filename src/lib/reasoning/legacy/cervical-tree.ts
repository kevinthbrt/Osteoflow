/**
 * Logique de l'arbre décisionnel cervical, extraite telle quelle du composant
 * `neck-pain-tree.tsx`. Ce module ne contient aucun rendu : il sert à la fois
 * d'implémentation de référence pour la modale existante et de témoin de
 * non-régression pour le moteur de raisonnement (`src/lib/reasoning`).
 *
 * Toute correction clinique se fait ici, plus dans le composant.
 */

export type Answer = 'yes' | 'no' | string

export interface NeckTreeState {
  q_duration: Answer | null
  // Red flags
  q1_symptom_checks: string[]
  q1_sign_checks: string[]
  q1_signs_count: number
  q2_fracture: Answer | null
  q2_checks: string[]
  q3_neoplasia: Answer | null
  q3_checks: string[]
  q3_has_cancer_hx: boolean
  q4_infection: Answer | null
  q4_checks: string[]
  q5_dissection: Answer | null
  q5_checks: string[]
  // Step 2
  q6_arm_radiation: Answer | null
  q6_paresthesias: Answer | null
  q6_arm_worse: Answer | null
  q7_headache: Answer | null
  // Step 3B - Mechanical
  q8_wad: Answer | null
  q8_wad_grade: number
  q9_inflammatory: Answer | null
  q10_location: Answer | null
  q11_facet_criteria: number
  // Step 3A - Radicular
  q13_spurling: Answer | null
  q13_ulnt_positive: boolean
  q13_bakody: Answer | null
  q13_level: Answer | null
  // Step 3C - Cervicogenic headache
  q12_criteria_checks: string[]
  q12_frt_positive: Answer | null
  // Yellow flags
  q_yellow_flags: string[]
  q_chronic_risk: Answer | null
}

export const initialState: NeckTreeState = {
  q_duration: null,
  q1_symptom_checks: [], q1_sign_checks: [], q1_signs_count: 0,
  q2_fracture: null, q2_checks: [],
  q3_neoplasia: null, q3_checks: [], q3_has_cancer_hx: false,
  q4_infection: null, q4_checks: [],
  q5_dissection: null, q5_checks: [],
  q6_arm_radiation: null, q6_paresthesias: null, q6_arm_worse: null,
  q7_headache: null,
  q8_wad: null, q8_wad_grade: 0,
  q9_inflammatory: null,
  q10_location: null,
  q11_facet_criteria: 0,
  q13_spurling: null, q13_ulnt_positive: false, q13_bakody: null, q13_level: null,
  q12_criteria_checks: [], q12_frt_positive: null,
  q_yellow_flags: [], q_chronic_risk: null,
}


export interface TreatmentRec {
  manualTherapy: {
    evidenceLevel: string
    techniques: string[]
    warning?: string
  }
  exercises: {
    evidenceLevel: string
    protocol: string[]
  }
  keyNotes: string[]
}

export interface DiagnosisResult {
  primary: string
  confidence: 'probable' | 'possible' | 'exclusion' | 'urgent'
  tests: Array<{ name: string; target: string; result?: string; refinement?: string }>
  exams: Array<{ name: string; urgency: 'urgent' | 'if_persistent' | 'not_indicated'; condition?: string }>
  yellowFlagWarning: boolean
  chronicRisk: boolean
  isAcute: boolean
  anamnesisSummary: string
  treatment: TreatmentRec
}

export const TREATMENT_RECS: Record<string, TreatmentRec> = {
  non_specific_cervical: {
    manualTherapy: {
      evidenceLevel: 'Modéré',
      techniques: [
        'Mobilisations cervicales (grades III-IV) — préférées au HVLA cervical (rapport bénéfice/risque)',
        'Manipulation thoracique (HVLA T1-T8) — efficace et plus sûre que la manipulation cervicale',
        'Techniques myofasciales (trapèze supérieur, SCOM, sous-occipitaux, scalènes)',
        'Traitement multimodal : combinaison ≥ 2 techniques (SUCRA = 100 %, méta-analyse réseau 2025)',
      ],
    },
    exercises: {
      evidenceLevel: 'Modéré',
      protocol: [
        'Flexion crânio-cervicale (deep neck flexors) avec biofeedback pression : 10 × 10 sec, progression 22→30 mmHg, 2×/jour',
        'Renforcement cervico-scapulo-thoracique : rétraction scapulaire, rowing, élévations — 3×/semaine',
        'Renforcement extenseurs cervicaux : résistance isométrique progressive',
        'Étirements quotidiens : trapèze supérieur, SCOM, scalènes, élévateur de la scapula',
        'Auto-mobilisation cervico-thoracique : améliore amplitudes + douleur (d = 1.23-1.61)',
        'Rééducation posturale : correction protraction cervicale (forward head posture)',
        'Marche active : 30 min, 5×/semaine — bénéfice général sur la douleur',
      ],
    },
    keyNotes: [
      'Traitement multimodal (TM + exercice) supérieur à chaque modalité isolée (Cochrane 2025)',
      'Manipulation thoracique = alternative plus sûre à la manipulation cervicale directe',
      'Informer le patient du risque rare mais grave de la manipulation cervicale (dissection artérielle)',
    ],
  },
  radiculopathy_cervical: {
    manualTherapy: {
      evidenceLevel: 'Modéré',
      techniques: [
        'Mobilisation neurale (neurodynamique) ULNT 1-2-3 — composant le plus efficace (SMD = −1.45)',
        'Mobilisations cervicales en ouverture foraminale (glissement latéral, traction manuelle)',
        'Manipulation thoracique (HVLA) — en complément, plus sûre que HVLA cervical',
        'Traction cervicale manuelle (SMD = −0.66) — soulagement si radiculopathie confirmée',
      ],
      warning: '⚠️ Éviter le HVLA cervical en cas de déficit neurologique progressif ou hernie volumineuse',
    },
    exercises: {
      evidenceLevel: 'Modéré',
      protocol: [
        'Neurodynamique à domicile : auto-mobilisation nerf médian/radial/ulnaire selon racine — 3 × 10 rép., 2×/jour',
        'Flexion crânio-cervicale (deep neck flexors) : activation fléchisseurs profonds, 2×/jour',
        'Renforcement scapulaire : rétraction, abaissement, rotation externe — décharge le rachis cervical',
        'Étirements doux : scalènes, trapèze supérieur, pectoraux',
        "Éducation : 90 % des radiculopathies cervicales s'améliorent avec traitement conservateur < 12 semaines",
      ],
    },
    keyNotes: [
      'Combinaison optimale : traitement articulaire + neurodynamique + renforcement + traction (méta-analyse réseau 2025)',
      'IRM uniquement si déficit neurologique progressif ou symptômes > 4-6 semaines malgré traitement',
      'Résultats à 2 ans comparables entre chirurgie et traitement conservateur',
    ],
  },
  myelopathy: {
    manualTherapy: {
      evidenceLevel: 'Contre-indication',
      techniques: [
        'Mobilisation thoracique douce uniquement (grades I-II)',
        'Techniques myofasciales douces épaules et thorax',
        "Renforcement scapulaire et posture — en attente d'évaluation neurochirurgicale",
      ],
      warning: "⛔ CONTRE-INDICATION ABSOLUE au HVLA cervical — risque d'aggravation neurologique irréversible. Référer en neurochirurgie en urgence relative pour IRM + évaluation.",
    },
    exercises: {
      evidenceLevel: 'Faible',
      protocol: [
        'Exercices posturaux doux uniquement',
        'Renforcement scapulaire léger',
        "Aucun exercice cervical en charge avant évaluation neurochirurgicale",
      ],
    },
    keyNotes: [
      'Urgence relative : IRM cervicale + consultation neurochirurgicale',
      "Ne pas retarder l'orientation par une prise en charge conservatrice prolongée",
      'Suivi neurologique : toute aggravation = urgence chirurgicale',
    ],
  },
  wad: {
    manualTherapy: {
      evidenceLevel: 'Faible–Modéré',
      techniques: [
        'Mobilisations cervicales douces (grades I-II en phase aiguë, progression vers III-IV)',
        'Techniques myofasciales (SCOM, trapèze, sous-occipitaux)',
        'Mobilisation thoracique (HVLA thoracique acceptable en phase subaiguë)',
      ],
      warning: '⚠️ Pas de manipulation cervicale en phase aiguë (< 4 semaines post-trauma). Éviter le port de collier au-delà de 72h.',
    },
    exercises: {
      evidenceLevel: 'Modéré',
      protocol: [
        'Semaines 1-4 : flexion crânio-cervicale avec biofeedback + renforcement extenseurs + stabilisation scapulaire',
        'Exercices sensori-moteurs : proprioception cervicale, contrôle oculomoteur, équilibre',
        'Semaines 4-6 : transition vers exercices fonctionnels globaux',
        "Semaines 7-12 : programme d'activité graduée individualisé vers les objectifs fonctionnels",
        'Rester actif : éviter le repos prolongé — retour aux activités normales dès que possible',
      ],
    },
    keyNotes: [
      'Rassurer sur le pronostic : 50-70 % des WAD grade I-II récupèrent sans séquelles à 6 mois',
      'Collier cervical à éviter : augmente la chronicisation',
      'WAD grade III : suivi neurologique + IRM si déficit persistant > 4 semaines',
    ],
  },
  cervicogenic_headache: {
    manualTherapy: {
      evidenceLevel: 'Modéré',
      techniques: [
        'Mobilisation/manipulation C1-C2 ciblant la dysfonction identifiée au FRT (Maitland ou HVLA)',
        "Techniques d'énergie musculaire (MET) sous-occipitaux et rachis cervical supérieur",
        'Techniques myofasciales sous-occipitaux, trapèze supérieur, SCOM',
        'SNAG C1-C2 (Mulligan) : pression antérieure C1 pendant rotation — 6 rép., 3×/jour',
        'Mobilisation thoracique haute (T1-T4)',
      ],
    },
    exercises: {
      evidenceLevel: 'Modéré',
      protocol: [
        'Flexion crânio-cervicale avec biofeedback pression : 10 × 10 sec, progression 22→30 mmHg, 2×/jour',
        'Renforcement extenseurs cervicaux : résistance isométrique progressive',
        'Renforcement cervico-scapulo-thoracique : endurance + force — 3×/semaine',
        'Auto-SNAG C1-C2 : pression antérieure sur C1 + rotation cervicale — 6 rép., 3×/jour',
        'Exercices sensori-moteurs : repositionnement cervical, contrôle oculomoteur',
        'Rééducation posturale : correction protraction cervicale',
      ],
    },
    keyNotes: [
      'TM + exercices combinés = stratégie optimale (NNT = 6, Jull 2002)',
      'TM plus efficace à court terme ; exercices plus efficaces à long terme',
      'Manipulation + dry needling : meilleur effet sur intensité et fréquence (méta-analyse réseau 2024)',
      'FRT < 32° du côté symptomatique = critère diagnostique validé vs bloc anesthésique',
    ],
  },
  facet_cervical: {
    manualTherapy: {
      evidenceLevel: 'Faible',
      techniques: [
        'Mobilisations postéro-antérieures (PA) segmentaires au niveau symptomatique (grades III-IV)',
        'Mobilisation en rotation du segment concerné',
        'Techniques myofasciales paravertébraux cervicaux',
        'Manipulation thoracique (HVLA) — alternative plus sûre à la manipulation cervicale directe',
      ],
      warning: "⚠️ Éviter l'extension forcée (facteur aggravant des facettes cervicales)",
    },
    exercises: {
      evidenceLevel: 'Faible',
      protocol: [
        'Flexion crânio-cervicale (deep neck flexors) — dénominateur commun de tous les protocoles cervicaux',
        'Renforcement extenseurs cervicaux : isométrie progressive',
        'Stabilisation scapulaire',
        'Étirements : trapèze supérieur, élévateur de la scapula, scalènes',
        'Mobilité thoracique : pour décharger le rachis cervical',
      ],
    },
    keyNotes: [
      'Niveau de preuve faible spécifique au syndrome facettaire cervical — extrapolé des données générales',
      'Bloc facettaire diagnostique = seul test de certitude',
      'Traitement multimodal supérieur à chaque modalité isolée',
    ],
  },
}

// ─── Result builder ──────────────────────────────────────────────────────────

export function buildResult(state: NeckTreeState): DiagnosisResult {
  const isAcute = state.q_duration === 'acute'
  const isRadicular = state.q6_arm_radiation === 'yes' && state.q6_arm_worse === 'yes'

  // Myelopathy — urgent
  if (state.q1_signs_count >= 2) {
    return {
      primary: 'Myélopathie cervicale dégénérative — évaluation neurochirurgicale urgente',
      confidence: 'urgent',
      tests: [
        { name: 'Hoffmann', target: 'Motoneurone supérieur', result: '', refinement: 'Hoffmann positif → signe de motoneurone supérieur' },
        { name: 'Tromner', target: 'Motoneurone supérieur', result: 'Sn 93-97 % / Sp 79-100 %', refinement: 'Tromner positif → très évocateur de myélopathie' },
        { name: 'Babinski', target: 'Motoneurone supérieur', result: 'Sp 93-100 %', refinement: 'Babinski positif → atteinte voie pyramidale confirmée' },
        { name: 'Clonus', target: 'Motoneurone supérieur', result: 'Sp 96-99 %', refinement: 'Clonus positif → myélopathie très probable' },
        { name: 'Réflexe brachioradial inversé', target: 'C5-C6', result: 'Quasi-pathognomonique', refinement: 'Réflexe inversé → atteinte myélopathique C5-C6 quasi-certaine' },
        { name: 'Romberg', target: 'Équilibre', result: 'Sp > 90 %', refinement: 'Romberg positif → atteinte cordonale postérieure' },
        { name: 'Marche en tandem', target: 'Coordination', result: '', refinement: 'Tandem positif → trouble de la marche évocateur de myélopathie' },
        { name: 'Hyperréflexie ostéotendineuse', target: 'Motoneurone supérieur', result: '', refinement: 'Hyperréflexie → signe de libération pyramidale' },
        { name: 'Amplitudes cervicales', target: 'Mobilité', result: '', refinement: '' },
        { name: 'Évaluation fonctionnelle mains', target: 'Dextérité', result: '', refinement: 'Déficit de dextérité → confirme atteinte fonctionnelle myélopathique' },
      ],
      exams: [
        { name: 'IRM cervicale', urgency: 'urgent', condition: 'Urgence relative — compression médullaire à objectiver' },
        { name: 'Consultation neurochirurgicale', urgency: 'urgent', condition: 'Orientation immédiate' },
      ],
      yellowFlagWarning: false,
      chronicRisk: false,
      isAcute,
      anamnesisSummary: buildAnamnesisText('Myélopathie cervicale dégénérative', state, 'myelopathy'),
      treatment: TREATMENT_RECS.myelopathy,
    }
  }

  // Radicular path
  if (isRadicular) {
    const levelLabels: Record<string, string> = {
      C5: 'C5 (épaule, deltoïde, face latérale bras)',
      C6: 'C6 (pouce, index, face latérale avant-bras)',
      C7: 'C7 (majeur, face postérieure avant-bras)',
      C8: 'C8 (annulaire, auriculaire, face médiale main)',
      T1: 'T1 (face médiale avant-bras)',
      unclear: 'Niveau imprécis / multiple',
    }
    const levelPrimary = state.q13_level
      ? `Radiculopathie cervicale ${levelLabels[state.q13_level] || state.q13_level}`
      : 'Radiculopathie cervicale (niveau à préciser)'

    return {
      primary: levelPrimary,
      confidence: 'probable',
      tests: [
        { name: 'Spurling', target: 'Radiculopathie cervicale', result: 'Sn 38-98 %, Sp 84-100 %', refinement: 'Spurling positif → radiculopathie cervicale très probable (Sp 84-100 %)' },
        { name: 'Abduction épaule / Bakody', target: 'Décompression foraminale', result: 'Sn 49 %, Sp 76 %', refinement: 'Bakody positif → radiculopathie cervicale confirmée (signe décompression)' },
        { name: 'ULNT 1 médian', target: 'Nerf médian (C6-C7)', result: 'Sn 70 %, Sp 71 %', refinement: 'ULNT 1 positif → atteinte nerf médian / racine C6-C7' },
        { name: 'ULNT 2 radial', target: 'Nerf radial (C5-C6)', result: '', refinement: 'ULNT 2 positif → atteinte nerf radial / racine C5-C6' },
        { name: 'ULNT 3 ulnaire', target: 'Nerf ulnaire (C8-T1)', result: '', refinement: 'ULNT 3 positif → atteinte nerf ulnaire / racine C8-T1' },
        { name: 'ULNT combinés 4 tests', target: 'Radiculopathie cervicale', result: 'Sn 97 %, Sp 51 %', refinement: 'Cluster ULNT positif → radiculopathie cervicale très sensible (Sn 97 %)' },
        { name: 'Arm Squeeze test', target: 'Radiculopathie cervicale', result: '', refinement: 'Arm Squeeze positif → douleur à la compression biceps → évocateur de radiculopathie' },
        { name: 'Traction cervicale manuelle', target: 'Décompression foraminale', result: 'SMD = −0.66', refinement: 'Traction positive (soulagement) → radiculopathie par compression foraminale' },
        { name: 'Examen neurologique racine-spécifique', target: state.q13_level || 'Niveau suspect', result: '', refinement: 'Déficit moteur/sensitif/réflexe objectivé → atteinte radiculaire confirmée' },
      ],
      exams: [
        { name: 'IRM cervicale', urgency: 'if_persistent', condition: 'Si déficit neurologique progressif ou symptômes > 4-6 semaines malgré traitement' },
      ],
      yellowFlagWarning: false,
      chronicRisk: false,
      isAcute,
      anamnesisSummary: buildAnamnesisText(levelPrimary, state, 'radicular'),
      treatment: TREATMENT_RECS.radiculopathy_cervical,
    }
  }

  // WAD
  if (state.q8_wad_grade > 0) {
    const wadGrade = state.q8_wad_grade
    const primary = wadGrade >= 3
      ? 'WAD grade III — atteinte neurologique'
      : 'WAD grade I-II — prise en charge conservative'
    return {
      primary,
      confidence: 'probable',
      tests: [
        { name: 'Amplitudes cervicales (AROM)', target: 'Limitation mobilité', result: '', refinement: 'Limitation AROM → quantification de la restriction post-traumatique' },
        { name: 'Palpation points douloureux', target: 'Muscles / articulations', result: '', refinement: 'Points douloureux identifiés → guide le traitement myofascial' },
        { name: 'Examen neurologique', target: 'WAD grade III', result: '', refinement: 'Déficit neurologique → WAD grade III confirmé → IRM à envisager' },
        { name: 'Tests proprioception et contrôle moteur', target: 'Sensori-moteur', result: '', refinement: 'Déficit proprioceptif → axe sensori-moteur à cibler en rééducation' },
      ],
      exams: [
        wadGrade >= 3
          ? { name: 'IRM cervicale', urgency: 'if_persistent', condition: 'WAD grade III : si déficit neurologique persistant > 4 semaines' }
          : { name: 'Radiographies cervicales', urgency: 'if_persistent', condition: 'WAD grade I-II : seulement si suspicion fracture (cf. critères NEXUS/Canadian C-Spine)' },
      ],
      yellowFlagWarning: false,
      chronicRisk: false,
      isAcute,
      anamnesisSummary: buildAnamnesisText(primary, state, 'wad'),
      treatment: TREATMENT_RECS.wad,
    }
  }

  // Inflammatory SpA
  if (state.q9_inflammatory === 'yes') {
    return {
      primary: 'Suspicion spondyloarthrite axiale — atteinte cervicale',
      confidence: 'possible',
      tests: [
        { name: 'Amplitudes cervicales globales', target: 'Raideur', result: '', refinement: 'Limitation amplitudes → atteinte inflammatoire cervicale' },
        { name: 'Mobilité thoracique', target: 'Limitation', result: '', refinement: 'Raideur thoracique → critère de SpA axiale' },
        { name: 'Distance menton-sternum', target: 'Flexion cervicale', result: '', refinement: 'Distance augmentée → limitation cliniquement significative' },
      ],
      exams: [
        { name: 'Radiographies rachis cervical', urgency: 'if_persistent', condition: 'Recherche syndesmophytes / fusion' },
        { name: 'IRM rachis cervical', urgency: 'if_persistent', condition: 'Si doute ou atteinte active inflammatoire' },
        { name: 'Bilan biologique : CRP, VS, HLA-B27', urgency: 'if_persistent', condition: '' },
        { name: 'Référer en rhumatologie', urgency: 'if_persistent', condition: 'Pour confirmation et traitement médicamenteux' },
      ],
      yellowFlagWarning: state.q_yellow_flags.length >= 2,
      chronicRisk: state.q_chronic_risk === 'yes',
      isAcute,
      anamnesisSummary: buildAnamnesisText('Suspicion spondyloarthrite axiale cervicale', state, 'inflammatory'),
      treatment: TREATMENT_RECS.non_specific_cervical,
    }
  }

  // Cervicogenic headache
  if ((state.q10_location === 'suboccipital' || state.q7_headache === 'yes') && state.q12_criteria_checks.length >= 1) {
    const criteriaCount = state.q12_criteria_checks.length
    const primary = criteriaCount >= 3 ? 'Céphalée cervicogénique probable' : 'Céphalée cervicogénique possible'
    const confidence = criteriaCount >= 3 ? 'probable' : 'possible'
    return {
      primary,
      confidence,
      tests: [
        { name: 'Test de flexion-rotation cervicale (FRT)', target: 'C1-C2', result: 'Limitation < 32° = positif', refinement: 'FRT positif → dysfonction C1-C2 confirmée (critère diagnostique validé)' },
        { name: 'Palpation articulaire C1-C2', target: 'Douleur reproductrice', result: '', refinement: 'Palpation C1-C2 reproductrice → confirme origine cervicale supérieure' },
        { name: 'Amplitudes cervicales', target: 'Limitation', result: '', refinement: 'Limitation ipsilatérale → argument pour céphalée cervicogénique' },
        { name: 'Test de flexion crânio-cervicale (CCFT)', target: 'Fléchisseurs profonds', result: '', refinement: 'CCFT déficient → dysfonction fléchisseurs profonds → cible thérapeutique' },
        { name: 'Reproduction de la céphalée à la palpation cervicale supérieure', target: 'C0-C1-C2-C3', result: '', refinement: 'Reproduction céphalée → critère diagnostic IHS pour céphalée cervicogénique' },
      ],
      exams: [
        { name: 'Pas d\'imagerie en routine', urgency: 'not_indicated', condition: 'Si FRT positif + critères cliniques suffisants' },
        { name: 'IRM cervicale haute', urgency: 'if_persistent', condition: 'Si céphalée sévère ou résistante' },
      ],
      yellowFlagWarning: state.q_yellow_flags.length >= 2,
      chronicRisk: state.q_chronic_risk === 'yes',
      isAcute,
      anamnesisSummary: buildAnamnesisText(primary, state, 'cervicogenic'),
      treatment: TREATMENT_RECS.cervicogenic_headache,
    }
  }

  // Facet cervical
  if (state.q10_location === 'paravertebral' && state.q11_facet_criteria >= 2) {
    return {
      primary: 'Syndrome facettaire cervical probable',
      confidence: 'probable',
      tests: [
        { name: 'Extension + rotation ipsilatérale (reproduction douleur)', target: 'Facettes cervicales', result: '', refinement: 'Douleur reproductrice en extension-rotation → syndrome facettaire cervical confirmé' },
        { name: 'Mobilisation PA segmentaire', target: 'Niveau symptomatique', result: '', refinement: 'PA douloureuse → identification du niveau facettaire cible' },
        { name: 'Critères de Revel cervicaux combinés', target: 'Facettes cervicales', result: '', refinement: 'Critères combinés → probabilité diagnostique augmentée' },
        { name: 'Bloc facettaire diagnostique', target: 'Confirmation', result: 'Référence gold standard', refinement: 'Bloc positif = seul test confirmatoire fiable du syndrome facettaire' },
      ],
      exams: [
        { name: 'Pas d\'imagerie en routine', urgency: 'not_indicated', condition: '' },
        { name: 'Bloc facettaire diagnostique', urgency: 'if_persistent', condition: 'Seul examen confirmatoire — si résistance au traitement conservateur' },
      ],
      yellowFlagWarning: state.q_yellow_flags.length >= 2,
      chronicRisk: state.q_chronic_risk === 'yes',
      isAcute,
      anamnesisSummary: buildAnamnesisText('Syndrome facettaire cervical', state, 'facet'),
      treatment: TREATMENT_RECS.facet_cervical,
    }
  }

  // Non-specific cervical
  return {
    primary: "Cervicalgie non spécifique (diagnostic d'exclusion)",
    confidence: 'exclusion',
    tests: [
      { name: 'Examen neurologique complet (exclusion déficit)', target: 'Déficit moteur/sensitif', result: '', refinement: 'Examen neurologique normal → confirme absence de radiculopathie' },
      { name: 'Amplitudes cervicales actives/passives', target: 'Limitation fonctionnelle', result: '', refinement: 'Limitation amplitudes → quantification de la dysfonction' },
      { name: 'Palpation paravertébrale', target: 'Spasme, tension myofasciale', result: '', refinement: 'Tension myofasciale identifiée → cible thérapeutique prioritaire' },
      { name: 'Test de flexion crânio-cervicale (dysfonction fléchisseurs profonds)', target: 'Deep neck flexors', result: '', refinement: 'CCFT déficient → dysfonction fléchisseurs profonds → priorité rééducation' },
    ],
    exams: [
      { name: 'Aucun examen nécessaire', urgency: 'not_indicated', condition: 'Cervicalgie non spécifique — imagerie non recommandée en routine' },
    ],
    yellowFlagWarning: state.q_yellow_flags.length >= 2,
    chronicRisk: state.q_chronic_risk === 'yes',
    isAcute,
    anamnesisSummary: buildAnamnesisText("Cervicalgie non spécifique", state, 'non_specific'),
    treatment: TREATMENT_RECS.non_specific_cervical,
  }
}

export function buildAnamnesisText(primary: string, state: NeckTreeState, type: string): string {
  const lines: string[] = []
  lines.push('=== Arbre décisionnel cervicalgie (MyOsteoFlow) ===')
  lines.push(`Suspicion diagnostique : ${primary}`)
  lines.push('')

  // ── Durée ──
  if (state.q_duration) {
    lines.push(`Durée : ${state.q_duration === 'acute' ? 'aiguë (< 8 semaines)' : 'subaiguë / chronique (≥ 8 semaines)'}.`)
  }

  // ── Drapeaux rouges ──
  const symptomLabels: Record<string, string> = {
    hand_dex: 'maladresse des mains',
    gait_instab: "troubles de l'équilibre / marche",
    hand_numb: 'engourdissements mains/pieds',
    arm_weak: 'faiblesse bras/mains',
    bladder: 'troubles urinaires',
    lhermitte: 'signe de Lhermitte',
  }
  const signLabels: Record<string, string> = {
    hoffmann: 'Hoffmann',
    tromner: 'Tromner',
    babinski: 'Babinski',
    clonus: 'Clonus',
    inv_brachioradial: 'réflexe brachioradial inversé',
    hyperreflexia: 'hyperréflexie',
    romberg: 'Romberg',
    tandem: 'marche en tandem',
  }
  const q2Labels: Record<string, string> = {
    trauma: 'traumatisme récent',
    age65: '> 65 ans',
    steroids_osteo: 'corticoïdes / ostéoporose',
    focal_pain: 'douleur très localisée',
  }
  const q3Labels: Record<string, string> = {
    cancer_hx: 'antécédent de cancer',
    weight_loss: 'perte de poids inexpliquée',
    night_pain: 'douleur nocturne',
    age50_persistent: '> 50 ans + douleur persistante',
  }
  const q4Labels: Record<string, string> = {
    fever: 'fièvre',
    immuno: 'immunodépression',
    iv_drugs: 'drogues IV',
    recent_surgery: 'chirurgie récente',
    vertebral_pain: 'douleur vertébrale localisée',
  }
  const q5Labels: Record<string, string> = {
    sudden_headache: 'céphalée brutale inhabituelle',
    neuro_signs: 'signes neurologiques (visuel, vertige, diplopie)',
    recent_trauma: 'traumatisme cervical récent',
    age50_vasc: '> 50 ans + facteurs vasculaires',
    pulsatile_tinnitus: 'acouphène pulsatile unilatéral',
  }

  const redFlagLines: string[] = []
  if (state.q1_signs_count >= 2) {
    const symp = state.q1_symptom_checks.map(k => symptomLabels[k] || k).join(', ')
    const signs = state.q1_sign_checks.map(k => signLabels[k] || k).join(', ')
    redFlagLines.push(`⚠ Signes de myélopathie (${state.q1_signs_count} signe(s) UMN)${symp ? ` — symptômes : ${symp}` : ''}${signs ? ` — signes : ${signs}` : ''}`)
  }
  if (state.q2_fracture === 'yes') {
    const items = state.q2_checks.map(k => q2Labels[k] || k).join(', ')
    redFlagLines.push(`⚠ Suspicion de fracture cervicale (${items})`)
  }
  if (state.q3_neoplasia === 'alert') {
    const items = state.q3_checks.map(k => q3Labels[k] || k).join(', ')
    redFlagLines.push(`⚠ Suspicion néoplasie cervicale (${items})`)
  }
  if (state.q3_neoplasia === 'watch') {
    redFlagLines.push('(!) Antécédent de cancer isolé sans autre facteur — surveillance rapprochée')
  }
  if (state.q4_infection === 'yes') {
    const items = state.q4_checks.map(k => q4Labels[k] || k).join(', ')
    redFlagLines.push(`⚠ Suspicion infection spinale cervicale (${items})`)
  }
  if (state.q5_dissection === 'yes') {
    const items = state.q5_checks.map(k => q5Labels[k] || k).join(', ')
    redFlagLines.push(`⚠ Suspicion dissection artérielle cervicale (${items}) — urgence vasculaire`)
  }
  if (redFlagLines.length) {
    lines.push('Drapeaux rouges :')
    redFlagLines.forEach(l => lines.push(`  ${l}`))
  }

  // ── Irradiation / type ──
  lines.push('')
  if (state.q6_arm_radiation === 'no') {
    lines.push('Irradiation : douleur axiale cervicale uniquement (sans irradiation dans le bras).')
  } else if (state.q6_arm_radiation === 'yes') {
    const pares = state.q6_paresthesias === 'yes' ? 'avec fourmillements/engourdissements' : 'sans paresthésies'
    const worse = state.q6_arm_worse === 'yes' ? 'douleur de bras > douleur de cou' : 'douleur de cou ≥ douleur de bras'
    lines.push(`Irradiation : dans le bras (${pares}, ${worse}).`)
  }

  // ── Voie radiculaire ──
  if (type === 'radicular') {
    lines.push('')
    lines.push('Voie radiculaire cervicale :')
    lines.push('  → Tests de confirmation à réaliser : Spurling, ULNT, Bakody (voir résumé d\'examen).')
    if (state.q13_level) {
      const lev: Record<string, string> = { C5: 'C5 (épaule, deltoïde)', C6: 'C6 (pouce, index)', C7: 'C7 (majeur)', C8: 'C8 (annulaire, auriculaire)', T1: 'T1 (face médiale avant-bras)', unclear: 'niveau imprécis / multiple' }
      lines.push(`  Niveau suspecté : ${lev[state.q13_level] || state.q13_level}.`)
    }
  }

  // ── WAD ──
  if (type === 'wad') {
    lines.push('')
    lines.push(`WAD grade ${state.q8_wad_grade} (Quebec Task Force).`)
  }

  // ── Céphalée cervicogénique ──
  if (type === 'cervicogenic') {
    lines.push('')
    lines.push('Céphalée cervicogénique :')
    lines.push(`  Critères cliniques présents (anamnèse) : ${state.q12_criteria_checks.length}/7.`)
    lines.push('  → FRT (test de flexion-rotation) à réaliser lors de l\'examen — limitation < 32° ipsilatérale = positif (Sn 91 %, Sp 90 %).')
  }

  // ── Mécanique ──
  if (type === 'facet' || type === 'non_specific') {
    lines.push('')
    lines.push('Caractéristiques mécaniques cervicales :')
    const locLabels: Record<string, string> = {
      medial: 'médiane sur les épineuses',
      paravertebral: 'paravertébrale (facettaire)',
      trapezius: 'trapèze / musculature diffuse',
      suboccipital: 'sous-occipitale',
    }
    if (state.q10_location) lines.push(`  Localisation : ${locLabels[state.q10_location] || state.q10_location}.`)
    if (state.q11_facet_criteria > 0) lines.push(`  Critères facettaires cervicaux : ${state.q11_facet_criteria}/4${state.q11_facet_criteria >= 2 ? ' (syndrome facettaire probable)' : ''}.`)
  }

  if (type === 'inflammatory') {
    lines.push('')
    lines.push('Profil inflammatoire cervical évocateur — exploration SpA axiale recommandée.')
  }

  if (type === 'non_specific') {
    lines.push("  Diagnostic d'exclusion — aucune imagerie recommandée en routine.")
  }

  // ── Drapeaux rouges éliminés ──
  lines.push('')
  const cleared: string[] = []
  if (state.q1_signs_count < 2 && state.q1_sign_checks.length === 0) cleared.push('myélopathie')
  if (state.q2_fracture === 'no') cleared.push('fracture')
  if (state.q3_neoplasia === 'no') cleared.push('néoplasie')
  if (state.q4_infection === 'no') cleared.push('infection')
  if (state.q5_dissection === 'no') cleared.push('dissection artérielle')
  if (cleared.length) lines.push(`Drapeaux rouges éliminés : ${cleared.join(', ')}.`)

  // ── Drapeaux jaunes ──
  const yellowLabels: Record<string, string> = {
    catastrophism: 'catastrophisme',
    anxiety: 'anxiété',
    depression: 'dépression',
    kinesophobia: 'kinésiophobie',
    work: 'insatisfaction au travail',
    obesity: 'obésité',
    smoking: 'tabagisme actif',
    high_pain: 'douleur intense (EVA ≥ 7)',
  }
  if (state.q_yellow_flags.length > 0) {
    const labels = state.q_yellow_flags.map(f => yellowLabels[f] || f)
    lines.push(`Drapeaux jaunes (${state.q_yellow_flags.length}) : ${labels.join(', ')}.`)
  } else if (state.q_yellow_flags.length === 0 && state.q_chronic_risk !== null) {
    lines.push('Drapeaux jaunes : aucun identifié.')
  }
  if (state.q_chronic_risk === 'yes') lines.push('Facteurs de risque de chronicisation → plan biopsychosocial ciblé recommandé.')
  if (state.q_chronic_risk === 'no') lines.push('Risque de chronicisation faible → réassurance et traitement conservateur.')

  return lines.join('\n')
}

// ─── Drapeaux rouges ─────────────────────────────────────────────────────────
//
// Ces règles vivaient dans les gestionnaires de clic du composant. Elles sont
// remontées ici telles quelles : ce sont les décisions les plus lourdes de
// l'arbre, elles doivent être testables sans passer par l'interface.

export type RedFlagVerdict = 'alert' | 'watch' | 'none'

/** Myélopathie : deux signes de motoneurone supérieur ou plus. */
export function assessMyelopathy(signChecks: string[]): RedFlagVerdict {
  return signChecks.length >= 2 ? 'alert' : 'none'
}

/**
 * Fracture cervicale. Tout traumatisme récent alerte d'emblée (critères NEXUS
 * et règle canadienne) ; sans traumatisme, l'âge de plus de 65 ans associé à un
 * autre facteur suffit.
 */
export function assessCervicalFracture(checks: string[]): RedFlagVerdict {
  if (checks.includes('trauma')) return 'alert'
  if (checks.includes('age65') && checks.length >= 2) return 'alert'
  return 'none'
}

/** Néoplasie — même règle que le lombaire : l'antécédent isolé ne fait que surveiller. */
export function assessCervicalNeoplasia(checks: string[]): RedFlagVerdict {
  const hasCancerHistory = checks.includes('cancer_hx')
  const otherFactors = checks.filter((value) => value !== 'cancer_hx').length
  if ((hasCancerHistory && otherFactors >= 1) || (!hasCancerHistory && checks.length >= 2)) return 'alert'
  if (hasCancerHistory) return 'watch'
  return 'none'
}

/** Infection cervicale — la porte d'entrée est ici la chirurgie récente. */
export function assessCervicalInfection(checks: string[]): RedFlagVerdict {
  const hasFever = checks.includes('fever')
  if (hasFever && checks.length >= 2) return 'alert'
  const hasEntryPoint = checks.includes('iv_drugs') || checks.includes('recent_surgery')
  if (!hasFever && hasEntryPoint && checks.length >= 2) return 'alert'
  return 'none'
}

/**
 * Dissection artérielle. Céphalée brutale et signes neurologiques ensemble, ou
 * deux facteurs quels qu'ils soient : le pronostic vital prime sur la
 * spécificité.
 */
export function assessDissection(checks: string[]): RedFlagVerdict {
  if (checks.includes('sudden_headache') && checks.includes('neuro_signs')) return 'alert'
  return checks.length >= 2 ? 'alert' : 'none'
}
