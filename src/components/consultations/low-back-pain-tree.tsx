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
import { AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, X, Activity, FileText } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Answer = 'yes' | 'no' | string

interface TreeState {
  // Red flags
  q1_cauda_equina: Answer | null
  q2_fracture: Answer | null
  q2_trauma_neuro: boolean
  q2_factors: number
  q3_neoplasia: Answer | null
  q3_factors: number
  q4_infection: Answer | null
  q4_factors: number
  q5_aaa: Answer | null
  // Step 2
  q6_radiation: Answer | null   // yes = radicular, no = axial
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
  // Step 3B – Axial
  q9_inflammatory: Answer | null
  q9_criteria: number
  q9_extra_articular: boolean
  q10_location: Answer | null   // 'medial' | 'paravertebral' | 'gluteal' | 'diffuse'
  q11_discogenic: Answer | null
  q11_centralization: Answer | null
  q12_facet: Answer | null
  q13_si_joint: Answer | null
  q13_tests_positive: number
}

const initialState: TreeState = {
  q1_cauda_equina: null,
  q2_fracture: null, q2_trauma_neuro: false, q2_factors: 0,
  q3_neoplasia: null, q3_factors: 0,
  q4_infection: null, q4_factors: 0,
  q5_aaa: null,
  q6_radiation: null, q6_below_knee: null, q6_leg_worse: null,
  q7_age_under60: null, q7_unilateral: null, q7_worse_sitting: null,
  q7_worse_walking: null, q7_shopping_cart: null, q7_sudden_onset: null,
  q7_cough_sneeze: null,
  q9_inflammatory: null, q9_criteria: 0, q9_extra_articular: false,
  q10_location: null,
  q11_discogenic: null, q11_centralization: null,
  q12_facet: null,
  q13_si_joint: null, q13_tests_positive: 0,
}

type Step =
  | 'q1' | 'q2' | 'q3' | 'q4' | 'q5'
  | 'q6'
  | 'q7' | 'q8'
  | 'q9' | 'q10' | 'q11' | 'q12' | 'q13' | 'q14'
  | 'alert_cauda_equina' | 'alert_fracture' | 'alert_neoplasia' | 'alert_infection' | 'alert_aaa'
  | 'result'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Result builder ──────────────────────────────────────────────────────────

interface DiagnosisResult {
  primary: string
  confidence: 'probable' | 'possible' | 'exclusion'
  tests: Array<{ name: string; target: string; result?: string }>
  exams: Array<{ name: string; urgency: 'urgent' | 'if_persistent' | 'not_indicated'; condition?: string }>
  yellowFlags: boolean
  anamnesisSummary: string
}

function buildResult(state: TreeState): DiagnosisResult {
  const isRadicular = state.q6_radiation === 'yes' && state.q6_below_knee === 'yes' && state.q6_leg_worse === 'yes'

  if (isRadicular) {
    const isYoung = state.q7_age_under60 === 'yes'
    const discFeatures = [
      state.q7_unilateral === 'yes',
      state.q7_worse_sitting === 'yes',
      state.q7_sudden_onset === 'yes',
      state.q7_cough_sneeze === 'yes',
    ].filter(Boolean).length
    const stenosisFeatures = [
      state.q7_age_under60 === 'no',
      state.q7_unilateral === 'no',
      state.q7_worse_sitting === 'no',
      state.q7_worse_walking === 'yes',
      state.q7_shopping_cart === 'yes',
    ].filter(Boolean).length

    const isDisc = discFeatures >= 2 && isYoung
    const isStenosis = stenosisFeatures >= 3

    const primary = isDisc
      ? 'Hernie discale probable'
      : isStenosis
        ? 'Sténose spinale probable'
        : 'Radiculopathie lombaire (à préciser)'

    return {
      primary,
      confidence: 'probable',
      tests: [
        { name: 'Lasègue ipsilatéral (SLR)', target: 'Hernie discale', result: 'Sn 92 %' },
        { name: 'Lasègue croisé', target: 'Hernie discale', result: 'Sp 90 %' },
        { name: 'Lasègue assis (distracted SLR)', target: 'Hernie discale', result: 'Sn 41 %' },
        { name: 'Femoral stretch test (L2-L4)', target: 'Radiculopathie haute', result: '' },
        { name: 'Test de Romberg + démarche élargie', target: 'Sténose spinale', result: 'Sp > 90 %' },
        { name: 'Extension lombaire reproduit douleur', target: 'Sténose spinale', result: '' },
        { name: 'Force motrice : dorsiflexion cheville', target: 'L4-L5', result: '' },
        { name: 'Réflexe rotulien', target: 'L4', result: '' },
        { name: 'Réflexe achilléen', target: 'S1', result: '' },
        { name: 'Sensibilité face latérale jambe / dos du pied', target: 'L5', result: '' },
        { name: 'Sensibilité face postérieure jambe / plante', target: 'S1', result: '' },
      ],
      exams: [
        {
          name: 'IRM lombaire',
          urgency: 'if_persistent',
          condition: 'Si déficit neurologique sévère/progressif ou symptômes > 6-8 semaines',
        },
      ],
      yellowFlags: false,
      anamnesisSummary: buildAnamnesisText(primary, state, 'radicular'),
    }
  }

  // Axial pain path
  const isInflammatory = state.q9_criteria >= 4 || state.q9_extra_articular
  if (isInflammatory) {
    return {
      primary: 'Suspicion de spondyloarthrite axiale',
      confidence: 'possible',
      tests: [
        { name: 'Mobilité lombaire (Schober)', target: 'Raideur', result: '' },
        { name: 'Extension lombaire activo-passive', target: 'Limitation', result: '' },
        { name: 'Mobilité thoracique', target: 'Spondylarthrite', result: '' },
      ],
      exams: [
        { name: 'Radiographies bassin / sacro-iliaques', urgency: 'if_persistent', condition: 'Profil inflammatoire' },
        { name: 'Bilan biologique : CRP, NFS', urgency: 'if_persistent', condition: '' },
        { name: 'HLA-B27', urgency: 'if_persistent', condition: 'Référer en rhumatologie si ≥ 1 paramètre ASAS positif' },
      ],
      yellowFlags: false,
      anamnesisSummary: buildAnamnesisText('Spondyloarthrite axiale suspectée', state, 'inflammatory'),
    }
  }

  // Mechanical axial
  const loc = state.q10_location
  if (loc === 'gluteal' && state.q13_tests_positive >= 3) {
    return {
      primary: 'Dysfonction sacro-iliaque probable',
      confidence: 'probable',
      tests: [
        { name: 'Test de distraction', target: 'Articulation SI', result: '' },
        { name: 'Test de compression', target: 'Articulation SI', result: '' },
        { name: 'Thrust sacré', target: 'Articulation SI', result: '' },
        { name: 'Test de Gaenslen', target: 'Articulation SI', result: '' },
        { name: 'Test de Patrick / FABER', target: 'Articulation SI', result: '' },
        { name: 'Thigh thrust (cisaillement postérieur)', target: 'Articulation SI', result: '' },
      ],
      exams: [{ name: 'Bloc diagnostique SI', urgency: 'if_persistent', condition: 'Confirme le diagnostic' }, { name: 'Pas d\'imagerie en routine', urgency: 'not_indicated', condition: '' }],
      yellowFlags: false,
      anamnesisSummary: buildAnamnesisText('Dysfonction sacro-iliaque', state, 'mechanical'),
    }
  }

  if (loc === 'medial' && state.q11_centralization === 'yes') {
    return {
      primary: 'Douleur discogénique probable',
      confidence: 'probable',
      tests: [
        { name: 'Phénomène de centralisation (McKenzie)', target: 'Discogénique', result: 'LR+ significatif' },
        { name: 'Mouvements répétés en extension', target: 'Centralisation', result: '' },
        { name: 'Mouvements répétés en flexion', target: 'Centralisation', result: '' },
      ],
      exams: [{ name: 'Pas d\'imagerie en routine', urgency: 'not_indicated', condition: 'Centralisation positive suffit au diagnostic' }],
      yellowFlags: false,
      anamnesisSummary: buildAnamnesisText('Lombalgie discogénique', state, 'mechanical'),
    }
  }

  if (loc === 'paravertebral') {
    return {
      primary: 'Syndrome facettaire possible',
      confidence: 'possible',
      tests: [
        { name: 'Critères de Revel (combinés ≥ 3)', target: 'Facettes', result: 'Sp 66-91 %' },
        { name: 'Extension + rotation reproduit douleur', target: 'Facettes', result: '' },
        { name: 'Phénomène de non-centralisation', target: 'Facettes', result: 'Sn 100 % / Sp 11-17 %' },
      ],
      exams: [
        { name: 'Bloc facettaire diagnostique', urgency: 'if_persistent', condition: 'Seul examen diagnostique fiable' },
        { name: 'Pas d\'imagerie en routine', urgency: 'not_indicated', condition: '' },
      ],
      yellowFlags: false,
      anamnesisSummary: buildAnamnesisText('Syndrome facettaire', state, 'mechanical'),
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
    exams: [{ name: 'Pas d\'imagerie nécessaire', urgency: 'not_indicated', condition: 'Diagnostic d\'exclusion — 80-90 % des cas' }],
    yellowFlags: true,
    anamnesisSummary: buildAnamnesisText('Lombalgie non spécifique', state, 'non_specific'),
  }
}

function buildAnamnesisText(
  primary: string,
  state: TreeState,
  type: 'radicular' | 'inflammatory' | 'mechanical' | 'non_specific'
): string {
  const lines: string[] = []
  lines.push(`=== Arbre décisionnel lombalgie ===`)
  lines.push(`Suspicion diagnostique : ${primary}`)
  lines.push('')

  if (type === 'radicular') {
    const details: string[] = []
    if (state.q7_age_under60 === 'yes') details.push('< 60 ans')
    else if (state.q7_age_under60 === 'no') details.push('≥ 60 ans')
    if (state.q7_unilateral === 'yes') details.push('douleur unilatérale')
    if (state.q7_unilateral === 'no') details.push('douleur bilatérale')
    if (state.q7_worse_sitting === 'yes') details.push('aggravée en position assise')
    if (state.q7_worse_walking === 'yes') details.push('aggravée à la marche (claudication)')
    if (state.q7_shopping_cart === 'yes') details.push('soulagée en flexion / appui caddie')
    if (state.q7_cough_sneeze === 'yes') details.push('augmentée à la toux/éternuement')
    if (state.q7_sudden_onset === 'yes') details.push('début brutal après effort')
    if (details.length) lines.push(`Caractéristiques : ${details.join(', ')}.`)
    lines.push('Irradiation descendant sous le genou, douleur de jambe > douleur de dos.')
  }

  if (type === 'inflammatory') {
    lines.push(`${state.q9_criteria} critères inflammatoires présents (seuil ≥ 4).`)
    if (state.q9_extra_articular) lines.push('Manifestation(s) extra-articulaire(s) associée(s).')
  }

  if (type === 'mechanical') {
    const locLabels: Record<string, string> = {
      medial: 'médiane (discogénique)',
      paravertebral: 'paravertébrale (facettaire)',
      gluteal: 'fessière / sacro-iliaque',
      diffuse: 'diffuse paravertébrale',
    }
    if (state.q10_location) lines.push(`Localisation : ${locLabels[state.q10_location] || state.q10_location}.`)
    if (state.q13_tests_positive > 0) lines.push(`Tests de provocation SI positifs : ${state.q13_tests_positive}/6.`)
    if (state.q11_centralization === 'yes') lines.push('Phénomène de centralisation positif (McKenzie).')
  }

  lines.push('')
  lines.push('Drapeaux rouges : éliminés (syndrome queue de cheval, fracture, néoplasie, infection, AAA).')

  return lines.join('\n')
}

// ─── Main component ──────────────────────────────────────────────────────────

interface LowBackPainTreeProps {
  open: boolean
  onClose: () => void
  onApply: (anamnesis: string) => void
}

const STEP_LABELS: Partial<Record<Step, string>> = {
  q1: 'Étape 1 – Drapeaux rouges',
  q2: 'Étape 1 – Drapeaux rouges',
  q3: 'Étape 1 – Drapeaux rouges',
  q4: 'Étape 1 – Drapeaux rouges',
  q5: 'Étape 1 – Drapeaux rouges',
  q6: 'Étape 2 – Caractérisation',
  q7: 'Étape 3A – Causes radiculaires',
  q8: 'Étape 3A – Localisation neurologique',
  q9: 'Étape 3B – Mécanique / Inflammatoire',
  q10: 'Étape 3B – Localisation',
  q11: 'Étape 3B – Discogénique',
  q12: 'Étape 3B – Facettaire',
  q13: 'Étape 3B – Sacro-iliaque',
  q14: 'Étape 3B – Non spécifique',
  result: 'Résultat',
}

export function LowBackPainTree({ open, onClose, onApply }: LowBackPainTreeProps) {
  const [step, setStep] = useState<Step>('q1')
  const [state, setState] = useState<TreeState>(initialState)
  const [history, setHistory] = useState<Step[]>([])
  const [q2Checks, setQ2Checks] = useState<string[]>([])
  const [q3Checks, setQ3Checks] = useState<string[]>([])
  const [q4Checks, setQ4Checks] = useState<string[]>([])
  const [q9Checks, setQ9Checks] = useState<string[]>([])
  const [q13Checks, setQ13Checks] = useState<string[]>([])
  const [result, setResult] = useState<DiagnosisResult | null>(null)

  const reset = () => {
    setStep('q1')
    setState(initialState)
    setHistory([])
    setQ2Checks([])
    setQ3Checks([])
    setQ4Checks([])
    setQ9Checks([])
    setQ13Checks([])
    setResult(null)
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

  // ── Steps ──────────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Q1 : Cauda equina ─────────────────────────────────────────────────
      case 'q1':
        return (
          <StepWrapper
            label="Q1 — Syndrome de la queue de cheval"
            badge="Drapeau rouge 1/5"
            badgeVariant="destructive"
            question="Le patient présente-t-il l'un des signes suivants ?"
            hint="Difficultés à uriner / rétention urinaire récente · Incontinence urinaire ou fécale · Engourdissement périnéal (zone en selle) · Faiblesse progressive des deux jambes"
          >
            <RadioGroup
              value={state.q1_cauda_equina}
              onChange={(v) => {
                if (v === 'yes') push('alert_cauda_equina', { q1_cauda_equina: 'yes' })
                else push('q2', { q1_cauda_equina: 'no' })
              }}
              options={[
                { label: 'Non — aucun de ces signes', value: 'no' },
                { label: 'Oui — ≥ 1 signe présent', value: 'yes', description: 'Suspicion de syndrome de la queue de cheval' },
              ]}
            />
          </StepWrapper>
        )

      // ── Alert cauda equina ────────────────────────────────────────────────
      case 'alert_cauda_equina':
        return (
          <AlertStep
            title="⚠️ Suspicion de syndrome de la queue de cheval"
            items={[
              'IRM urgente',
              'Consultation chirurgicale immédiate',
              'Ne pas retarder la prise en charge',
            ]}
            onContinue={() => push('q2')}
            continueLabel="Continuer l'évaluation"
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
          >
            <CheckboxGroup
              options={[
                { label: 'Traumatisme récent (chute, accident)', value: 'trauma' },
                { label: 'Déficit neurologique associé au traumatisme', value: 'neuro' },
                { label: 'Âge > 70 ans', value: 'age70' },
                { label: 'Corticoïdes au long cours', value: 'steroids' },
                { label: 'Ostéoporose connue', value: 'osteo' },
                { label: 'Douleur médiane très localisée sur la colonne', value: 'medial_pain' },
              ]}
              selected={q2Checks}
              onChange={(vals) => setQ2Checks(vals)}
            />
            <Button
              className="w-full mt-3"
              onClick={() => {
                const trauma = q2Checks.includes('trauma')
                const neuro = q2Checks.includes('neuro')
                const factors = q2Checks.length
                if (trauma && neuro) {
                  push('alert_fracture', { q2_fracture: 'yes', q2_trauma_neuro: true, q2_factors: factors })
                } else if (factors >= 2) {
                  push('alert_fracture', { q2_fracture: 'yes', q2_trauma_neuro: false, q2_factors: factors })
                } else {
                  push('q3', { q2_fracture: 'no', q2_factors: factors })
                }
              }}
            >
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_fracture':
        return (
          <AlertStep
            title="⚠️ Suspicion de fracture vertébrale"
            items={
              state.q2_trauma_neuro
                ? ['Radiographies lombo-sacrées AP/latéral', 'IRM ou TDM urgent (trauma + déficit neuro)', 'LR+ = 31.1 si trauma + déficit neurologique']
                : ['Radiographies lombo-sacrées AP/latéral', `${state.q2_factors} facteurs de risque identifiés`, 'Risque ≥ 42 % si > 75 ans + ≥ 2 facteurs']
            }
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
            hint="Un drapeau rouge isolé a une très faible spécificité. C'est la combinaison qui est informative."
          >
            <CheckboxGroup
              options={[
                { label: 'Antécédent de cancer', value: 'cancer_hx' },
                { label: 'Perte de poids inexpliquée', value: 'weight_loss' },
                { label: 'Douleur principalement nocturne (réveille la nuit)', value: 'night_pain' },
                { label: '> 50 ans avec facteurs de risque de cancer', value: 'age50' },
                { label: 'Douleur persistante / aggravée sous traitement > 1 mois', value: 'persistent' },
              ]}
              selected={q3Checks}
              onChange={setQ3Checks}
            />
            <Button
              className="w-full mt-3"
              onClick={() => {
                const factors = q3Checks.length
                if (q3Checks.includes('cancer_hx') || factors >= 2) {
                  push('alert_neoplasia', { q3_neoplasia: 'yes', q3_factors: factors })
                } else {
                  push('q4', { q3_neoplasia: 'no', q3_factors: factors })
                }
              }}
            >
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_neoplasia':
        return (
          <AlertStep
            title="⚠️ Suspicion de néoplasie / métastase"
            items={[
              state.q3_factors >= 1 && q3Checks.includes('cancer_hx') ? 'LR+ = 27.9 si antécédent de cancer' : `${state.q3_factors} facteurs de risque identifiés`,
              'IRM lombaire recommandée',
              'Bilan biologique : NFS, VS, CRP',
            ].filter(Boolean) as string[]}
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
          >
            <CheckboxGroup
              options={[
                { label: 'Fièvre', value: 'fever' },
                { label: 'Immunodépression (VIH, immunosuppresseurs)', value: 'immuno' },
                { label: 'Usage de drogues IV', value: 'iv_drugs' },
                { label: 'Cathéter vasculaire ou infection récente', value: 'catheter' },
                { label: 'Douleur constante même au repos', value: 'rest_pain' },
              ]}
              selected={q4Checks}
              onChange={setQ4Checks}
            />
            <Button
              className="w-full mt-3"
              onClick={() => {
                const factors = q4Checks.length
                if (q4Checks.includes('fever') && factors >= 2) {
                  push('alert_infection', { q4_infection: 'yes', q4_factors: factors })
                } else {
                  push('q5', { q4_infection: 'no', q4_factors: factors })
                }
              }}
            >
              Valider et continuer
            </Button>
          </StepWrapper>
        )

      case 'alert_infection':
        return (
          <AlertStep
            title="⚠️ Suspicion d'infection spinale"
            items={[
              q4Checks.includes('iv_drugs') ? 'LR+ = 13.7 si usage de drogues IV + autre site d\'infection' : '',
              q4Checks.includes('catheter') ? 'LR+ = 15.7 si cathéter vasculaire' : '',
              'IRM urgente',
              'Bilan biologique : NFS, VS, CRP',
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
            question="Le patient présente-t-il ≥ 2 des facteurs suivants ?"
            hint="Homme > 50 ans · Tabagisme actif ou sevré · Gêne ou douleur abdominale associée"
          >
            <RadioGroup
              value={state.q5_aaa}
              onChange={(v) => {
                if (v === 'yes') push('alert_aaa', { q5_aaa: 'yes' })
                else push('q6', { q5_aaa: 'no' })
              }}
              options={[
                { label: 'Non — profil non évocateur', value: 'no' },
                { label: 'Oui — ≥ 2 facteurs présents', value: 'yes', description: 'Palpation abdominale à effectuer' },
              ]}
            />
          </StepWrapper>
        )

      case 'alert_aaa':
        return (
          <AlertStep
            title="⚠️ Suspicion d'anévrisme de l'aorte abdominale"
            items={[
              'Palpation abdominale : recherche masse pulsatile',
              'Échographie abdominale ou TDM',
              'Consultation vasculaire urgente si masse pulsatile',
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
            badge="Étape 2"
            badgeVariant="secondary"
            question="La douleur irradie-t-elle dans la jambe ?"
          >
            <div className="space-y-3">
              <RadioGroup
                value={state.q6_radiation}
                onChange={(v) => setState((s) => ({ ...s, q6_radiation: v }))}
                options={[
                  { label: 'Non — douleur principalement dorsale / fessière', value: 'no', description: '→ Voie mécanique / inflammatoire' },
                  { label: 'Oui — douleur descendant dans la jambe', value: 'yes' },
                ]}
              />
              {state.q6_radiation === 'yes' && (
                <div className="space-y-3 pl-2 border-l-2 border-primary/30">
                  <RadioGroup
                    value={state.q6_below_knee}
                    onChange={(v) => setState((s) => ({ ...s, q6_below_knee: v }))}
                    options={[
                      { label: 'Descend sous le genou', value: 'yes' },
                      { label: 'S\'arrête à la cuisse / fesse', value: 'no' },
                    ]}
                  />
                  {state.q6_below_knee !== null && (
                    <RadioGroup
                      value={state.q6_leg_worse}
                      onChange={(v) => setState((s) => ({ ...s, q6_leg_worse: v }))}
                      options={[
                        { label: 'Douleur de jambe > douleur de dos', value: 'yes' },
                        { label: 'Douleur de dos ≥ douleur de jambe', value: 'no' },
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
            question="Répondez aux questions suivantes :"
          >
            <div className="space-y-3">
              {[
                { key: 'q7_age_under60', q: 'Patient âgé de moins de 60 ans ?', note: 'Hernie : pic 30-50 ans · Sténose : > 60 ans' },
                { key: 'q7_unilateral', q: 'Douleur unilatérale ?', note: 'Hernie : unilatérale · Sténose : souvent bilatérale' },
                { key: 'q7_worse_sitting', q: 'Douleur aggravée en position assise ?', note: 'Hernie : OUI · Sténose : soulagée assis' },
                { key: 'q7_worse_walking', q: 'Douleur aggravée à la marche et station debout prolongée ?', note: 'Claudication neurogène → sténose' },
                { key: 'q7_shopping_cart', q: 'Soulagée en se penchant en avant (appui sur caddie) ?', note: '"Shopping cart sign" — sténose Sn 52-70 % Sp 55-83 %' },
                { key: 'q7_sudden_onset', q: 'Début brutal après un effort ?', note: 'Hernie : souvent · Sténose : installation progressive' },
                { key: 'q7_cough_sneeze', q: 'Douleur augmentée à la toux / éternuement / poussée ?', note: 'Hernie — OR 3.2' },
              ].map(({ key, q, note }) => (
                <div key={key} className="space-y-1">
                  <p className="text-sm font-medium">{q}</p>
                  <p className="text-xs text-muted-foreground">{note}</p>
                  <div className="flex gap-2">
                    {(['yes', 'no'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
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
              Continuer vers localisation neurologique
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
                <tbody className="divide-y">
                  <tr>
                    <td className="p-2 font-semibold text-primary">L4</td>
                    <td className="p-2">Face antéro-médiale jambe</td>
                    <td className="p-2">Dorsiflexion cheville, extension genou</td>
                    <td className="p-2">Rotulien ↓</td>
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="p-2 font-semibold text-primary">L5</td>
                    <td className="p-2">Face latérale jambe, dos du pied, gros orteil</td>
                    <td className="p-2">Dorsiflexion cheville, extension orteils</td>
                    <td className="p-2">Ischio-jambier médial (inconstant)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold text-primary">S1</td>
                    <td className="p-2">Face post. jambe, plante, 5e orteil</td>
                    <td className="p-2">Flexion plantaire, flexion orteils</td>
                    <td className="p-2">Achilléen ↓</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
          >
            <CheckboxGroup
              options={[
                { label: 'Début < 45 ans', value: 'onset_45' },
                { label: 'Apparition progressive / insidieuse', value: 'insidious' },
                { label: 'Raideur matinale > 30 minutes', value: 'morning_stiff' },
                { label: 'Amélioré par l\'exercice, pas par le repos', value: 'exercise_better' },
                { label: 'Douleurs fessières alternantes', value: 'alternating_buttock' },
                { label: 'Réveils en 2e partie de nuit', value: 'night_waking' },
              ]}
              selected={q9Checks}
              onChange={setQ9Checks}
            />
            <div className="mt-3">
              <p className="text-sm font-medium mb-2">Manifestations extra-articulaires :</p>
              <CheckboxGroup
                options={[
                  { label: 'Psoriasis, uvéite, MICI, dactylite', value: 'extra_articular' },
                  { label: 'Antécédents familiaux de spondylarthrite', value: 'family_hx' },
                ]}
                selected={q9Checks}
                onChange={setQ9Checks}
              />
            </div>
            <Button
              className="w-full mt-3"
              onClick={() => {
                const inflammCriteria = q9Checks.filter((v) =>
                  ['onset_45', 'insidious', 'morning_stiff', 'exercise_better', 'alternating_buttock', 'night_waking'].includes(v)
                ).length
                const extraArticular = q9Checks.includes('extra_articular') || q9Checks.includes('family_hx')
                const updates = { q9_criteria: inflammCriteria, q9_extra_articular: extraArticular }
                if (inflammCriteria >= 4 || extraArticular) {
                  showResult({ ...updates, q9_inflammatory: 'yes' })
                } else {
                  push('q10', { ...updates, q9_inflammatory: 'no' })
                }
              }}
            >
              Continuer
            </Button>
          </StepWrapper>
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
                else if (v === 'gluteal') push('q13', { q10_location: v })
                else showResult({ q10_location: v })
              }}
              options={[
                { label: 'Médiane (sur les épineuses)', value: 'medial', description: '→ Douleur discogénique ou fracture' },
                { label: 'Paravertébrale (à côté de la colonne)', value: 'paravertebral', description: '→ Origine facettaire ou musculaire' },
                { label: 'Fessière / sacro-iliaque', value: 'gluteal', description: '→ Dysfonction sacro-iliaque' },
                { label: 'Diffuse paravertébrale bilatérale', value: 'diffuse', description: '→ Lombalgie non spécifique' },
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
            hint="Mouvements répétés qui font migrer la douleur vers le centre (lombaire) → critère le plus spécifique pour la douleur discogénique (LR+ significatif)"
          >
            <RadioGroup
              value={state.q11_centralization}
              onChange={(v) => showResult({ q11_centralization: v })}
              options={[
                { label: 'Oui — centralisation positive', value: 'yes', description: 'Douleur discogénique probable' },
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
            question="Caractéristiques évocatrices (critères de Revel) :"
            hint="Les tests cliniques individuels ont une faible précision. C'est la combinaison qui est informative. Spécificité 66-91 % pour ≥ 3 critères."
          >
            <div className="text-sm space-y-1 bg-muted/30 rounded-lg p-3 mb-3">
              <p>· Douleur paravertébrale aggravée en extension + rotation</p>
              <p>· Irradiation vers hanche / cuisse (pas sous le genou)</p>
              <p>· Arthrose connue</p>
              <p>· Âge &gt; 65 ans</p>
            </div>
            <RadioGroup
              value={state.q12_facet}
              onChange={(v) => showResult({ q12_facet: v })}
              options={[
                { label: 'Profil facettaire probable (≥ 3 critères)', value: 'probable' },
                { label: 'Profil non concluant', value: 'unclear' },
              ]}
            />
          </StepWrapper>
        )

      // ── Q13 : Sacro-iliaque ───────────────────────────────────────────────
      case 'q13':
        return (
          <StepWrapper
            label="Q13 — Dysfonction sacro-iliaque"
            badge="Voie mécanique"
            badgeVariant="default"
            question="Tests de provocation SI — cochez ceux positifs :"
            hint="≥ 3 tests positifs : Sn 80-91 %, Sp 63-79 % (LR+ = 2.44). < 3 tests : exclut la SI avec 92 % de certitude."
          >
            <CheckboxGroup
              options={[
                { label: 'Test de distraction', value: 't1' },
                { label: 'Test de compression', value: 't2' },
                { label: 'Thrust sacré', value: 't3' },
                { label: 'Test de Gaenslen', value: 't4' },
                { label: 'Test de Patrick / FABER', value: 't5' },
                { label: 'Thigh thrust (cisaillement postérieur)', value: 't6' },
              ]}
              selected={q13Checks}
              onChange={setQ13Checks}
            />
            <Button
              className="w-full mt-3"
              onClick={() => showResult({ q13_tests_positive: q13Checks.length })}
            >
              Voir le résultat
            </Button>
          </StepWrapper>
        )

      // ── Result ────────────────────────────────────────────────────────────
      case 'result':
        if (!result) return null
        return <ResultStep result={result} onApply={() => { onApply(result.anamnesisSummary); onClose() }} onReset={reset} />

      default:
        return null
    }
  }

  const stepLabel = STEP_LABELS[step] || ''
  const isAlert = step.startsWith('alert_')
  const progress = (() => {
    const allSteps: Step[] = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'result']
    const idx = allSteps.indexOf(step)
    return idx < 0 ? 0 : Math.round((idx / (allSteps.length - 1)) * 100)
  })()

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
                <span>{stepLabel}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderStep()}
        </div>

        {!isAlert && step !== 'result' && (
          <div className="px-6 pb-4 flex-shrink-0 border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={history.length === 0}
              onClick={goBack}
              className="gap-1.5 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Étape précédente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepWrapper({
  label,
  badge,
  badgeVariant,
  question,
  hint,
  children,
}: {
  label: string
  badge: string
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  question: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant={badgeVariant} className="text-xs">{badge}</Badge>
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className="font-medium">{question}</p>
      {hint && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">{hint}</p>
      )}
      {children}
    </div>
  )
}

function AlertStep({
  title,
  items,
  onContinue,
  continueLabel,
}: {
  title: string
  items: string[]
  onContinue: () => void
  continueLabel: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-destructive">{title}</p>
          <ul className="mt-2 space-y-1">
            {items.map((item, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5">
                <span className="text-destructive mt-1">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Button variant="outline" className="w-full gap-2" onClick={onContinue}>
        {continueLabel}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function ResultStep({
  result,
  onApply,
  onReset,
}: {
  result: DiagnosisResult
  onApply: () => void
  onReset: () => void
}) {
  const urgencyLabel = {
    urgent: { label: 'Urgent', className: 'text-destructive bg-destructive/10' },
    if_persistent: { label: 'Si persistance > 6-8 sem.', className: 'text-amber-700 bg-amber-50' },
    not_indicated: { label: 'Non indiqué en routine', className: 'text-emerald-700 bg-emerald-50' },
  }

  const confidenceLabel = {
    probable: { label: 'Probable', className: 'bg-primary/10 text-primary' },
    possible: { label: 'Possible', className: 'bg-amber-100 text-amber-800' },
    exclusion: { label: 'Par exclusion', className: 'bg-muted text-muted-foreground' },
  }

  return (
    <div className="space-y-5">
      {/* Primary diagnosis */}
      <div className="p-4 border-2 border-primary/30 rounded-xl bg-primary/5">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">{result.primary}</span>
        </div>
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${confidenceLabel[result.confidence].className}`}
        >
          {confidenceLabel[result.confidence].label}
        </span>
      </div>

      {/* Yellow flags reminder */}
      {result.yellowFlags && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <p className="font-medium">⚠️ Évaluer les drapeaux jaunes (facteurs de chronicisation)</p>
          <p className="text-xs mt-1">Catastrophisme · Anxiété · Dépression · Kinésiophobie · Insatisfaction au travail</p>
        </div>
      )}

      {/* Tests checklist */}
      <div>
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Tests cliniques à réaliser
        </h3>
        <div className="space-y-1.5">
          {result.tests.map((t, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-sm">
              <input type="checkbox" className="mt-0.5 accent-primary" />
              <div className="flex-1">
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground"> — {t.target}</span>
                {t.result && <span className="text-xs text-muted-foreground ml-1">({t.result})</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

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
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${u.className}`}>
                  {u.label}
                </span>
                <div>
                  <span className="font-medium">{e.name}</span>
                  {e.condition && <p className="text-xs text-muted-foreground">{e.condition}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Summary preview */}
      <div>
        <h3 className="font-semibold text-sm mb-2">Résumé à insérer dans l'anamnèse</h3>
        <pre className="text-xs bg-muted/40 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
          {result.anamnesisSummary}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
          Recommencer
        </Button>
        <Button className="flex-1 gap-2" onClick={onApply}>
          <FileText className="h-4 w-4" />
          Insérer dans l'anamnèse
        </Button>
      </div>
    </div>
  )
}
