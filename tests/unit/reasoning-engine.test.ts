import { describe, it, expect } from 'vitest'
import {
  CERVICAL_ACTIONS,
  CERVICAL_HYPOTHESES,
  LUMBAR_ACTIONS,
  LUMBAR_HYPOTHESES,
} from '@/lib/reasoning'
import {
  SIGNALS,
  activeHypotheses,
  applySignal,
  evaluate,
  isReasoningSignal,
  negativeLabel,
  openSignalsOf,
  reason,
  scoreHypothesis,
  signalsFromRecord,
  summariseSignals,
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

describe('mise en forme du relevé', () => {
  it('sépare ce qui est relevé de ce qui est écarté', () => {
    const summary = summariseSignals({
      'lombaire.irradiation_sous_genou': true,
      'lombaire.debut_brutal': true,
      'general.fievre': false,
      'terrain.antecedent_cancer': false,
    })
    expect(summary.present.map((entry) => entry.label)).toEqual(['Topographie', 'Douleur'])
    expect(summary.present[0].items.map((item) => item.label)).toEqual(['irradiation sous le genou'])
    expect(summary.absent.map((item) => item.label)).toEqual([
      'pas de fièvre',
      'pas d\'antécédent de cancer',
    ])
  })

  it('ignore ce qui n\'a pas été exploré', () => {
    const summary = summariseSignals({ 'general.fievre': undefined })
    expect(summary.present).toEqual([])
    expect(summary.absent).toEqual([])
  })
})

describe('ce que le dossier sait déjà', () => {
  it('déduit les tranches d\'âge de la date de naissance', () => {
    expect(signalsFromRecord(35, 'F')).toEqual({
      'terrain.age_moins_60': true,
      'terrain.age_plus_65': false,
      'terrain.age_plus_70': false,
      'terrain.sexe_feminin': true,
    })
    expect(signalsFromRecord(30, 'F', '2099-01-01')['terrain.grossesse']).toBe(true)
    expect(signalsFromRecord(30, 'F', '2000-01-01')['terrain.grossesse']).toBe(false)
    expect(signalsFromRecord(72, 'M')).toEqual({
      'terrain.age_moins_60': false,
      'terrain.age_plus_65': true,
      'terrain.age_plus_70': true,
      'terrain.sexe_feminin': false,
    })
  })

  it('ne demande plus l\'âge une fois le dossier lu', () => {
    const result = reason({
      signals: signalsFromRecord(35, 'F'),
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
      actionLimit: 8,
    })
    const questions = result.nextActions.map((suggestion) => suggestion.action.id)
    expect(questions.filter((id) => id.includes('age_'))).toEqual([])
  })
})

describe('ce qu\'un test renseigne', () => {
  /**
   * Un test mesure ce qu'il mesure. Le câbler sur un élément d'anamnèse — le
   * Lasègue sur « la jambe fait plus mal que le dos », le Spurling sur la même
   * chose — fait enregistrer comme déclaré par le patient ce qui vient de
   * l'examen, et fait disparaître la question qu'il aurait fallu poser.
   */
  it('ne renseigne jamais un élément qui se demande au patient', () => {
    const fautifs: string[] = []
    for (const action of [...LUMBAR_ACTIONS, ...CERVICAL_ACTIONS]) {
      if (action.kind !== 'test') continue
      for (const signal of action.resolves ?? []) {
        if (SIGNALS[signal]?.question) fautifs.push(`${action.id} → ${signal}`)
      }
    }
    expect(fautifs).toEqual([])
  })

  it('renseigne un signal d\'examen quand il en renseigne un', () => {
    for (const action of [...LUMBAR_ACTIONS, ...CERVICAL_ACTIONS]) {
      if (action.kind !== 'test') continue
      for (const signal of action.resolves ?? []) {
        expect(['examen', 'neurologique'], `${action.id} → ${signal}`).toContain(
          SIGNALS[signal]?.group,
        )
      }
    }
  })
})

describe('règles fondées sur la littérature', () => {
  it('fait monter la radiculopathie cervicale avec le cluster de Wainner', () => {
    const base = { 'cervical.irradiation_bras': true, 'cervical.bras_plus_douloureux': true }
    const score = (signals: Record<string, boolean>) =>
      reason({ signals, hypotheses: CERVICAL_HYPOTHESES }).hypotheses.find(
        (h) => h.id === 'cervical.radiculopathie',
      )!.score

    const aucun = score({
      ...base,
      'cervical.spurling_positif': false,
      'cervical.distraction_positif': false,
      'cervical.ulnt_positif': false,
      'cervical.rotation_limitee_60': false,
    })
    const trois = score({
      ...base,
      'cervical.spurling_positif': true,
      'cervical.distraction_positif': true,
      'cervical.ulnt_positif': true,
      'cervical.rotation_limitee_60': false,
    })
    const quatre = score({
      ...base,
      'cervical.spurling_positif': true,
      'cervical.distraction_positif': true,
      'cervical.ulnt_positif': true,
      'cervical.rotation_limitee_60': true,
    })
    expect(aucun).toBeLessThan(trois)
    expect(trois).toBeLessThan(quatre)
  })

  it('ne compte pas deux fois le cluster complet', () => {
    // Le critère « trois sur quatre » exclut le cas où les quatre sont là.
    const quatre = reason({
      signals: {
        'cervical.irradiation_bras': true,
        'cervical.bras_plus_douloureux': true,
        'cervical.spurling_positif': true,
        'cervical.distraction_positif': true,
        'cervical.ulnt_positif': true,
        'cervical.rotation_limitee_60': true,
      },
      hypotheses: CERVICAL_HYPOTHESES,
    }).hypotheses.find((h) => h.id === 'cervical.radiculopathie')!
    expect(quatre.argumentsFor.filter((a) => a.includes('Wainner'))).toHaveLength(1)
  })

  it('lève le drapeau fracture sur une contusion en regard du rachis', () => {
    const result = reason({
      signals: { 'general.contusion_abrasion': true },
      hypotheses: LUMBAR_HYPOTHESES,
    })
    expect(result.redFlags.map((f) => f.id)).toContain('lombaire.fracture')
  })

  it('lève le drapeau fracture sur trois des quatre facteurs de Downie', () => {
    const result = reason({
      signals: {
        'terrain.sexe_feminin': true,
        'terrain.age_plus_70': true,
        'terrain.corticotherapie': true,
        'general.traumatisme_recent': false,
        'general.contusion_abrasion': false,
      },
      hypotheses: LUMBAR_HYPOTHESES,
    })
    const fracture = result.redFlags.find((f) => f.id === 'lombaire.fracture')
    expect(fracture).toBeDefined()
    expect(fracture!.argumentsFor.some((a) => a.includes('Downie'))).toBe(true)
  })

  it('fait baisser la hernie discale sur un Lasègue négatif', () => {
    const base = {
      'lombaire.irradiation_jambe': true,
      'lombaire.irradiation_sous_genou': true,
      'lombaire.jambe_plus_douloureuse': true,
      'terrain.age_moins_60': true,
      'lombaire.unilateral': true,
      'lombaire.aggrave_assis': true,
    }
    const score = (signals: Record<string, boolean>) =>
      reason({ signals, hypotheses: LUMBAR_HYPOTHESES }).hypotheses.find(
        (h) => h.id === 'lombaire.hernie-discale',
      )!.score
    expect(score({ ...base, 'lombaire.lasegue_positif': false })).toBeLessThan(
      score({ ...base, 'lombaire.lasegue_positif': true }),
    )
  })
})

describe('formulation de ce qui est écarté', () => {
  it('énonce la négation, pas le libellé affirmatif', () => {
    const summary = summariseSignals({ 'general.fievre': false, 'lombaire.irradiation_jambe': false })
    expect(summary.absent.map((item) => item.label)).toEqual([
      'pas de fièvre',
      'pas d\'irradiation dans la jambe',
    ])
  })

  it('utilise la formulation propre du signal quand la négation dit autre chose', () => {
    // Le patient a dit que les antalgiques le soulagent : c'est cela qu'il faut
    // lire, pas l'absence de « douleur persistante malgré le traitement ».
    expect(negativeLabel('general.douleur_persistante_traitement')).toBe(
      'soulagé par le traitement antalgique',
    )
    expect(negativeLabel('lombaire.lasegue_positif')).toBe('Lasègue négatif')
    expect(negativeLabel('terrain.sexe_feminin')).toBe('sexe masculin')
  })

  it('élide correctement devant une voyelle', () => {
    expect(negativeLabel('general.contusion_abrasion')).toBe(
      'pas de contusion ou abrasion cutanée en regard du rachis',
    )
    expect(negativeLabel('lombaire.unilateral')).toBe('pas d\'atteinte unilatérale')
  })
})

describe('drapeaux jaunes relevés à l\'interrogatoire', () => {
  it('pèsent à partir de deux éléments, pas d\'un seul', () => {
    // Ils pèsent désormais sur la stratification pronostique, tenue à part du
    // différentiel : un risque de chronicisation élevé oriente la prise en
    // charge sans rien dire de la nature de la lésion.
    const score = (signals: Record<string, boolean>) =>
      reason({ signals, hypotheses: LUMBAR_HYPOTHESES }).profiles.find(
        (h) => h.id === 'lombaire.chronicisation',
      )!.score
    const base = { 'lombaire.irradiation_jambe': false, 'lombaire.rythme_inflammatoire': false }
    const aucun = score({ ...base })
    const un = score({ ...base, 'psychosocial.peur_mouvement': true })
    const deux = score({
      ...base,
      'psychosocial.peur_mouvement': true,
      'psychosocial.stress_anxiete': true,
    })
    expect(un).toBe(aucun)
    expect(deux).toBeGreaterThan(aucun)
  })
})

describe('rôle des signaux', () => {
  it('distingue ce qui sert au raisonnement de ce qui sert au compte rendu', () => {
    expect(isReasoningSignal('lombaire.irradiation_sous_genou')).toBe(true)
    expect(isReasoningSignal('facteur.soulage_chaleur')).toBe(false)
    expect(isReasoningSignal('contexte.travail_ecran')).toBe(false)
  })

  it('garde une question pour tout signal qui se demande au patient', () => {
    // Un signal de compte rendu sans question ne serait jamais renseigné
    // autrement que par la dictée : c'est acceptable, mais pas silencieusement.
    const sansQuestion = Object.entries(SIGNALS)
      .filter(([, d]) => d.role === 'compte-rendu' && !d.question)
      .map(([id]) => id)
    expect(sansQuestion).toEqual(['terrain.grossesse'])
  })
})

describe('rapports de vraisemblance', () => {
  /**
   * La règle qui garde le vocabulaire honnête : un chiffre sans référence est
   * une intuition déguisée. Le test la fait respecter mécaniquement.
   */
  it('exige une source pour chaque valeur publiée', () => {
    const sansSource: string[] = []
    for (const hypothesis of [...LUMBAR_HYPOTHESES, ...CERVICAL_HYPOTHESES]) {
      for (const criterion of hypothesis.criteria) {
        if (criterion.lr && !criterion.lr.source.trim()) {
          sansSource.push(`${hypothesis.id} — ${criterion.label}`)
        }
      }
      if (hypothesis.prior && !hypothesis.prior.source.trim()) {
        sansSource.push(`${hypothesis.id} — prévalence`)
      }
    }
    expect(sansSource).toEqual([])
  })

  it('donne à chaque critère un poids ou un rapport, jamais les deux ni aucun', () => {
    // Une exception, et une seule : le diagnostic d'exclusion ne se score pas.
    // Ses critères décrivent le tableau sans l'établir, donc ils ne portent ni
    // poids ni rapport — leur en donner reviendrait à le faire concourir.
    const mal: string[] = []
    for (const hypothesis of [...LUMBAR_HYPOTHESES, ...CERVICAL_HYPOTHESES]) {
      for (const criterion of hypothesis.criteria) {
        const aPoids = criterion.weight !== undefined
        const aRapport = criterion.lr !== undefined
        if (hypothesis.kind === 'exclusion') {
          if (aPoids || aRapport) mal.push(`${hypothesis.id} — ${criterion.label} (scoré)`)
          continue
        }
        if (aPoids === aRapport) mal.push(`${hypothesis.id} — ${criterion.label}`)
      }
    }
    expect(mal).toEqual([])
  })

  it('fait peser un critère faux quand le rapport négatif est connu', () => {
    const score = (signals: Record<string, boolean>) =>
      reason({ signals, hypotheses: LUMBAR_HYPOTHESES }).hypotheses.find(
        (h) => h.id === 'lombaire.hernie-discale',
      )!.score
    const base = {
      'lombaire.irradiation_jambe': true,
      'lombaire.irradiation_sous_genou': true,
      'lombaire.jambe_plus_douloureuse': true,
    }
    // Lasègue : LR− 0,29, donc un négatif retire des points ; LR+ 1,28, donc un
    // positif n'en apporte presque aucun. C'est exactement ce que dit l'étude.
    const negatif = score({ ...base, 'lombaire.lasegue_positif': false })
    const inconnu = score({ ...base })
    const positif = score({ ...base, 'lombaire.lasegue_positif': true })
    expect(negatif).toBeLessThan(inconnu)
    expect(positif - inconnu).toBeLessThan(inconnu - negatif)
  })

  it('classe le cluster de Wainner selon son rapport, pas selon un poids choisi', () => {
    const radiculo = (signals: Record<string, boolean>) =>
      reason({ signals, hypotheses: CERVICAL_HYPOTHESES }).hypotheses.find(
        (h) => h.id === 'cervical.radiculopathie',
      )!.score
    const base = { 'cervical.irradiation_bras': true, 'cervical.bras_plus_douloureux': true }
    const cluster = {
      'cervical.spurling_positif': true,
      'cervical.distraction_positif': true,
      'cervical.ulnt_positif': true,
    }
    const trois = radiculo({ ...base, ...cluster, 'cervical.rotation_limitee_60': false })
    const quatre = radiculo({ ...base, ...cluster, 'cervical.rotation_limitee_60': true })
    // LR+ 6,1 contre 30,3 : l'écart doit se retrouver dans le score.
    expect(quatre - trois).toBeGreaterThan(5)
  })
})
