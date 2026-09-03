import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnamnesisCards } from '@/components/consultations/anamnesis-cards'
import type { AnamnesisSection } from '@/lib/anamnesis'

const sections: AnamnesisSection[] = [
  { id: 'history', label: 'Histoire', icon: '⚡', items: ['Port de charge', 'Apparition J+4'] },
  { id: 'pain', label: 'Douleur', icon: '📍', items: ['Localisation : lombaire basse gauche', 'Intensité : EVA 7/10', 'Type : dysesthésie[?]'] },
  { id: 'treatment', label: 'Traitements', icon: '💊', items: ['—'] },
  { id: 'functional', label: 'Impact fonctionnel', icon: '🚶', items: ['—'] },
  { id: 'red_flags', label: 'Drapeaux rouges', icon: '🚩', items: [], allClear: true },
]

describe('rendu des cartes', () => {
  const html = renderToStaticMarkup(
    <AnamnesisCards
      reason="Lombalgie aiguë"
      summary="Lombalgie aiguë mécanique depuis 4 jours, lombaire basse gauche, EVA 7/10, sans drapeau rouge."
      sections={sections}
      onEdit={() => {}}
      disabled
    />,
  )

  it('affiche la phrase de synthèse et le motif', () => {
    expect(html).toContain('Lombalgie aiguë mécanique depuis 4 jours')
    expect(html).toContain('Lombalgie aiguë')
  })

  it('affiche les pastilles dérivées des cartes', () => {
    expect(html).toContain('EVA 7/10')
    expect(html).toContain('4 j')
    expect(html).toContain('Drapeaux rouges : aucun')
    expect(html).toContain('1 point à confirmer')
  })

  it('replie les rubriques non abordées en une seule ligne', () => {
    expect(html).toContain('Non abordé')
    // Les cartes vides ne sont plus rendues, seuls leurs libellés dans la ligne.
    expect(html.match(/Traitements/g)).toHaveLength(1)
    expect(html.match(/Impact fonctionnel/g)).toHaveLength(1)
    // Les rubriques renseignées, elles, gardent leur carte.
    expect(html).toContain('Localisation : lombaire basse gauche')
  })

  it('signale visuellement le seul item incertain', () => {
    const uncertain = html.split('dysesthésie[?]')[0]
    expect(uncertain).toContain('decoration-dotted')
  })

  it('rend le drapeau rouge en alerte quand un signe est listé', () => {
    const flagged = renderToStaticMarkup(
      <AnamnesisCards
        sections={sections.map((s) =>
          s.id === 'red_flags' ? { ...s, allClear: false, items: ['Douleur nocturne non soulagée'] } : s,
        )}
        onEdit={() => {}}
        disabled
      />,
    )
    expect(flagged).toContain('1 drapeau rouge')
    expect(flagged).toContain('border-red-300')
    expect(flagged).not.toContain('Drapeaux rouges : aucun')
  })

  it('ne rend aucun bandeau quand il n\'y a rien à y mettre', () => {
    const bare = renderToStaticMarkup(
      <AnamnesisCards
        sections={[{ id: 'history', label: 'Histoire', icon: '⚡', items: ['Apparition progressive'] }]}
        onEdit={() => {}}
        disabled
      />,
    )
    expect(bare).not.toContain('Drapeaux rouges')
    expect(bare).toContain('Apparition progressive')
  })
})
