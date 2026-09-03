'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { MarkdownText } from '@/components/ui/markdown-text'
import { AnamnesisCards } from '@/components/consultations/anamnesis-cards'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/db/client'
import type { AnamnesisSection } from '@/lib/anamnesis'

interface AnamnesisDisplayProps {
  anamnesis?: string | null
  /** JSON sérialisé des sections structurées par l'IA (colonne anamnesis_sections). */
  anamnesisSections?: string | null
  /**
   * Phrase de synthèse (colonne anamnesis_summary). Absente sur les
   * consultations structurées avant son introduction : les pastilles du bandeau,
   * elles, sont recalculées depuis les cartes et restent donc disponibles.
   */
  anamnesisSummary?: string | null
  reason?: string
  /**
   * Fourni pour permettre la reprise : une consultation antérieure dont les
   * cartes existent mais qui n'a pas de phrase de synthèse peut en obtenir une
   * à la demande, enregistrée sur la consultation.
   */
  consultationId?: string
}

/**
 * Affiche l'anamnèse soit sous forme de cartes (si des sections structurées par
 * l'IA ont été enregistrées), soit en texte markdown classique en repli.
 * Lecture seule, utilisé sur les consultations passées / déjà enregistrées.
 */
export function AnamnesisDisplay({
  anamnesis,
  anamnesisSections,
  anamnesisSummary,
  reason,
  consultationId,
}: AnamnesisDisplayProps) {
  const { toast } = useToast()
  const [summary, setSummary] = useState<string | null>(anamnesisSummary ?? null)
  const [generating, setGenerating] = useState(false)

  let sections: AnamnesisSection[] | null = null
  if (anamnesisSections) {
    try {
      const parsed = JSON.parse(anamnesisSections)
      if (Array.isArray(parsed) && parsed.length > 0) sections = parsed
    } catch { /* repli texte */ }
  }

  if (!sections) return <MarkdownText text={anamnesis || ''} />

  const cards = sections

  const generateSummary = async () => {
    if (!consultationId) return
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/summarize-anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, sections: cards }),
      })
      const data = await res.json()
      if (!res.ok || !data.summary) {
        toast({ title: 'Synthèse impossible', description: data.error || 'Réessayez dans un instant.', variant: 'destructive' })
        return
      }

      // Enregistrée sur la consultation : la synthèse d'une anamnèse figée n'a
      // aucune raison d'être recalculée (ni repayée) à chaque réouverture.
      const { error } = await createClient()
        .from('consultations')
        .update({ anamnesis_summary: data.summary })
        .eq('id', consultationId)

      if (error) {
        toast({ title: 'Synthèse non enregistrée', description: error.message, variant: 'destructive' })
      }
      setSummary(data.summary)
    } catch {
      toast({ title: 'Synthèse impossible', description: 'Impossible de contacter le serveur.', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <AnamnesisCards reason={reason} summary={summary} sections={cards} onEdit={() => {}} disabled />
      {!summary && consultationId && (
        <button
          type="button"
          onClick={generateSummary}
          disabled={generating}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generating ? 'Synthèse en cours…' : 'Résumer cette anamnèse en une phrase'}
        </button>
      )}
    </div>
  )
}
