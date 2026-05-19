'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, Activity, FileText, Clock } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Answer = 'yes' | 'no' | string

interface TreeState {
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

const initialState: TreeState = {
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

type Step =
  | 'duration'
  | 'q1' | 'q2' | 'q3' | 'q4' | 'q5'
  | 'alert_cauda_equina' | 'alert_fracture' | 'alert_neoplasia' | 'alert_neoplasia_watch' | 'alert_infection' | 'alert_aaa'
  | 'q6'
  | 'q7' | 'q8'
  | 'q9' | 'q9_spa_sacroiliitis' | 'q9_spa_hlab27' | 'q9_spa_clinical' | 'q9_spa_mri'
  | 'q10' | 'q11' | 'q12' | 'q13'
  | 'q14_yellow_flags' | 'q_chronic_risk'
  | 'result'

// ─── Sub-components ──────────────────────────────────────────────────────────

function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: { label: string; value: string }[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selected.includes(o.value) ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
          }`}
        >
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={selected.includes(o.value)}
            onChange={() => toggle(o.value)}
          />
          <span className="text-sm">{o.label}</span>
        </label>
      ))}
    </div>
  )
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string; description?: string }[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
            value === o.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
          }`}
        >
          <span
            className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              value === o.value ? 'border-primary' : 'border-muted-foreground'
            }`}
          >
            {value === o.value && <span className="w-2 h-2 rounded-full bg-primary" />}
          </span>
          <span className="flex-1">
            <span className="text-sm font-medium">{o.label}</span>
            {o.description && <span className="block text-xs text-muted-foreground mt-0.5">{o.description}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

function StepWrapper({
  label, badge, badgeVariant, question, hint, children,
}: {
  label: string; badge: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  question: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant={badgeVariant} className="text-xs">{badge}</Badge>
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className="font-medium">{question}</p>
      {hint && <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">{hint}</p>}
      {children}
    </div>
  )
}

function AlertStep({
  title, items, onContinue, continueLabel, variant = 'destructive',
}: {
  title: string; items: string[]; onContinue: () => void; continueLabel: string
  variant?: 'destructive' | 'warning'
}) {
  const cls = variant === 'warning'
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-destructive/10 border-destructive/30 text-destructive'
  const icon = variant === 'warning' ? 'text-amber-500' : 'text-destructive'
  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 p-4 border rounded-lg ${cls}`}>
        <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${icon}`} />
        <div>
          <p className="font-semibold">{title}</p>
          <ul className="mt-2 space-y-1">
            {items.map((item, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5">
                <span className="mt-1">•</span>{item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Button variant="outline" className="w-full gap-2" onClick={onContinue}>
        {continueLabel}<ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ─── Result builder ──────────────────────────────────────────────────────────

interface TreatmentRec {
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

interface DiagnosisResult {
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

const TREATMENT_RECS: Record<string, TreatmentRec> = {
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

function buildResult(state: TreeState): DiagnosisResult {
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

function buildAnamnesisText(primary: string, state: TreeState, type: string): string {
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

// ─── Main component ──────────────────────────────────────────────────────────

interface LowBackPainTreeProps {
  open: boolean
  onClose: () => void
  onApply: (anamnesis: string, examination?: string, advice?: string) => void
}

const STEP_PROGRESS: Partial<Record<Step, number>> = {
  duration: 2,
  q1: 8, q2: 16, q3: 24, q4: 32, q5: 40,
  q6: 48,
  q7: 56, q8: 64,
  q9: 56, q9_spa_sacroiliitis: 62, q9_spa_hlab27: 68, q9_spa_clinical: 74, q9_spa_mri: 80,
  q10: 62, q11: 70, q12: 70,
  q14_yellow_flags: 80, q_chronic_risk: 88,
  result: 100,
}

export function LowBackPainTree({ open, onClose, onApply }: LowBackPainTreeProps) {
  const [step, setStep] = useState<Step>('duration')
  const [state, setState] = useState<TreeState>(initialState)
  const [history, setHistory] = useState<Step[]>([])
  const [q2Checks, setQ2Checks] = useState<string[]>([])
  const [q3Checks, setQ3Checks] = useState<string[]>([])
  const [q4Checks, setQ4Checks] = useState<string[]>([])
  const [q9Checks, setQ9Checks] = useState<string[]>([])
  const [q13Checks, setQ13Checks] = useState<string[]>([])
  const [yellowFlagChecks, setYellowFlagChecks] = useState<string[]>([])
  const [result, setResult] = useState<DiagnosisResult | null>(null)

  const reset = () => {
    setStep('duration'); setState(initialState); setHistory([])
    setQ2Checks([]); setQ3Checks([]); setQ4Checks([]); setQ9Checks([])
    setQ13Checks([]); setYellowFlagChecks([]); setResult(null)
  }

  const goBack = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(history.slice(0, -1))
    setStep(prev)
  }

  const push = (next: Step, updates?: Partial<TreeState>) => {
    setHistory([...history, step])
    if (updates) setState((s) => ({ ...s, ...updates }))
    setStep(next)
  }

  const showResult = (updates?: Partial<TreeState>) => {
    const finalState = updates ? { ...state, ...updates } : state
    setState(finalState)
    setResult(buildResult(finalState))
    setHistory([...history, step])
    setStep('result')
  }

  // Helper: go to yellow flags or result based on whether there's anything to assess
  const goToYellowFlags = (updates?: Partial<TreeState>) => {
    setHistory([...history, step])
    if (updates) setState((s) => ({ ...s, ...updates }))
    setStep('q14_yellow_flags')
  }

  const renderStep = () => {
    switch (step) {

      // ── Duration (AAFP entry point) ───────────────────────────────────────
      case 'duration':
        return (
          <StepWrapper
            label="Durée de la douleur"
            badge="Point de départ"
            badgeVariant="secondary"
            question="Depuis combien de temps dure la lombalgie ?"
            hint="L'algorithme AAFP 2025 distingue la phase aiguë (< 8 semaines, traitement conservateur en première ligne) de la phase subaiguë/chronique (≥ 8 semaines, bilan plus approfondi)."
          >
            <RadioGroup
              value={state.q_duration}
              onChange={(v) => push('q1', { q_duration: v })}
              options={[
                { label: 'Moins de 8 semaines (aiguë)', value: 'acute', description: 'Traitement conservateur recommandé en première intention' },
                { label: '8 semaines ou plus (subaiguë / chronique)', value: 'subacute', description: 'Bilan diagnostique approfondi recommandé' },
              ]}
            />
          </StepWrapper>
        )

      // ── Q1 : Cauda equina ─────────────────────────────────────────────────
      case 'q1':
        return (
          <StepWrapper
            label="Q1 — Syndrome de la queue de cheval"
            badge="Drapeau rouge 1/5"
            badgeVariant="destructive"
            question="Le patient présente-t-il ≥ 1 des signes suivants ?"
            hint="Difficultés à uriner ou rétention urinaire · Incontinence urinaire ou fécale · Engourdissement périnéal (zone en selle) · Faiblesse progressive des deux jambes"
          >
            <RadioGroup
              value={state.q1_cauda_equina}
              onChange={(v) => {
                if (v === 'yes') push('alert_cauda_equina', { q1_cauda_equina: 'yes' })
                else push('q2', { q1_cauda_equina: 'no' })
              }}
              options={[
                { label: 'Non — aucun de ces signes', value: 'no' },
                { label: 'Oui — ≥ 1 signe présent', value: 'yes', description: 'Urgence chirurgicale' },
              ]}
            />
          </StepWrapper>
        )

      case 'alert_cauda_equina':
        return (
          <AlertStep
            title="⚠️ Suspicion de syndrome de la queue de cheval"
            items={[
              'IRM urgente',
              'Consultation chirurgicale immédiate',
              'La rétention urinaire aiguë, l\'anesthésie en selle et la perte du tonus anal sont les signes les plus systématiquement retrouvés',
              'Ne pas retarder la prise en charge',
            ]}
            onContinue={() => push('q2')}
            continueLabel="Continuer l'évaluation complète"
          />
        )

      // ── Q2 : Fracture ─────────────────────────────────────────────────────
      case 'q2':
        return (
          <StepWrapper
            label="Q2 — Fracture vertébrale"
            badge="Drapeau rouge 2/5"
            badgeVariant="destructive"
            question="Cochez les facteurs de risque présents :"
            hint="Le traumatisme associé à un déficit neurologique est le signe le plus spécifique (LR+ = 31.1). Risque ≥ 42 % si > 75 ans + ≥ 2 facteurs."
          >
            <CheckboxGroup
              options={[
                { label: 'Traumatisme récent (chute, accident)', value: 'trauma' },
                { label: 'Déficit neurologique associé au traumatisme', value: 'neuro' },
                { label: 'Âge > 70 ans', value: 'age70' },
                { label: 'Corticoïdes au long cours', value: 'steroids' },
                { label: 'Ostéoporose connue', value: 'osteo' },
                { label: 'Douleur médiane très localisée sur les épineuses', value: 'medial_pain' },
              ]}
              selected={q2Checks}
              onChange={setQ2Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              const trauma = q2Checks.includes('trauma')
              const neuro = q2Checks.includes('neuro')
              const factors = q2Checks.length
              if (trauma && neuro) push('alert_fracture', { q2_fracture: 'yes', q2_trauma_neuro: true, q2_factors: factors, q2_checks: q2Checks })
              else if (factors >= 2) push('alert_fracture', { q2_fracture: 'yes', q2_trauma_neuro: false, q2_factors: factors, q2_checks: q2Checks })
              else push('q3', { q2_fracture: 'no', q2_factors: factors, q2_checks: q2Checks })
            }}>
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_fracture':
        return (
          <AlertStep
            title="⚠️ Suspicion de fracture vertébrale"
            items={state.q2_trauma_neuro
              ? ['Radiographies lombo-sacrées AP/latéral', 'IRM ou TDM urgent — trauma + déficit neurologique (LR+ = 31.1)']
              : ['Radiographies lombo-sacrées AP/latéral', `${state.q2_factors} facteurs de risque identifiés`, 'Risque ≥ 42 % si > 75 ans + ≥ 2 facteurs associés']}
            onContinue={() => push('q3')}
            continueLabel="Continuer l'évaluation"
          />
        )

      // ── Q3 : Néoplasie ────────────────────────────────────────────────────
      case 'q3':
        return (
          <StepWrapper
            label="Q3 — Néoplasie / Métastase"
            badge="Drapeau rouge 3/5"
            badgeVariant="destructive"
            question="Cochez les facteurs de risque présents :"
            hint="⚠️ Un drapeau rouge isolé (ex. douleur nocturne seule) a une très faible spécificité (faux positif > 96 %). C'est la combinaison qui est informative. Un antécédent de cancer SEUL sans autre élément clinique ne suffit pas à déclencher un bilan."
          >
            <CheckboxGroup
              options={[
                { label: 'Antécédent de cancer', value: 'cancer_hx' },
                { label: 'Perte de poids inexpliquée récente', value: 'weight_loss' },
                { label: 'Douleur nocturne (réveille en 2e partie de nuit)', value: 'night_pain' },
                { label: '> 50 ans avec facteurs de risque de cancer (tabac, expositions)', value: 'age50' },
                { label: 'Douleur persistante / aggravée malgré traitement > 1 mois', value: 'persistent' },
              ]}
              selected={q3Checks}
              onChange={setQ3Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              const hasCancerHx = q3Checks.includes('cancer_hx')
              const otherFactors = q3Checks.filter(v => v !== 'cancer_hx').length
              const totalFactors = q3Checks.length
              // Alert: cancer_hx + ≥1 autre facteur, OU ≥2 facteurs sans antécédent de cancer
              if ((hasCancerHx && otherFactors >= 1) || (!hasCancerHx && totalFactors >= 2)) {
                push('alert_neoplasia', { q3_neoplasia: 'alert', q3_factors: totalFactors, q3_has_cancer_hx: hasCancerHx, q3_checks: q3Checks })
              } else if (hasCancerHx && otherFactors === 0) {
                push('alert_neoplasia_watch', { q3_neoplasia: 'watch', q3_factors: 1, q3_has_cancer_hx: true, q3_checks: q3Checks })
              } else {
                push('q4', { q3_neoplasia: 'no', q3_factors: totalFactors, q3_has_cancer_hx: hasCancerHx, q3_checks: q3Checks })
              }
            }}>
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_neoplasia':
        return (
          <AlertStep
            title="⚠️ Suspicion de néoplasie / métastase"
            items={[
              state.q3_has_cancer_hx ? 'Antécédent de cancer + ≥ 1 élément clinique → LR+ = 27.9' : `${state.q3_factors} facteurs de risque combinés`,
              'IRM lombaire recommandée',
              'Bilan biologique : NFS, VS, CRP',
              'Référer en oncologie si suspicion confirmée',
            ]}
            onContinue={() => push('q4')}
            continueLabel="Continuer l'évaluation"
          />
        )

      case 'alert_neoplasia_watch':
        return (
          <AlertStep
            variant="warning"
            title="🔶 Antécédent de cancer isolé — surveillance rapprochée"
            items={[
              'Un antécédent de cancer seul, sans autre élément clinique, a une spécificité insuffisante pour justifier un bilan immédiat',
              'Surveillance clinique rapprochée recommandée',
              'Reconsidérer le bilan si apparition de douleur nocturne, perte de poids ou aggravation sous traitement',
            ]}
            onContinue={() => push('q4')}
            continueLabel="Continuer l'évaluation"
          />
        )

      // ── Q4 : Infection ────────────────────────────────────────────────────
      case 'q4':
        return (
          <StepWrapper
            label="Q4 — Infection spinale (spondylodiscite / abcès épidural)"
            badge="Drapeau rouge 4/5"
            badgeVariant="destructive"
            question="Cochez les facteurs de risque présents :"
            hint="LR+ = 13.7 si usage de drogues IV + autre site d'infection · LR+ = 15.7 si cathéter vasculaire. La fièvre seule est insuffisante."
          >
            <CheckboxGroup
              options={[
                { label: 'Fièvre', value: 'fever' },
                { label: 'Immunodépression (VIH, corticoïdes, immunosuppresseurs)', value: 'immuno' },
                { label: 'Usage de drogues IV', value: 'iv_drugs' },
                { label: 'Cathéter vasculaire ou infection bactérienne récente', value: 'catheter' },
                { label: 'Douleur constante même au repos (pas de position antalgique)', value: 'rest_pain' },
              ]}
              selected={q4Checks}
              onChange={setQ4Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              const factors = q4Checks.length
              const hasFever = q4Checks.includes('fever')
              if (hasFever && factors >= 2) push('alert_infection', { q4_infection: 'yes', q4_factors: factors, q4_checks: q4Checks })
              else if (!hasFever && (q4Checks.includes('iv_drugs') || q4Checks.includes('catheter')) && factors >= 2) push('alert_infection', { q4_infection: 'yes', q4_factors: factors, q4_checks: q4Checks })
              else push('q5', { q4_infection: 'no', q4_factors: factors, q4_checks: q4Checks })
            }}>
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_infection':
        return (
          <AlertStep
            title="⚠️ Suspicion d'infection spinale (spondylodiscite)"
            items={[
              q4Checks.includes('iv_drugs') ? 'Usage de drogues IV + facteur associé : LR+ = 13.7' : '',
              q4Checks.includes('catheter') ? 'Cathéter vasculaire : LR+ = 15.7' : '',
              'IRM urgente',
              'Bilan biologique : NFS, VS, CRP, hémocultures',
              'Consultation infectiologie',
            ].filter(Boolean) as string[]}
            onContinue={() => push('q5')}
            continueLabel="Continuer l'évaluation"
          />
        )

      // ── Q5 : AAA ──────────────────────────────────────────────────────────
      case 'q5':
        return (
          <StepWrapper
            label="Q5 — Anévrisme de l'aorte abdominale"
            badge="Drapeau rouge 5/5"
            badgeVariant="destructive"
            question="Le profil vasculaire est-il évocateur ?"
            hint="Population à risque : homme > 50 ans, tabagisme actif ou sevré. Association à une douleur abdominale pulsatile."
          >
            <RadioGroup
              value={state.q5_aaa}
              onChange={(v) => {
                if (v === 'yes') push('alert_aaa', { q5_aaa: 'yes' })
                else push('q6', { q5_aaa: 'no' })
              }}
              options={[
                { label: 'Non — profil non évocateur', value: 'no' },
                { label: 'Oui — homme > 50 ans fumeur + douleur abdominale', value: 'yes', description: 'Palpation abdominale à effectuer' },
              ]}
            />
          </StepWrapper>
        )

      case 'alert_aaa':
        return (
          <AlertStep
            title="⚠️ Suspicion d'anévrisme de l'aorte abdominale"
            items={[
              'Palpation abdominale : rechercher masse pulsatile',
              'Échographie abdominale ou TDM si doute',
              'Consultation vasculaire urgente si masse pulsatile identifiée',
            ]}
            onContinue={() => push('q6')}
            continueLabel="Continuer l'évaluation"
          />
        )

      // ── Q6 : Irradiation ─────────────────────────────────────────────────
      case 'q6':
        return (
          <StepWrapper
            label="Q6 — Caractérisation de la douleur"
            badge="Étape 2 — Nœud principal"
            badgeVariant="secondary"
            question="La douleur irradie-t-elle dans la jambe ?"
            hint="C'est le nœud de branchement principal : voie radiculaire (hernie/sténose) vs voie axiale (mécanique/inflammatoire)."
          >
            <div className="space-y-3">
              <RadioGroup
                value={state.q6_radiation}
                onChange={(v) => setState((s) => ({ ...s, q6_radiation: v }))}
                options={[
                  { label: 'Non — douleur axiale (dos, fesse, hanche uniquement)', value: 'no', description: '→ Voie mécanique / inflammatoire' },
                  { label: 'Oui — douleur descendant dans la jambe', value: 'yes' },
                ]}
              />
              {state.q6_radiation === 'yes' && (
                <div className="space-y-3 pl-3 border-l-2 border-primary/30">
                  <p className="text-sm font-medium text-muted-foreground">Précisez :</p>
                  <RadioGroup
                    value={state.q6_below_knee}
                    onChange={(v) => setState((s) => ({ ...s, q6_below_knee: v }))}
                    options={[
                      { label: 'Descend sous le genou (distribution dermatomale)', value: 'yes' },
                      { label: 'S\'arrête à la cuisse ou à la fesse', value: 'no', description: '→ Irradiation pseudo-radiculaire → voie axiale' },
                    ]}
                  />
                  {state.q6_below_knee !== null && (
                    <RadioGroup
                      value={state.q6_leg_worse}
                      onChange={(v) => setState((s) => ({ ...s, q6_leg_worse: v }))}
                      options={[
                        { label: 'Douleur de jambe > douleur de dos', value: 'yes', description: 'Critère clé pour la radiculopathie vraie' },
                        { label: 'Douleur de dos ≥ douleur de jambe', value: 'no', description: '→ Voie axiale même avec irradiation' },
                      ]}
                    />
                  )}
                </div>
              )}
            </div>
            <Button
              className="w-full mt-3"
              disabled={
                state.q6_radiation === null ||
                (state.q6_radiation === 'yes' && (state.q6_below_knee === null || state.q6_leg_worse === null))
              }
              onClick={() => {
                const radicular = state.q6_radiation === 'yes' && state.q6_below_knee === 'yes' && state.q6_leg_worse === 'yes'
                push(radicular ? 'q7' : 'q9')
              }}
            >
              Continuer
            </Button>
          </StepWrapper>
        )

      // ── Q7 : Hernie vs Sténose ────────────────────────────────────────────
      case 'q7':
        return (
          <StepWrapper
            label="Q7 — Hernie discale vs Sténose spinale"
            badge="Voie radiculaire"
            badgeVariant="default"
            question="Répondez aux questions suivantes (toutes) :"
            hint="Hernie : pic 30-50 ans. Sténose : > 60 ans. Ces deux pathologies représentent les causes radiculaires les plus fréquentes."
          >
            <div className="space-y-3">
              {[
                { key: 'q7_age_under60', q: 'Patient âgé de moins de 60 ans ?', note: 'Hernie : OUI · Sténose : NON (> 60 ans)' },
                { key: 'q7_unilateral', q: 'Douleur unilatérale ?', note: 'Hernie : unilatérale · Sténose : souvent bilatérale' },
                { key: 'q7_worse_sitting', q: 'Douleur aggravée en position assise ?', note: 'Hernie : OUI · Sténose : soulagée assis' },
                { key: 'q7_worse_walking', q: 'Douleur aggravée à la marche / station debout prolongée ?', note: 'Claudication neurogène → sténose' },
                { key: 'q7_shopping_cart', q: 'Soulagée en se penchant en avant (appui caddie) ?', note: '"Shopping cart sign" — Sn 52-70 %, Sp 55-83 % → sténose' },
                { key: 'q7_sudden_onset', q: 'Début brutal après un effort ?', note: 'Hernie : souvent · Sténose : installation progressive' },
                { key: 'q7_cough_sneeze', q: 'Douleur augmentée à la toux / éternuement / poussée ?', note: 'Hernie → OR 3.2' },
              ].map(({ key, q, note }) => (
                <div key={key} className="space-y-1">
                  <p className="text-sm font-medium">{q}</p>
                  <p className="text-xs text-muted-foreground">{note}</p>
                  <div className="flex gap-2">
                    {(['yes', 'no'] as const).map((v) => (
                      <button key={v} type="button"
                        onClick={() => setState((s) => ({ ...s, [key]: v }))}
                        className={`flex-1 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                          (state as any)[key] === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent/50'
                        }`}
                      >
                        {v === 'yes' ? 'Oui' : 'Non'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="w-full mt-3"
              disabled={[state.q7_age_under60, state.q7_unilateral, state.q7_worse_sitting, state.q7_worse_walking, state.q7_shopping_cart, state.q7_sudden_onset, state.q7_cough_sneeze].some((v) => v === null)}
              onClick={() => push('q8')}
            >
              Continuer → Localisation neurologique
            </Button>
          </StepWrapper>
        )

      // ── Q8 : Localisation neurologique ────────────────────────────────────
      case 'q8':
        return (
          <StepWrapper
            label="Q8 — Localisation neurologique"
            badge="Voie radiculaire"
            badgeVariant="default"
            question="Réalisez l'examen neurologique et identifiez le niveau radiculaire :"
          >
            <div className="rounded-lg border overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Racine</th>
                    <th className="text-left p-2 font-medium">Douleur / Paresthésies</th>
                    <th className="text-left p-2 font-medium">Moteur</th>
                    <th className="text-left p-2 font-medium">Réflexe</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  <tr><td className="p-2 font-semibold text-primary">L2</td><td className="p-2">Face ant. cuisse (inguinal → genou)</td><td className="p-2">Flexion hanche</td><td className="p-2">—</td></tr>
                  <tr className="bg-muted/20"><td className="p-2 font-semibold text-primary">L3</td><td className="p-2">Face ant.-médiale cuisse → genou</td><td className="p-2">Extension genou</td><td className="p-2">Rotulien ↓ (partiel)</td></tr>
                  <tr><td className="p-2 font-semibold text-primary">L4</td><td className="p-2">Face ant.-médiale jambe</td><td className="p-2">Dorsiflexion cheville, extension genou</td><td className="p-2">Rotulien ↓</td></tr>
                  <tr className="bg-muted/20"><td className="p-2 font-semibold text-primary">L5</td><td className="p-2">Face latérale jambe, dos du pied, gros orteil</td><td className="p-2">Dorsiflexion cheville, extension orteils, éversion</td><td className="p-2">Ischio-jambier médial (inconstant)</td></tr>
                  <tr><td className="p-2 font-semibold text-primary">S1</td><td className="p-2">Face post. jambe, plante, 5e orteil</td><td className="p-2">Flexion plantaire, flexion orteils</td><td className="p-2">Achilléen ↓</td></tr>
                  <tr className="bg-muted/20"><td className="p-2 font-semibold text-primary">S2-S3</td><td className="p-2">Face post. cuisse, périnée</td><td className="p-2">Sphincters (si atteints)</td><td className="p-2">—</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Test clinique clé : Femoral stretch test pour L2-L4 (patient en décubitus ventral, flexion passive du genou).</p>
            <Button className="w-full mt-4" onClick={() => showResult()}>
              Voir le résultat
            </Button>
          </StepWrapper>
        )

      // ── Q9 : Inflammatoire vs mécanique ───────────────────────────────────
      case 'q9':
        return (
          <StepWrapper
            label="Q9 — Douleur inflammatoire vs mécanique ?"
            badge="Voie axiale"
            badgeVariant="default"
            question="Cochez les critères de douleur inflammatoire présents :"
            hint="Seuil : ≥ 4 critères = profil inflammatoire évocateur de spondyloarthrite. Une manifestation extra-articulaire associée renforce la suspicion même en dessous du seuil."
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Critères ASAS de douleur inflammatoire</p>
              <CheckboxGroup
                options={[
                  { label: 'Début avant 45 ans', value: 'onset_45' },
                  { label: 'Début progressif / insidieux', value: 'insidious' },
                  { label: 'Raideur matinale > 30 minutes', value: 'morning_stiff' },
                  { label: 'Améliorée par l\'exercice, non améliorée par le repos', value: 'exercise_better' },
                  { label: 'Douleurs fessières alternantes (droite puis gauche)', value: 'alternating_buttock' },
                  { label: 'Réveils en 2e partie de nuit (pas en début de nuit)', value: 'night_waking' },
                ]}
                selected={q9Checks}
                onChange={setQ9Checks}
              />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">Manifestations extra-articulaires</p>
              <CheckboxGroup
                options={[
                  { label: 'Psoriasis', value: 'psoriasis' },
                  { label: 'Uvéite', value: 'uveitis' },
                  { label: 'Maladie inflammatoire intestinale (MICI)', value: 'ibd' },
                  { label: 'Dactylite', value: 'dactylitis' },
                  { label: 'Enthésite (talon, fascia plantaire)', value: 'enthesitis' },
                  { label: 'Antécédents familiaux de spondylarthrite', value: 'family_hx' },
                ]}
                selected={q9Checks}
                onChange={setQ9Checks}
              />
            </div>
            <Button className="w-full mt-3" onClick={() => {
              const inflammCriteria = ['onset_45','insidious','morning_stiff','exercise_better','alternating_buttock','night_waking'].filter(v => q9Checks.includes(v)).length
              const extraArticular = ['psoriasis','uveitis','ibd','dactylitis','enthesitis','family_hx'].some(v => q9Checks.includes(v))
              const updates = { q9_criteria: inflammCriteria, q9_checks: q9Checks, q9_extra_articular: extraArticular }
              if (inflammCriteria >= 4 || extraArticular) {
                push('q9_spa_sacroiliitis', { ...updates, q9_inflammatory: 'yes' })
              } else {
                push('q10', { ...updates, q9_inflammatory: 'no' })
              }
            }}>
              Continuer
            </Button>
          </StepWrapper>
        )

      // ── SpA algorithm (NEJM) ──────────────────────────────────────────────
      case 'q9_spa_sacroiliitis':
        return (
          <StepWrapper
            label="SpA — Sacroiliite radiographique"
            badge="Algorithme SpA (NEJM)"
            badgeVariant="secondary"
            question="Y a-t-il une sacroiliite radiographique définie sur les radiographies du bassin ?"
            hint="Sacroiliite radiographique définie = stade ≥ 2 bilatéral ou stade 3-4 unilatéral (critères de New York). Contexte : lombalgies > 3 mois, âge < 45 ans."
          >
            <RadioGroup
              value={state.q9_spa_sacroiliitis}
              onChange={(v) => {
                if (v === 'yes') showResult({ q9_spa_sacroiliitis: 'yes' })
                else {
                  // Route based on criteria count
                  const criteria = state.q9_criteria
                  if (criteria >= 4) push('q9_spa_clinical', { q9_spa_sacroiliitis: 'no' })
                  else push('q9_spa_hlab27', { q9_spa_sacroiliitis: 'no' })
                }
              }}
              options={[
                { label: 'Oui — sacroiliite radiographique présente', value: 'yes', description: '→ Spondylarthrite ankylosante (critères de New York modifiés)' },
                { label: 'Non / Non évaluée', value: 'no', description: '→ Évaluer les features SpA et le HLA-B27' },
              ]}
            />
          </StepWrapper>
        )

      case 'q9_spa_hlab27':
        return (
          <StepWrapper
            label="SpA — HLA-B27"
            badge="Algorithme SpA (NEJM)"
            badgeVariant="secondary"
            question="Le HLA-B27 est-il positif ?"
            hint={`${state.q9_criteria} critère(s) inflammatoire(s) identifié(s). ${state.q9_criteria >= 2 ? 'Avec HLA-B27 positif : évaluer si le tableau clinique est convaincant.' : 'Avec 0-1 critère : HLA-B27 négatif oriente vers d\'autres diagnostics.'}`}
          >
            <RadioGroup
              value={state.q9_spa_hlab27}
              onChange={(v) => {
                if (v === 'no' && state.q9_criteria <= 1) {
                  // 0-1 criteria + HLA-B27 négatif → autres diagnostics
                  showResult({ q9_spa_hlab27: 'no', q9_spa_clinical_picture: 'no' })
                } else if (v === 'yes' && state.q9_criteria >= 2) {
                  push('q9_spa_clinical', { q9_spa_hlab27: 'yes' })
                } else {
                  // HLA-B27 positif avec peu de critères, ou négatif avec 2-3 → IRM
                  push('q9_spa_mri', { q9_spa_hlab27: v })
                }
              }}
              options={[
                { label: 'Positif', value: 'yes' },
                { label: 'Négatif', value: 'no' },
                { label: 'Non réalisé', value: 'unknown', description: '→ À prescrire' },
              ]}
            />
            {state.q9_spa_hlab27 === 'unknown' && (
              <Button className="w-full mt-3" onClick={() => push('q9_spa_mri', { q9_spa_hlab27: 'unknown' })}>
                Continuer sans résultat HLA-B27
              </Button>
            )}
          </StepWrapper>
        )

      case 'q9_spa_clinical':
        return (
          <StepWrapper
            label="SpA — Tableau clinique convaincant ?"
            badge="Algorithme SpA (NEJM)"
            badgeVariant="secondary"
            question="Le tableau clinique global est-il convaincant pour une spondyloarthrite axiale ?"
            hint="Tenez compte de l'ensemble : nombre de critères inflammatoires, manifestations extra-articulaires, réponse aux AINS, histoire familiale, âge de début."
          >
            <RadioGroup
              value={state.q9_spa_clinical_picture}
              onChange={(v) => {
                if (v === 'yes') showResult({ q9_spa_clinical_picture: 'yes' })
                else push('q9_spa_mri', { q9_spa_clinical_picture: 'no' })
              }}
              options={[
                { label: 'Oui — tableau clinique convaincant', value: 'yes', description: '→ Spondyloarthrite axiale (non radiographique)' },
                { label: 'Non — tableau peu convaincant', value: 'no', description: '→ IRM sacro-iliaque pour confirmer ou infirmer' },
              ]}
            />
          </StepWrapper>
        )

      case 'q9_spa_mri':
        return (
          <AlertStep
            variant="warning"
            title="🔶 IRM sacro-iliaque recommandée"
            items={[
              'L\'IRM est l\'examen de référence pour diagnostiquer la SpA non radiographique (critères ASAS)',
              state.q9_spa_hlab27 === 'yes' ? 'HLA-B27 positif : probabilité pré-test élevée' : 'HLA-B27 négatif ou non réalisé : l\'IRM est l\'étape décisive',
              'IRM positive (inflammation active SI) → Spondyloarthrite axiale confirmée',
              'IRM négative → Reconsidérer d\'autres diagnostics',
              'Référer en rhumatologie',
            ]}
            onContinue={() => showResult()}
            continueLabel="Voir le résultat"
          />
        )

      // ── Q10 : Localisation mécanique ──────────────────────────────────────
      case 'q10':
        return (
          <StepWrapper
            label="Q10 — Localisation de la douleur mécanique"
            badge="Voie mécanique"
            badgeVariant="default"
            question="Où se situe exactement la douleur ?"
          >
            <RadioGroup
              value={state.q10_location}
              onChange={(v) => {
                setState((s) => ({ ...s, q10_location: v }))
                if (v === 'medial') push('q11', { q10_location: v })
                else if (v === 'paravertebral') push('q12', { q10_location: v })
                else if (v === 'gluteal') goToYellowFlags({ q10_location: v })
                else goToYellowFlags({ q10_location: v })
              }}
              options={[
                { label: 'Médiane (sur les épineuses)', value: 'medial', description: '→ Douleur discogénique ou fracture' },
                { label: 'Paravertébrale (à côté de la colonne)', value: 'paravertebral', description: '→ Origine facettaire ou musculaire' },
                { label: 'Fessière / sacro-iliaque', value: 'gluteal', description: '→ Dysfonction sacro-iliaque' },
                { label: 'Diffuse paravertébrale bilatérale', value: 'diffuse', description: '→ Lombalgie non spécifique (strain/sprain)' },
              ]}
            />
          </StepWrapper>
        )

      // ── Q11 : Discogénique ────────────────────────────────────────────────
      case 'q11':
        return (
          <StepWrapper
            label="Q11 — Douleur discogénique (sans radiculopathie)"
            badge="Voie mécanique"
            badgeVariant="default"
            question="Le phénomène de centralisation est-il positif (test de McKenzie) ?"
            hint="Mouvements répétés (extension ou flexion) qui font migrer la douleur vers le centre (lombaire) et la font disparaître en périphérie → c'est le seul test clinique avec LR+ significatif pour la douleur discogénique."
          >
            <RadioGroup
              value={state.q11_centralization}
              onChange={(v) => goToYellowFlags({ q11_centralization: v })}
              options={[
                { label: 'Oui — centralisation positive', value: 'yes', description: 'Douleur discogénique probable — pas d\'imagerie en routine' },
                { label: 'Non — pas de centralisation', value: 'no', description: 'Orientation vers syndrome facettaire ou non spécifique' },
              ]}
            />
          </StepWrapper>
        )

      // ── Q12 : Facettaire ──────────────────────────────────────────────────
      case 'q12':
        return (
          <StepWrapper
            label="Q12 — Syndrome facettaire"
            badge="Voie mécanique"
            badgeVariant="default"
            question="Profil clinique facettaire (critères de Revel) :"
            hint="Les tests individuels ont une faible précision. Spécificité 66-91 % pour ≥ 3 critères combinés. La non-centralisation a une Sn 100 % mais Sp 11-17 % seulement — à utiliser pour exclure. Le seul examen informatif est le SPECT ou le bloc facettaire diagnostique."
          >
            <div className="text-sm space-y-1 bg-muted/30 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Critères de Revel (spécificité 66-91 % si ≥ 3) :</p>
              <p>· Douleur paravertébrale aggravée en extension + rotation ipsilatérale</p>
              <p>· Irradiation vers hanche / cuisse (pas sous le genou)</p>
              <p>· Arthrose lombaire connue</p>
              <p>· Âge &gt; 65 ans</p>
              <p>· Douleur non centralisée aux mouvements répétés</p>
            </div>
            <RadioGroup
              value={state.q12_facet}
              onChange={(v) => goToYellowFlags({ q12_facet: v })}
              options={[
                { label: 'Profil facettaire probable (≥ 3 critères de Revel)', value: 'probable' },
                { label: 'Profil non concluant', value: 'unclear' },
              ]}
            />
          </StepWrapper>
        )

      // ── Q14 : Drapeaux jaunes ─────────────────────────────────────────────
      case 'q14_yellow_flags':
        return (
          <StepWrapper
            label="Q14 — Drapeaux jaunes (facteurs de chronicisation)"
            badge="Évaluation psychosociale"
            badgeVariant="secondary"
            question="Cochez les facteurs de risque de chronicisation présents :"
            hint="Ces facteurs psychosociaux sont des prédicteurs indépendants d'évolution vers la lombalgie chronique. Leur identification permet d'adapter le plan de traitement (AAFP 2025)."
          >
            <CheckboxGroup
              options={[
                { label: 'Catastrophisme (le patient pense que c\'est grave / irréversible)', value: 'catastrophism' },
                { label: 'Anxiété', value: 'anxiety' },
                { label: 'Dépression', value: 'depression' },
                { label: 'Kinésiophobie (peur du mouvement)', value: 'kinesophobia' },
                { label: 'Insatisfaction au travail ou contexte professionnel difficile', value: 'work' },
                { label: 'Obésité', value: 'obesity' },
                { label: 'Tabagisme actif', value: 'smoking' },
                { label: 'Douleur de forte intensité (EVA ≥ 7/10)', value: 'high_pain' },
              ]}
              selected={yellowFlagChecks}
              onChange={setYellowFlagChecks}
            />
            <Button className="w-full mt-3" onClick={() => {
              setState((s) => ({ ...s, q_yellow_flags: yellowFlagChecks }))
              if (yellowFlagChecks.length >= 2) push('q_chronic_risk', { q_yellow_flags: yellowFlagChecks })
              else showResult({ q_yellow_flags: yellowFlagChecks })
            }}>
              Continuer
            </Button>
          </StepWrapper>
        )

      // ── Risque de chronicisation (AAFP) ──────────────────────────────────
      case 'q_chronic_risk':
        return (
          <StepWrapper
            label="Risque de chronicisation — AAFP 2025"
            badge="Évaluation finale"
            badgeVariant="secondary"
            question="Confirmez : le patient présente des facteurs de risque de développer une lombalgie chronique ?"
            hint={`${yellowFlagChecks.length} drapeaux jaune(s) identifié(s). Selon l'algorithme AAFP 2025 : si oui, élaborer un plan de traitement qui adresse spécifiquement ces facteurs (dépression, anxiété, obésité, tabac). Si non, réassurance + prise en charge conservative.`}
          >
            <RadioGroup
              value={state.q_chronic_risk}
              onChange={(v) => showResult({ q_chronic_risk: v })}
              options={[
                { label: 'Oui — plan de traitement ciblé nécessaire', value: 'yes', description: 'Adresser les facteurs identifiés (AAFP : dépression, anxiété, obésité, tabac)' },
                { label: 'Non — réassurance et traitement conservateur', value: 'no', description: 'Rester actif, chaleur, AINS, acupuncture, dry needling, TENS' },
              ]}
            />
          </StepWrapper>
        )

      case 'result':
        if (!result) return null
        return <ResultStep result={result} onApply={(examination, advice) => { onApply(result.anamnesisSummary, examination, advice); onClose() }} onReset={reset} />

      default:
        return null
    }
  }

  const progress = STEP_PROGRESS[step] ?? 0
  const isAlert = step.startsWith('alert_')

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Arbre décisionnel — Lombalgie
            </DialogTitle>
          </div>
          {step !== 'result' && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{step === 'duration' ? 'Point de départ' : step.startsWith('q1') || step.startsWith('q2') || step.startsWith('q3') || step.startsWith('q4') || step.startsWith('q5') ? 'Étape 1 — Drapeaux rouges' : step === 'q6' ? 'Étape 2 — Caractérisation' : step.startsWith('q9_spa') ? 'Étape 3B — Algorithme SpA (NEJM)' : step.startsWith('q7') || step === 'q8' ? 'Étape 3A — Causes radiculaires' : step.startsWith('q9') || step.startsWith('q1') ? 'Étape 3B — Causes axiales' : step.startsWith('q14') || step === 'q_chronic_risk' ? 'Étape 4 — Drapeaux jaunes (AAFP)' : ''}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderStep()}
        </div>

        {!isAlert && step !== 'result' && (
          <div className="px-6 pb-4 flex-shrink-0 border-t pt-3">
            <Button variant="ghost" size="sm" disabled={history.length === 0} onClick={goBack} className="gap-1.5 text-muted-foreground">
              <ChevronLeft className="h-4 w-4" />
              Étape précédente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Result step ──────────────────────────────────────────────────────────────

function evidenceLevelClass(level: string): string {
  if (level.startsWith('Élevé')) return 'bg-emerald-100 text-emerald-800'
  if (level.startsWith('Modéré')) return 'bg-blue-100 text-blue-800'
  if (level.startsWith('Très faible')) return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-800'
}

function ResultStep({ result, onApply, onReset }: { result: DiagnosisResult; onApply: (examination?: string, advice?: string) => void; onReset: () => void }) {
  const [checkedTests, setCheckedTests] = useState<Record<number, boolean>>({})
  const [testNotes, setTestNotes] = useState<Record<number, string>>({})

  const toggleTest = (i: number) =>
    setCheckedTests(prev => ({ ...prev, [i]: !prev[i] }))

  const checkedCount = Object.values(checkedTests).filter(Boolean).length

  const buildExaminationText = () => {
    const positiveTests = result.tests
      .map((t, i) => ({ t, i }))
      .filter(({ i }) => checkedTests[i])
    if (!positiveTests.length) return undefined
    const lines = ['=== Tests cliniques (arbre décisionnel lombalgie) ===']
    positiveTests.forEach(({ t, i }) => {
      const note = testNotes[i]?.trim() || 'positif'
      lines.push(`• ${t.name} [${t.target}] : ${note}`)
    })
    return lines.join('\n')
  }

  const buildAdviceText = () => {
    const { treatment, primary } = result
    const lines: string[] = []
    lines.push(`=== Conseils — ${primary} ===`)
    lines.push('')
    lines.push(`Protocole d'exercices (niveau de preuve : ${treatment.exercises.evidenceLevel}) :`)
    treatment.exercises.protocol.forEach(e => lines.push(`• ${e}`))
    if (treatment.manualTherapy.warning) {
      lines.push('')
      lines.push(`⚠ ${treatment.manualTherapy.warning}`)
    }
    if (treatment.keyNotes.length) {
      lines.push('')
      lines.push('Points essentiels :')
      treatment.keyNotes.forEach(n => lines.push(`• ${n}`))
    }
    return lines.join('\n')
  }

  const urgencyLabel = {
    urgent: { label: 'Urgent', className: 'text-destructive bg-destructive/10' },
    if_persistent: { label: 'Si persistance / indication', className: 'text-amber-700 bg-amber-50' },
    not_indicated: { label: 'Non indiqué en routine', className: 'text-emerald-700 bg-emerald-50' },
  }
  const confidenceLabel = {
    probable: { label: 'Probable', className: 'bg-primary/10 text-primary' },
    possible: { label: 'Possible', className: 'bg-amber-100 text-amber-800' },
    exclusion: { label: 'Par exclusion', className: 'bg-muted text-muted-foreground' },
    urgent: { label: 'Urgence', className: 'bg-destructive/10 text-destructive' },
  }

  return (
    <div className="space-y-5">
      {/* Primary diagnosis */}
      <div className="p-4 border-2 border-primary/30 rounded-xl bg-primary/5">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">{result.primary}</span>
        </div>
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${confidenceLabel[result.confidence].className}`}>
          {confidenceLabel[result.confidence].label}
        </span>
      </div>

      {/* Acute phase banner */}
      {result.isAcute && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <p className="font-medium flex items-center gap-1.5"><Clock className="h-4 w-4" /> Phase aiguë (&lt; 8 semaines)</p>
          <p className="text-xs mt-1">Traitement conservateur recommandé en première intention. Imagerie non recommandée sauf drapeau rouge identifié.</p>
        </div>
      )}

      {/* Yellow flags warning */}
      {result.yellowFlagWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <p className="font-medium">⚠️ Drapeaux jaunes identifiés — risque de chronicisation</p>
          <p className="text-xs mt-1">Intégrer une approche biopsychosociale dans le plan de traitement.</p>
        </div>
      )}

      {/* Chronic risk */}
      {result.chronicRisk && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
          <p className="font-medium">📋 Plan de traitement ciblé recommandé (AAFP 2025)</p>
          <p className="text-xs mt-1">Adresser les facteurs spécifiques : dépression, anxiété, obésité, tabac.</p>
        </div>
      )}

      {/* Tests checklist — interactive */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Tests cliniques à réaliser
          </h3>
          {checkedCount > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {checkedCount} positif{checkedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-2">Cochez les tests positifs — le résultat sera inséré dans l&apos;examen clinique.</p>
        <div className="space-y-1.5">
          {result.tests.map((t, i) => (
            <div key={i} className={`rounded-lg border text-sm transition-colors ${checkedTests[i] ? 'border-primary bg-primary/5' : 'bg-muted/20'}`}>
              <label className="flex items-start gap-2 p-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary flex-shrink-0"
                  checked={!!checkedTests[i]}
                  onChange={() => toggleTest(i)}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-muted-foreground"> — {t.target}</span>
                  {t.result && <span className="text-xs text-muted-foreground ml-1">({t.result})</span>}
                </div>
              </label>
              {checkedTests[i] && (
                <div className="px-2 pb-2 pl-8">
                  <input
                    type="text"
                    placeholder="Note sur le résultat (ex : douleur à 60°, LR+ …)"
                    value={testNotes[i] || ''}
                    onChange={e => setTestNotes(prev => ({ ...prev, [i]: e.target.value }))}
                    className="w-full text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Diagnostic refinement based on positive tests */}
      {checkedCount > 0 && (() => {
        const refinements = result.tests
          .map((t, i) => ({ t, i }))
          .filter(({ i }) => checkedTests[i] && result.tests[i].refinement)
          .map(({ t, i }) => ({ msg: t.refinement!, note: testNotes[i] }))
        if (!refinements.length) return null
        return (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs font-semibold text-primary mb-2">Raffinement diagnostique</p>
            <ul className="space-y-1">
              {refinements.map((r, i) => (
                <li key={i} className="text-xs flex items-start gap-1.5">
                  <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                  <span>{r.msg}{r.note ? ` — ${r.note}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })()}

      <Separator />

      {/* Exams */}
      <div>
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Examens complémentaires
        </h3>
        <div className="space-y-1.5">
          {result.exams.map((e, i) => {
            const u = urgencyLabel[e.urgency]
            return (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg text-sm border">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${u.className}`}>{u.label}</span>
                <div>
                  <span className="font-medium">{e.name}</span>
                  {e.condition && <p className="text-xs text-muted-foreground">{e.condition}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Treatment recommendations */}
      <div>
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Recommandations de pratique
        </h3>

        {/* Manual therapy */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thérapie manuelle</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${evidenceLevelClass(result.treatment.manualTherapy.evidenceLevel)}`}>
              Preuve {result.treatment.manualTherapy.evidenceLevel}
            </span>
          </div>
          {result.treatment.manualTherapy.warning && (
            <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              {result.treatment.manualTherapy.warning}
            </div>
          )}
          <ul className="space-y-1">
            {result.treatment.manualTherapy.techniques.map((t, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5 text-muted-foreground">
                <span className="mt-1 text-primary flex-shrink-0">·</span>{t}
              </li>
            ))}
          </ul>
        </div>

        {/* Exercises */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Protocole d&apos;exercices</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${evidenceLevelClass(result.treatment.exercises.evidenceLevel)}`}>
              Preuve {result.treatment.exercises.evidenceLevel}
            </span>
          </div>
          <ul className="space-y-1">
            {result.treatment.exercises.protocol.map((e, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5 text-muted-foreground">
                <span className="mt-1 text-primary flex-shrink-0">·</span>{e}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 gap-1.5 text-xs"
            onClick={() => onApply(buildExaminationText(), buildAdviceText())}
          >
            <FileText className="h-3.5 w-3.5" />
            Insérer dans les conseils et fermer
          </Button>
        </div>

        {/* Key notes */}
        {result.treatment.keyNotes.length > 0 && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Points essentiels</p>
            <ul className="space-y-1">
              {result.treatment.keyNotes.map((note, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="flex-shrink-0">·</span>{note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Separator />

      {/* Summary */}
      <div>
        <h3 className="font-semibold text-sm mb-2">Résumé à insérer dans l&apos;anamnèse</h3>
        <pre className="text-xs bg-muted/40 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">{result.anamnesisSummary}</pre>
      </div>

      {/* Actions */}
      {checkedCount > 0 && (
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary">
          <p className="font-medium">{checkedCount} test{checkedCount > 1 ? 's' : ''} positif{checkedCount > 1 ? 's' : ''} — sera{checkedCount > 1 ? 'ont' : ''} ajouté{checkedCount > 1 ? 's' : ''} dans le champ &quot;Examen clinique&quot;.</p>
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">Recommencer</Button>
        <Button className="flex-1 gap-2" onClick={() => onApply(buildExaminationText())}>
          <FileText className="h-4 w-4" />
          Insérer dans l&apos;anamnèse
        </Button>
      </div>
    </div>
  )
}
