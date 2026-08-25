import { describe, it, expect } from 'vitest'
import {
  activeHypotheses,
  evaluate,
  reason,
  scoreHypothesis,
  signalsOf,
  type ActionDefinition,
  type HypothesisDefinition,
  type SignalExpr,
} from '@/lib/reasoning'

const AUCUN = {}

describe('logique ternaire', () => {
  it('distingue « non » de « pas encore exploré »', () => {
    expect(evaluate('general.fievre', {})).toBe('unknown')
    expect(evaluate('general.fievre', { 'general.fievre': false })).toBe('no')
    expect(evaluate('general.fievre', { 'general.fievre': true })).toBe('yes')
  })

  it('conclut « non » sur un ET dès qu\'un membre est faux, sans connaître le reste', () => {
    const expr: SignalExpr = { all: ['general.fievre', 'general.perte_poids'] }
    expect(evaluate(expr, { 'general.fievre': false })).toBe('no')
    expect(evaluate(expr, { 'general.fievre': true })).toBe('unknown')
  })

  it('conclut « oui » sur un OU dès qu\'un membre est vrai', () => {
    const expr: SignalExpr = { any: ['general.fievre', 'general.perte_poids'] }
    expect(evaluate(expr, { 'general.fievre': true })).toBe('yes')
    expect(evaluate(expr, { 'general.fievre': false })).toBe('unknown')
    expect(evaluate(expr, { 'general.fievre': false, 'general.perte_poids': false })).toBe('no')
  })

  it('tranche un seuil dès qu\'il est atteint ou devenu inatteignable', () => {
    const expr: SignalExpr = {
      atLeast: 2,
      among: ['general.fievre', 'general.perte_poids', 'general.douleur_nocturne'],
    }
    expect(evaluate(expr, { 'general.fievre': true, 'general.perte_poids': true })).toBe('yes')
    expect(evaluate(expr, { 'general.fievre': false, 'general.perte_poids': false })).toBe('no')
    expect(evaluate(expr, { 'general.fievre': true })).toBe('unknown')
  })

  it('propage l\'inconnu à travers la négation', () => {
    expect(evaluate({ not: 'general.fievre' }, {})).toBe('unknown')
    expect(evaluate({ not: 'general.fievre' }, { 'general.fievre': false })).toBe('yes')
  })

  it('recense les signaux d\'une expression sans doublon', () => {
    const expr: SignalExpr = {
      all: ['general.fievre', { any: ['general.fievre', { not: 'general.perte_poids' }] }],
    }
    expect(signalsOf(expr).sort()).toEqual(['general.fievre', 'general.perte_poids'])
  })
})

const HYPOTHESE_TEST: HypothesisDefinition = {
  id: 'test.exemple',
  label: 'Exemple',
  region: 'lombaire',
  kind: 'specific',
  requires: 'lombaire.irradiation_jambe',
  criteria: [
    { when: 'lombaire.aggrave_assis', weight: 5, label: 'aggravation assise' },
    { when: 'lombaire.debut_brutal', weight: 3, label: 'début brutal' },
    { when: 'terrain.age_plus_70', weight: -4, label: 'âge élevé, peu compatible' },
  ],
}

describe('cotation d\'une hypothèse', () => {
  it('sépare arguments pour, arguments contre et ce qui reste à explorer', () => {
    const scored = scoreHypothesis(HYPOTHESE_TEST, {
      'lombaire.irradiation_jambe': true,
      'lombaire.aggrave_assis': true,
      'terrain.age_plus_70': true,
    })
    expect(scored.status).toBe('retained')
    expect(scored.score).toBe(1)
    expect(scored.argumentsFor).toEqual(['aggravation assise'])
    expect(scored.argumentsAgainst).toEqual(['âge élevé, peu compatible'])
    expect(scored.unexplored).toEqual(['début brutal'])
  })

  it('annonce le score encore atteignable', () => {
    const scored = scoreHypothesis(HYPOTHESE_TEST, { 'lombaire.irradiation_jambe': true })
    expect(scored.score).toBe(0)
    expect(scored.potential).toBe(8)
  })

  it('écarte l\'hypothèse quand sa condition d\'entrée est fausse', () => {
    const scored = scoreHypothesis(HYPOTHESE_TEST, {
      'lombaire.irradiation_jambe': false,
      'lombaire.aggrave_assis': true,
    })
    expect(scored.status).toBe('excluded')
    expect(scored.score).toBe(0)
  })

  it('met en attente tant que la condition d\'entrée n\'est pas tranchée', () => {
    expect(scoreHypothesis(HYPOTHESE_TEST, AUCUN).status).toBe('pending')
  })
})

describe('classement du différentiel', () => {
  const forte: HypothesisDefinition = {
    id: 'test.forte',
    label: 'Forte',
    region: 'lombaire',
    kind: 'specific',
    criteria: [{ when: 'lombaire.aggrave_assis', weight: 10, label: 'assis' }],
  }
  const faible: HypothesisDefinition = {
    id: 'test.faible',
    label: 'Faible',
    region: 'lombaire',
    kind: 'exclusion',
    criteria: [{ when: 'lombaire.aggrave_assis', weight: 2, label: 'assis' }],
  }
  const enAttente: HypothesisDefinition = {
    id: 'test.attente',
    label: 'En attente',
    region: 'lombaire',
    kind: 'specific',
    requires: 'lombaire.rythme_inflammatoire',
    criteria: [{ when: 'lombaire.rythme_inflammatoire', weight: 50, label: 'inflammatoire' }],
  }

  it('range les hypothèses retenues avant celles en attente, quel que soit leur potentiel', () => {
    const result = reason({
      signals: { 'lombaire.aggrave_assis': true },
      hypotheses: [faible, enAttente, forte],
    })
    expect(result.hypotheses.map((hypothesis) => hypothesis.id)).toEqual([
      'test.forte',
      'test.faible',
      'test.attente',
    ])
  })

  it('sort les drapeaux rouges du différentiel', () => {
    const drapeau: HypothesisDefinition = {
      id: 'test.drapeau',
      label: 'Drapeau',
      region: 'lombaire',
      kind: 'red-flag',
      requires: 'general.fievre',
      criteria: [{ when: 'general.fievre', weight: 100, label: 'fièvre' }],
    }
    const result = reason({
      signals: { 'general.fievre': true, 'lombaire.aggrave_assis': true },
      hypotheses: [forte, drapeau],
    })
    expect(result.redFlags.map((flag) => flag.id)).toEqual(['test.drapeau'])
    expect(result.hypotheses.map((hypothesis) => hypothesis.id)).toEqual(['test.forte'])
  })

  it('conserve la trace de ce qui a été écarté', () => {
    const result = reason({
      signals: { 'lombaire.rythme_inflammatoire': false },
      hypotheses: [enAttente],
    })
    expect(result.hypotheses).toEqual([])
    expect(result.excluded.map((hypothesis) => hypothesis.id)).toEqual(['test.attente'])
  })
})

describe('prochaines actions', () => {
  const hypotheses: HypothesisDefinition[] = [
    {
      id: 'test.a',
      label: 'A',
      region: 'lombaire',
      kind: 'specific',
      criteria: [
        { when: 'lombaire.centralisation', weight: 20, label: 'centralisation' },
        { when: 'lombaire.aggrave_toux', weight: 1, label: 'toux' },
      ],
      actions: ['action.mckenzie'],
    },
  ]
  const actions: ActionDefinition[] = [
    {
      id: 'action.mckenzie',
      kind: 'test',
      label: 'Mouvements répétés',
      resolves: ['lombaire.centralisation'],
    },
  ]

  it('propose en premier ce qui débloque le plus de poids', () => {
    const result = reason({ signals: {}, hypotheses, actions })
    expect(result.nextActions[0].action.id).toBe('action.mckenzie')
    expect(result.nextActions[0].discriminates).toEqual(['A'])
  })

  it('déduit une question du vocabulaire quand aucun test ne couvre le signal', () => {
    const result = reason({ signals: { 'lombaire.centralisation': true }, hypotheses, actions })
    expect(result.nextActions.map((suggestion) => suggestion.action.id)).toContain(
      'question:lombaire.aggrave_toux',
    )
  })

  it('cesse de proposer ce qui est déjà renseigné', () => {
    const result = reason({
      signals: { 'lombaire.centralisation': true, 'lombaire.aggrave_toux': true },
      hypotheses,
      actions,
    })
    expect(result.nextActions).toEqual([])
  })

  it('s\'en tient au nombre d\'actions demandé', () => {
    const result = reason({ signals: {}, hypotheses, actions, actionLimit: 1 })
    expect(result.nextActions).toHaveLength(1)
  })
})

describe('drapeau rouge levé', () => {
  const drapeau: HypothesisDefinition = {
    id: 'test.drapeau',
    label: 'Drapeau',
    region: 'lombaire',
    kind: 'red-flag',
    requires: 'general.fievre',
    criteria: [{ when: 'general.fievre', weight: 100, label: 'fièvre' }],
    actions: ['action.avis'],
  }
  const banale: HypothesisDefinition = {
    id: 'test.banale',
    label: 'Banale',
    region: 'lombaire',
    kind: 'mechanical',
    criteria: [{ when: 'lombaire.centralisation', weight: 20, label: 'centralisation' }],
    actions: ['action.mckenzie'],
  }
  const actions: ActionDefinition[] = [
    { id: 'action.avis', kind: 'referral', label: 'Avis médical', urgency: 'urgent' },
    {
      id: 'action.mckenzie',
      kind: 'test',
      label: 'Mouvements répétés',
      resolves: ['lombaire.centralisation'],
    },
  ]

  it('propose l\'orientation avant toute question de routine', () => {
    const result = reason({
      signals: { 'general.fievre': true },
      hypotheses: [drapeau, banale],
      actions,
    })
    expect(result.nextActions[0].action.id).toBe('action.avis')
  })

  it('rend sa place au reste quand le drapeau retombe', () => {
    const result = reason({
      signals: { 'general.fievre': false },
      hypotheses: [drapeau, banale],
      actions,
    })
    expect(result.redFlags).toEqual([])
    expect(result.nextActions[0].action.id).toBe('action.mckenzie')
  })
})

describe('hypothèses réellement en lice', () => {
  const sansArgument: HypothesisDefinition = {
    id: 'test.catalogue',
    label: 'Reste du catalogue',
    region: 'lombaire',
    kind: 'specific',
    requires: 'lombaire.rythme_inflammatoire',
    criteria: [{ when: 'lombaire.rythme_inflammatoire', weight: 30, label: 'inflammatoire' }],
  }
  const avecArgument: HypothesisDefinition = {
    id: 'test.piste',
    label: 'Piste',
    region: 'lombaire',
    kind: 'specific',
    requires: 'lombaire.irradiation_jambe',
    criteria: [{ when: 'lombaire.unilateral', weight: 1, label: 'unilatéral' }],
  }

  it('écarte de l\'affichage ce qui n\'a pas le moindre argument', () => {
    const result = reason({
      signals: { 'lombaire.unilateral': true },
      hypotheses: [sansArgument, avecArgument],
    })
    // Les deux sont en attente, mais une seule repose sur quelque chose.
    expect(result.hypotheses).toHaveLength(2)
    expect(activeHypotheses(result).map((hypothesis) => hypothesis.id)).toEqual(['test.piste'])
  })

  it('garde une hypothèse dont la porte d\'entrée est franchie, même sans argument encore coté', () => {
    const result = reason({
      signals: { 'lombaire.irradiation_jambe': true },
      hypotheses: [avecArgument],
    })
    expect(activeHypotheses(result).map((hypothesis) => hypothesis.id)).toEqual(['test.piste'])
  })
})
