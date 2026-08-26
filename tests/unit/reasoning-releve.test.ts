import { describe, it, expect } from 'vitest'
import {
  CERVICAL_ACTIONS,
  CERVICAL_HYPOTHESES,
  LUMBAR_HYPOTHESES,
  LUMBAR_ACTIONS,
  SIGNALS,
  isReasoningSignal,
  signalsOf,
  activeHypotheses,
  applySignal,
  reason,
  scoreHypothesis,
  signalsFromRecord,
  summariseSignals,
  type SignalId,
} from '@/lib/reasoning'

/**
 * Le relevé en cours de dictée.
 *
 * Ces cas viennent d'une consultation réelle : le praticien a dicté « douleur
 * paravertébrale bilatérale diffuse », le relevé l'a bien capté, et le copilote
 * continuait de demander où siégeait la douleur. Le raisonnement était juste ;
 * c'est la boucle entre ce qui est relevé et ce qui est proposé qui ne se
 * refermait pas. Aucun des tests du moteur ne pouvait le voir, parce qu'ils
 * partaient tous de signaux déjà propagés.
 */

/** L'état d'un patient de 29 ans, après la première phrase de l'anamnèse. */
function anamneseDiffuse(): Partial<Record<SignalId, boolean>> {
  let signals = { ...signalsFromRecord(29, 'M') }
  signals = applySignal(signals, 'lombaire.duree_aigue', true)
  signals = applySignal(signals, 'lombaire.irradiation_jambe', false)
  signals = applySignal(signals, 'lombaire.localisation_diffuse', true)
  return signals
}

describe('propagation du relevé', () => {
  it('cesse de demander le siège une fois le siège désigné', () => {
    const result = reason({
      signals: anamneseDiffuse(),
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
      actionLimit: 8,
    })
    expect(result.nextActions.map((s) => s.action.id)).not.toContain('choice:lombaire.localisation')
  })

  it('écarte les autres sièges plutôt que de les laisser en suspens', () => {
    const signals = anamneseDiffuse()
    expect(signals['lombaire.localisation_mediane']).toBe(false)
    expect(signals['lombaire.localisation_paravertebrale']).toBe(false)
    expect(signals['lombaire.localisation_fessiere']).toBe(false)
  })

  it('n\'énumère pas les sièges écartés dans le relevé', () => {
    // Les trois négations sont vraies, mais elles ne disent rien de plus que la
    // réponse elle-même : les afficher noierait les vraies négations, celles
    // que le patient a démenties.
    const absent = summariseSignals(anamneseDiffuse()).absent.map((item) => item.id)
    expect(absent).not.toContain('lombaire.localisation_mediane')
    expect(absent).not.toContain('lombaire.localisation_paravertebrale')
    expect(absent).toContain('lombaire.irradiation_jambe')
  })

  it('referme la branche pédiatrique sur l\'âge du dossier', () => {
    const result = reason({
      signals: anamneseDiffuse(),
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
      actionLimit: 8,
    })
    expect(result.excluded.map((h) => h.id)).toContain('lombaire.spondylolyse')
    expect(result.nextActions.map((s) => s.action.id)).not.toContain('lombaire.test-cigogne')
  })
})

describe('ce que le copilote a à montrer', () => {
  it('affiche le diagnostic résiduel dès qu\'un élément le décrit', () => {
    // Il ne marque aucun point — c'est voulu — mais il repose sur un argument,
    // donc il est une piste. Sans cela le panneau restait vide et donnait à
    // croire que le copilote n'avait rien trouvé.
    const result = reason({
      signals: anamneseDiffuse(),
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
    })
    const affichees = activeHypotheses(result)
    const residuel = affichees.find((h) => h.id === 'lombaire.non-specifique')
    expect(residuel).toBeDefined()
    expect(residuel!.argumentsFor.length).toBeGreaterThan(0)
    expect(residuel!.score).toBe(0)
  })

  it('garde un argument descriptif à zéro point', () => {
    const residuel = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.non-specifique')!
    const scored = scoreHypothesis(residuel, {
      'lombaire.localisation_diffuse': true,
      'lombaire.episodes_anterieurs': true,
      'lombaire.geste_declenchant': true,
    })
    expect(scored.argumentsFor.length).toBe(3)
    expect(scored.score).toBe(0)
  })
})

describe('valeur d\'une action', () => {
  it('ne vaut pas plus parce qu\'elle coche plusieurs cases d\'une même hypothèse', () => {
    // La palpation des épineuses renseigne trois signaux, mais tous les trois
    // ouvrent la même porte : le spondylolisthésis. Les additionner la faisait
    // passer devant la question qui départage trois hypothèses distinctes.
    const result = reason({
      signals: { 'lombaire.irradiation_jambe': false, 'lombaire.rythme_inflammatoire': false },
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
      actionLimit: 8,
    })
    const rang = (id: string) => result.nextActions.findIndex((s) => s.action.id === id)
    const siege = rang('choice:lombaire.localisation')
    const palpation = rang('lombaire.palpation-epineuses')
    expect(siege).toBe(0)
    expect(palpation === -1 || palpation > siege).toBe(true)
  })

  it('vaut en revanche la somme des hypothèses distinctes qu\'elle départage', () => {
    const result = reason({
      signals: { 'lombaire.irradiation_jambe': false, 'lombaire.rythme_inflammatoire': false },
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
      actionLimit: 8,
    })
    const siege = result.nextActions.find((s) => s.action.id === 'choice:lombaire.localisation')!
    // Discogénique, facettaire, sacro-iliaque : une question, trois branches.
    expect(siege.discriminates.length).toBeGreaterThanOrEqual(3)
  })
})

describe('la boucle se referme', () => {
  it('reprend la main à chaque signal relevé', () => {
    // Ce que le praticien constate à l'écran : chaque élément capté retire une
    // question et en fait apparaître une autre. Le test suit la consultation
    // pas à pas.
    const etape = (signals: Partial<Record<SignalId, boolean>>) =>
      reason({ signals, hypotheses: LUMBAR_HYPOTHESES, actions: LUMBAR_ACTIONS, actionLimit: 5 })
        .nextActions.map((s) => s.action.id)

    let signals: Partial<Record<SignalId, boolean>> = signalsFromRecord(29, 'M')
    const depart = etape(signals)
    expect(depart).toContain('choice:lombaire.localisation')

    signals = applySignal(signals, 'lombaire.localisation_diffuse', true)
    const apresSiege = etape(signals)
    expect(apresSiege).not.toContain('choice:lombaire.localisation')
    expect(apresSiege).not.toEqual(depart)

    signals = applySignal(signals, 'lombaire.rythme_inflammatoire', false)
    const apresRythme = etape(signals)
    expect(apresRythme).not.toContain('question:lombaire.rythme_inflammatoire')

    // Tant que l'irradiation n'est pas tranchée, la voie mécanique reste
    // indécise et la hernie garde la tête : le moteur ne conclut pas au
    // résiduel sur une branche qu'il n'a pas fermée.
    expect(
      reason({ signals, hypotheses: LUMBAR_HYPOTHESES }).hypotheses[0].id,
    ).toBe('lombaire.hernie-discale')

    signals = applySignal(signals, 'lombaire.irradiation_jambe', false)

    const result = reason({ signals, hypotheses: LUMBAR_HYPOTHESES, actions: LUMBAR_ACTIONS })
    expect(result.hypotheses[0].id).toBe('lombaire.non-specifique')
    expect(result.hypotheses[0].status).toBe('retained')
  })
})


/**
 * L'anamnèse de la seconde consultation : « une douleur vraiment centrée au
 * milieu de la colonne, ça me fait un point assez précis », puis « ça me
 * descend un petit peu dans la fesse à droite, mais pas plus bas ».
 *
 * Le relevé affichait « douleur très localisée sur les épineuses » et, dans le
 * même différentiel, « absence de douleur lombaire médiane » — deux faits
 * contradictoires, dont le second portait un rapport publié et faisait monter
 * la dysfonction sacro-iliaque en tête.
 *
 * Cause : le vocabulaire n'avait pas de signal pour une irradiation fessière.
 * L'extraction n'avait que le siège fessier, qui appartient au groupe exclusif
 * des sièges de douleur — désigner la fesse chassait donc la ligne médiane.
 */
function anamneseMediane(): Partial<Record<SignalId, boolean>> {
  let signals = { ...signalsFromRecord(29, 'M') }
  signals = applySignal(signals, 'lombaire.duree_aigue', true)
  signals = applySignal(signals, 'general.douleur_mediane_epineuse', true)
  signals = applySignal(signals, 'lombaire.irradiation_fessiere', true)
  signals = applySignal(signals, 'lombaire.irradiation_sous_genou', false)
  return signals
}

describe('cohérence du relevé', () => {
  it('distingue le siège de la douleur de son irradiation', () => {
    const signals = anamneseMediane()
    // La douleur siège au milieu et descend dans la fesse : les deux à la fois,
    // ce qui est le tableau le plus banal de la lombalgie commune.
    expect(signals['lombaire.localisation_mediane']).toBe(true)
    expect(signals['lombaire.irradiation_fessiere']).toBe(true)
    expect(signals['lombaire.localisation_fessiere']).toBe(false)
  })

  it('n\'affirme pas l\'absence d\'un élément que le patient vient de décrire', () => {
    const result = reason({
      signals: anamneseMediane(),
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
    })
    const arguments_ = result.hypotheses.flatMap((h) => h.argumentsFor)
    expect(arguments_.join(' ')).not.toContain('absence de douleur lombaire médiane')
    expect(result.excluded.map((h) => h.id)).toContain('lombaire.sacro-iliaque')
  })

  it('propage la contraposée : ce qui implique un signal faux est faux', () => {
    // Pas d'irradiation dans la jambe, donc pas sous le genou. Sans cela, le
    // relevé peut tenir un fait et son contraire.
    const jambe = applySignal({}, 'lombaire.irradiation_jambe', false)
    expect(jambe['lombaire.irradiation_sous_genou']).toBe(false)

    const mediane = applySignal({}, 'lombaire.localisation_mediane', false)
    expect(mediane['general.douleur_mediane_epineuse']).toBe(false)
  })

  it('fait suivre l\'exclusivité aux implications', () => {
    // Une douleur très localisée sur les épineuses est médiane, donc ni
    // paravertébrale, ni fessière, ni diffuse.
    const signals = applySignal({}, 'general.douleur_mediane_epineuse', true)
    expect(signals['lombaire.localisation_mediane']).toBe(true)
    expect(signals['lombaire.localisation_paravertebrale']).toBe(false)
    expect(signals['lombaire.localisation_diffuse']).toBe(false)
  })

  it('ne produit jamais un relevé contradictoire, quel que soit le signal posé', () => {
    // Balayage complet du vocabulaire : pour chaque signal, dans les deux sens,
    // aucun couple « A vrai et ce que A implique faux » ne doit subsister.
    const incoherences: string[] = []
    for (const id of Object.keys(SIGNALS) as SignalId[]) {
      for (const valeur of [true, false]) {
        const signals = applySignal({}, id, valeur)
        for (const [autre, definition] of Object.entries(SIGNALS)) {
          for (const implique of definition.implies ?? []) {
            const porteur = signals[autre as SignalId]
            const implique_ = signals[implique as SignalId]
            if (porteur === true && implique_ === false) {
              incoherences.push(`${id}=${valeur} → ${autre} vrai mais ${implique} faux`)
            }
          }
        }
      }
    }
    expect(incoherences).toEqual([])
  })
})

describe('vocabulaire sans angle mort', () => {
  it('n\'expose aucun signal de raisonnement qu\'aucune hypothèse n\'exploite', () => {
    // Un signal extractible qu'aucune hypothèse ne lit est pire qu'absent :
    // l'extraction s'en sert, il occupe le relevé, et il ne mène nulle part —
    // ou pire, il se substitue au signal correct, comme le siège fessier l'a
    // fait pour l'irradiation fessière.
    const exploites = new Set<string>()
    for (const hypothesis of [...LUMBAR_HYPOTHESES, ...CERVICAL_HYPOTHESES]) {
      if (hypothesis.requires) for (const s of signalsOf(hypothesis.requires)) exploites.add(s)
      for (const criterion of hypothesis.criteria) {
        for (const s of signalsOf(criterion.when)) exploites.add(s)
      }
    }
    const orphelins = (Object.keys(SIGNALS) as SignalId[]).filter(
      (id) => isReasoningSignal(id) && !exploites.has(id),
    )
    expect(orphelins).toEqual([])
  })

  it('renseigne par une action tout signal d\'examen qui ne se demande pas', () => {
    // Un signal d'examen sans question ni action ne pourrait être posé que par
    // la dictée : le praticien n'aurait aucun moyen de le renseigner lui-même.
    const resolus = new Set<string>()
    for (const action of [...LUMBAR_ACTIONS, ...CERVICAL_ACTIONS]) {
      for (const s of action.resolves ?? []) resolus.add(s)
    }
    const inaccessibles = (Object.entries(SIGNALS) as [SignalId, { group: string; question?: string }][])
      .filter(([id, d]) => d.group === 'examen' && !d.question && !resolus.has(id) && isReasoningSignal(id))
      .map(([id]) => id)
    expect(inaccessibles).toEqual([])
  })
})
