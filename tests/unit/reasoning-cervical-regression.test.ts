import { describe, it, expect } from 'vitest'
import {
  initialState,
  buildResult,
  assessMyelopathy,
  assessCervicalFracture,
  assessCervicalNeoplasia,
  assessCervicalInfection,
  assessDissection,
  type NeckTreeState,
} from '@/lib/reasoning/legacy/cervical-tree'
import { CERVICAL_HYPOTHESES, CERVICAL_ACTIONS, cervicalTreeStateToSignals, reason } from '@/lib/reasoning'

/**
 * Même exigence que pour le lombaire : le moteur doit retenir la même
 * hypothèse en tête que l'arbre cervical, sur tous les parcours possibles.
 */

function hypothesisFor(primary: string): string {
  if (primary.startsWith('Radiculopathie cervicale')) return 'cervical.radiculopathie'
  if (primary.startsWith('Céphalée cervicogénique')) return 'cervical.cephalee-cervicogenique'
  const table: Record<string, string> = {
    'Myélopathie cervicale dégénérative — évaluation neurochirurgicale urgente': 'cervical.myelopathie',
    'WAD grade III — atteinte neurologique': 'cervical.wad-iii',
    'WAD grade I-II — prise en charge conservative': 'cervical.wad-i-ii',
    'Suspicion spondyloarthrite axiale — atteinte cervicale': 'cervical.spa',
    'Syndrome facettaire cervical probable': 'cervical.facettaire',
    'Cervicalgie non spécifique (diagnostic d\'exclusion)': 'cervical.non-specifique',
  }
  const id = table[primary]
  if (!id) throw new Error(`Conclusion non cartographiée : ${primary}`)
  return id
}

function cleanState(overrides: Partial<NeckTreeState> = {}): NeckTreeState {
  return {
    ...initialState,
    q_duration: 'acute',
    q2_fracture: 'no',
    q2_checks: [],
    q3_neoplasia: 'no',
    q3_checks: [],
    q4_infection: 'no',
    q4_checks: [],
    q5_dissection: 'no',
    q5_checks: [],
    ...overrides,
  }
}

function topHypothesis(state: NeckTreeState): string {
  const result = reason({
    signals: cervicalTreeStateToSignals(state),
    hypotheses: CERVICAL_HYPOTHESES,
    actions: CERVICAL_ACTIONS,
  })
  return result.hypotheses[0]?.id ?? 'aucune'
}

describe('différentiel cervical — balayage des parcours', () => {
  const signCounts = [0, 1, 2, 3]
  const radiations = ['yes', 'no', null] as const
  const armWorse = ['yes', 'no'] as const
  const wadGrades = [0, 1, 2, 3]
  const inflammatory = ['yes', 'no'] as const
  const locations = ['medial', 'paravertebral', 'trapezius', 'suboccipital'] as const
  const headaches = ['yes', 'no'] as const
  const headacheCriteria = [0, 1, 3]
  const facetCriteria = [0, 2]

  const combos: NeckTreeState[] = []
  for (const signs of signCounts)
    for (const radiation of radiations)
      for (const worse of armWorse)
        for (const grade of wadGrades)
          for (const inflam of inflammatory)
            for (const location of locations)
              for (const headache of headaches)
                for (const criteria of headacheCriteria)
                  for (const facet of facetCriteria)
                    combos.push(
                      cleanState({
                        q1_sign_checks: Array.from({ length: signs }, (_, i) => `signe-${i}`),
                        q1_signs_count: signs,
                        q6_arm_radiation: radiation,
                        q6_arm_worse: worse,
                        q8_wad: 'yes',
                        q8_wad_grade: grade,
                        q9_inflammatory: inflam,
                        q10_location: location,
                        q11_facet_criteria: facet,
                        q7_headache: headache,
                        q12_criteria_checks: Array.from({ length: criteria }, (_, i) => `critere-${i}`),
                      }),
                    )

  it('balaye plusieurs milliers de parcours', () => {
    expect(combos.length).toBeGreaterThan(2000)
  })

  it('exerce réellement les huit conclusions de l\'arbre', () => {
    // Sans cette garantie, un balayage devenu dégénéré passerait le test de
    // non-régression sans rien vérifier.
    const atteintes = new Set(combos.map((state) => hypothesisFor(buildResult(state).primary)))
    expect([...atteintes].sort()).toEqual([
      'cervical.cephalee-cervicogenique',
      'cervical.facettaire',
      'cervical.myelopathie',
      'cervical.non-specifique',
      'cervical.radiculopathie',
      'cervical.spa',
      'cervical.wad-i-ii',
      'cervical.wad-iii',
    ])
  })

  it('conclut comme l\'arbre sur chacun', () => {
    const mismatches: string[] = []
    for (const state of combos) {
      const attendu = hypothesisFor(buildResult(state).primary)
      const obtenu = topHypothesis(state)
      if (attendu !== obtenu) {
        mismatches.push(
          `signes=${state.q1_signs_count} irradiation=${state.q6_arm_radiation} bras=${state.q6_arm_worse} ` +
            `wad=${state.q8_wad_grade} inflam=${state.q9_inflammatory} loc=${state.q10_location} ` +
            `céphalée=${state.q7_headache}/${state.q12_criteria_checks.length} facettes=${state.q11_facet_criteria} ` +
            `→ attendu ${attendu}, obtenu ${obtenu}`,
        )
      }
    }
    expect(mismatches.slice(0, 10)).toEqual([])
  })
})

describe('parcours sans étape whiplash', () => {
  it('conclut comme l\'arbre quand le grade n\'a jamais été demandé', () => {
    for (const location of ['medial', 'paravertebral', 'suboccipital'] as const) {
      const state = cleanState({
        q6_arm_radiation: 'no',
        q6_arm_worse: 'no',
        q9_inflammatory: 'no',
        q10_location: location,
        q11_facet_criteria: 2,
        q7_headache: 'no',
      })
      expect(topHypothesis(state), location).toBe(hypothesisFor(buildResult(state).primary))
    }
  })
})

describe('drapeaux rouges cervicaux', () => {
  function subsets<T>(items: readonly T[]): T[][] {
    return items.reduce<T[][]>((acc, item) => [...acc, ...acc.map((set) => [...set, item])], [[]])
  }

  function firesFlag(state: NeckTreeState, id: string): boolean {
    const result = reason({ signals: cervicalTreeStateToSignals(state), hypotheses: CERVICAL_HYPOTHESES })
    return result.redFlags.some((flag) => flag.id === id)
  }

  it('déclenche la fracture exactement comme l\'arbre', () => {
    for (const checks of subsets(['trauma', 'age65', 'steroids_osteo', 'focal_pain'])) {
      const state = cleanState({ q2_checks: checks })
      expect(firesFlag(state, 'cervical.fracture'), checks.join('+') || 'aucun').toBe(
        assessCervicalFracture(checks) === 'alert',
      )
    }
  })

  it('déclenche la néoplasie et la surveillance exactement comme l\'arbre', () => {
    for (const checks of subsets(['cancer_hx', 'weight_loss', 'night_pain', 'age50_persistent'])) {
      const state = cleanState({ q3_checks: checks })
      const verdict = assessCervicalNeoplasia(checks)
      expect(firesFlag(state, 'cervical.neoplasie'), checks.join('+') || 'aucun').toBe(verdict === 'alert')
      expect(firesFlag(state, 'cervical.neoplasie-surveillance'), checks.join('+') || 'aucun').toBe(
        verdict === 'watch',
      )
    }
  })

  it('déclenche l\'infection exactement comme l\'arbre', () => {
    for (const checks of subsets(['fever', 'immuno', 'iv_drugs', 'recent_surgery', 'vertebral_pain'])) {
      const state = cleanState({ q4_checks: checks })
      expect(firesFlag(state, 'cervical.infection'), checks.join('+') || 'aucun').toBe(
        assessCervicalInfection(checks) === 'alert',
      )
    }
  })

  it('déclenche la dissection exactement comme l\'arbre', () => {
    for (const checks of subsets([
      'sudden_headache',
      'neuro_signs',
      'recent_trauma',
      'age50_vasc',
      'pulsatile_tinnitus',
    ])) {
      const state = cleanState({ q5_checks: checks })
      expect(firesFlag(state, 'cervical.dissection'), checks.join('+') || 'aucun').toBe(
        assessDissection(checks) === 'alert',
      )
    }
  })

  it('place la myélopathie en tête du différentiel dès deux signes', () => {
    for (const signs of [0, 1, 2, 3]) {
      const state = cleanState({
        q1_sign_checks: Array.from({ length: signs }, (_, i) => `signe-${i}`),
        q1_signs_count: signs,
        q6_arm_radiation: 'no',
        q6_arm_worse: 'no',
        q9_inflammatory: 'no',
        q10_location: 'medial',
        q7_headache: 'no',
      })
      const isTop = topHypothesis(state) === 'cervical.myelopathie'
      expect(isTop, `${signs} signe(s)`).toBe(assessMyelopathy(state.q1_sign_checks) === 'alert')
    }
  })
})
