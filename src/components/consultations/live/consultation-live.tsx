'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Mic, PanelLeft, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLiveDictation } from '@/hooks/use-live-dictation'
import {
  applyOps,
  AXES,
  linesToReason,
  linesToSections,
  type AxisId,
  type LiveLine,
} from '@/lib/anamnesis-live'
import { sectionsToMarkdown, type AnamnesisSection } from '@/lib/anamnesis'
import { LiveLineFeed } from '@/components/consultations/live/live-line-feed'
import { LiveChecklist } from '@/components/consultations/live/live-checklist'
import {
  LivePatientPanel,
  type HistoryEntry,
  type PastConsultation,
  type PatientSummary,
} from '@/components/consultations/live/live-patient-panel'

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

/** État complet du mode consultation, rendu au formulaire pour son brouillon. */
export interface LiveState {
  lines: LiveLine[]
  redFlagsCleared: boolean
  dismissedAxes: AxisId[]
}

interface ConsultationLiveProps {
  patientName: string
  /** Dossier affiché à gauche, en lecture seule. */
  patient: PatientSummary
  history: HistoryEntry[]
  pastConsultations: PastConsultation[]
  /** Contexte transmis à l'extraction (âge, profession, antécédents connus). */
  patientContext?: string
  onFinish: (result: LiveResult) => Promise<void> | void
  onCancel: () => void
  finishing?: boolean
  /** État repris d'un brouillon, au montage seulement. */
  initialState?: LiveState
  /** Remonte l'état à chaque changement, pour que le parent le persiste. */
  onStateChange?: (state: LiveState) => void
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ConsultationLive({
  patientName,
  patient,
  history,
  pastConsultations,
  patientContext,
  onFinish,
  onCancel,
  finishing,
  initialState,
  onStateChange,
}: ConsultationLiveProps) {
  const [lines, setLines] = useState<LiveLine[]>(initialState?.lines ?? [])
  const [redFlagsCleared, setRedFlagsCleared] = useState(!!initialState?.redFlagsCleared)
  const [dismissedAxes, setDismissedAxes] = useState<AxisId[]>(initialState?.dismissedAxes ?? [])
  const [showPatient, setShowPatient] = useState(true)
  // Une anamnèse reprise doit se signaler : sans quoi le praticien croit
  // repartir de zéro et redicte par-dessus.
  const [restored, setRestored] = useState((initialState?.lines?.length ?? 0) > 0)
  const [extracting, setExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)

  /**
   * Sur macOS la fenêtre est en `hiddenInset` : les boutons de fermeture flottent
   * au-dessus du contenu, en haut à gauche. Ailleurs dans l'application la barre
   * latérale occupe cette zone ; ici l'en-tête y passait dessous. Détecté après
   * le montage pour ne pas désaligner le rendu serveur.
   */
  const [macInset, setMacInset] = useState(false)
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { platform?: string } }).electronAPI
    setMacInset(api?.platform === 'darwin')
  }, [])

  // L'extraction lit l'état courant au moment de l'appel, pas celui capturé à la
  // création de la fonction : sans ce miroir, deux passages rapprochés
  // enverraient tous les deux un état périmé et la correction retomberait à côté.
  const linesRef = useRef<LiveLine[]>([])
  useEffect(() => { linesRef.current = lines }, [lines])

  const queueRef = useRef<string[]>([])
  const busyRef = useRef(false)
  const aliveRef = useRef(true)
  // Le drapeau doit être REPOSÉ au montage, pas seulement levé au démontage :
  // en mode strict React monte, démonte puis remonte le composant, si bien
  // qu'une simple fonction de nettoyage le laissait à false pour toujours.
  // L'extraction tournait alors dans le vide, la dictée s'affichait mais aucune
  // ligne n'arrivait et l'indicateur d'analyse ne s'éteignait jamais.
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Un passage perdu n'interrompt pas la consultation, mais il ne doit pas
        // non plus passer inaperçu : le message exact est affiché, sans quoi
        // l'écran se contente de tourner sans rien dire.
        if (aliveRef.current) setExtractionError(data?.error || `Analyse indisponible (${res.status})`)
      } else if (aliveRef.current) {
        setExtractionError('')
        setLines((prev) => applyOps(prev, data.ops))
      }
    } catch {
      if (aliveRef.current) setExtractionError('Analyse injoignable. Vérifiez votre connexion.')
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

  /* ── État remonté ─────────────────────────────────────────────────────────
   *
   * Le mode consultation ne persiste rien lui-même : il rend son état au
   * formulaire, qui possède le brouillon. Deux écrivains sur le même brouillon
   * s'écrasaient, celui-ci ne connaissant ni l'examen ni les conseils déjà
   * saisis. Une anamnèse recueillie puis perdue serait pourtant pire que pas
   * d'anamnèse du tout : le patient est reparti, on ne la refait pas.
   */
  useEffect(() => {
    onStateChange?.({ lines, redFlagsCleared, dismissedAxes })
  }, [lines, redFlagsCleared, dismissedAxes, onStateChange])

  const editLine = useCallback((id: string, text: string) => {
    // `edited` verrouille la ligne : entre le jugement du praticien et celui du
    // modèle, c'est le sien qui fait foi.
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text, edited: true, confidence: 'high' } : l)))
  }, [])

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const addLine = useCallback((axis: AxisId, text: string) => {
    // Posée par le praticien, donc verrouillée d'emblée : l'IA n'a pas à
    // réécrire ce qu'il a saisi lui-même.
    setLines((prev) => applyOps(prev, [{ op: 'add', id: crypto.randomUUID(), axis, text }])
      .map((l) => (l.text === text && l.axis === axis ? { ...l, edited: true } : l)))
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

  const requiredAxes = AXES.filter((a) => a.required && !dismissedAxes.includes(a.id))
  const coveredCount = requiredAxes.filter((a) => lines.some((l) => l.axis === a.id)).length
  const coverage = requiredAxes.length > 0 ? (coveredCount / requiredAxes.length) * 100 : 100

  return (
    // z-[60] et non z-50 : la pastille de simulation d'offre et la bulle de
    // support flottent en z-50 et se superposaient à l'écran de consultation,
    // qui doit être le seul élément visible tant que le patient est là.
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* En-tête : qui, depuis combien de temps, et le micro. Rien d'autre. */}
      <header className={cn('relative flex shrink-0 items-center gap-4 border-b bg-card px-5 py-3', macInset && 'pl-24')}>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Quitter le mode consultation"
        >
          <X className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowPatient((v) => !v)}
          className={cn(
            'rounded-lg p-1.5 transition-colors hover:bg-muted',
            showPatient ? 'text-foreground' : 'text-muted-foreground',
          )}
          aria-label={showPatient ? 'Masquer le dossier patient' : 'Afficher le dossier patient'}
          aria-pressed={showPatient}
        >
          <PanelLeft className="h-4 w-4" />
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

        {/* Au démarrage l'action est portée par le micro central : le bouton
            d'en-tête ne réapparaît qu'une fois qu'il y a quelque chose à
            reprendre ou à arrêter. */}
        {(dictation.isRecording || lines.length > 0) && (
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
              <><Mic className="mr-1.5 h-3.5 w-3.5" /> Reprendre</>
            )}
          </Button>
        )}

        {/* Sensation d'avancement : sur dix minutes d'interrogatoire, rien ne
            disait qu'on progressait. Deux pixels au bas de l'en-tête suffisent. */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-transparent">
          <div
            className="h-full bg-primary/70 transition-[width] duration-500"
            style={{ width: `${coverage}%` }}
            role="progressbar"
            aria-valuenow={Math.round(coverage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Couverture de l'interrogatoire"
          />
        </div>
      </header>

      {restored && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/50 px-5 py-2 text-xs text-muted-foreground">
          <span>Anamnèse en cours restaurée. Reprenez la dictée ou terminez.</span>
          <button
            type="button"
            onClick={() => { setLines([]); setRedFlagsCleared(false); setDismissedAxes([]); setRestored(false) }}
            className="shrink-0 underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
          >
            Repartir de zéro
          </button>
        </div>
      )}

      {(dictation.error || extractionError) && (
        <div className="flex shrink-0 items-start gap-2 border-b bg-amber-50 px-5 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {dictation.error || `${extractionError} La dictée continue et reste consultable en bas de l'écran.`}
          </span>
        </div>
      )}

      {/* Le fil à gauche, ce qui manque à droite. */}
      <div className="flex min-h-0 flex-1 flex-col bg-background lg:flex-row">
        {showPatient && (
          <aside className="shrink-0 overflow-y-auto border-b lg:w-64 lg:border-b-0 lg:border-r xl:w-72">
            <LivePatientPanel patient={patient} history={history} pastConsultations={pastConsultations} />
          </aside>
        )}

        <main className="relative min-h-0 flex-1 overflow-y-auto bg-card shadow-[0_0_40px_-12px_rgba(0,0,0,0.30)]">
          <LiveLineFeed
            lines={lines}
            interim={dictation.interim}
            onEdit={editLine}
            onRemove={removeLine}
            onAdd={addLine}
            onStart={() => void dictation.start()}
            isRecording={dictation.isRecording}
          />
        </main>

        <aside className={cn(
          'shrink-0 overflow-y-auto border-t',
          'lg:w-80 lg:border-l lg:border-t-0 xl:w-96',
        )}>
          <LiveChecklist
            lines={lines}
            redFlagsCleared={redFlagsCleared}
            onClearRedFlags={setRedFlagsCleared}
            dismissedAxes={dismissedAxes}
            onDismissAxis={(axis) => setDismissedAxes((prev) => [...prev, axis])}
            onRestoreAxes={() => setDismissedAxes([])}
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

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-card px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
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
