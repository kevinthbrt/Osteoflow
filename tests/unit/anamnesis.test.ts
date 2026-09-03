import { describe, it, expect } from 'vitest'
import {
  deriveAnamnesisVitals,
  extractEva,
  extractOnset,
  extractSide,
  isNotCovered,
  sectionsToMarkdown,
  type AnamnesisSection,
} from '@/lib/anamnesis'

/** Fabrique une section, en ne précisant que ce que le test observe. */
function section(id: string, items: string[], extra: Partial<AnamnesisSection> = {}): AnamnesisSection {
  return { id, label: id, icon: '•', items, ...extra }
}

describe('extractEva', () => {
  it('lit les formes dictées les plus courantes', () => {
    expect(extractEva('Intensité : EVA 7/10')).toBe(7)
    expect(extractEva('Intensité : EVA : 4')).toBe(4)
    expect(extractEva('douleur à 8/10 au réveil')).toBe(8)
    expect(extractEva('EVA 10/10')).toBe(10)
    expect(extractEva('EVA 0/10')).toBe(0)
  })

  it('ne retient rien quand la valeur est hors échelle ou absente', () => {
    expect(extractEva('Intensité : EVA 12/10')).toBeNull()
    expect(extractEva('Intensité : non chiffrée')).toBeNull()
    expect(extractEva('')).toBeNull()
  })
})

describe('extractOnset', () => {
  it('privilégie les formes qui portent explicitement l\'ancienneté', () => {
    expect(extractOnset('Apparition J+4 après port de charge')).toBe('4 j')
    expect(extractOnset('Douleur depuis 3 semaines')).toBe('3 sem.')
    expect(extractOnset('ça fait 2 mois que ça dure')).toBe('2 mois')
    expect(extractOnset('il y a environ 5 ans, chute à ski')).toBe('5 ans')
    expect(extractOnset('depuis 1 an')).toBe('1 an')
  })

  it('comprend les repères relatifs du langage parlé', () => {
    expect(extractOnset('Début hier soir')).toBe('1 j')
    expect(extractOnset('Apparu avant-hier')).toBe('2 j')
    expect(extractOnset('Réveil douloureux ce matin')).toBe('ce jour')
  })

  it('accepte un nombre nu suivi d\'une unité en dernier recours', () => {
    expect(extractOnset('Lombalgie 3 mois, évolution par crises')).toBe('3 mois')
  })

  it('ne retient rien sans repère de durée', () => {
    expect(extractOnset('Apparition progressive, sans facteur déclenchant')).toBeNull()
  })
})

describe('extractSide', () => {
  it('reconnaît les mots pleins et les abréviations isolées', () => {
    expect(extractSide('Localisation : lombaire basse gauche')).toBe('G')
    expect(extractSide('Épaule droite')).toBe('D')
    expect(extractSide('Localisation : cervicale, G')).toBe('G')
    expect(extractSide('Irradiation, D')).toBe('D')
  })

  it('reconnaît la bilatéralité, y compris quand les deux côtés sont cités', () => {
    expect(extractSide('Douleur bilatérale')).toBe('Bilat.')
    expect(extractSide('Lombaire G/D')).toBe('Bilat.')
    expect(extractSide('Genou gauche puis genou droit')).toBe('Bilat.')
    expect(extractSide('Dlr des deux côtés')).toBe('Bilat.')
  })

  it('ne confond pas une initiale prise au milieu d\'un mot', () => {
    // « Grande » et « Décharge » commencent par G et D : les retenir donnerait
    // une latéralité inventée sur presque toutes les anamnèses.
    expect(extractSide('Type : décharge électrique, grande intensité')).toBeNull()
    expect(extractSide('Type : mécanique')).toBeNull()
  })
})

describe('deriveAnamnesisVitals', () => {
  const sections: AnamnesisSection[] = [
    section('history', ['Port de charge lourde', 'Apparition J+4', 'Évolution stable']),
    section('pain', ['Localisation : lombaire basse gauche', 'Type : mécanique', 'Intensité : EVA 7/10', 'Irradiations : fessière']),
    section('modulating', ['⬆️ position assise prolongée', '⬇️ marche']),
    section('history_past', ['—']),
    section('treatment', ['—']),
    section('functional', ['Arrêt du sport depuis 4 jours']),
    section('red_flags', [], { allClear: true }),
  ]

  it('extrait chaque donnée dans la rubrique où elle a un sens', () => {
    const vitals = deriveAnamnesisVitals(sections)
    expect(vitals.eva).toBe(7)
    expect(vitals.onset).toBe('4 j')
    expect(vitals.side).toBe('G')
    expect(vitals.redFlags).toBe('clear')
    expect(vitals.redFlagCount).toBe(0)
  })

  it('ne prend pas la latéralité dans un antécédent sans rapport', () => {
    // Le poignet droit fracturé en 2015 ne dit rien du côté de la lombalgie.
    const withHistory = sections.map((s) =>
      s.id === 'history_past' ? section('history_past', ['Fracture poignet droit 2015']) : s,
    )
    expect(deriveAnamnesisVitals(withHistory).side).toBe('G')
  })

  it('liste les rubriques non abordées, drapeaux rouges exclus', () => {
    expect(deriveAnamnesisVitals(sections).notCovered).toEqual(['history_past', 'treatment'])
  })

  it('compte les drapeaux rouges listés', () => {
    const flagged = sections.map((s) =>
      s.id === 'red_flags'
        ? section('red_flags', ['Douleur nocturne non soulagée par le repos', 'Amaigrissement 5 kg'], { allClear: false })
        : s,
    )
    const vitals = deriveAnamnesisVitals(flagged)
    expect(vitals.redFlags).toBe('flagged')
    expect(vitals.redFlagCount).toBe(2)
  })

  it('compte les items à confirmer', () => {
    const uncertain = sections.map((s) =>
      s.id === 'pain' ? section('pain', ['Type : dysesthésie[?]', 'Intensité : EVA 7/10']) : s,
    )
    expect(deriveAnamnesisVitals(uncertain).toConfirm).toBe(1)
  })

  it('laisse le statut des drapeaux inconnu quand la rubrique est absente', () => {
    // Cas des anamnèses structurées avant l'ajout du dépistage : mieux vaut ne
    // rien affirmer que d'annoncer un dépistage négatif qui n'a pas eu lieu.
    const vitals = deriveAnamnesisVitals(sections.filter((s) => s.id !== 'red_flags'))
    expect(vitals.redFlags).toBe('unknown')
  })

  it('ne renvoie rien plutôt que d\'inventer, sur des cartes vides', () => {
    const vitals = deriveAnamnesisVitals([])
    expect(vitals).toEqual({
      eva: null, onset: null, side: null,
      redFlags: 'unknown', redFlagCount: 0, toConfirm: 0, notCovered: [],
    })
    expect(deriveAnamnesisVitals(null).eva).toBeNull()
  })
})

describe('isNotCovered', () => {
  it('traite le placeholder et la chaîne vide comme « non abordé »', () => {
    expect(isNotCovered(section('treatment', ['—']))).toBe(true)
    expect(isNotCovered(section('treatment', ['', '  ']))).toBe(true)
    expect(isNotCovered(section('treatment', []))).toBe(true)
    expect(isNotCovered(section('treatment', ['Kiné 10 séances']))).toBe(false)
  })

  it('n\'applique jamais l\'étiquette aux drapeaux rouges', () => {
    expect(isNotCovered(section('red_flags', [], { allClear: true }))).toBe(false)
  })
})

describe('sectionsToMarkdown', () => {
  it('conserve le comportement attendu par les lettres et les exports', () => {
    const md = sectionsToMarkdown([
      section('pain', ['Localisation : lombaire', '—']),
      section('treatment', ['—']),
      section('red_flags', [], { allClear: true }),
    ])
    expect(md).toBe(
      '**Caractéristiques de la douleur**\n- Localisation : lombaire\n\n**Drapeaux rouges**\n- Aucun identifié',
    )
  })
})
