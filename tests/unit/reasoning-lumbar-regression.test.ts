import { describe, it, expect } from 'vitest'
import {
  initialState,
  buildResult,
  assessLumbarFracture,
  assessLumbarNeoplasia,
  assessLumbarInfection,
  type TreeState,
} from '@/lib/reasoning/legacy/lumbar-tree'
import { LUMBAR_HYPOTHESES, LUMBAR_ACTIONS, lumbarTreeStateToSignals, reason } from '@/lib/reasoning'

/**
 * Non-régression : pour tout parcours de l'arbre lombaire, le moteur doit
 * retenir la même hypothèse en tête du différentiel que celle conclue par
 * l'arbre. C'est le test qui autorise — ou non — à considérer la base de
 * connaissance comme une transposition fidèle.
 */

const PRIMARY_TO_HYPOTHESIS: Record<string, string> = {
  'Hernie discale probable': 'lombaire.hernie-discale',
  'Sténose spinale probable': 'lombaire.stenose',
  'Radiculopathie lombaire (à préciser)': 'lombaire.radiculopathie',
  'Spondylarthrite ankylosante (sacroiliite radiographique)': 'lombaire.spa-radiographique',
  'Spondyloarthrite axiale (non radiographique)': 'lombaire.spa-non-radiographique',
  'Suspicion de spondyloarthrite axiale — IRM recommandée': 'lombaire.spa-suspicion',
  'Dysfonction sacro-iliaque probable': 'lombaire.sacro-iliaque',
  'Douleur discogénique probable': 'lombaire.discogenique',
  'Syndrome facettaire possible': 'lombaire.facettaire',
  'Lombalgie non spécifique (diagnostic d\'exclusion)': 'lombaire.non-specifique',
}

/** Parcours type : drapeaux rouges tous négatifs, comme dans la majorité des cas. */
function cleanState(overrides: Partial<TreeState> = {}): TreeState {
  return {
    ...initialState,
    q_duration: 'acute',
    q1_cauda_equina: 'no',
    q2_fracture: 'no',
    q2_checks: [],
    q3_neoplasia: 'no',
    q3_checks: [],
    q4_infection: 'no',
    q4_checks: [],
    q5_aaa: 'no',
    ...overrides,
  }
}

function topHypothesis(state: TreeState): string {
  const result = reason({
    signals: lumbarTreeStateToSignals(state),
    hypotheses: LUMBAR_HYPOTHESES,
    actions: LUMBAR_ACTIONS,
  })
  return result.hypotheses[0]?.id ?? 'aucune'
}

function expectedHypothesis(state: TreeState): string {
  const primary = buildResult(state).primary
  const id = PRIMARY_TO_HYPOTHESIS[primary]
  if (!id) throw new Error(`Conclusion non cartographiée : ${primary}`)
  return id
}

const YES_NO = ['yes', 'no'] as const

describe('voie radiculaire — les 128 combinaisons discriminantes', () => {
  const combos: TreeState[] = []
  for (const age of YES_NO)
    for (const unilateral of YES_NO)
      for (const sitting of YES_NO)
        for (const walking of YES_NO)
          for (const cart of YES_NO)
            for (const sudden of YES_NO)
              for (const cough of YES_NO)
                combos.push(
                  cleanState({
                    q6_radiation: 'yes',
                    q6_below_knee: 'yes',
                    q6_leg_worse: 'yes',
                    q7_age_under60: age,
                    q7_unilateral: unilateral,
                    q7_worse_sitting: sitting,
                    q7_worse_walking: walking,
                    q7_shopping_cart: cart,
                    q7_sudden_onset: sudden,
                    q7_cough_sneeze: cough,
                  }),
                )

  it('couvre bien 128 parcours', () => {
    expect(combos).toHaveLength(128)
  })

  it('exerce réellement les trois conclusions radiculaires', () => {
    const atteintes = new Set(combos.map(expectedHypothesis))
    expect([...atteintes].sort()).toEqual([
      'lombaire.hernie-discale',
      'lombaire.radiculopathie',
      'lombaire.stenose',
    ])
  })

  it('conclut comme l\'arbre sur chacune', () => {
    const mismatches = combos
      .map((state) => ({ state, attendu: expectedHypothesis(state), obtenu: topHypothesis(state) }))
      .filter((row) => row.attendu !== row.obtenu)
    expect(mismatches.map((row) => `${row.attendu} ≠ ${row.obtenu}`)).toEqual([])
  })

  it('n\'écarte jamais les trois hypothèses radiculaires à la fois', () => {
    for (const state of combos) {
      const result = reason({ signals: lumbarTreeStateToSignals(state), hypotheses: LUMBAR_HYPOTHESES })
      const radiculaires = result.hypotheses.filter((hypothesis) =>
        ['lombaire.hernie-discale', 'lombaire.stenose', 'lombaire.radiculopathie'].includes(hypothesis.id),
      )
      expect(radiculaires).toHaveLength(3)
    }
  })
})

describe('voie inflammatoire', () => {
  const TRISTATE = ['yes', 'no', null] as const
  it('conclut comme l\'arbre sur toutes les combinaisons sacroiliite × tableau clinique', () => {
    for (const sacroiliite of TRISTATE) {
      for (const clinique of TRISTATE) {
        const state = cleanState({
          q6_radiation: 'no',
          q9_inflammatory: 'yes',
          q9_criteria: 4,
          q9_spa_sacroiliitis: sacroiliite,
          q9_spa_clinical_picture: clinique,
        })
        expect(topHypothesis(state), `sacroiliite=${sacroiliite} clinique=${clinique}`).toBe(
          expectedHypothesis(state),
        )
      }
    }
  })
})

describe('voie mécanique', () => {
  const LOCATIONS = ['medial', 'paravertebral', 'gluteal', 'diffuse'] as const
  it('conclut comme l\'arbre sur toutes les localisations × centralisation', () => {
    for (const location of LOCATIONS) {
      for (const centralisation of [...YES_NO, null] as const) {
        const state = cleanState({
          q6_radiation: 'no',
          q9_inflammatory: 'no',
          q10_location: location,
          q11_centralization: centralisation,
        })
        expect(topHypothesis(state), `${location} / centralisation=${centralisation}`).toBe(
          expectedHypothesis(state),
        )
      }
    }
  })
})

describe('irradiation incomplète', () => {
  it('ne bascule pas en radiculaire sans les trois éléments', () => {
    for (const belowKnee of YES_NO) {
      for (const legWorse of YES_NO) {
        if (belowKnee === 'yes' && legWorse === 'yes') continue
        const state = cleanState({
          q6_radiation: 'yes',
          q6_below_knee: belowKnee,
          q6_leg_worse: legWorse,
          q9_inflammatory: 'no',
          q10_location: 'diffuse',
        })
        expect(topHypothesis(state), `sous-genou=${belowKnee} jambe=${legWorse}`).toBe(
          expectedHypothesis(state),
        )
      }
    }
  })
})

describe('drapeaux rouges', () => {
  /** Toutes les parties d'un ensemble, pour balayer les combinaisons de cases cochées. */
  function subsets<T>(items: readonly T[]): T[][] {
    return items.reduce<T[][]>((acc, item) => [...acc, ...acc.map((set) => [...set, item])], [[]])
  }

  function firesFlag(state: TreeState, id: string): boolean {
    const result = reason({ signals: lumbarTreeStateToSignals(state), hypotheses: LUMBAR_HYPOTHESES })
    return result.redFlags.some((flag) => flag.id === id)
  }

  it('déclenche la fracture exactement comme l\'arbre', () => {
    for (const checks of subsets(['trauma', 'neuro', 'age70', 'steroids', 'osteo', 'medial_pain'])) {
      const state = cleanState({ q2_fracture: checks.length > 0 ? 'yes' : 'no', q2_checks: checks })
      expect(firesFlag(state, 'lombaire.fracture'), checks.join('+') || 'aucun').toBe(
        assessLumbarFracture(checks) === 'alert',
      )
    }
  })

  it('déclenche la néoplasie et la surveillance exactement comme l\'arbre', () => {
    for (const checks of subsets(['cancer_hx', 'weight_loss', 'night_pain', 'age50', 'persistent'])) {
      const state = cleanState({ q3_neoplasia: 'no', q3_checks: checks })
      const verdict = assessLumbarNeoplasia(checks)
      expect(firesFlag(state, 'lombaire.neoplasie'), checks.join('+') || 'aucun').toBe(verdict === 'alert')
      expect(firesFlag(state, 'lombaire.neoplasie-surveillance'), checks.join('+') || 'aucun').toBe(
        verdict === 'watch',
      )
    }
  })

  it('déclenche l\'infection exactement comme l\'arbre', () => {
    for (const checks of subsets(['fever', 'immuno', 'iv_drugs', 'catheter', 'rest_pain'])) {
      const state = cleanState({ q4_infection: 'no', q4_checks: checks })
      expect(firesFlag(state, 'lombaire.infection'), checks.join('+') || 'aucun').toBe(
        assessLumbarInfection(checks) === 'alert',
      )
    }
  })

  it('remonte la queue de cheval sans rien attendre d\'autre', () => {
    const state = cleanState({ q1_cauda_equina: 'yes' })
    expect(firesFlag(state, 'lombaire.queue-de-cheval')).toBe(true)
  })
})
