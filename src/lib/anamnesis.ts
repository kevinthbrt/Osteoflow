import type { AnamnesisSection } from '@/components/consultations/anamnesis-recorder'

/**
 * Cartes (sections) = source de vérité unique produite par l'IA. Le texte markdown
 * de l'anamnèse est désormais DÉRIVÉ de ces cartes (et non plus généré séparément),
 * afin de rester disponible pour les lettres, exports, recherche et consultations
 * passées — sans risque de divergence avec les cartes affichées.
 */

const SECTION_HEADINGS: Record<string, string> = {
  history: 'Histoire de la maladie',
  pain: 'Caractéristiques de la douleur',
  modulating: 'Facteurs modulants',
  history_past: 'Antécédents mentionnés',
  treatment: 'Traitements essayés',
  functional: 'Impact fonctionnel',
  red_flags: 'Drapeaux rouges',
}

/** Reconstruit le texte markdown de l'anamnèse à partir des cartes structurées. */
export function sectionsToMarkdown(sections: AnamnesisSection[]): string {
  const blocks: string[] = []

  for (const section of sections) {
    const heading = SECTION_HEADINGS[section.id] ?? section.label
    const items = section.items.filter((i) => i && i.trim() && i.trim() !== '—')

    if (section.id === 'red_flags') {
      if (section.allClear || items.length === 0) {
        blocks.push(`**${heading}**\n- Aucun identifié`)
      } else {
        blocks.push(`**${heading}**\n${items.map((i) => `- ${i}`).join('\n')}`)
      }
      continue
    }

    // Les rubriques vides (uniquement "—") ne sont pas reportées dans le texte.
    if (items.length === 0) continue
    blocks.push(`**${heading}**\n${items.map((i) => `- ${i}`).join('\n')}`)
  }

  return blocks.join('\n\n')
}
