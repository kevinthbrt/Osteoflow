import { describe, it, expect } from 'vitest'
import { LUMBAR_ACTIONS, LUMBAR_HYPOTHESES } from '@/lib/reasoning'
import {
  SIGNALS,
  activeHypotheses,
  applySignal,
  evaluate,
  openSignalsOf,
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

  it('cesse de proposer un test dont le résultat est déjà connu', () => {
    const result = reason({
      signals: { 'lombaire.centralisation': true, 'lombaire.aggrave_toux': true },
      hypotheses,
      actions,
    })
    expect(result.nextActions).toEqual([])
  })

  it('continue de proposer un questionnaire de référence, qui ne sert pas à départager', () => {
    // L'EIFEL ne tranche aucune hypothèse : il documente l'état du patient et
    // sert de point de comparaison à la séance suivante.
    const avecQuestionnaire: HypothesisDefinition[] = [
      { ...hypotheses[0], actions: ['action.mckenzie', 'action.eifel'] },
    ]
    const result = reason({
      signals: { 'lombaire.centralisation': true, 'lombaire.aggrave_toux': true },
      hypotheses: avecQuestionnaire,
      actions: [
        ...actions,
        { id: 'action.eifel', kind: 'questionnaire', label: 'EIFEL', questionnaireId: 'eifel' },
      ],
    })
    expect(result.nextActions.map((suggestion) => suggestion.action.id)).toEqual(['action.eifel'])
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

describe('propagation des implications', () => {
  it('répond du même coup à la question englobante', () => {
    const signals = applySignal({}, 'lombaire.irradiation_sous_genou', true)
    expect(signals['lombaire.irradiation_sous_genou']).toBe(true)
    expect(signals['lombaire.irradiation_jambe']).toBe(true)
  })

  it('ne propage rien sur une réponse négative', () => {
    // « Pas sous le genou » ne dit rien de l'irradiation dans la cuisse.
    const signals = applySignal({}, 'lombaire.irradiation_sous_genou', false)
    expect(signals['lombaire.irradiation_sous_genou']).toBe(false)
    expect(signals['lombaire.irradiation_jambe']).toBeUndefined()
  })

  it('suit une chaîne d\'implications sans se perdre', () => {
    const signals = applySignal({}, 'cervical.wad_grade_3', true)
    expect(signals['cervical.whiplash']).toBe(true)
  })

  it('ne modifie pas le relevé d\'origine', () => {
    const before = { 'general.fievre': false } as const
    const after = applySignal(before, 'lombaire.irradiation_sous_genou', true)
    expect(before).toEqual({ 'general.fievre': false })
    expect(after['general.fievre']).toBe(false)
  })
})

describe('signaux qui s\'excluent', () => {
  it('désigner un siège de douleur écarte les autres', () => {
    const signals = applySignal({}, 'lombaire.localisation_fessiere', true)
    expect(signals['lombaire.localisation_fessiere']).toBe(true)
    expect(signals['lombaire.localisation_mediane']).toBe(false)
    expect(signals['lombaire.localisation_paravertebrale']).toBe(false)
    expect(signals['lombaire.localisation_diffuse']).toBe(false)
  })

  it('ne touche pas aux autres régions', () => {
    const signals = applySignal({}, 'lombaire.localisation_mediane', true)
    expect(signals['cervical.localisation_paravertebrale']).toBeUndefined()
  })

  it('n\'écarte rien sur une réponse négative', () => {
    // « Ce n'est pas médian » ne dit pas où c'est.
    const signals = applySignal({}, 'lombaire.localisation_mediane', false)
    expect(signals['lombaire.localisation_fessiere']).toBeUndefined()
  })

  it('rend la voie mécanique atteignable sans extraction automatique', () => {
    // Un poste sans IA doit pouvoir mener le raisonnement de bout en bout.
    let signals = applySignal({}, 'lombaire.irradiation_jambe', false)
    signals = applySignal(signals, 'lombaire.rythme_inflammatoire', false)
    signals = applySignal(signals, 'lombaire.localisation_fessiere', true)
    const result = reason({ signals, hypotheses: LUMBAR_HYPOTHESES })
    expect(result.hypotheses[0].id).toBe('lombaire.sacro-iliaque')
  })
})

describe('formulation des questions', () => {
  /**
   * Le copilote ne propose que deux boutons, Oui et Non. Une question dont la
   * réponse « oui » ne veut pas dire exactement « ce signal est vrai » produit
   * un relevé faux — ce qui est pire qu'un relevé absent, puisque le
   * raisonnement part alors dans la mauvaise direction.
   */
  const questions = Object.entries(SIGNALS)
    .filter(([, definition]) => definition.question)
    .map(([id, definition]) => ({ id, question: definition.question! }))

  it('couvre une bonne partie du vocabulaire', () => {
    expect(questions.length).toBeGreaterThan(25)
  })

  it('pose une seule question à la fois', () => {
    const doubles = questions.filter(({ question }) => (question.match(/\?/g) ?? []).length !== 1)
    expect(doubles.map((entry) => entry.id)).toEqual([])
  })

  it('termine par un point d\'interrogation', () => {
    const malformées = questions.filter(({ question }) => !question.trim().endsWith('?'))
    expect(malformées.map((entry) => entry.id)).toEqual([])
  })

  it('n\'appelle jamais une réponse ouverte', () => {
    // « Depuis combien de temps… », « Qu'est-ce qui fait le plus mal… » :
    // ces tournures attendent une durée ou un choix, pas un oui.
    const ouvertes = /^(qu'est-ce|que\b|quel|quelle|quels|quelles|combien|depuis combien|comment|où|pourquoi|lequel|laquelle)/i
    const fautives = questions.filter(({ question }) => ouvertes.test(question.trim()))
    expect(fautives.map((entry) => entry.id)).toEqual([])
  })

  it('n\'oppose jamais deux branches dans un choix', () => {
    // « … le dos ou la jambe ? » : « oui » ne désigne aucune des deux.
    const alternative = /\b(?:est-ce|:)\s[^?]*\bou\b[^?]*\?$|\bou (?:la |le |les |l')?(?:douleur|jambe|bras|dos|cou)\s*\?$/i
    const fautives = questions.filter(({ question }) => alternative.test(question.trim()))
    expect(fautives.map((entry) => entry.id)).toEqual([])
  })
})

describe('questions à choix', () => {
  const mecanique: HypothesisDefinition = {
    id: 'test.mecanique',
    label: 'Mécanique',
    region: 'lombaire',
    kind: 'mechanical',
    criteria: [
      { when: 'lombaire.localisation_fessiere', weight: 20, label: 'douleur fessière' },
      { when: 'lombaire.localisation_mediane', weight: 20, label: 'douleur médiane' },
    ],
  }

  it('pose une seule question pour un groupe qui s\'exclut', () => {
    const result = reason({ signals: {}, hypotheses: [mecanique], actionLimit: 5 })
    const choix = result.nextActions.filter((suggestion) => suggestion.action.kind === 'choice')
    expect(choix).toHaveLength(1)
    expect(choix[0].action.label).toBe('Où siège la douleur ?')
    expect(choix[0].action.options?.map((option) => option.label)).toEqual([
      'Médiane',
      'Paravertébrale',
      'Fessière',
      'Diffuse',
    ])
  })

  it('ne pose plus de question oui/non pour ces signaux', () => {
    const result = reason({ signals: {}, hypotheses: [mecanique], actionLimit: 5 })
    const binaires = result.nextActions.filter((suggestion) =>
      suggestion.action.id.startsWith('question:lombaire.localisation'),
    )
    expect(binaires).toEqual([])
  })

  it('disparaît une fois le siège désigné', () => {
    const signals = applySignal({}, 'lombaire.localisation_fessiere', true)
    const result = reason({ signals, hypotheses: [mecanique], actionLimit: 5 })
    expect(result.nextActions.filter((suggestion) => suggestion.action.kind === 'choice')).toEqual([])
  })
})

describe('signaux encore utiles', () => {
  it('ignore une branche déjà tranchée', () => {
    // `all(not(A), B)` : une fois A faux, la négation est acquise et seul B
    // reste à chercher.
    const expr: SignalExpr = {
      all: [
        { not: { all: ['lombaire.irradiation_jambe', 'lombaire.irradiation_sous_genou'] } },
        'lombaire.centralisation',
      ],
    }
    expect(openSignalsOf(expr, { 'lombaire.irradiation_jambe': false })).toEqual([
      'lombaire.centralisation',
    ])
  })

  it('les réclame tous tant que rien n\'est tranché', () => {
    const expr: SignalExpr = { all: ['lombaire.irradiation_jambe', 'lombaire.centralisation'] }
    expect(openSignalsOf(expr, {}).sort()).toEqual([
      'lombaire.centralisation',
      'lombaire.irradiation_jambe',
    ])
  })

  it('ne réclame plus rien d\'une expression décidée', () => {
    const expr: SignalExpr = { any: ['lombaire.irradiation_jambe', 'lombaire.centralisation'] }
    expect(openSignalsOf(expr, { 'lombaire.irradiation_jambe': true })).toEqual([])
  })

  it('ne propose plus le trajet de la douleur quand l\'irradiation est écartée', () => {
    let signals = applySignal({}, 'lombaire.irradiation_jambe', false)
    signals = applySignal(signals, 'lombaire.rythme_inflammatoire', false)
    const result = reason({
      signals,
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
      actionLimit: 8,
    })
    const proposés = result.nextActions.map((suggestion) => suggestion.action.id)
    expect(proposés).not.toContain('question:lombaire.irradiation_sous_genou')
    expect(proposés).not.toContain('question:lombaire.jambe_plus_douloureuse')
    // À la place, la question qui fait réellement avancer : le siège.
    expect(proposés[0]).toBe('choice:lombaire.localisation')
  })
})

describe('ordre de la consultation', () => {
  it('demande avant d\'examiner, à poids égal', () => {
    // Le Lasègue et la question renseignent le même signe : on commence par
    // demander.
    const result = reason({
      signals: {},
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
      actionLimit: 6,
    })
    const kinds = result.nextActions.map((suggestion) => suggestion.action.kind)
    const premierTest = kinds.indexOf('test')
    const dernièreQuestion = Math.max(kinds.lastIndexOf('question'), kinds.lastIndexOf('choice'))
    if (premierTest !== -1 && dernièreQuestion !== -1) {
      expect(premierTest).toBeGreaterThan(dernièreQuestion)
    }
    expect(['question', 'choice']).toContain(kinds[0])
  })

  it('laisse passer devant une orientation urgente', () => {
    const signals = { 'lombaire.queue_de_cheval': true }
    const result = reason({ signals, hypotheses: LUMBAR_HYPOTHESES, actions: LUMBAR_ACTIONS })
    expect(result.nextActions[0].action.id).toBe('lombaire.urgence-neurochirurgicale')
  })
})

describe('ce qui a déjà été fait', () => {
  it('ne repropose pas un questionnaire déjà rempli', () => {
    const signals = { 'lombaire.irradiation_jambe': false, 'lombaire.rythme_inflammatoire': false }
    const avant = reason({ signals, hypotheses: LUMBAR_HYPOTHESES, actions: LUMBAR_ACTIONS, actionLimit: 8 })
    expect(avant.nextActions.map((s) => s.action.id)).toContain('lombaire.start-back')

    const après = reason({
      signals,
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
      done: ['lombaire.start-back'],
      actionLimit: 8,
    })
    expect(après.nextActions.map((s) => s.action.id)).not.toContain('lombaire.start-back')
  })
})
