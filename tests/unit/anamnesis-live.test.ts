import { describe, it, expect } from 'vitest'
import {
  AXES,
  applyOps,
  coveredAxes,
  linesToReason,
  linesToSections,
  missingAxes,
  remapAddedIds,
  type LiveLine,
} from '@/lib/anamnesis-live'
import { deriveAnamnesisVitals, sectionsToMarkdown } from '@/lib/anamnesis'

function line(id: string, axis: LiveLine['axis'], text: string, extra: Partial<LiveLine> = {}): LiveLine {
  return { id, axis, text, ...extra }
}

describe('applyOps', () => {
  it('ajoute les lignes et les range dans l\'ordre de lecture clinique', () => {
    // Le patient parle dans le désordre, la synthèse se lit dans l'ordre.
    const lines = applyOps([], [
      { op: 'add', id: 'c', axis: 'soulageant', text: 'Marche' },
      { op: 'add', id: 'a', axis: 'localisation', text: 'Lombaire basse' },
      { op: 'add', id: 'b', axis: 'anciennete', text: 'Depuis 4 jours' },
    ])
    expect(lines.map((l) => l.axis)).toEqual(['localisation', 'anciennete', 'soulageant'])
  })

  it('corrige une ligne existante au lieu d\'en empiler une seconde', () => {
    // « c'est à gauche, ah non pardon à droite » : le cas qui justifie les
    // identifiants stables. Deux lignes contradictoires seraient pires que rien.
    const before = applyOps([], [{ op: 'add', id: 'x', axis: 'lateralite', text: 'Gauche' }])
    const after = applyOps(before, [{ op: 'update', id: 'x', text: 'Droite' }])
    expect(after).toHaveLength(1)
    expect(after[0].text).toBe('Droite')
    expect(after[0].axis).toBe('lateralite')
  })

  it('marque la ligne touchée, pour pouvoir la signaler à l\'écran', () => {
    const before = applyOps([], [{ op: 'add', id: 'x', axis: 'lateralite', text: 'Gauche' }], 1000)
    const after = applyOps(before, [{ op: 'update', id: 'x', text: 'Droite' }], 2000)
    expect(after[0].touchedAt).toBe(2000)
  })

  it('supprime une ligne que le patient retire', () => {
    const before = applyOps([], [
      { op: 'add', id: 'x', axis: 'irradiation', text: 'Descend sous le genou' },
      { op: 'add', id: 'y', axis: 'localisation', text: 'Lombaire' },
    ])
    expect(applyOps(before, [{ op: 'remove', id: 'x' }]).map((l) => l.id)).toEqual(['y'])
  })

  it('ne touche jamais une ligne corrigée à la main par le praticien', () => {
    // Entre le jugement du praticien et celui du modèle, c'est le sien qui fait foi.
    const edited = [line('x', 'lateralite', 'Gauche', { edited: true })]
    expect(applyOps(edited, [{ op: 'update', id: 'x', text: 'Droite' }])[0].text).toBe('Gauche')
    expect(applyOps(edited, [{ op: 'remove', id: 'x' }])).toHaveLength(1)
  })

  it('traite un update sur une ligne inconnue comme un ajout', () => {
    // Perdre un fait coûte plus cher que de tolérer une opération mal étiquetée.
    const lines = applyOps([], [{ op: 'update', id: 'z', axis: 'intensite', text: 'EVA 7/10' }])
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('EVA 7/10')
  })

  it('ignore ce qui n\'est pas exploitable plutôt que de polluer la synthèse', () => {
    const lines = applyOps([], [
      { op: 'add', id: 'a', axis: 'inventé', text: 'Quelque chose' },
      { op: 'add', id: 'b', axis: 'intensite' },
      { op: 'add', axis: 'intensite', text: 'Sans identifiant' },
      null,
      'texte',
    ])
    expect(lines).toHaveLength(0)
    expect(applyOps([], 'pas un tableau')).toEqual([])
  })

  it('conserve le verbatim et le doute de transcription', () => {
    const lines = applyOps([], [
      { op: 'add', id: 'a', axis: 'irradiation', text: 'Descend sous le genou', confidence: 'low', verbatim: 'ça tire jusqu\'en bas de la jambe' },
    ])
    expect(lines[0].confidence).toBe('low')
    expect(lines[0].verbatim).toBe('ça tire jusqu\'en bas de la jambe')
  })
})

describe('checklist', () => {
  it('réclame les axes requis non couverts, et seulement ceux-là', () => {
    const lines = applyOps([], [
      { op: 'add', id: 'a', axis: 'localisation', text: 'Lombaire basse' },
      { op: 'add', id: 'b', axis: 'lateralite', text: 'Gauche' },
    ])
    const missing = missingAxes(lines).map((a) => a.id)
    expect(missing).not.toContain('localisation')
    expect(missing).not.toContain('lateralite')
    expect(missing).toContain('intensite')
    // Les antécédents ne sont pas requis : leur absence n'est pas un oubli.
    expect(missing).not.toContain('antecedent')
    expect(coveredAxes(lines).has('localisation')).toBe(true)
  })

  it('est générique, sans axe propre à une région', () => {
    // Une liste par pathologie demanderait un développement par région.
    const ids = AXES.map((a) => a.id).join(' ')
    expect(ids).not.toMatch(/lombaire|cervical|epaule|genou/i)
    expect(AXES.filter((a) => a.required).length).toBeGreaterThan(10)
  })
})

describe('pont vers les cartes enregistrées', () => {
  const lines = applyOps([], [
    { op: 'add', id: 'm', axis: 'motif', text: 'Lombalgie aiguë' },
    { op: 'add', id: 'a', axis: 'localisation', text: 'Lombaire basse' },
    { op: 'add', id: 'b', axis: 'lateralite', text: 'Gauche' },
    { op: 'add', id: 'c', axis: 'intensite', text: 'EVA 7/10' },
    { op: 'add', id: 'd', axis: 'anciennete', text: 'Depuis 4 jours' },
    { op: 'add', id: 'e', axis: 'aggravant', text: 'Position assise' },
    { op: 'add', id: 'f', axis: 'soulageant', text: 'Marche' },
  ])

  it('range chaque axe dans la rubrique où il vivait déjà', () => {
    const sections = linesToSections(lines)
    const byId = Object.fromEntries(sections.map((s) => [s.id, s]))
    expect(byId.pain.items).toEqual(['Localisation : Lombaire basse', 'Latéralité : Gauche', 'Intensité : EVA 7/10'])
    expect(byId.history.items).toEqual(['Ancienneté : Depuis 4 jours'])
    expect(byId.modulating.items).toEqual(['Aggravants : Position assise', 'Soulageants : Marche'])
    // Les sept rubriques restent présentes : elles servent de checklist.
    expect(sections.map((s) => s.id)).toHaveLength(7)
  })

  it('sort le motif des cartes, il devient le motif de la consultation', () => {
    expect(linesToReason(lines)).toBe('Lombalgie aiguë')
    expect(JSON.stringify(linesToSections(lines))).not.toContain('Lombalgie aiguë')
  })

  it('marque « non abordé » les rubriques sans ligne', () => {
    const byId = Object.fromEntries(linesToSections(lines).map((s) => [s.id, s]))
    expect(byId.treatment.items).toEqual(['—'])
    expect(byId.functional.items).toEqual(['—'])
  })

  it('ne déclare le dépistage négatif que si le praticien l\'a tranché', () => {
    // Sans drapeau listé, une rubrique vide est ambiguë : pas dépisté, ou
    // dépisté négatif ? Annoncer un dépistage qui n'a pas eu lieu serait pire.
    const undecided = linesToSections(lines).find((s) => s.id === 'red_flags')!
    expect(undecided.allClear).toBe(false)
    const cleared = linesToSections(lines, true).find((s) => s.id === 'red_flags')!
    expect(cleared.allClear).toBe(true)

    const flagged = linesToSections(
      applyOps(lines, [{ op: 'add', id: 'rf', axis: 'red_flag', text: 'Douleur nocturne non soulagée' }]),
      true,
    ).find((s) => s.id === 'red_flags')!
    // Un drapeau listé l'emporte sur la case cochée.
    expect(flagged.allClear).toBe(false)
    expect(flagged.items).toEqual(['Douleur nocturne non soulagée'])
  })

  it('produit des cartes que le reste de l\'application sait déjà lire', () => {
    // C'est tout l'intérêt du pont : lettres, exports, recherche et bandeau de
    // synthèse continuent de fonctionner sans rien savoir du mode consultation.
    const sections = linesToSections(lines, true)
    const vitals = deriveAnamnesisVitals(sections)
    expect(vitals.eva).toBe(7)
    expect(vitals.onset).toBe('4 j')
    expect(vitals.side).toBe('G')
    expect(vitals.redFlags).toBe('clear')

    const markdown = sectionsToMarkdown(sections)
    expect(markdown).toContain('**Caractéristiques de la douleur**')
    expect(markdown).toContain('- Intensité : EVA 7/10')
    expect(markdown).toContain('- Aucun identifié')
    expect(markdown).not.toContain('—')
  })
})

describe('remapAddedIds', () => {
  it('rend uniques les identifiants inventés par le modèle', () => {
    // Le modèle réutilise « n1 » d'un passage à l'autre. Sans substitution, deux
    // lignes partageraient un identifiant et corriger l'une réécrirait l'autre.
    let n = 0
    const ops = remapAddedIds(
      [
        { op: 'add', id: 'n1', axis: 'localisation', text: 'Lombaire' },
        { op: 'add', id: 'n2', axis: 'intensite', text: 'EVA 7/10' },
      ],
      () => `uuid-${++n}`,
    )
    expect(ops.map((o) => o.id)).toEqual(['uuid-1', 'uuid-2'])
  })

  it('reste cohérent quand le modèle ajoute puis corrige dans le même lot', () => {
    let n = 0
    const ops = remapAddedIds(
      [
        { op: 'add', id: 'n1', axis: 'lateralite', text: 'Gauche' },
        { op: 'update', id: 'n1', text: 'Droite' },
      ],
      () => `uuid-${++n}`,
    )
    expect(ops[0].id).toBe('uuid-1')
    expect(ops[1].id).toBe('uuid-1')
  })

  it('ne touche pas aux identifiants des lignes déjà posées', () => {
    // Un `update` sur une ligne existante doit garder son identifiant réel,
    // sinon la correction retomberait à côté.
    const ops = remapAddedIds(
      [{ op: 'update', id: 'ligne-existante', text: 'Droite' }, { op: 'remove', id: 'autre' }],
      () => 'ne-devrait-pas-servir',
    )
    expect(ops.map((o) => o.id)).toEqual(['ligne-existante', 'autre'])
  })

  it('bout à bout : un identifiant substitué reste corrigeable au passage suivant', () => {
    let n = 0
    const first = remapAddedIds(
      [{ op: 'add', id: 'n1', axis: 'lateralite', text: 'Gauche' }],
      () => `uuid-${++n}`,
    )
    const lines = applyOps([], first)
    expect(lines[0].id).toBe('uuid-1')

    // Au passage suivant, le modèle voit l'identifiant réel et le reprend.
    const second = remapAddedIds([{ op: 'update', id: 'uuid-1', text: 'Droite' }], () => 'jamais')
    const corrected = applyOps(lines, second)
    expect(corrected).toHaveLength(1)
    expect(corrected[0].text).toBe('Droite')
  })
})
