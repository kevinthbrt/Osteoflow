'use client'

import { MarkdownText } from '@/components/ui/markdown-text'
import { AnamnesisCards } from '@/components/consultations/anamnesis-cards'
import type { AnamnesisSection } from '@/components/consultations/anamnesis-recorder'

interface AnamnesisDisplayProps {
  anamnesis?: string | null
  /** JSON sérialisé des sections structurées par l'IA (colonne anamnesis_sections). */
  anamnesisSections?: string | null
  reason?: string
}

/**
 * Affiche l'anamnèse soit sous forme de cartes (si des sections structurées par
 * l'IA ont été enregistrées), soit en texte markdown classique en repli.
 * Lecture seule — utilisé sur les consultations passées / déjà enregistrées.
 */
export function AnamnesisDisplay({ anamnesis, anamnesisSections, reason }: AnamnesisDisplayProps) {
  let sections: AnamnesisSection[] | null = null
  if (anamnesisSections) {
    try {
      const parsed = JSON.parse(anamnesisSections)
      if (Array.isArray(parsed) && parsed.length > 0) sections = parsed
    } catch { /* repli texte */ }
  }

  if (sections) {
    return <AnamnesisCards reason={reason} sections={sections} onEdit={() => {}} disabled />
  }
  return <MarkdownText text={anamnesis || ''} />
}
