import { describe, it, expect } from 'vitest'
import {
  LUMBAR_HYPOTHESES,
  LUMBAR_ACTIONS,
  CERVICAL_HYPOTHESES,
  SOURCES,
  sourcesNonVerifiees,
  reason,
  scoreHypothesis,
  type Criterion,
  type HypothesisDefinition,
  type SourceEntry,
} from '@/lib/reasoning'

const TOUTES = [...LUMBAR_HYPOTHESES, ...CERVICAL_HYPOTHESES]

function tousLesCriteres(): { hypothesis: HypothesisDefinition; criterion: Criterion }[] {
  return TOUTES.flatMap((hypothesis) =>
    hypothesis.criteria.map((criterion) => ({ hypothesis, criterion })),
  )
}

/**
 * Les règles du document de référence, transformées en garde-fous exécutables.
 *
 * Ce fichier ne vérifie pas que le moteur donne la bonne réponse — les tests de
 * non-régression s'en chargent. Il vérifie que la base de connaissance et le
 * calcul respectent les règles méthodologiques qui rendent cette réponse
 * défendable. Une valeur mal sourcée, un rapport non informatif, un drapeau
 * rouge qui rassure : ce sont ces fautes-là qui ne se voient pas à l'usage.
 */
describe('traçabilité des valeurs', () => {
  it('résout chaque source citée dans la bibliographie', () => {
    const orphelines: string[] = []
    for (const { hypothesis, criterion } of tousLesCriteres()) {
      for (const clef of [criterion.lr?.source, criterion.source]) {
        if (clef && !(clef in SOURCES)) orphelines.push(`${hypothesis.id} — ${clef}`)
      }
    }
    for (const hypothesis of TOUTES) {
      if (hypothesis.prior && !(hypothesis.prior.source in SOURCES)) {
        orphelines.push(`${hypothesis.id} — prévalence ${hypothesis.prior.source}`)
      }
    }
    expect(orphelines).toEqual([])
  })

  it('donne une citation complète à chaque entrée de la bibliographie', () => {
    const incompletes = Object.entries(SOURCES)
      .filter(([, entree]) => entree.citation.trim().length < 20)
      .map(([clef]) => clef)
    expect(incompletes).toEqual([])
  })

  it('déclare explicitement les sources dont la publication primaire reste à consulter', () => {
    // Le test ne juge pas leur nombre : il exige qu'elles soient nommées. Une
    // valeur reprise d'un document de synthèse sans avoir été remontée à sa
    // publication est utilisable, mais elle ne doit pas passer pour vérifiée.
    const aVerifier = sourcesNonVerifiees()
    for (const clef of aVerifier) {
      expect(SOURCES[clef].verification).toBe('document')
    }
    expect(aVerifier.length).toBeGreaterThan(0)
  })

  it('explique chaque attribution corrigée', () => {
    // Le document de référence attribue deux valeurs à la mauvaise publication.
    // La correction est portée par la bibliographie, et elle doit dire laquelle.
    const corrigees = (Object.entries(SOURCES) as [string, SourceEntry][]).filter(
      ([, entree]) => entree.verification === 'corrigee',
    )
    expect(corrigees.length).toBeGreaterThan(0)
    for (const [clef, entree] of corrigees) {
      expect(entree.note, clef).toBeTruthy()
    }
  })
})

/**
 * Le squelette structurel hérité de l'arbre décisionnel, et lui seul.
 *
 * Ces onze poids ne sont pas des mesures : ce sont les priorités cliniques que
 * l'arbre encodait, conservées parce qu'aucune publication ne couvre ces
 * profils composites et parce que le test de non-régression les vérifie. La
 * liste est fermée et nommée. Ajouter un nombre choisi à la main ailleurs fait
 * échouer ce test — c'est tout son objet.
 */
const SQUELETTE_STRUCTUREL = [
  'lombaire.hernie-discale — profil discal',
  'lombaire.hernie-discale — atteinte unilatérale',
  'lombaire.hernie-discale — aggravation en position assise',
  'lombaire.hernie-discale — début brutal',
  'lombaire.stenose — profil sténosant',
  'lombaire.stenose — aggravation à la marche',
  'lombaire.radiculopathie — irradiation sous le genou',
  'lombaire.sacro-iliaque — douleur fessière',
  'lombaire.discogenique — centralisation',
  'lombaire.facettaire — douleur paravertébrale',
  'cervical — squelette hérité',
]

describe('inventaire des poids non mesurés', () => {
  it('n\'en laisse subsister que dans le squelette hérité de l\'arbre', () => {
    const orphelins = tousLesCriteres()
      .filter(({ criterion }) => criterion.weight !== undefined && !criterion.source)
      .map(({ hypothesis, criterion }) => `${hypothesis.id} — ${criterion.label}`)

    const lombaires = orphelins.filter((entree) => entree.startsWith('lombaire.'))
    expect(lombaires).toHaveLength(SQUELETTE_STRUCTUREL.length - 1)
    // Ils appartiennent tous à une hypothèse du squelette : aucun nombre
    // arbitraire ne s'est glissé dans les entités ajoutées depuis.
    const hypothesesDuSquelette = new Set(
      SQUELETTE_STRUCTUREL.map((entree) => entree.split(' — ')[0]),
    )
    for (const entree of lombaires) {
      expect(hypothesesDuSquelette, entree).toContain(entree.split(' — ')[0])
    }
  })

  it('source chaque valeur des entités ajoutées depuis le document', () => {
    const ajoutees = [
      'lombaire.origine-renale',
      'lombaire.origine-gynecologique',
      'lombaire.origine-digestive',
      'lombaire.zona',
      'lombaire.douleur-non-mecanique',
      'lombaire.grand-trochanter',
      'lombaire.ischio-jambiers',
      'lombaire.meralgie',
      'lombaire.fasciite-plantaire',
      'lombaire.hanche',
      'lombaire.spondylolyse',
      'lombaire.spondylolisthesis',
    ]
    const sansSource: string[] = []
    for (const id of ajoutees) {
      const hypothesis = LUMBAR_HYPOTHESES.find((h) => h.id === id)
      expect(hypothesis, id).toBeDefined()
      for (const criterion of hypothesis!.criteria) {
        if (!criterion.lr && !criterion.source) sansSource.push(`${id} — ${criterion.label}`)
      }
    }
    expect(sansSource).toEqual([])
  })
})

describe('paliers d\'informativité (chapitre 8)', () => {
  it('ne code aucun rapport muet dans les deux sens', () => {
    // « Ne retenir un signe que si LR+ ≥ 2 ou LR− ≤ 0,5. » Un rapport compris
    // entre les deux ne déplace pas assez la probabilité pour valoir mieux que
    // du bruit ; en coder un donnerait au signe une influence que l'étude ne
    // lui reconnaît pas.
    const muets: string[] = []
    for (const { hypothesis, criterion } of tousLesCriteres()) {
      if (!criterion.lr) continue
      const confirme = criterion.lr.positive >= 2
      const ecarte = criterion.lr.negative !== undefined && criterion.lr.negative <= 0.5
      if (!confirme && !ecarte) muets.push(`${hypothesis.id} — ${criterion.label}`)
    }
    expect(muets).toEqual([])
  })

  it('refuse tout rapport nul ou négatif', () => {
    // Un rapport nul vaudrait une certitude absolue et ferait diverger le
    // chaînage des cotes. Aucune étude n'en fournit de tel.
    for (const { hypothesis, criterion } of tousLesCriteres()) {
      if (!criterion.lr) continue
      expect(criterion.lr.positive, hypothesis.id).toBeGreaterThan(0)
      if (criterion.lr.negative !== undefined) {
        expect(criterion.lr.negative, hypothesis.id).toBeGreaterThan(0)
      }
    }
  })

  it('ignore un rapport positif non informatif tout en gardant son versant négatif', () => {
    // Le Lasègue : LR+ 1,28 muet, LR− 0,29 parlant. Un positif ne doit rien
    // apporter, un négatif doit retirer.
    const hernie = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.hernie-discale')!
    const base = {
      'lombaire.irradiation_jambe': true,
      'lombaire.irradiation_sous_genou': true,
      'lombaire.jambe_plus_douloureuse': true,
    }
    const neutre = scoreHypothesis(hernie, base).score
    const positif = scoreHypothesis(hernie, { ...base, 'lombaire.lasegue_positif': true }).score
    const negatif = scoreHypothesis(hernie, { ...base, 'lombaire.lasegue_positif': false }).score

    expect(positif).toBe(neutre)
    expect(negatif).toBeLessThan(neutre)
  })
})

describe('sécurité des drapeaux rouges (chapitre 3)', () => {
  it('ne rassure jamais sur une réponse négative', () => {
    // Sur une prévalence de départ de quelques pour mille, un dépistage négatif
    // n'abaisse pas utilement la probabilité d'une pathologie grave. Le moteur
    // n'a qu'un seuil d'alerte à franchir ou non.
    const drapeaux = TOUTES.filter((hypothesis) => hypothesis.kind === 'red-flag')
    expect(drapeaux.length).toBeGreaterThan(0)

    for (const drapeau of drapeaux) {
      const tousFaux = Object.fromEntries(
        drapeau.criteria
          .flatMap((criterion) => signauxDe(criterion.when))
          .map((signal) => [signal, false]),
      )
      const scored = scoreHypothesis(drapeau, tousFaux)
      expect(scored.score, drapeau.id).toBeGreaterThanOrEqual(0)
      expect(scored.argumentsAgainst, drapeau.id).toEqual([])
    }
  })

  it('classe chaque drapeau retenu dans un des trois niveaux d\'alerte', () => {
    const result = reason({
      signals: { 'lombaire.anesthesie_selle': true },
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
    })
    const sqc = result.redFlags.find((f) => f.id === 'lombaire.queue-de-cheval')
    expect(sqc).toBeDefined()
    expect(sqc!.alert).toBe('immediate')
  })

  it('oriente avant d\'examiner quand un drapeau rouge est retenu', () => {
    const result = reason({
      signals: { 'lombaire.retention_urinaire': true },
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
    })
    expect(result.nextActions[0].action.kind).toBe('referral')
  })

  it('alerte sur un seul item verbal critique, sans attendre d\'accumulation', () => {
    for (const signal of [
      'lombaire.retention_urinaire',
      'lombaire.anesthesie_selle',
      'lombaire.incontinence_recente',
    ] as const) {
      const result = reason({ signals: { [signal]: true }, hypotheses: LUMBAR_HYPOTHESES })
      expect(result.redFlags.map((f) => f.id), signal).toContain('lombaire.queue-de-cheval')
    }
  })
})

describe('signes corrélés (chapitre 5)', () => {
  it('ne compte qu\'une fois une famille de signes corrélés', () => {
    const stenose = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.stenose')!
    const base = { 'lombaire.claudication_neurogene': true }
    const unSeul = scoreHypothesis(stenose, {
      ...base,
      'lombaire.pas_de_douleur_assis': true,
    }).score
    const deux = scoreHypothesis(stenose, {
      ...base,
      'lombaire.pas_de_douleur_assis': true,
      'lombaire.signe_caddie': true,
    }).score
    // Absence de douleur assise et amélioration en antéflexion décrivent le
    // même phénomène postural : les additionner fabriquerait une certitude.
    expect(deux).toBe(unSeul)
  })

  it('laisse le rapport du cluster remplacer celui de ses membres', () => {
    const si = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.sacro-iliaque')!
    // La porte d'entrée doit être franchie : une hypothèse dont la classe
    // n'est pas établie ne cumule aucun point.
    const base = {
      'lombaire.localisation_fessiere': true,
      'lombaire.irradiation_jambe': false,
      'lombaire.rythme_inflammatoire': false,
    }
    const testIsole = scoreHypothesis(si, {
      ...base,
      'lombaire.distraction_positif': true,
    }).score
    const cluster = scoreHypothesis(si, {
      ...base,
      'lombaire.distraction_positif': true,
      'lombaire.cluster_laslett_3plus': true,
    }).score
    const clusterSeul = scoreHypothesis(si, {
      ...base,
      'lombaire.cluster_laslett_3plus': true,
    }).score

    expect(cluster).toBe(clusterSeul)
    expect(cluster).toBeGreaterThan(testIsole)
  })

  it('additionne en revanche des familles distinctes', () => {
    const stenose = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.stenose')!
    const anamnese = scoreHypothesis(stenose, {
      'lombaire.claudication_neurogene': true,
      'lombaire.signe_caddie': true,
    }).score
    const avecExamen = scoreHypothesis(stenose, {
      'lombaire.claudication_neurogene': true,
      'lombaire.signe_caddie': true,
      'lombaire.demarche_base_elargie': true,
    }).score
    expect(avecExamen).toBeGreaterThan(anamnese)
  })
})

describe('probabilité post-test (chapitre 8)', () => {
  it('enchaîne les cotes à partir de la prévalence, sans additionner de points', () => {
    const fracture = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.fracture')!
    const scored = scoreHypothesis(fracture, {
      'general.contusion_abrasion': true,
      'general.traumatisme_recent': false,
      'terrain.age_plus_70': false,
      'terrain.corticotherapie': false,
      'terrain.sexe_feminin': false,
      'terrain.osteoporose': false,
      'general.deficit_neuro_post_traumatique': false,
      'general.douleur_mediane_epineuse': false,
      'lombaire.perte_sensitive_ressentie': false,
    })

    const prior = fracture.prior!.value
    const cote = (prior / (1 - prior)) * 31.09
    expect(scored.probability).toBeCloseTo(cote / (1 + cote), 3)
  })

  it('ne produit aucune probabilité quand un poids ordinal a pesé', () => {
    // Un seul nombre non mesuré dans le calcul et le résultat n'aurait plus de
    // sens : mieux vaut pas de probabilité qu'une probabilité fabriquée.
    const fracture = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.fracture')!
    const scored = scoreHypothesis(fracture, {
      'terrain.sexe_feminin': true,
      'terrain.age_plus_70': true,
      'general.traumatisme_recent': true,
    })
    expect(scored.probability).toBeUndefined()
  })

  it('ne produit aucune probabilité sans prévalence sourcée', () => {
    const hernie = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.hernie-discale')!
    expect(hernie.prior).toBeUndefined()
    const scored = scoreHypothesis(hernie, {
      'lombaire.irradiation_jambe': true,
      'lombaire.irradiation_sous_genou': true,
      'lombaire.jambe_plus_douloureuse': true,
      'lombaire.douleur_dermatomale': true,
    })
    expect(scored.probability).toBeUndefined()
  })
})

describe('diagnostic résiduel et stratification (couches 2 et 4)', () => {
  it('ne fait jamais monter le diagnostic d\'exclusion', () => {
    const exclusions = TOUTES.filter((hypothesis) => hypothesis.kind === 'exclusion')
    expect(exclusions.length).toBeGreaterThan(0)
    for (const exclusion of exclusions) {
      const tousVrais = Object.fromEntries(
        exclusion.criteria.flatMap((criterion) => signauxDe(criterion.when)).map((s) => [s, true]),
      )
      expect(scoreHypothesis(exclusion, tousVrais).score, exclusion.id).toBe(0)
    }
  })

  it('tient la stratification pronostique hors du différentiel', () => {
    const result = reason({
      signals: {
        'lombaire.irradiation_jambe': false,
        'lombaire.rythme_inflammatoire': false,
        'psychosocial.peur_mouvement': true,
        'psychosocial.stress_anxiete': true,
      },
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
    })
    expect(result.hypotheses.map((h) => h.id)).not.toContain('lombaire.chronicisation')
    const profil = result.profiles.find((p) => p.id === 'lombaire.chronicisation')
    expect(profil).toBeDefined()
    expect(profil!.score).toBeGreaterThan(0)
  })
})

describe('mimes périphériques (chapitre 7 bis)', () => {
  it('n\'exclut jamais une radiculopathie coexistante', () => {
    // Un syndrome douloureux du grand trochanter accompagne 18 à 35 % des
    // radiculopathies. Coder l'un comme excluant l'autre produirait un faux
    // négatif exactement là où les deux tableaux se ressemblent.
    const result = reason({
      signals: {
        'lombaire.irradiation_jambe': true,
        'lombaire.irradiation_sous_genou': true,
        'lombaire.jambe_plus_douloureuse': true,
        'lombaire.palpation_trochanter_douloureuse': true,
      },
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
    })
    const ids = result.hypotheses.map((h) => h.id)
    expect(ids).toContain('lombaire.radiculopathie')
    expect(ids).toContain('lombaire.grand-trochanter')
    expect(result.excluded.map((h) => h.id)).not.toContain('lombaire.radiculopathie')
  })

  it('fait baisser le score radiculaire devant une sensibilité focale sans signe objectif', () => {
    const radiculopathie = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.radiculopathie')!
    const base = {
      'lombaire.irradiation_jambe': true,
      'lombaire.irradiation_sous_genou': true,
      'lombaire.jambe_plus_douloureuse': true,
      'lombaire.deficit_moteur': false,
      'lombaire.reflexe_achilleen_aboli': false,
      'lombaire.reflexe_rotulien_aboli': false,
      'lombaire.douleur_dermatomale': false,
    }
    const sansMime = scoreHypothesis(radiculopathie, base).score
    const avecMime = scoreHypothesis(radiculopathie, {
      ...base,
      'lombaire.palpation_trochanter_douloureuse': true,
    }).score
    expect(avecMime).toBeLessThan(sansMime)
  })

  it('ne pénalise pas la radiculopathie quand un signe objectif l\'accompagne', () => {
    const radiculopathie = LUMBAR_HYPOTHESES.find((h) => h.id === 'lombaire.radiculopathie')!
    const base = {
      'lombaire.irradiation_jambe': true,
      'lombaire.irradiation_sous_genou': true,
      'lombaire.jambe_plus_douloureuse': true,
      'lombaire.douleur_dermatomale': true,
      'lombaire.palpation_trochanter_douloureuse': true,
    }
    const scored = scoreHypothesis(radiculopathie, base)
    expect(scored.argumentsAgainst).toEqual([])
  })
})

describe('filtre viscéral et vasculaire (chapitre 7)', () => {
  it('sort du champ manuel devant une douleur non mécanique accompagnée', () => {
    const result = reason({
      signals: {
        'lombaire.douleur_non_positionnelle': true,
        'general.perte_poids': true,
      },
      hypotheses: LUMBAR_HYPOTHESES,
      actions: LUMBAR_ACTIONS,
    })
    expect(result.redFlags.map((f) => f.id)).toContain('lombaire.douleur-non-mecanique')
    expect(result.nextActions[0].action.kind).toBe('referral')
  })

  it('reconnaît les causes viscérales et vasculaires du différentiel non rachidien', () => {
    const attendues = [
      'lombaire.aaa',
      'lombaire.origine-renale',
      'lombaire.origine-gynecologique',
      'lombaire.origine-digestive',
      'lombaire.zona',
    ]
    const presentes = LUMBAR_HYPOTHESES.map((h) => h.id)
    for (const id of attendues) expect(presentes).toContain(id)
  })
})

/** Signaux mentionnés par une expression — copie locale, pour ne rien exporter. */
function signauxDe(expr: unknown): string[] {
  if (typeof expr === 'string') return [expr]
  if (!expr || typeof expr !== 'object') return []
  const node = expr as Record<string, unknown>
  if ('not' in node) return signauxDe(node.not)
  if ('all' in node) return (node.all as unknown[]).flatMap(signauxDe)
  if ('any' in node) return (node.any as unknown[]).flatMap(signauxDe)
  if ('among' in node) return (node.among as unknown[]).flatMap(signauxDe)
  return []
}
