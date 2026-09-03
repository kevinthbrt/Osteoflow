'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Mic, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLiveDictation } from '@/hooks/use-live-dictation'
import {
  applyOps,
  linesToReason,
  linesToSections,
  type LiveLine,
} from '@/lib/anamnesis-live'
import { sectionsToMarkdown, type AnamnesisSection } from '@/lib/anamnesis'
import { LiveLineFeed } from '@/components/consultations/live/live-line-feed'
import { LiveChecklist } from '@/components/consultations/live/live-checklist'

/**
 * Mode consultation : l'anamnèse s'écrit pendant qu'elle se dit.
 *
 * L'écran ne montre que ce qui sert tant que le patient est là. La facturation,
 * la relance et les pièces jointes appartiennent à un autre moment et restent
 * dans le formulaire, où on arrive ensuite.
 *
 * Le panneau reste affiché après l'arrêt de la dictée : il sert aussi de mémo
 * pendant l'examen, quand les consultations s'enchaînent et qu'on ne sait plus
 * si une question a été posée à ce patient ou au précédent.
 */

export interface LiveResult {
  reason: string
  sections: AnamnesisSection[]
  markdown: string
  /** Dictée intégrale, conservée comme filet si l'extraction a perdu un passage. */
  transcript: string
}

interface ConsultationLiveProps {
  patientName: string
  /** Contexte transmis à l'extraction (âge, profession, antécédents connus). */
  patientContext?: string
  onFinish: (result: LiveResult) => Promise<void> | void
  onCancel: () => void
  finishing?: boolean
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ConsultationLive({
  patientName,
  patientContext,
  onFinish,
  onCancel,
  finishing,
}: ConsultationLiveProps) {
  const [lines, setLines] = useState<LiveLine[]>([])
  const [redFlagsCleared, setRedFlagsCleared] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [degraded, setDegraded] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  // L'extraction lit l'état courant au moment de l'appel, pas celui capturé à la
  // création de la fonction : sans ce miroir, deux passages rapprochés
  // enverraient tous les deux un état périmé et la correction retomberait à côté.
  const linesRef = useRef<LiveLine[]>([])
  useEffect(() => { linesRef.current = lines }, [lines])

  const queueRef = useRef<string[]>([])
  const busyRef = useRef(false)
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false }, [])

  /**
   * Traite les passages en attente, un appel à la fois.
   *
   * Deux appels simultanés partiraient du même état et se contrediraient. Les
   * passages accumulés pendant un appel en cours sont regroupés en un seul :
   * la dictée ne prend pas de retard, et on économise des appels.
   */
  const pump = useCallback(async () => {
    if (busyRef.current) return
    const pending = queueRef.current.splice(0, queueRef.current.length).join(' ').trim()
    if (!pending) return

    busyRef.current = true
    setExtracting(true)
    try {
      const res = await fetch('/api/ai/live-anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passage: pending,
          lines: linesRef.current.map((l) => ({ id: l.id, axis: l.axis, text: l.text })),
          context: patientContext,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Un passage perdu ne doit pas interrompre la consultation : la dictée
        // intégrale reste conservée et le praticien en est averti.
        setDegraded(true)
      } else if (aliveRef.current) {
        setLines((prev) => applyOps(prev, data.ops))
      }
    } catch {
      setDegraded(true)
    } finally {
      busyRef.current = false
      if (aliveRef.current) setExtracting(false)
      if (queueRef.current.length > 0) void pump()
    }
  }, [patientContext])

  const handlePassage = useCallback((passage: string) => {
    queueRef.current.push(passage)
    void pump()
  }, [pump])

  const dictation = useLiveDictation({ onPassage: handlePassage })

  const editLine = useCallback((id: string, text: string) => {
    // `edited` verrouille la ligne : entre le jugement du praticien et celui du
    // modèle, c'est le sien qui fait foi.
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text, edited: true, confidence: 'high' } : l)))
  }, [])

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const finish = useCallback(async () => {
    if (dictation.isRecording) dictation.stop()
    const sections = linesToSections(lines, redFlagsCleared)
    await onFinish({
      reason: linesToReason(lines),
      sections,
      markdown: sectionsToMarkdown(sections),
      transcript: dictation.transcript,
    })
  }, [dictation, lines, redFlagsCleared, onFinish])

  const hasContent = lines.length > 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* En-tête : qui, depuis combien de temps, et le micro. Rien d'autre. */}
      <header className="flex shrink-0 items-center gap-4 border-b px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Quitter le mode consultation"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight">{patientName}</h1>
          <p className="text-xs text-muted-foreground">Mode consultation</p>
        </div>

        {extracting && (
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Loader2 className="h-3 w-3 animate-spin" />
            analyse
          </span>
        )}

        {dictation.isRecording && (
          <span className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {formatElapsed(dictation.elapsed)}
          </span>
        )}

        <Button
          type="button"
          size="sm"
          variant={dictation.isRecording ? 'secondary' : 'default'}
          onClick={() => (dictation.isRecording ? dictation.stop() : void dictation.start())}
          disabled={dictation.state === 'transcribing' || finishing}
        >
          {dictation.isRecording ? (
            <><Square className="mr-1.5 h-3.5 w-3.5" /> Arrêter</>
          ) : (
            <><Mic className="mr-1.5 h-3.5 w-3.5" /> Dicter</>
          )}
        </Button>
      </header>

      {(dictation.error || degraded) && (
        <div className="flex shrink-0 items-start gap-2 border-b bg-amber-50 px-5 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {dictation.error ||
              "Un passage n'a pas pu être analysé. Ouvrez la dictée intégrale en bas de l'écran pour vérifier ce qui manque."}
          </span>
        </div>
      )}

      {/* Le fil à gauche, ce qui manque à droite. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="min-h-0 flex-1 overflow-y-auto">
          <LiveLineFeed
            lines={lines}
            interim={dictation.interim}
            onEdit={editLine}
            onRemove={removeLine}
          />
        </main>

        <aside className={cn(
          'shrink-0 overflow-y-auto border-t bg-muted/20',
          'lg:w-80 lg:border-l lg:border-t-0 xl:w-96',
        )}>
          <LiveChecklist
            lines={lines}
            redFlagsCleared={redFlagsCleared}
            onClearRedFlags={setRedFlagsCleared}
          />
        </aside>
      </div>

      {/* La dictée brute reste consultable tant qu'on peut encore agir dessus :
          c'est le filet quand un passage n'a pas été analysé. */}
      {showTranscript && dictation.transcript && (
        <div className="max-h-40 shrink-0 overflow-y-auto border-t bg-muted/30 px-5 py-3 text-[13px] leading-relaxed text-muted-foreground">
          {dictation.transcript}
        </div>
      )}

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {hasContent
              ? `${lines.length} élément${lines.length > 1 ? 's' : ''} relevé${lines.length > 1 ? 's' : ''}`
              : 'Rien de relevé pour l\'instant'}
          </p>
          {dictation.transcript && (
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="shrink-0 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
            >
              {showTranscript ? 'Masquer la dictée' : 'Dictée intégrale'}
            </button>
          )}
        </div>
        <Button type="button" onClick={finish} disabled={!hasContent || finishing}>
          {finishing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Préparation…</> : 'Terminer l\'anamnèse'}
        </Button>
      </footer>
    </div>
  )
}
