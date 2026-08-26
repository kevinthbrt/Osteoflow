'use client'

import { MarkdownText } from '@/components/ui/markdown-text'
import { AnamnesisCards } from '@/components/consultations/anamnesis-cards'
import { AnamnesisSummaryView } from '@/components/consultations/anamnesis-summary-view'
import { useAnamnesisView } from '@/hooks/use-anamnesis-view'
import type { AnamnesisSection } from '@/components/consultations/anamnesis-recorder'

interface AnamnesisDisplayProps {
  anamnesis?: string | null
  /** JSON sérialisé des sections structurées par l'IA (colonne anamnesis_sections). */
  anamnesisSections?: string | null
  reason?: string
}

/**
 * Affiche l'anamnèse d'une consultation déjà enregistrée, en cartes ou en
 * relevé selon le réglage, avec repli sur le texte brut.
 *
 * Le mode n'est pas enregistré avec la consultation : c'est une préférence
 * d'affichage, relue à chaque ouverture. Une consultation dictée il y a six
 * mois en mode cartes s'affiche donc en relevé si le praticien a changé d'avis
 * depuis — les données sont les mêmes, seule la mise en forme change.
 */
export function AnamnesisDisplay({ anamnesis, anamnesisSections, reason }: AnamnesisDisplayProps) {
  const { view } = useAnamnesisView()

  let sections: AnamnesisSection[] | null = null
  if (anamnesisSections) {
    try {
      const parsed = JSON.parse(anamnesisSections)
      if (Array.isArray(parsed) && parsed.length > 0) sections = parsed
    } catch {
      /* repli texte */
    }
  }

  if (sections) {
    return view === 'summary' ? (
      <AnamnesisSummaryView reason={reason} sections={sections} disabled />
    ) : (
      <AnamnesisCards reason={reason} sections={sections} onEdit={() => {}} disabled />
    )
  }
  return <MarkdownText text={anamnesis || ''} />
}
