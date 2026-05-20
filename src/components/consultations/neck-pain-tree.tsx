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
import { AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, Activity, FileText, Clock, AlertOctagon } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Answer = 'yes' | 'no' | string

interface NeckTreeState {
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

const initialState: NeckTreeState = {
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

type Step =
  | 'duration'
  | 'q1' | 'q2' | 'q3' | 'q4' | 'q5'
  | 'alert_myelopathy' | 'alert_fracture' | 'alert_neoplasia' | 'alert_neoplasia_watch' | 'alert_infection' | 'alert_dissection'
  | 'q6' | 'q7'
  | 'q8_wad' | 'q8_wad_grade'
  | 'q9' | 'q10' | 'q11'
  | 'q12_headache'
  | 'q13_radicular' | 'q13_level'
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

// ─── Treatment recommendations ───────────────────────────────────────────────

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

function buildResult(state: NeckTreeState): DiagnosisResult {
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

function buildAnamnesisText(primary: string, state: NeckTreeState, type: string): string {
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

// ─── Main component ──────────────────────────────────────────────────────────

interface NeckPainTreeProps {
  open: boolean
  onClose: () => void
  onApply: (anamnesis: string, examination?: string, advice?: string) => void
}

const STEP_PROGRESS: Partial<Record<Step, number>> = {
  duration: 2,
  q1: 8, q2: 16, q3: 24, q4: 32, q5: 40,
  q6: 48, q7: 54,
  q8_wad: 56, q8_wad_grade: 62,
  q9: 56, q10: 62, q11: 70,
  q12_headache: 70,
  q13_level: 56,
  q14_yellow_flags: 80, q_chronic_risk: 88,
  result: 100,
}

export function NeckPainTree({ open, onClose, onApply }: NeckPainTreeProps) {
  const [step, setStep] = useState<Step>('duration')
  const [state, setState] = useState<NeckTreeState>(initialState)
  const [history, setHistory] = useState<Step[]>([])

  // Local checkbox states
  const [q1SymptomChecks, setQ1SymptomChecks] = useState<string[]>([])
  const [q1SignChecks, setQ1SignChecks] = useState<string[]>([])
  const [q2Checks, setQ2Checks] = useState<string[]>([])
  const [q3Checks, setQ3Checks] = useState<string[]>([])
  const [q4Checks, setQ4Checks] = useState<string[]>([])
  const [q5Checks, setQ5Checks] = useState<string[]>([])
  const [q9Checks, setQ9Checks] = useState<string[]>([])
  const [q11Checks, setQ11Checks] = useState<string[]>([])
  const [q12Checks, setQ12Checks] = useState<string[]>([])
  const [yellowFlagChecks, setYellowFlagChecks] = useState<string[]>([])
  const [result, setResult] = useState<DiagnosisResult | null>(null)

  const reset = () => {
    setStep('duration'); setState(initialState); setHistory([])
    setQ1SymptomChecks([]); setQ1SignChecks([])
    setQ2Checks([]); setQ3Checks([]); setQ4Checks([]); setQ5Checks([])
    setQ9Checks([]); setQ11Checks([]); setQ12Checks([])
    setYellowFlagChecks([]); setResult(null)
  }

  const goBack = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(history.slice(0, -1))
    setStep(prev)
  }

  const push = (next: Step, updates?: Partial<NeckTreeState>) => {
    setHistory([...history, step])
    if (updates) setState((s) => ({ ...s, ...updates }))
    setStep(next)
  }

  const showResult = (updates?: Partial<NeckTreeState>) => {
    const finalState = updates ? { ...state, ...updates } : state
    setState(finalState)
    setResult(buildResult(finalState))
    setHistory([...history, step])
    setStep('result')
  }

  const goToYellowFlags = (updates?: Partial<NeckTreeState>) => {
    setHistory([...history, step])
    if (updates) setState((s) => ({ ...s, ...updates }))
    setStep('q14_yellow_flags')
  }

  const renderStep = () => {
    switch (step) {

      // ── Duration ─────────────────────────────────────────────────────────
      case 'duration':
        return (
          <StepWrapper
            label="Durée de la douleur"
            badge="Point de départ"
            badgeVariant="secondary"
            question="Depuis combien de temps dure la cervicalgie ?"
            hint="L'algorithme distingue la phase aiguë (< 8 semaines, traitement conservateur en première ligne) de la phase subaiguë/chronique (≥ 8 semaines, bilan plus approfondi)."
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

      // ── Q1 : Myélopathie ─────────────────────────────────────────────────
      case 'q1':
        return (
          <StepWrapper
            label="Q1 — Myélopathie cervicale"
            badge="Drapeau rouge 1/5"
            badgeVariant="destructive"
            question="Signes de myélopathie cervicale ?"
            hint="La myélopathie cervicale est la complication neurologique la plus fréquente chez l'adulte > 50 ans. ≥ 2 signes de motoneurone supérieur = orientation neurochirurgicale urgente."
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Symptômes fonctionnels</p>
                <CheckboxGroup
                  options={[
                    { label: 'Difficultés à manipuler petits objets / maladresse des mains', value: 'hand_dex' },
                    { label: "Troubles de l'équilibre ou de la marche", value: 'gait_instab' },
                    { label: 'Engourdissements mains ou pieds', value: 'hand_numb' },
                    { label: 'Faiblesse bras ou mains', value: 'arm_weak' },
                    { label: 'Troubles urinaires — urgence, fréquence, hésitation', value: 'bladder' },
                    { label: 'Sensations électriques en flexion cervicale — signe de Lhermitte', value: 'lhermitte' },
                  ]}
                  selected={q1SymptomChecks}
                  onChange={setQ1SymptomChecks}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Signes de motoneurone supérieur (tests cliniques)</p>
                <CheckboxGroup
                  options={[
                    { label: 'Hoffmann', value: 'hoffmann' },
                    { label: 'Tromner — Sn 93-97 % / Sp 79-100 %', value: 'tromner' },
                    { label: 'Babinski — Sp 93-100 %', value: 'babinski' },
                    { label: 'Clonus — Sp 96-99 %', value: 'clonus' },
                    { label: 'Réflexe brachioradial inversé — quasi-pathognomonique C5-C6', value: 'inv_brachioradial' },
                    { label: 'Hyperréflexie ostéotendineuse', value: 'hyperreflexia' },
                    { label: 'Romberg — Sp > 90 %', value: 'romberg' },
                    { label: 'Marche en tandem', value: 'tandem' },
                  ]}
                  selected={q1SignChecks}
                  onChange={setQ1SignChecks}
                />
              </div>
            </div>
            <Button className="w-full mt-3" onClick={() => {
              const signCount = q1SignChecks.length
              if (signCount >= 2) {
                push('alert_myelopathy', {
                  q1_symptom_checks: q1SymptomChecks,
                  q1_sign_checks: q1SignChecks,
                  q1_signs_count: signCount,
                })
              } else {
                push('q2', {
                  q1_symptom_checks: q1SymptomChecks,
                  q1_sign_checks: q1SignChecks,
                  q1_signs_count: signCount,
                })
              }
            }}>
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_myelopathy':
        return (
          <AlertStep
            title="⚠️ Suspicion de myélopathie cervicale dégénérative"
            items={[
              `${state.q1_signs_count} signe(s) de motoneurone supérieur identifié(s)`,
              'IRM cervicale en urgence relative',
              'Consultation neurochirurgicale immédiate',
              'CONTRE-INDICATION ABSOLUE au HVLA cervical',
              'Ne pas retarder l\'orientation par une prise en charge conservative prolongée',
            ]}
            onContinue={() => push('q2')}
            continueLabel="Continuer l'évaluation complète"
          />
        )

      // ── Q2 : Fracture ─────────────────────────────────────────────────────
      case 'q2':
        return (
          <StepWrapper
            label="Q2 — Fracture cervicale"
            badge="Drapeau rouge 2/5"
            badgeVariant="destructive"
            question="Cochez les facteurs de risque présents :"
            hint="Critères NEXUS / Canadian C-Spine Rule : traumatisme + facteurs de risque → imagerie obligatoire. Âge > 65 ans + ≥ 1 autre facteur = risque élevé."
          >
            <CheckboxGroup
              options={[
                { label: 'Traumatisme récent — chute, accident, sport de contact', value: 'trauma' },
                { label: '> 65 ans', value: 'age65' },
                { label: 'Corticoïdes long cours / ostéoporose connue', value: 'steroids_osteo' },
                { label: 'Douleur très localisée sur un point précis (épineuse)', value: 'focal_pain' },
              ]}
              selected={q2Checks}
              onChange={setQ2Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              const hasTrauma = q2Checks.includes('trauma')
              const hasAge65 = q2Checks.includes('age65')
              const factors = q2Checks.length
              if (hasTrauma) {
                push('alert_fracture', { q2_fracture: 'yes', q2_checks: q2Checks })
              } else if (hasAge65 && factors >= 2) {
                push('alert_fracture', { q2_fracture: 'yes', q2_checks: q2Checks })
              } else {
                push('q3', { q2_fracture: 'no', q2_checks: q2Checks })
              }
            }}>
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_fracture':
        return (
          <AlertStep
            title="⚠️ Suspicion de fracture cervicale"
            items={[
              'Radiographies cervicales en urgence (face, profil, bouche ouverte)',
              'TDM cervical si radiographies insuffisantes ou mécanisme violent',
              'Ne pas mobiliser le rachis cervical avant imagerie',
              'Critères NEXUS / Canadian C-Spine Rule positifs',
            ]}
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
            hint="Un drapeau rouge isolé a une très faible spécificité (faux positif > 96 %). C'est la combinaison qui est informative. Un antécédent de cancer SEUL sans autre élément clinique ne suffit pas à déclencher un bilan immédiat."
          >
            <CheckboxGroup
              options={[
                { label: 'Antécédent de cancer', value: 'cancer_hx' },
                { label: 'Perte de poids inexpliquée récente', value: 'weight_loss' },
                { label: 'Douleur nocturne (réveille en 2e partie de nuit)', value: 'night_pain' },
                { label: '> 50 ans + douleur persistante / aggravée malgré traitement', value: 'age50_persistent' },
              ]}
              selected={q3Checks}
              onChange={setQ3Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              const hasCancerHx = q3Checks.includes('cancer_hx')
              const otherFactors = q3Checks.filter(v => v !== 'cancer_hx').length
              const totalFactors = q3Checks.length
              if ((hasCancerHx && otherFactors >= 1) || (!hasCancerHx && totalFactors >= 2)) {
                push('alert_neoplasia', { q3_neoplasia: 'alert', q3_has_cancer_hx: hasCancerHx, q3_checks: q3Checks })
              } else if (hasCancerHx && otherFactors === 0) {
                push('alert_neoplasia_watch', { q3_neoplasia: 'watch', q3_has_cancer_hx: true, q3_checks: q3Checks })
              } else {
                push('q4', { q3_neoplasia: 'no', q3_has_cancer_hx: hasCancerHx, q3_checks: q3Checks })
              }
            }}>
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_neoplasia':
        return (
          <AlertStep
            title="⚠️ Suspicion de néoplasie / métastase cervicale"
            items={[
              state.q3_has_cancer_hx ? 'Antécédent de cancer + ≥ 1 élément clinique → LR+ = 27.9' : `${state.q3_checks.length} facteurs de risque combinés`,
              'IRM cervicale recommandée',
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
            label="Q4 — Infection spinale cervicale"
            badge="Drapeau rouge 4/5"
            badgeVariant="destructive"
            question="Cochez les facteurs de risque présents :"
            hint="Spondylodiscite / abcès épidural cervical. La fièvre seule est insuffisante. La combinaison fièvre + ≥ 1 autre facteur est le seuil clinique d'alerte."
          >
            <CheckboxGroup
              options={[
                { label: 'Fièvre', value: 'fever' },
                { label: 'Immunodépression (VIH, corticoïdes, immunosuppresseurs)', value: 'immuno' },
                { label: 'Usage de drogues IV', value: 'iv_drugs' },
                { label: 'Chirurgie cervicale ou rachidienne récente', value: 'recent_surgery' },
                { label: 'Douleur vertébrale cervicale très localisée et constante', value: 'vertebral_pain' },
              ]}
              selected={q4Checks}
              onChange={setQ4Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              const hasFever = q4Checks.includes('fever')
              const factors = q4Checks.length
              if (hasFever && factors >= 2) {
                push('alert_infection', { q4_infection: 'yes', q4_checks: q4Checks })
              } else if (!hasFever && (q4Checks.includes('iv_drugs') || q4Checks.includes('recent_surgery')) && factors >= 2) {
                push('alert_infection', { q4_infection: 'yes', q4_checks: q4Checks })
              } else {
                push('q5', { q4_infection: 'no', q4_checks: q4Checks })
              }
            }}>
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_infection':
        return (
          <AlertStep
            title="⚠️ Suspicion d'infection spinale cervicale"
            items={[
              'IRM cervicale urgente',
              'Bilan biologique : NFS, VS, CRP, hémocultures',
              'Consultation infectiologie',
              'Ne pas instaurer une antibiothérapie sans prélèvements bactériologiques',
            ]}
            onContinue={() => push('q5')}
            continueLabel="Continuer l'évaluation"
          />
        )

      // ── Q5 : Dissection artérielle ────────────────────────────────────────
      case 'q5':
        return (
          <StepWrapper
            label="Q5 — Dissection artérielle cervicale"
            badge="Drapeau rouge 5/5"
            badgeVariant="destructive"
            question="Cochez les signes évocateurs :"
            hint="Dissection carotidienne ou vertébrale : urgence vasculaire rare mais grave. Risque d'AVC ischémique. La combinaison céphalée brutale + signes neurologiques est le signal d'alarme principal."
          >
            <CheckboxGroup
              options={[
                { label: 'Céphalée brutale inhabituelle sévère (thunderclap headache)', value: 'sudden_headache' },
                { label: 'Troubles visuels, vertiges, diplopie, dysphagie, dysarthrie', value: 'neuro_signs' },
                { label: 'Traumatisme cervical récent, même mineur (chiro, sport, whiplash)', value: 'recent_trauma' },
                { label: '> 50 ans + facteurs de risque vasculaire (HTA, tabac, SAOS)', value: 'age50_vasc' },
                { label: 'Acouphène pulsatile unilatéral', value: 'pulsatile_tinnitus' },
              ]}
              selected={q5Checks}
              onChange={setQ5Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              const hasSudden = q5Checks.includes('sudden_headache')
              const hasNeuro = q5Checks.includes('neuro_signs')
              const factors = q5Checks.length
              if ((hasSudden && hasNeuro) || factors >= 2) {
                push('alert_dissection', { q5_dissection: 'yes', q5_checks: q5Checks })
              } else {
                push('q6', { q5_dissection: 'no', q5_checks: q5Checks })
              }
            }}>
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_dissection':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-destructive/10 border-destructive/30 text-destructive">
              <AlertOctagon className="h-5 w-5 flex-shrink-0 mt-0.5 text-destructive" />
              <div>
                <p className="font-semibold">🚨 Urgence vasculaire — Suspicion de dissection artérielle cervicale</p>
                <ul className="mt-2 space-y-1">
                  {[
                    'Orienter en urgence aux urgences hospitalières',
                    'Angio-IRM ou angio-TDM des vaisseaux cervicaux en urgence',
                    'CONTRE-INDICATION ABSOLUE à toute manipulation cervicale',
                    'Risque d\'AVC ischémique par embolie artérielle',
                    q5Checks.includes('sudden_headache') && q5Checks.includes('neuro_signs') ? 'Céphalée brutale + signes neurologiques = urgence vasculaire certaine' : `${q5Checks.length} facteurs de risque identifiés`,
                  ].filter(Boolean).map((item, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="mt-1">•</span>{item as string}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => push('q6')}>
              Continuer l'évaluation<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )

      // ── Q6 : Irradiation bras ─────────────────────────────────────────────
      case 'q6':
        return (
          <StepWrapper
            label="Q6 — Irradiation dans le bras"
            badge="Étape 2 — Nœud principal"
            badgeVariant="secondary"
            question="La douleur irradie-t-elle dans le bras ?"
            hint="Nœud de branchement principal : voie radiculaire cervicale (C5-T1) vs voie axiale mécanique/inflammatoire."
          >
            <div className="space-y-3">
              <RadioGroup
                value={state.q6_arm_radiation}
                onChange={(v) => setState((s) => ({ ...s, q6_arm_radiation: v }))}
                options={[
                  { label: 'Non — douleur axiale cervicale uniquement', value: 'no', description: '→ Voie mécanique / inflammatoire' },
                  { label: 'Oui — douleur descendant dans le bras', value: 'yes' },
                ]}
              />
              {state.q6_arm_radiation === 'yes' && (
                <div className="space-y-3 pl-3 border-l-2 border-primary/30">
                  <p className="text-sm font-medium text-muted-foreground">Précisez :</p>
                  <RadioGroup
                    value={state.q6_paresthesias}
                    onChange={(v) => setState((s) => ({ ...s, q6_paresthesias: v }))}
                    options={[
                      { label: 'Avec fourmillements / engourdissements / faiblesse dans le bras ou la main', value: 'yes' },
                      { label: 'Sans paresthésies ni faiblesse', value: 'no', description: '→ Irradiation référée non radiculaire' },
                    ]}
                  />
                  {state.q6_paresthesias !== null && (
                    <RadioGroup
                      value={state.q6_arm_worse}
                      onChange={(v) => setState((s) => ({ ...s, q6_arm_worse: v }))}
                      options={[
                        { label: 'La douleur du bras est plus forte que la douleur du cou', value: 'yes', description: 'Critère clé pour la radiculopathie vraie' },
                        { label: 'La douleur du cou est ≥ à la douleur du bras', value: 'no', description: '→ Voie axiale même avec irradiation' },
                      ]}
                    />
                  )}
                </div>
              )}
            </div>
            <Button
              className="w-full mt-3"
              disabled={
                state.q6_arm_radiation === null ||
                (state.q6_arm_radiation === 'yes' && (state.q6_paresthesias === null || state.q6_arm_worse === null))
              }
              onClick={() => {
                const radicular = state.q6_arm_radiation === 'yes' && state.q6_paresthesias === 'yes' && state.q6_arm_worse === 'yes'
                push(radicular ? 'q13_level' : 'q7')
              }}
            >
              Continuer
            </Button>
          </StepWrapper>
        )

      // ── Q7 : Céphalée ─────────────────────────────────────────────────────
      case 'q7':
        return (
          <StepWrapper
            label="Q7 — Irradiation vers la tête"
            badge="Voie axiale"
            badgeVariant="default"
            question="La douleur irradie-t-elle vers la tête, le front ou la tempe ?"
            hint="Céphalée cervicogénique : irradiation de la nuque vers le front ou la tempe, toujours du même côté, déclenchée par les mouvements du cou."
          >
            <RadioGroup
              value={state.q7_headache}
              onChange={(v) => {
                if (v === 'yes') push('q12_headache', { q7_headache: 'yes' })
                else push('q8_wad', { q7_headache: 'no' })
              }}
              options={[
                { label: 'Oui — irradiation vers la tête / le front', value: 'yes', description: '→ Exploration céphalée cervicogénique' },
                { label: 'Non — douleur cervicale pure', value: 'no', description: '→ Voie mécanique cervicale' },
              ]}
            />
          </StepWrapper>
        )

      // ── Q8 WAD ────────────────────────────────────────────────────────────
      case 'q8_wad':
        return (
          <StepWrapper
            label="Q8 — Traumatisme cervical (WAD)"
            badge="Voie mécanique"
            badgeVariant="default"
            question="Y a-t-il eu un traumatisme cervical en hyperflexion/hyperextension (whiplash) ?"
            hint="WAD = Whiplash Associated Disorder. Mécanisme typique : accident de la route, choc sportif, chute. Grading selon la Quebec Task Force."
          >
            <RadioGroup
              value={state.q8_wad}
              onChange={(v) => {
                if (v === 'yes') push('q8_wad_grade', { q8_wad: 'yes' })
                else push('q9', { q8_wad: 'no', q8_wad_grade: 0 })
              }}
              options={[
                { label: 'Non — pas de traumatisme identifié', value: 'no' },
                { label: 'Oui — traumatisme cervical récent (hyperflexion / hyperextension)', value: 'yes', description: '→ Classification WAD Quebec Task Force' },
              ]}
            />
          </StepWrapper>
        )

      case 'q8_wad_grade':
        return (
          <StepWrapper
            label="Q8b — Grade WAD"
            badge="Voie WAD"
            badgeVariant="default"
            question="Grade WAD selon la Quebec Task Force :"
            hint="Le grade oriente le pronostic et la prise en charge. Grade I-II : pronostic favorable (50-70 % de récupération à 6 mois). Grade III : atteinte neurologique — IRM si persistance > 4 semaines. Grade IV : urgence imagerie."
          >
            <RadioGroup
              value={state.q8_wad_grade > 0 ? String(state.q8_wad_grade) : null}
              onChange={(v) => showResult({ q8_wad_grade: Number(v) })}
              options={[
                { label: 'Grade I — douleur et raideur, sans signes physiques objectifs', value: '1', description: 'Pronostic favorable, traitement conservateur' },
                { label: 'Grade II — + signes musculosquelettiques (diminution amplitudes, points douloureux)', value: '2', description: 'Traitement conservateur + exercices actifs' },
                { label: 'Grade III — + signes neurologiques (déficit sensitif, moteur ou réflexe)', value: '3', description: 'Suivi neurologique, IRM si persistance > 4 semaines' },
                { label: 'Grade IV — fracture ou luxation cervicale — imagerie urgente', value: '4', description: 'Urgence — radiographies + TDM / IRM' },
              ]}
            />
          </StepWrapper>
        )

      // ── Q9 : Inflammatoire ────────────────────────────────────────────────
      case 'q9':
        return (
          <StepWrapper
            label="Q9 — Profil inflammatoire ?"
            badge="Voie axiale"
            badgeVariant="default"
            question="Cochez les critères de douleur inflammatoire présents :"
            hint="Seuil : ≥ 4 critères = profil inflammatoire évocateur de spondyloarthrite axiale. L'atteinte cervicale est possible dans la SpA, notamment les formes évoluées."
          >
            <CheckboxGroup
              options={[
                { label: 'Début avant 45 ans', value: 'onset_45' },
                { label: 'Début progressif / insidieux', value: 'insidious' },
                { label: 'Raideur matinale > 30 minutes', value: 'morning_stiff' },
                { label: "Améliorée par l'exercice, non améliorée par le repos", value: 'exercise_better' },
                { label: 'Douleurs cervicales ou dorsales alternantes', value: 'alternating_buttock' },
                { label: 'Réveils en 2e partie de nuit', value: 'night_waking' },
              ]}
              selected={q9Checks}
              onChange={setQ9Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              const criteriaCount = q9Checks.length
              if (criteriaCount >= 4) {
                goToYellowFlags({ q9_inflammatory: 'yes' })
              } else {
                push('q10', { q9_inflammatory: 'no' })
              }
            }}>
              Continuer
            </Button>
          </StepWrapper>
        )

      // ── Q10 : Localisation ────────────────────────────────────────────────
      case 'q10':
        return (
          <StepWrapper
            label="Q10 — Localisation de la douleur cervicale"
            badge="Voie mécanique"
            badgeVariant="default"
            question="Où se situe exactement la douleur ?"
          >
            <RadioGroup
              value={state.q10_location}
              onChange={(v) => {
                setState((s) => ({ ...s, q10_location: v }))
                if (v === 'paravertebral') push('q11', { q10_location: v })
                else if (v === 'suboccipital') push('q12_headache', { q10_location: v })
                else goToYellowFlags({ q10_location: v })
              }}
              options={[
                { label: 'Médiane (sur les épineuses)', value: 'medial', description: '→ Cervicalgie non spécifique' },
                { label: 'Paravertébrale unilatérale (à côté de la colonne)', value: 'paravertebral', description: '→ Origine facettaire possible' },
                { label: 'Trapèze / muscles cervicaux diffus', value: 'trapezius', description: '→ Tension myofasciale / cervicalgie non spécifique' },
                { label: 'Sous-occipitale / nuque (C0-C1-C2)', value: 'suboccipital', description: '→ Céphalée cervicogénique à explorer' },
              ]}
            />
          </StepWrapper>
        )

      // ── Q11 : Facette cervicale ───────────────────────────────────────────
      case 'q11':
        return (
          <StepWrapper
            label="Q11 — Syndrome facettaire cervical"
            badge="Voie mécanique"
            badgeVariant="default"
            question="Cochez les critères présents (syndrome facettaire cervical) :"
            hint="≥ 2 critères oriente vers un syndrome facettaire cervical. Le seul test confirmatoire fiable est le bloc facettaire diagnostique."
          >
            <CheckboxGroup
              options={[
                { label: 'Aggravée en extension + rotation ipsilatérale', value: 'extension_rotation' },
                { label: 'Douleur paravertébrale unilatérale', value: 'unilateral_paravert' },
                { label: 'Sans irradiation sous le coude', value: 'no_below_elbow' },
                { label: 'Soulagée par le repos', value: 'relieved_rest' },
              ]}
              selected={q11Checks}
              onChange={setQ11Checks}
            />
            <Button className="w-full mt-3" onClick={() => {
              goToYellowFlags({ q11_facet_criteria: q11Checks.length })
            }}>
              Continuer
            </Button>
          </StepWrapper>
        )

      // ── Q12 : Céphalée cervicogénique ─────────────────────────────────────
      case 'q12_headache':
        return (
          <StepWrapper
            label="Q12 — Céphalée cervicogénique"
            badge="Voie céphalée cervicogénique"
            badgeVariant="default"
            question="Cochez les critères cliniques présents (anamnèse) :"
            hint="Critères IHS basés sur l'interrogatoire. Le test FRT (flexion-rotation cervicale) sera proposé dans le résumé pour confirmer le diagnostic lors de l'examen clinique."
          >
            <CheckboxGroup
              options={[
                { label: 'Toujours du même côté (sans changement de côté)', value: 'unilateral' },
                { label: 'Irradiation nuque → front / tempe (postéro-antérieure)', value: 'posterior_anterior' },
                { label: 'Déclenchée par les mouvements du cou ou posture prolongée', value: 'movement_triggered' },
                { label: 'Modérée, non pulsatile (≠ migraine)', value: 'non_pulsatile' },
                { label: 'Durée variable (heures à jours)', value: 'variable_duration' },
                { label: 'Antécédent de traumatisme cervical', value: 'trauma_hx' },
                { label: 'Nausées / photophobie (présentes mais non prédominantes)', value: 'nausea_photo' },
              ]}
              selected={q12Checks}
              onChange={setQ12Checks}
            />
            <Button
              className="w-full mt-3"
              disabled={q12Checks.length === 0}
              onClick={() => goToYellowFlags({ q12_criteria_checks: q12Checks })}
            >
              Continuer
            </Button>
          </StepWrapper>
        )

      // ── Q13 : Niveau radiculaire (symptômes → dermatome) ─────────────────────
      case 'q13_level':
        return (
          <StepWrapper
            label="Q13 — Niveau radiculaire cervical"
            badge="Voie radiculaire"
            badgeVariant="default"
            question="Où le patient ressent-il ses symptômes ? (douleur, paresthésies, faiblesse)"
            hint="Sélectionnez le niveau correspondant à la distribution des symptômes décrits par le patient. Les tests de confirmation (Spurling, ULNT, Bakody) seront proposés dans le résumé."
          >
            <div className="rounded-lg border overflow-hidden text-sm mb-3">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium text-xs">Racine</th>
                    <th className="text-left p-2 font-medium text-xs">Dermatome</th>
                    <th className="text-left p-2 font-medium text-xs">Myotome</th>
                    <th className="text-left p-2 font-medium text-xs">Réflexe</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  <tr><td className="p-2 font-semibold text-primary">C5</td><td className="p-2">Épaule, face lat. bras</td><td className="p-2">Abduction épaule, flexion coude</td><td className="p-2">Bicipital ↓</td></tr>
                  <tr className="bg-muted/20"><td className="p-2 font-semibold text-primary">C6</td><td className="p-2">Pouce, index, face lat. av-bras</td><td className="p-2">Flexion coude, extension poignet</td><td className="p-2">Brachioradial ↓, bicipital ↓</td></tr>
                  <tr><td className="p-2 font-semibold text-primary">C7</td><td className="p-2">Majeur, face post. av-bras</td><td className="p-2">Extension coude, flexion poignet</td><td className="p-2">Tricipital ↓</td></tr>
                  <tr className="bg-muted/20"><td className="p-2 font-semibold text-primary">C8</td><td className="p-2">Annulaire, auriculaire, face méd. main</td><td className="p-2">Flexion doigts, opposition pouce</td><td className="p-2">—</td></tr>
                  <tr><td className="p-2 font-semibold text-primary">T1</td><td className="p-2">Face médiale av-bras</td><td className="p-2">Intrinsèques main (interosseux)</td><td className="p-2">—</td></tr>
                </tbody>
              </table>
            </div>
            <RadioGroup
              value={state.q13_level}
              onChange={(v) => goToYellowFlags({ q13_level: v })}
              options={[
                { label: 'C5 — épaule, deltoïde, face latérale bras', value: 'C5' },
                { label: 'C6 — pouce, index, face latérale avant-bras', value: 'C6' },
                { label: 'C7 — majeur, face postérieure avant-bras', value: 'C7' },
                { label: 'C8 — annulaire, auriculaire, face médiale main', value: 'C8' },
                { label: 'T1 — face médiale avant-bras', value: 'T1' },
                { label: 'Imprécis / multiple — sans niveau clairement identifié', value: 'unclear' },
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
            hint="Ces facteurs psychosociaux sont des prédicteurs indépendants d'évolution vers la cervicalgie chronique. Leur identification permet d'adapter le plan de traitement."
          >
            <CheckboxGroup
              options={[
                { label: "Catastrophisme (le patient pense que c'est grave / irréversible)", value: 'catastrophism' },
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

      // ── Risque de chronicisation ──────────────────────────────────────────
      case 'q_chronic_risk':
        return (
          <StepWrapper
            label="Risque de chronicisation"
            badge="Évaluation finale"
            badgeVariant="secondary"
            question="Confirmez : le patient présente des facteurs de risque de développer une cervicalgie chronique ?"
            hint={`${yellowFlagChecks.length} drapeaux jaune(s) identifié(s). Si oui, élaborer un plan de traitement qui adresse spécifiquement ces facteurs. Si non, réassurance + prise en charge conservative.`}
          >
            <RadioGroup
              value={state.q_chronic_risk}
              onChange={(v) => showResult({ q_chronic_risk: v })}
              options={[
                { label: 'Oui — plan de traitement ciblé nécessaire', value: 'yes', description: 'Adresser les facteurs identifiés (dépression, anxiété, obésité, tabac)' },
                { label: 'Non — réassurance et traitement conservateur', value: 'no', description: 'Rester actif, chaleur, AINS, exercices, thérapie manuelle' },
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
              Arbre décisionnel — Cervicalgie
            </DialogTitle>
          </div>
          {step !== 'result' && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {step === 'duration' ? 'Point de départ'
                    : ['q1', 'q2', 'q3', 'q4', 'q5'].some(s => step.startsWith(s)) && !step.startsWith('q6') ? 'Étape 1 — Drapeaux rouges'
                    : step === 'q6' || step === 'q7' ? 'Étape 2 — Caractérisation'
                    : step === 'q8_wad' || step === 'q8_wad_grade' ? 'Étape 3 — WAD'
                    : step === 'q9' || step === 'q10' || step === 'q11' ? 'Étape 3B — Mécanique'
                    : step === 'q12_headache' ? 'Étape 3C — Céphalée cervicogénique'
                    : step === 'q13_radicular' || step === 'q13_level' ? 'Étape 3A — Radiculopathie'
                    : step === 'q14_yellow_flags' || step === 'q_chronic_risk' ? 'Étape 4 — Drapeaux jaunes'
                    : ''}
                </span>
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

// ─── Result step ─────────────────────────────────────────────────────────────

function evidenceLevelClass(level: string): string {
  if (level.startsWith('Élevé')) return 'bg-emerald-100 text-emerald-800'
  if (level.startsWith('Modéré')) return 'bg-blue-100 text-blue-800'
  if (level.startsWith('Contre')) return 'bg-red-100 text-red-800'
  if (level.startsWith('Très faible')) return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-800'
}

function ResultStep({
  result, onApply, onReset,
}: {
  result: DiagnosisResult
  onApply: (examination?: string, advice?: string) => void
  onReset: () => void
}) {
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
    const lines = ['=== Tests cliniques (arbre décisionnel cervicalgie) ===']
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
      {/* Myelopathy safety banner */}
      {result.confidence === 'urgent' && (
        <div className="p-4 bg-destructive/10 border-2 border-destructive/50 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-destructive">⛔ CONTRE-INDICATION ABSOLUE au HVLA cervical</p>
              <p className="text-sm text-destructive/90 mt-1">Myélopathie cervicale suspectée — orientation neurochirurgicale urgente requise. Ne pas manipuler le rachis cervical.</p>
            </div>
          </div>
        </div>
      )}

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
          <p className="font-medium">📋 Plan de traitement ciblé recommandé</p>
          <p className="text-xs mt-1">Adresser les facteurs spécifiques : dépression, anxiété, obésité, tabac.</p>
        </div>
      )}

      {/* Tests checklist */}
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
                    placeholder="Note sur le résultat (ex : douleur reproduite, limitation 28°…)"
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

      {/* Diagnostic refinement */}
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
