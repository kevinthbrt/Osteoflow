/**
 * Logique de l'arbre décisionnel lombaire, extraite telle quelle du composant
 * `low-back-pain-tree.tsx`. Ce module ne contient aucun rendu : il sert à la
 * fois d'implémentation de référence pour la modale existante et de témoin de
 * non-régression pour le moteur de raisonnement (`src/lib/reasoning`).
 *
 * Toute correction clinique se fait ici, plus dans le composant.
 */

export type Answer = 'yes' | 'no' | string

export interface TreeState {
  // Duration (AAFP)
  q_duration: Answer | null            // 'acute' | 'subacute'
  // Red flags
  q1_cauda_equina: Answer | null
  q2_fracture: Answer | null
  q2_trauma_neuro: boolean
  q2_factors: number
  q2_checks: string[]
  q3_neoplasia: Answer | null          // 'alert' | 'watch' | 'no'
  q3_factors: number
  q3_has_cancer_hx: boolean
  q3_checks: string[]
  q4_infection: Answer | null
  q4_factors: number
  q4_checks: string[]
  q5_aaa: Answer | null
  // Step 2
  q6_radiation: Answer | null
  q6_below_knee: Answer | null
  q6_leg_worse: Answer | null
  // Step 3A – Radicular
  q7_age_under60: Answer | null
  q7_unilateral: Answer | null
  q7_worse_sitting: Answer | null
  q7_worse_walking: Answer | null
  q7_shopping_cart: Answer | null
  q7_sudden_onset: Answer | null
  q7_cough_sneeze: Answer | null
  // Step 3B – Axial inflammatory → SpA algorithm
  q9_inflammatory: Answer | null
  q9_criteria: number
  q9_checks: string[]
  q9_extra_articular: boolean
  q9_spa_sacroiliitis: Answer | null
  q9_spa_hlab27: Answer | null
  q9_spa_clinical_picture: Answer | null
  // Step 3B – Mechanical
  q10_location: Answer | null
  q11_centralization: Answer | null
  q12_facet: Answer | null
  q13_tests_positive: number
  // Yellow flags / chronic risk (AAFP)
  q_yellow_flags: string[]
  q_chronic_risk: Answer | null
}

export const initialState: TreeState = {
  q_duration: null,
  q1_cauda_equina: null,
  q2_fracture: null, q2_trauma_neuro: false, q2_factors: 0, q2_checks: [],
  q3_neoplasia: null, q3_factors: 0, q3_has_cancer_hx: false, q3_checks: [],
  q4_infection: null, q4_factors: 0, q4_checks: [],
  q5_aaa: null,
  q6_radiation: null, q6_below_knee: null, q6_leg_worse: null,
  q7_age_under60: null, q7_unilateral: null, q7_worse_sitting: null,
  q7_worse_walking: null, q7_shopping_cart: null, q7_sudden_onset: null,
  q7_cough_sneeze: null,
  q9_inflammatory: null, q9_criteria: 0, q9_checks: [], q9_extra_articular: false,
  q9_spa_sacroiliitis: null, q9_spa_hlab27: null, q9_spa_clinical_picture: null,
  q10_location: null,
  q11_centralization: null,
  q12_facet: null,
  q13_tests_positive: 0,
  q_yellow_flags: [],
  q_chronic_risk: null,
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
  non_specific: {
    manualTherapy: {
      evidenceLevel: 'Modéré',
      techniques: [
        'HVLA (thrust) lombaire et thoraco-lombaire',
        'Mobilisations articulaires (grades III-IV)',
        'Techniques myofasciales (MFR) — réduction de la douleur ES : −0.69',
        'OMT incluant techniques viscérales (diaphragme) — bénéfice additionnel démontré',
      ],
    },
    exercises: {
      evidenceLevel: 'Élevé',
      protocol: [
        'Renforcement du core : gainage ventral, latéral, bird-dog — 3×/sem, progression sur 8 semaines',
        'Exercices de contrôle moteur : transverse + multifides → progression vers tâches fonctionnelles',
        'Marche structurée : 30 min/j, 5×/sem (SMD analgésique : −1.05)',
        'Pilates : 2-3×/sem — meilleur effet sur la douleur (SMD : −1.14) et le handicap',
        'Éducation : rester actif, éviter le repos au lit, pronostic favorable attendu',
      ],
    },
    keyNotes: [
      'Combinaison TM + exercice systématiquement supérieure à chaque modalité isolée',
      'OMT : 65 % obtiennent ≥ 30 % de soulagement vs 46 % dans le groupe sham (SMD douleur : −0.59)',
    ],
  },
  disc_radicular: {
    manualTherapy: {
      evidenceLevel: 'Modéré',
      techniques: [
        'HVLA lombaire (technique de Maigne) — 3 séances à 1 semaine d\'intervalle',
        'Mobilisations en distraction lombaire',
        'Mobilisation neurale (neurodynamique) — niveau de preuve B',
      ],
      warning: 'Éviter HVLA si déficit neurologique progressif, syndrome de la queue de cheval ou hernie séquestrée massive',
    },
    exercises: {
      evidenceLevel: 'Modéré',
      protocol: [
        'Évaluation de la préférence directionnelle (McKenzie) : mouvements répétés extension / flexion / glissement latéral',
        'Extension (la plus fréquente, 83 % des cas) : prone press-ups, 10 rép. toutes les 2-3h, passif → actif',
        'Stabilisation : activation transverse + multifides, puis exercices fonctionnels',
        'Éducation posturale : éviter la flexion prolongée, support lombaire',
        'Marche : reprise progressive, limiter la position assise prolongée',
      ],
    },
    keyNotes: [
      'Centralisation observée chez ~70 % des patients → prédit un bon pronostic',
      'HVLA vs sham : réduction EVA −1.20 ; vs kiné seule : −1.26 à court/moyen terme',
      'À 24 mois : McKenzie ≡ conseils guidés selon les guidelines',
    ],
  },
  stenosis: {
    manualTherapy: {
      evidenceLevel: 'Modéré',
      techniques: [
        'Mobilisation en distraction lombaire (flexion-distraction)',
        'Mobilisation de la hanche et de l\'articulation sacro-iliaque',
        'Étirements manuels des fléchisseurs de hanche et des ischio-jambiers',
      ],
      warning: 'Éviter les techniques en extension (aggravation de la sténose)',
    },
    exercises: {
      evidenceLevel: 'Modéré',
      protocol: [
        'Exercices en flexion : genoux-poitrine, bascule pelvienne postérieure, flexion assise — 2-3×/j',
        'Vélo stationnaire : 20-30 min, 3-5×/sem (la flexion ouvre le canal rachidien)',
        'Marche sur tapis roulant : progression graduelle de la distance, avec pauses en flexion',
        'Renforcement du tronc : gainage en flexion, exercices de stabilisation',
        'Aquathérapie : marche en piscine, exercices en flexion en eau profonde',
      ],
    },
    keyNotes: [
      'TM + exercice individualisé > médicaments ± injections à 2 mois (MD : 2.0 sur ZCQ, IC 95% : 0.4-3.6)',
      'Les différences s\'estompent à 6 mois — l\'exercice régulier reste essentiel au long terme',
    ],
  },
  si: {
    manualTherapy: {
      evidenceLevel: 'Modéré (B)',
      techniques: [
        'Manipulation SI : thrust en décubitus latéral (rotation lombaire), thrust sacré',
        'Mobilisation avec mouvement (MWM) de Mulligan',
        'Techniques de muscle energy (MET) pour dysfonctions iliaques (antériorité/postériorité)',
        'Mobilisation des tissus mous péri-articulaires (piriforme, moyen fessier, ligaments SI)',
      ],
    },
    exercises: {
      evidenceLevel: 'Modéré (B)',
      protocol: [
        'Stabilisation de la ceinture pelvienne : transverse, plancher pelvien, multifides → co-contraction → fonctionnel',
        'Auto-mobilisation SI : en postériorité de l\'iliaque',
        'Étirements spécifiques : piriforme, fléchisseurs de hanche, ischio-jambiers, adducteurs',
        'Renforcement : ponts fessiers, clamshells, squats partiels',
        'Ceinture pelvienne de soutien : bénéfique notamment en post-partum',
      ],
    },
    keyNotes: [
      'TM la plus efficace à court terme ; exercices remarquables à 12 semaines ; équivalents à 24 semaines',
      'Core + MWM de Mulligan : réduit douleur, handicap et améliore la fonction',
    ],
  },
  discogenic: {
    manualTherapy: {
      evidenceLevel: 'Faible à Modéré',
      techniques: [
        'Mobilisations en flexion-distraction (technique de Cox)',
        'Mobilisations postéro-antérieures segmentaires',
        'Techniques myofasciales des paravertébraux',
      ],
    },
    exercises: {
      evidenceLevel: 'Modéré',
      protocol: [
        'McKenzie : évaluation de la préférence directionnelle (seul test clinique avec LR+ significatif)',
        'Exercices répétés dans la direction de centralisation (le plus souvent en extension)',
        'Contrôle moteur : supérieur à la manipulation et aux exercices à domicile en phase chronique',
        'Éviter la position assise prolongée, utiliser un support lombaire',
      ],
    },
    keyNotes: [
      'La centralisation est le seul test clinique avec LR+ significatif pour la douleur discogénique',
      'Programme de contrôle moteur supérieur à la manipulation seule pour les formes chroniques',
    ],
  },
  facet: {
    manualTherapy: {
      evidenceLevel: 'Faible',
      techniques: [
        'HVLA lombaire segmentaire ciblant le niveau symptomatique',
        'Mobilisations postéro-antérieures (PA) grades III-IV',
        'Techniques de mobilisation en rotation',
        'Techniques myofasciales des paravertébraux et du carré des lombes',
      ],
      warning: 'Éviter l\'extension forcée (facteur aggravant)',
    },
    exercises: {
      evidenceLevel: 'Faible',
      protocol: [
        'Exercices en flexion : genoux-poitrine, bascule pelvienne postérieure',
        'Core : gainage, exercices de stabilisation lombaire',
        'Étirements : fléchisseurs de hanche (psoas), extenseurs lombaires',
        'Mobilité thoracique : rotations douces (pour décharger le rachis lombaire)',
      ],
    },
    keyNotes: [
      'Données spécifiques limitées — reposent principalement sur les données de la lombalgie non spécifique',
      'Seul examen confirmatoire fiable : bloc facettaire diagnostique ou SPECT',
    ],
  },
  spa: {
    manualTherapy: {
      evidenceLevel: 'Très faible',
      techniques: [
        'Mobilisations douces uniquement (grades I-II)',
        'Techniques myofasciales et de tissus mous',
        'Mobilisation thoracique et costale (maintien de l\'expansion thoracique)',
        'Mobilisation des hanches et des épaules',
      ],
      warning: '⚠️ PAS de HVLA sur rachis ankylosé ou en voie d\'ankylose — risque de fracture. Référer en rhumatologie pour traitement médicamenteux (AINS 1re ligne, puis biothérapies si échec)',
    },
    exercises: {
      evidenceLevel: 'Élevé',
      protocol: [
        'Aérobie : natation, vélo, marche rapide — 3-5×/sem, 30 min',
        'Renforcement : muscles du tronc, extenseurs du rachis, muscles posturaux — 2-3×/sem',
        'Flexibilité quotidienne : extension rachis, rotation, flexion latérale, expansion thoracique',
        'Neuro-moteur : exercices posturaux, proprioception, équilibre',
        'Hydrothérapie / balnéothérapie : piscine chaude — améliore la douleur et le bien-être global',
      ],
    },
    keyNotes: [
      'Exercice supervisé haute intensité : améliore ASDAS (−0.6) et BASFI (−0.9)',
      'Exercices de groupe supervisés > exercices à domicile pour la mobilité et le bien-être',
      'Rôle ostéopathique complémentaire — le traitement médicamenteux est indispensable',
    ],
  },
}

export function buildResult(state: TreeState): DiagnosisResult {
  const isAcute = state.q_duration === 'acute'

  const isRadicular = state.q6_radiation === 'yes' && state.q6_below_knee === 'yes' && state.q6_leg_worse === 'yes'

  if (isRadicular) {
    const discFeatures = [
      state.q7_unilateral === 'yes', state.q7_worse_sitting === 'yes',
      state.q7_sudden_onset === 'yes', state.q7_cough_sneeze === 'yes',
    ].filter(Boolean).length
    const stenosisFeatures = [
      state.q7_age_under60 === 'no', state.q7_unilateral === 'no',
      state.q7_worse_sitting === 'no', state.q7_worse_walking === 'yes', state.q7_shopping_cart === 'yes',
    ].filter(Boolean).length
    const isDisc = discFeatures >= 2 && state.q7_age_under60 === 'yes'
    const isStenosis = stenosisFeatures >= 3
    const primary = isDisc ? 'Hernie discale probable' : isStenosis ? 'Sténose spinale probable' : 'Radiculopathie lombaire (à préciser)'
    return {
      primary,
      confidence: 'probable',
      tests: [
        { name: 'Lasègue ipsilatéral (SLR)', target: 'Hernie discale', result: 'Sn 92 %', refinement: 'Lasègue positif → argument fort pour hernie discale (Sn 92 %)' },
        { name: 'Lasègue croisé', target: 'Hernie discale', result: 'Sp 90 %', refinement: 'Lasègue croisé positif → hernie paramédiane probable (Sp 90 %)' },
        { name: 'Lasègue assis (distracted SLR)', target: 'Hernie discale', result: 'Sn 41 %', refinement: 'Test de Waddell positif — possible facteur psychosocial' },
        { name: 'Femoral stretch test (L2-L4)', target: 'Radiculopathie haute', result: '', refinement: 'Stretch test positif → compression radiculaire L2-L4' },
        { name: 'Romberg + démarche élargie', target: 'Sténose spinale', result: 'Sp > 90 %', refinement: 'Romberg positif → sténose spinale évoquée (Sp > 90 %)' },
        { name: 'Extension lombaire — reproduit la douleur ?', target: 'Sténose spinale', result: '', refinement: 'Extension reproductrice → sténose spinale renforcée' },
        { name: 'Force motrice : dorsiflexion cheville', target: 'L4-L5', result: '', refinement: 'Déficit moteur L4-L5 objectivé → IRM si progressif' },
        { name: 'Force motrice : flexion plantaire', target: 'S1', result: '', refinement: 'Déficit moteur S1 objectivé → surveillance neurologique' },
        { name: 'Réflexe rotulien', target: 'L3-L4', result: '', refinement: 'Réflexe rotulien diminué/aboli → atteinte L3-L4 confirmée' },
        { name: 'Réflexe achilléen', target: 'S1', result: '', refinement: 'Réflexe achilléen diminué/aboli → atteinte S1 confirmée' },
        { name: 'Sensibilité face ant.-médiale jambe', target: 'L4', result: '', refinement: 'Hypoesthésie L4 objectivée' },
        { name: 'Sensibilité face latérale jambe / dos du pied / gros orteil', target: 'L5', result: '', refinement: 'Hypoesthésie L5 objectivée' },
        { name: 'Sensibilité face post. jambe / plante / 5e orteil', target: 'S1', result: '', refinement: 'Hypoesthésie S1 objectivée' },
      ],
      exams: [{
        name: 'IRM lombaire',
        urgency: 'if_persistent',
        condition: 'Si déficit neurologique sévère/progressif ou symptômes > 6-8 semaines',
      }],
      yellowFlagWarning: false,
      chronicRisk: false,
      isAcute,
      anamnesisSummary: buildAnamnesisText(primary, state, 'radicular'),
      treatment: isStenosis ? TREATMENT_RECS.stenosis : TREATMENT_RECS.disc_radicular,
    }
  }

  // Inflammatory → SpA
  if (state.q9_inflammatory === 'yes') {
    if (state.q9_spa_sacroiliitis === 'yes') {
      return {
        primary: 'Spondylarthrite ankylosante (sacroiliite radiographique)',
        confidence: 'probable',
        tests: [
          { name: 'Mobilité lombaire (Schober)', target: 'Limitation', result: '', refinement: 'Schober positif → limitation de mobilité lombaire confirmée' },
          { name: 'Expansion thoracique', target: 'Limitation', result: '', refinement: 'Expansion thoracique réduite → critère diagnostique SpA' },
          { name: 'Distance doigt-sol', target: 'Flexion lombaire', result: '', refinement: 'Distance doigt-sol augmentée → atteinte globale du rachis' },
        ],
        exams: [
          { name: 'Radiographies bassin / sacro-iliaques', urgency: 'if_persistent', condition: 'Confirme la sacroiliite' },
          { name: 'IRM sacro-iliaque', urgency: 'if_persistent', condition: 'Si doute sur les radiographies' },
          { name: 'Bilan biologique : CRP, VS, NFS', urgency: 'if_persistent', condition: '' },
          { name: 'Référer en rhumatologie', urgency: 'if_persistent', condition: 'Pour confirmation et traitement' },
        ],
        yellowFlagWarning: false, chronicRisk: false, isAcute,
        anamnesisSummary: buildAnamnesisText('Spondylarthrite ankylosante', state, 'spa'),
        treatment: TREATMENT_RECS.spa,
      }
    }
    // Non-radiographic SpA
    const primary = state.q9_spa_clinical_picture === 'yes' ? 'Spondyloarthrite axiale (non radiographique)' : 'Suspicion de spondyloarthrite axiale — IRM recommandée'
    return {
      primary,
      confidence: state.q9_spa_clinical_picture === 'yes' ? 'probable' : 'possible',
      tests: [
        { name: 'Mobilité lombaire (Schober)', target: 'Raideur', result: '', refinement: 'Schober positif → limitation de mobilité lombaire confirmée' },
        { name: 'Test de Patrick / FABER', target: 'Articulation SI', result: '', refinement: 'FABER positif → tension articulation sacro-iliaque' },
        { name: 'Expansion thoracique', target: 'Limitation', result: '', refinement: 'Expansion thoracique réduite → critère diagnostique SpA' },
      ],
      exams: [
        { name: 'IRM sacro-iliaque', urgency: 'if_persistent', condition: 'Critère ASAS de référence pour SpA non radiographique' },
        { name: 'Radiographies bassin', urgency: 'if_persistent', condition: '' },
        { name: 'Bilan biologique : CRP, VS, NFS, HLA-B27', urgency: 'if_persistent', condition: '' },
        { name: 'Référer en rhumatologie', urgency: 'if_persistent', condition: 'Si ≥ 1 paramètre ASAS positif' },
      ],
      yellowFlagWarning: false, chronicRisk: false, isAcute,
      anamnesisSummary: buildAnamnesisText(primary, state, 'spa'),
      treatment: TREATMENT_RECS.spa,
    }
  }

  // Mechanical
  const loc = state.q10_location
  if (loc === 'gluteal') {
    return {
      primary: 'Dysfonction sacro-iliaque probable',
      confidence: 'probable',
      tests: [
        { name: 'Test de distraction', target: 'SI', result: '', refinement: 'Distraction positive → provocation douleur SI' },
        { name: 'Test de compression', target: 'SI', result: '', refinement: 'Compression positive → provocation douleur SI' },
        { name: 'Thrust sacré', target: 'SI', result: '', refinement: 'Thrust sacré positif → provocation douleur SI' },
        { name: 'Test de Gaenslen', target: 'SI', result: '', refinement: 'Gaenslen positif → tension bilatérale SI' },
        { name: 'Test de Patrick / FABER', target: 'SI', result: '', refinement: 'FABER positif → tension SI / hanche' },
        { name: 'Thigh thrust (cisaillement post.)', target: 'SI', result: 'Cluster ≥ 3 : Sn 80-91 % Sp 63-79 %', refinement: 'Thigh thrust positif → cisaillement postérieur SI' },
      ],
      exams: [
        { name: 'Bloc diagnostique SI', urgency: 'if_persistent', condition: 'Seul examen confirmatoire' },
        { name: 'Pas d\'imagerie en routine', urgency: 'not_indicated', condition: '' },
      ],
      yellowFlagWarning: state.q_yellow_flags.length >= 2,
      chronicRisk: state.q_chronic_risk === 'yes',
      isAcute,
      anamnesisSummary: buildAnamnesisText('Dysfonction sacro-iliaque', state, 'mechanical'),
      treatment: TREATMENT_RECS.si,
    }
  }
  if (loc === 'medial' && state.q11_centralization === 'yes') {
    return {
      primary: 'Douleur discogénique probable',
      confidence: 'probable',
      tests: [
        { name: 'Phénomène de centralisation (McKenzie)', target: 'Discogénique', result: 'LR+ significatif', refinement: 'Centralisation confirmée cliniquement → douleur discogénique validée' },
        { name: 'Mouvements répétés en extension', target: 'Centralisation', result: '', refinement: 'Préférence directionnelle en extension identifiée' },
        { name: 'Mouvements répétés en flexion', target: 'Centralisation', result: '', refinement: 'Préférence directionnelle en flexion identifiée' },
      ],
      exams: [{ name: 'Pas d\'imagerie en routine', urgency: 'not_indicated', condition: 'Centralisation positive suffit' }],
      yellowFlagWarning: state.q_yellow_flags.length >= 2,
      chronicRisk: state.q_chronic_risk === 'yes',
      isAcute,
      anamnesisSummary: buildAnamnesisText('Lombalgie discogénique', state, 'mechanical'),
      treatment: TREATMENT_RECS.discogenic,
    }
  }
  if (loc === 'paravertebral') {
    return {
      primary: 'Syndrome facettaire possible',
      confidence: 'possible',
      tests: [
        { name: 'Critères de Revel combinés (≥ 3/7)', target: 'Facettes', result: 'Sp 66-91 %', refinement: '≥ 3 critères de Revel → syndrome facettaire confirmé (Sp 66-91 %)' },
        { name: 'Extension + rotation ipsilatérale reproduit douleur', target: 'Facettes', result: '', refinement: 'Test extension-rotation positif → critère facettaire validé' },
        { name: 'Phénomène de non-centralisation', target: 'Facettes', result: 'Sn 100 % / Sp 11-17 %' },
      ],
      exams: [
        { name: 'Bloc facettaire diagnostique', urgency: 'if_persistent', condition: 'Seul test diagnostique fiable' },
        { name: 'Pas d\'imagerie en routine', urgency: 'not_indicated', condition: '' },
      ],
      yellowFlagWarning: state.q_yellow_flags.length >= 2,
      chronicRisk: state.q_chronic_risk === 'yes',
      isAcute,
      anamnesisSummary: buildAnamnesisText('Syndrome facettaire', state, 'mechanical'),
      treatment: TREATMENT_RECS.facet,
    }
  }
  // Non-specific
  return {
    primary: 'Lombalgie non spécifique (diagnostic d\'exclusion)',
    confidence: 'exclusion',
    tests: [
      { name: 'Examen neurologique complet', target: 'Exclusion déficit', result: '' },
      { name: 'Palpation paravertébrale', target: 'Spasme musculaire', result: '' },
      { name: 'Mobilité lombaire globale', target: 'Limitation fonctionnelle', result: '' },
    ],
    exams: [{ name: 'Aucun examen nécessaire', urgency: 'not_indicated', condition: '80-90 % des cas' }],
    yellowFlagWarning: state.q_yellow_flags.length >= 2,
    chronicRisk: state.q_chronic_risk === 'yes',
    isAcute,
    anamnesisSummary: buildAnamnesisText('Lombalgie non spécifique', state, 'non_specific'),
    treatment: TREATMENT_RECS.non_specific,
  }
}

export function buildAnamnesisText(primary: string, state: TreeState, type: string): string {
  const lines: string[] = []
  lines.push('=== Arbre décisionnel lombalgie (MyOsteoFlow) ===')
  lines.push(`Suspicion diagnostique : ${primary}`)
  lines.push('')

  // ── Durée ──
  if (state.q_duration) {
    lines.push(`Durée : ${state.q_duration === 'acute' ? 'aiguë (< 8 semaines)' : 'subaiguë / chronique (≥ 8 semaines)'}.`)
  }

  // ── Drapeaux rouges ──
  const q2Labels: Record<string, string> = { trauma: 'traumatisme récent', neuro: 'déficit neurologique associé', age70: 'âge > 70 ans', steroids: 'corticoïdes au long cours', osteo: 'ostéoporose connue', medial_pain: 'douleur médiane localisée' }
  const q3Labels: Record<string, string> = { cancer_hx: 'antécédent de cancer', weight_loss: 'perte de poids inexpliquée', night_pain: 'douleur nocturne', age50: '> 50 ans avec facteurs de risque', persistent: 'douleur persistante > 1 mois malgré traitement' }
  const q4Labels: Record<string, string> = { fever: 'fièvre', immuno: 'immunodépression', iv_drugs: 'drogues IV', catheter: 'cathéter/infection bactérienne récente', rest_pain: 'douleur constante au repos' }
  const redFlagLines: string[] = []
  if (state.q1_cauda_equina === 'yes') redFlagLines.push('⚠ Signes de queue de cheval présents — orientation urgente')
  if (state.q2_fracture === 'yes') {
    const items = state.q2_checks.map(k => q2Labels[k] || k).join(', ')
    redFlagLines.push(`⚠ Suspicion de fracture (${state.q2_factors} facteur(s) : ${items}${state.q2_trauma_neuro ? ' — trauma + déficit neurologique' : ''})`)
  }
  if (state.q3_neoplasia === 'alert') {
    const items = state.q3_checks.map(k => q3Labels[k] || k).join(', ')
    redFlagLines.push(`⚠ Suspicion néoplasie (${state.q3_factors} facteur(s) : ${items})`)
  }
  if (state.q3_neoplasia === 'watch') redFlagLines.push('(!) Antécédent de cancer isolé sans autre facteur — surveillance rapprochée')
  if (state.q4_infection === 'yes') {
    const items = state.q4_checks.map(k => q4Labels[k] || k).join(', ')
    redFlagLines.push(`⚠ Suspicion infection spinale (${items})`)
  }
  if (state.q5_aaa === 'yes') redFlagLines.push('⚠ Suspicion anévrisme de l\'aorte abdominale')
  if (redFlagLines.length) {
    lines.push('Drapeaux rouges :')
    redFlagLines.forEach(l => lines.push(`  ${l}`))
  }

  // ── Irradiation / type de douleur ──
  if (state.q6_radiation !== null) {
    if (state.q6_radiation === 'no') {
      lines.push('Irradiation : douleur axiale uniquement (pas d\'irradiation dans la jambe).')
    } else if (state.q6_radiation === 'yes') {
      const belowKnee = state.q6_below_knee === 'yes' ? 'descend sous le genou' : 'ne descend pas sous le genou'
      const legWorse = state.q6_leg_worse === 'yes' ? 'douleur de jambe > douleur de dos' : 'douleur de dos ≥ douleur de jambe'
      lines.push(`Irradiation : dans la jambe (${belowKnee}, ${legWorse}).`)
    }
  }

  // ── Voie radiculaire ──
  if (type === 'radicular') {
    const disc: string[] = []
    const stenosis: string[] = []
    if (state.q7_age_under60 === 'yes') disc.push('< 60 ans')
    if (state.q7_age_under60 === 'no') { stenosis.push('≥ 60 ans') }
    if (state.q7_unilateral === 'yes') disc.push('unilatérale')
    if (state.q7_unilateral === 'no') stenosis.push('bilatérale')
    if (state.q7_worse_sitting === 'yes') disc.push('aggravée assis')
    if (state.q7_worse_walking === 'yes') stenosis.push('aggravée à la marche / claudication neurogène')
    if (state.q7_shopping_cart === 'yes') stenosis.push('soulagée en flexion / appui caddie [shopping cart sign]')
    if (state.q7_sudden_onset === 'yes') disc.push('début brutal après effort')
    if (state.q7_cough_sneeze === 'yes') disc.push('augmentée à la toux / éternuement')
    const discStr = disc.filter(Boolean)
    const stenosisStr = stenosis.filter(Boolean)
    if (discStr.length) lines.push(`Caractéristiques évocatrices hernie discale : ${discStr.join(', ')}.`)
    if (stenosisStr.length) lines.push(`Caractéristiques évocatrices sténose spinale : ${stenosisStr.join(', ')}.`)
  }

  // ── Voie inflammatoire / SpA ──
  if (type === 'spa') {
    const inflammCriteriaLabels: Record<string, string> = {
      onset_45: 'début avant 45 ans', insidious: 'début insidieux/progressif',
      morning_stiff: 'raideur matinale > 30 min', exercise_better: 'améliorée par l\'exercice',
      alternating_buttock: 'douleurs fessières alternantes', night_waking: 'réveils en 2e partie de nuit',
    }
    const extraArticularLabels: Record<string, string> = {
      psoriasis: 'psoriasis', uveitis: 'uvéite', ibd: 'MICI',
      dactylitis: 'dactylite', enthesitis: 'enthésite', family_hx: 'antécédents familiaux SpA',
    }
    const inflammChecked = state.q9_checks.filter(k => k in inflammCriteriaLabels).map(k => inflammCriteriaLabels[k])
    const extraChecked = state.q9_checks.filter(k => k in extraArticularLabels).map(k => extraArticularLabels[k])
    lines.push('')
    lines.push('Profil inflammatoire (critères ASAS) :')
    lines.push(`  Critères satisfaits (${state.q9_criteria}/6) :${inflammChecked.length ? ' ' + inflammChecked.join(', ') : ' aucun'}.`)
    if (extraChecked.length) lines.push(`  Manifestations extra-articulaires : ${extraChecked.join(', ')}.`)
    else lines.push('  Manifestations extra-articulaires : aucune.')
    if (state.q9_spa_sacroiliitis === 'yes') lines.push('  Sacroiliite radiographique présente → critères de New York modifiés positifs.')
    if (state.q9_spa_sacroiliitis === 'no') lines.push('  Sacroiliite radiographique : absente ou non évaluée.')
    if (state.q9_spa_hlab27 === 'yes') lines.push('  HLA-B27 : positif.')
    if (state.q9_spa_hlab27 === 'no') lines.push('  HLA-B27 : négatif.')
    if (state.q9_spa_hlab27 === 'unknown') lines.push('  HLA-B27 : non réalisé — à prescrire.')
    if (state.q9_spa_clinical_picture === 'yes') lines.push('  Tableau clinique jugé convaincant pour SpA axiale non radiographique.')
    if (state.q9_spa_clinical_picture === 'no') lines.push('  Tableau clinique peu convaincant — IRM sacro-iliaque recommandée.')
  }

  // ── Voie mécanique axiale ──
  if (type === 'mechanical' || type === 'non_specific') {
    lines.push('')
    lines.push('Caractéristiques mécaniques :')
    const locLabels: Record<string, string> = {
      medial: 'médiane sur les épineuses (discogénique)',
      paravertebral: 'paravertébrale (facettaire)',
      gluteal: 'fessière / sacro-iliaque',
      diffuse: 'diffuse paravertébrale bilatérale',
    }
    if (state.q10_location) lines.push(`  Localisation : ${locLabels[state.q10_location] || state.q10_location}.`)
    if (state.q11_centralization === 'yes') lines.push('  Phénomène de centralisation positif (McKenzie) → douleur discogénique probable.')
    if (state.q11_centralization === 'no') lines.push('  Pas de centralisation aux mouvements répétés.')
    if (state.q12_facet === 'probable') lines.push('  Profil facettaire : ≥ 3 critères de Revel.')
    if (state.q10_location === 'gluteal') lines.push('  Localisation fessière/SI → tests de provocation SI à réaliser lors de l\'examen clinique.')
  }

  if (type === 'non_specific') {
    lines.push('  Diagnostic d\'exclusion — aucune imagerie recommandée en routine.')
  }

  // ── Drapeaux rouges éliminés ──
  lines.push('')
  const cleared: string[] = []
  if (state.q1_cauda_equina === 'no') cleared.push('queue de cheval')
  if (state.q2_fracture === 'no') cleared.push('fracture')
  if (state.q3_neoplasia === 'no') cleared.push('néoplasie')
  if (state.q4_infection === 'no') cleared.push('infection')
  if (state.q5_aaa === 'no') cleared.push('AAA')
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

/**
 * Fracture vertébrale. Le traumatisme associé à un déficit neurologique est le
 * signe le plus spécifique (LR+ = 31.1) ; sinon il faut au moins deux facteurs,
 * un facteur isolé n'étant pas informatif.
 */
export function assessLumbarFracture(checks: string[]): RedFlagVerdict {
  if (checks.includes('trauma') && checks.includes('neuro')) return 'alert'
  return checks.length >= 2 ? 'alert' : 'none'
}

/**
 * Néoplasie. Un antécédent de cancer seul ne déclenche qu'une surveillance :
 * isolé, sa spécificité est insuffisante pour justifier un bilan immédiat.
 */
export function assessLumbarNeoplasia(checks: string[]): RedFlagVerdict {
  const hasCancerHistory = checks.includes('cancer_hx')
  const otherFactors = checks.filter((value) => value !== 'cancer_hx').length
  if ((hasCancerHistory && otherFactors >= 1) || (!hasCancerHistory && checks.length >= 2)) return 'alert'
  if (hasCancerHistory) return 'watch'
  return 'none'
}

/**
 * Infection spinale. La fièvre seule est insuffisante ; à défaut de fièvre,
 * c'est la porte d'entrée (drogues IV, cathéter) associée à un autre facteur
 * qui alerte.
 */
export function assessLumbarInfection(checks: string[]): RedFlagVerdict {
  const hasFever = checks.includes('fever')
  if (hasFever && checks.length >= 2) return 'alert'
  const hasEntryPoint = checks.includes('iv_drugs') || checks.includes('catheter')
  if (!hasFever && hasEntryPoint && checks.length >= 2) return 'alert'
  return 'none'
}
