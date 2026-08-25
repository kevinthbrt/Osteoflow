import { describe, it, expect } from 'vitest'
import {
  CLINICAL_QUESTIONNAIRES,
  formatQuestionnaireResult,
  getQuestionnaire,
  isScorable,
  searchQuestionnaires,
  type ClinicalQuestionnaire,
  type QuestionnaireAnswers,
} from '@/lib/consultations/questionnaires'
import { signalsFromQuestionnaire } from '@/lib/reasoning'

/** Coche la même valeur sur tous les items, pour les bornes du score. */
function answerAll(questionnaire: ClinicalQuestionnaire, pick: 'min' | 'max'): QuestionnaireAnswers {
  const answers: QuestionnaireAnswers = {}
  for (const item of questionnaire.items) {
    const values = item.options.map((option) => option.value)
    answers[item.id] = pick === 'min' ? Math.min(...values) : Math.max(...values)
  }
  return answers
}

function requireQuestionnaire(id: string): ClinicalQuestionnaire {
  const questionnaire = getQuestionnaire(id)
  if (!questionnaire) throw new Error(`Questionnaire introuvable : ${id}`)
  return questionnaire
}

describe('catalogue', () => {
  it('n\'a pas d\'identifiant en double', () => {
    const ids = CLINICAL_QUESTIONNAIRES.map((questionnaire) => questionnaire.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('donne à chaque item des options et un identifiant unique dans son questionnaire', () => {
    for (const questionnaire of CLINICAL_QUESTIONNAIRES) {
      const ids = questionnaire.items.map((item) => item.id)
      expect(new Set(ids).size, questionnaire.id).toBe(ids.length)
      for (const item of questionnaire.items) {
        expect(item.options.length, `${questionnaire.id}/${item.id}`).toBeGreaterThan(1)
      }
    }
  })

  it('cote sans exception aux deux bornes de chaque échelle', () => {
    for (const questionnaire of CLINICAL_QUESTIONNAIRES) {
      for (const pick of ['min', 'max'] as const) {
        const answers = answerAll(questionnaire, pick)
        expect(isScorable(questionnaire, answers), questionnaire.id).toBe(true)
        const result = questionnaire.score(answers)
        expect(result.headline, questionnaire.id).toBeTruthy()
        expect(result.interpretation, questionnaire.id).toBeTruthy()
      }
    }
  })
})

describe('recherche', () => {
  it('retrouve un outil par son sigle', () => {
    expect(searchQuestionnaires('dn4').map((q) => q.id)).toEqual(['dn4'])
  })

  it('ignore les accents et la casse', () => {
    expect(searchQuestionnaires('EPWORTH').map((q) => q.id)).toContain('epworth')
  })

  it('exige que tous les termes soient présents', () => {
    expect(searchQuestionnaires('lombalgie chronicisation').map((q) => q.id)).toEqual(['start-back'])
  })

  it('respecte le filtre par catégorie', () => {
    const ids = searchQuestionnaires('', 'sommeil').map((q) => q.id)
    expect(ids).toEqual(['isi', 'epworth'])
  })
})

describe('DN4', () => {
  const dn4 = requireQuestionnaire('dn4')

  it('reste négatif à 3 items positifs', () => {
    const answers: QuestionnaireAnswers = { ...answerAll(dn4, 'min'), brulure: 1, decharges: 1, picotements: 1 }
    const result = dn4.score(answers)
    expect(result.headline).toBe('3/10')
    expect(result.level).toBe('low')
    expect(result.interpretation).toContain('peu probable')
  })

  it('bascule au seuil de 4 items positifs', () => {
    const answers: QuestionnaireAnswers = {
      ...answerAll(dn4, 'min'),
      brulure: 1,
      decharges: 1,
      picotements: 1,
      frottement: 1,
    }
    const result = dn4.score(answers)
    expect(result.headline).toBe('4/10')
    expect(result.level).toBe('high')
    expect(result.interpretation).toContain('probable')
    expect(result.details?.[0].value).toContain('brûlure')
  })
})

describe('Oswestry', () => {
  const odi = requireQuestionnaire('odi')

  it('rapporte le score aux seules sections renseignées', () => {
    // Neuf sections cotées à 2 sur 5 : 18/45, soit 40 %.
    const answers: QuestionnaireAnswers = {}
    for (const item of odi.items) answers[item.id] = 2
    answers.sexualite = undefined
    const result = odi.score(answers)
    expect(result.headline).toBe('40 %')
    expect(result.details).toContainEqual({ label: 'Sections cotées', value: '9/10' })
  })

  it('accepte neuf sections mais pas huit', () => {
    const answers: QuestionnaireAnswers = {}
    for (const item of odi.items) answers[item.id] = 1
    answers.sexualite = undefined
    expect(isScorable(odi, answers)).toBe(true)
    answers.social = undefined
    expect(isScorable(odi, answers)).toBe(false)
  })
})

describe('STarT Back', () => {
  const startBack = requireQuestionnaire('start-back')

  it('classe en risque faible en dessous de 4 points', () => {
    const answers: QuestionnaireAnswers = { ...answerAll(startBack, 'min'), q1: 1, q2: 1, q3: 1 }
    expect(startBack.score(answers).headline).toBe('Risque faible')
  })

  it('classe en risque moyen quand le retentissement est surtout physique', () => {
    const answers: QuestionnaireAnswers = { ...answerAll(startBack, 'min'), q1: 1, q2: 1, q3: 1, q4: 1 }
    const result = startBack.score(answers)
    expect(result.headline).toBe('Risque moyen')
    expect(result.details).toContainEqual({ label: 'Sous-score psychosocial', value: '0/5' })
  })

  it('classe en risque élevé au-delà de 3 points psychosociaux', () => {
    const answers: QuestionnaireAnswers = {
      ...answerAll(startBack, 'min'),
      q5: 1,
      q6: 1,
      q7: 1,
      q8: 1,
    }
    expect(startBack.score(answers).headline).toBe('Risque élevé')
  })

  it('ne compte le dernier item que pour les gênes les plus fortes', () => {
    const modere: QuestionnaireAnswers = { ...answerAll(startBack, 'min'), q9: 0 }
    const extreme: QuestionnaireAnswers = { ...answerAll(startBack, 'min'), q9: 1 }
    expect(startBack.score(modere).details?.[0].value).toBe('0/9')
    expect(startBack.score(extreme).details?.[0].value).toBe('1/9')
  })
})

describe('QuickDASH', () => {
  const quickDash = requireQuestionnaire('quick-dash')

  it('vaut 0 sans aucune gêne et 100 à la cotation maximale', () => {
    expect(quickDash.score(answerAll(quickDash, 'min')).headline).toBe('0/100')
    expect(quickDash.score(answerAll(quickDash, 'max')).headline).toBe('100/100')
  })

  it('tolère un item non renseigné mais pas deux', () => {
    const answers = answerAll(quickDash, 'min')
    answers.sommeil = undefined
    expect(isScorable(quickDash, answers)).toBe(true)
    answers.picotements = undefined
    expect(isScorable(quickDash, answers)).toBe(false)
  })
})

describe('règles de décision', () => {
  it('impose l\'imagerie cervicale devant un facteur de haut risque', () => {
    const cSpine = requireQuestionnaire('canadian-c-spine')
    const answers: QuestionnaireAnswers = { ...answerAll(cSpine, 'min'), paresthesies: 1, assis: 1, rotation: 1 }
    expect(cSpine.score(answers).headline).toBe('Imagerie indiquée')
  })

  it('écarte l\'imagerie cervicale quand les trois étapes sont franchies', () => {
    const cSpine = requireQuestionnaire('canadian-c-spine')
    const answers: QuestionnaireAnswers = { ...answerAll(cSpine, 'min'), ambulatoire: 1, rotation: 1 }
    expect(cSpine.score(answers).headline).toBe('Imagerie non indiquée')
  })

  it('n\'indique la radiographie de cheville que si la zone douloureuse concorde', () => {
    const ottawa = requireQuestionnaire('ottawa-cheville')
    const horsZone: QuestionnaireAnswers = { ...answerAll(ottawa, 'min'), 'malleole-externe': 1 }
    expect(ottawa.score(horsZone).headline).toBe('Radiographie non indiquée')

    const dansZone: QuestionnaireAnswers = { ...horsZone, 'zone-malleolaire': 1 }
    expect(ottawa.score(dansZone).headline).toBe('Radiographie indiquée (cheville)')
  })

  it('distingue une orientation urgente d\'un simple drapeau rouge', () => {
    const flags = requireQuestionnaire('drapeaux-rouges-lombaires')
    expect(flags.score(answerAll(flags, 'min')).headline).toBe('Aucun drapeau rouge')

    const cancer: QuestionnaireAnswers = { ...answerAll(flags, 'min'), cancer: 1 }
    expect(flags.score(cancer).headline).toBe('1 drapeau rouge')
    expect(flags.score(cancer).level).toBe('high')

    const queueDeCheval: QuestionnaireAnswers = { ...cancer, 'cauda-equina': 1 }
    expect(flags.score(queueDeCheval).headline).toBe('Orientation urgente')
    expect(flags.score(queueDeCheval).level).toBe('critical')
  })
})

describe('HADS', () => {
  it('lit les deux sous-échelles séparément', () => {
    const hads = requireQuestionnaire('hads')
    const answers: QuestionnaireAnswers = { ...answerAll(hads, 'min') }
    for (const id of ['a1', 'a3', 'a5', 'a7']) answers[id] = 3
    const result = hads.score(answers)
    expect(result.headline).toBe('A 12/21 · D 0/21')
    expect(result.level).toBe('high')
    expect(result.details?.[1].value).toBe('0/21 — absence de symptomatologie')
  })
})

describe('formatQuestionnaireResult', () => {
  const dn4 = requireQuestionnaire('dn4')
  const answers: QuestionnaireAnswers = {
    ...answerAll(dn4, 'min'),
    brulure: 1,
    decharges: 1,
    picotements: 1,
    frottement: 1,
  }

  it('rend un bloc titré, coté et sourcé', () => {
    const text = formatQuestionnaireResult(dn4, answers)
    const lines = text.split('\n')
    expect(lines[0]).toBe('=== DN4 — Douleur neuropathique en 4 questions ===')
    expect(lines[1]).toBe('Score : 4/10')
    expect(lines.at(-1)).toContain('Source :')
    expect(text).not.toContain('Détail des réponses')
  })

  it('ajoute le détail item par item à la demande', () => {
    const text = formatQuestionnaireResult(dn4, answers, { detailed: true })
    expect(text).toContain('Détail des réponses :')
    expect(text).toContain('  - Brûlure : Oui')
    expect(text).toContain('  - Picotements : Oui')
    expect(text).toContain('  - Engourdissement : Non')
  })

  it('ne rend rien tant que le questionnaire n\'est pas cotable', () => {
    expect(formatQuestionnaireResult(dn4, { brulure: 1 })).toBe('')
  })
})

describe('retour des questionnaires vers le raisonnement', () => {
  const startBack = requireQuestionnaire('start-back')

  function scoreWith(overrides: QuestionnaireAnswers) {
    const answers: QuestionnaireAnswers = {}
    for (const item of startBack.items) answers[item.id] = 0
    return startBack.score({ ...answers, ...overrides })
  }

  it('traduit un risque faible en absence de facteur psychosocial', () => {
    expect(signalsFromQuestionnaire('start-back', scoreWith({}))).toEqual({
      'psychosocial.risque_chronicisation': false,
      'psychosocial.drapeaux_jaunes_2plus': false,
    })
  })

  it('distingue le risque moyen du risque élevé', () => {
    const moyen = scoreWith({ q1: 1, q2: 1, q3: 1, q4: 1 })
    expect(signalsFromQuestionnaire('start-back', moyen)).toEqual({
      'psychosocial.risque_chronicisation': true,
      'psychosocial.drapeaux_jaunes_2plus': false,
    })

    const eleve = scoreWith({ q5: 1, q6: 1, q7: 1, q8: 1 })
    expect(signalsFromQuestionnaire('start-back', eleve)).toEqual({
      'psychosocial.risque_chronicisation': true,
      'psychosocial.drapeaux_jaunes_2plus': true,
    })
  })

  it('ne traduit rien quand la correspondance n\'est pas celle de l\'échelle', () => {
    const dn4 = requireQuestionnaire('dn4')
    const answers: QuestionnaireAnswers = {}
    for (const item of dn4.items) answers[item.id] = 1
    expect(signalsFromQuestionnaire('dn4', dn4.score(answers))).toEqual({})
  })
})
