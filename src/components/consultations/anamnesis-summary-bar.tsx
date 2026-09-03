'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Check, Clock, HelpCircle, MoveHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnamnesisVitals } from '@/lib/anamnesis'

/**
 * Bandeau de synthèse de l'anamnèse : la phrase à relire à voix haute au patient,
 * puis les paramètres chiffrés en pastilles.
 *
 * L'intention est de rendre la vérification possible en consultation. Relire
 * trente items pendant que le patient attend est irréaliste ; relire une phrase
 * et la faire confirmer par le patient prend dix secondes et vérifie à la
 * source. Les pastilles sont extraites des cartes elles-mêmes
 * (`deriveAnamnesisVitals`) : elles ne peuvent donc pas les contredire, et une
 * donnée absente n'est pas affichée plutôt que devinée.
 */

/** Zone de texte qui grandit avec son contenu, pour éditer sans tronquer. */
function GrowTextarea({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  ariaLabel: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('w-full resize-none overflow-hidden bg-transparent outline-none border-0 p-0', className)}
    />
  )
}

/**
 * Bandes d'intensité. Trois seuils seulement : c'est ce qui permet de lire la
 * jauge sans lire le chiffre.
 */
function evaTone(eva: number): { bar: string; text: string } {
  if (eva >= 7) return { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300' }
  if (eva >= 4) return { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' }
}

const PILL = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap'
const PILL_NEUTRAL = 'bg-muted/60 border-border text-muted-foreground'

function EvaPill({ eva }: { eva: number }) {
  const tone = evaTone(eva)
  return (
    <span
      className={cn(PILL, 'bg-background', tone.text, eva >= 7 ? 'border-red-300 dark:border-red-800' : eva >= 4 ? 'border-amber-300 dark:border-amber-800' : 'border-emerald-300 dark:border-emerald-800')}
      title={`Intensité douloureuse : ${eva} sur 10`}
    >
      <span className="font-semibold tabular-nums">EVA {eva}/10</span>
      <span className="flex items-center gap-[1.5px]" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn('h-2.5 w-[3px] rounded-full', i < eva ? tone.bar : 'bg-muted-foreground/20')}
          />
        ))}
      </span>
    </span>
  )
}

function RedFlagPill({ vitals }: { vitals: AnamnesisVitals }) {
  if (vitals.redFlags === 'clear') {
    return (
      <span className={cn(PILL, 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300')}>
        <Check className="h-3 w-3" />
        Drapeaux rouges : aucun
      </span>
    )
  }
  if (vitals.redFlags === 'flagged') {
    return (
      <span className={cn(PILL, 'bg-red-50 border-red-300 text-red-700 font-semibold dark:bg-red-950/40 dark:border-red-700 dark:text-red-300')}>
        <AlertTriangle className="h-3 w-3" />
        {vitals.redFlagCount} drapeau{vitals.redFlagCount > 1 ? 'x' : ''} rouge{vitals.redFlagCount > 1 ? 's' : ''}
      </span>
    )
  }
  // Rubrique absente : ne rien affirmer. Annoncer un dépistage négatif qui n'a
  // pas eu lieu serait pire que de ne rien afficher.
  return (
    <span className={cn(PILL, PILL_NEUTRAL)}>
      <HelpCircle className="h-3 w-3" />
      Drapeaux rouges non renseignés
    </span>
  )
}

interface AnamnesisSummaryBarProps {
  reason?: string
  /** Phrase de synthèse produite par l'IA. Absente sur les anamnèses antérieures. */
  summary?: string | null
  vitals: AnamnesisVitals
  /** Fournis en mode éditable (formulaire de consultation). */
  onReasonChange?: (value: string) => void
  onSummaryChange?: (value: string) => void
}

export function AnamnesisSummaryBar({
  reason,
  summary,
  vitals,
  onReasonChange,
  onSummaryChange,
}: AnamnesisSummaryBarProps) {
  const editable = !!onReasonChange || !!onSummaryChange
  const hasPills =
    vitals.eva !== null || vitals.onset !== null || vitals.side !== null || vitals.redFlags !== 'unknown' || vitals.toConfirm > 0

  if (!reason && !summary && !hasPills && !editable) return null

  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 space-y-2">
      {/* Motif : la seule ligne en rouge, parce que c'est la question posée. */}
      {(reason || onReasonChange) && (
        <div className="flex items-start gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
          <span className="shrink-0 leading-relaxed" aria-hidden="true">🎯</span>
          {onReasonChange ? (
            <GrowTextarea
              ariaLabel="Motif principal"
              value={reason ?? ''}
              onChange={onReasonChange}
              placeholder="Motif principal"
              className="text-sm font-semibold text-red-700 dark:text-red-300 placeholder:text-red-400/70"
            />
          ) : (
            <span className="break-words">{reason}</span>
          )}
        </div>
      )}

      {/* Phrase de synthèse : celle que le praticien relit au patient. */}
      {onSummaryChange ? (
        <GrowTextarea
          ariaLabel="Synthèse de l'anamnèse"
          value={summary ?? ''}
          onChange={onSummaryChange}
          placeholder="Synthèse en une phrase (à relire au patient)"
          className="text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 placeholder:italic"
        />
      ) : (
        summary && <p className="text-[13px] leading-relaxed text-foreground break-words">{summary}</p>
      )}

      {hasPills && (
        <div className="flex flex-wrap items-center gap-1.5">
          {vitals.eva !== null && <EvaPill eva={vitals.eva} />}
          {vitals.onset && (
            <span className={cn(PILL, PILL_NEUTRAL)} title="Ancienneté de la plainte">
              <Clock className="h-3 w-3" />
              {vitals.onset}
            </span>
          )}
          {vitals.side && (
            <span className={cn(PILL, PILL_NEUTRAL)} title="Latéralité">
              <MoveHorizontal className="h-3 w-3" />
              {vitals.side}
            </span>
          )}
          <RedFlagPill vitals={vitals} />
          {vitals.toConfirm > 0 && (
            <span
              className={cn(PILL, 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200')}
              title="Termes transcrits de façon incertaine, à confirmer auprès du patient"
            >
              <HelpCircle className="h-3 w-3" />
              {vitals.toConfirm} point{vitals.toConfirm > 1 ? 's' : ''} à confirmer
            </span>
          )}
        </div>
      )}
    </div>
  )
}
