'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Command as CommandIcon,
  Loader2,
  Mic,
  Sparkles,
  Square,
} from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { calculateAge, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { ClinicalToolboxDialog } from '@/components/consultations/clinical-toolbox-dialog'
import { OrthoTestsPickerDialog } from '@/components/consultations/ortho-tests-picker-dialog'
import { TopographyPanel } from '@/components/consultations/topography-panel'
import { AnamnesisSummary } from './anamnesis-summary'
import { CommandPalette, type Command } from './command-palette'
import { Copilot, type SignalTrace } from './copilot'
import { formatDuration, useDictation } from './use-dictation'
import {
  applySignal,
  detectRegion,
  signalsFromRecord,
  signalsFromQuestionnaire,
  type Region,
  type SignalId,
} from '@/lib/reasoning'
import type { Patient } from '@/types/database'

interface ConsultationCockpitProps {
  patient: Patient
  onUseClassicForm: () => void
}

type Field = 'reason' | 'anamnesis' | 'examination' | 'advice'

interface Draft {
  reason: string
  anamnesis: string
  examination: string
  advice: string
  savedAt: number
}

const SECTIONS: { field: Exclude<Field, 'reason'>; label: string; placeholder: string }[] = [
  { field: 'anamnesis', label: 'Anamnèse', placeholder: 'Ce que le patient raconte…' },
  { field: 'examination', label: 'Examen et traitement', placeholder: 'Ce que vous trouvez, ce que vous faites…' },
  { field: 'advice', label: 'Conseils', placeholder: 'Ce que le patient emporte…' },
]

/** Zone de texte sans cadre qui grandit avec son contenu. */
function GrowingTextarea({
  value,
  onChange,
  placeholder,
  onFocus,
  id,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  onFocus?: () => void
  id?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [value])

  return (
    <textarea
      id={id}
      ref={ref}
      value={value}
      onFocus={onFocus}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={1}
      className="w-full resize-none bg-transparent border-0 p-0 text-[15px] leading-[1.75] outline-none placeholder:text-muted-foreground/35 focus:ring-0"
    />
  )
}

export function ConsultationCockpit({ patient, onUseClassicForm }: ConsultationCockpitProps) {
  const router = useRouter()
  const { toast } = useToast()
  const db = useMemo(() => createClient(), [])

  const [reason, setReason] = useState('')
  const [anamnesis, setAnamnesis] = useState('')
  const [examination, setExamination] = useState('')
  const [advice, setAdvice] = useState('')

  // Âge et sexe sont dans le dossier : les demander ferait perdre confiance au
  // copilote, et le sexe entre dans la combinaison validée pour la fracture.
  const fromRecord = useMemo(
    () =>
      signalsFromRecord(
        calculateAge(patient.birth_date),
        patient.gender,
        patient.pregnancy_due_date,
      ),
    [patient.birth_date, patient.gender, patient.pregnancy_due_date],
  )
  const [signals, setSignals] = useState<Partial<Record<SignalId, boolean>>>(() => fromRecord)
  const [traces, setTraces] = useState<Partial<Record<SignalId, SignalTrace>>>(() =>
    Object.fromEntries(Object.keys(fromRecord).map((signal) => [signal, { source: 'dossier' }])),
  )
  const [regionOverride, setRegionOverride] = useState<Region | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [aiStatus, setAiStatus] = useState<'ok' | 'unconfigured' | 'error'>('ok')
  const [anamnesisView, setAnamnesisView] = useState<'elements' | 'texte'>('texte')
  /** Le praticien a choisi lui-même sa vue : on ne la lui reprend plus. */
  const viewChosenRef = useRef(false)
  const [doneActions, setDoneActions] = useState<string[]>([])

  const [showPalette, setShowPalette] = useState(false)
  const [showToolbox, setShowToolbox] = useState(false)
  const [toolboxQuestionnaire, setToolboxQuestionnaire] = useState<string | undefined>()
  const [pendingAction, setPendingAction] = useState<string | undefined>()
  const [showOrthoTests, setShowOrthoTests] = useState(false)
  const [showTopography, setShowTopography] = useState(false)
  const [saving, setSaving] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [restorable, setRestorable] = useState<Draft | null>(null)

  const region = regionOverride ?? detectRegion(reason, signals)
  const draftKey = `osteoflow:cockpit:${patient.id}`

  // ── Chronomètre de séance ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // ── Brouillon local ──────────────────────────────────────────────────────
  // Une consultation perdue parce que la machine s'est mise en veille est le
  // pire scénario de la journée : on écrit en local, sans réseau ni base.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      if (!stored) return
      const draft = JSON.parse(stored) as Draft
      const fresh = Date.now() - draft.savedAt < 12 * 60 * 60 * 1000
      if (fresh && (draft.anamnesis || draft.examination || draft.advice || draft.reason)) {
        setRestorable(draft)
      }
    } catch {
      /* un brouillon illisible ne doit jamais empêcher d'ouvrir l'écran */
    }
  }, [draftKey])

  useEffect(() => {
    if (!reason && !anamnesis && !examination && !advice) return
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ reason, anamnesis, examination, advice, savedAt: Date.now() }),
        )
      } catch {
        /* quota plein : on continue, la sauvegarde en base reste la référence */
      }
    }, 1500)
    return () => clearTimeout(handle)
  }, [draftKey, reason, anamnesis, examination, advice])

  // ── Extraction des signaux ───────────────────────────────────────────────
  const tracesRef = useRef(traces)
  tracesRef.current = traces
  const signalsRef = useRef(signals)
  signalsRef.current = signals

  /** Texte déjà soumis à l'analyse, pour n'envoyer ensuite que la suite. */
  const texteAnalyseRef = useRef('')

  const extract = useCallback(
    async (text: string, { complet = false }: { complet?: boolean } = {}) => {
      if (!text.trim()) return

      // Relire tout le texte à chaque segment fait grossir l'appel à mesure que
      // l'anamnèse s'allonge, pour une information qui, elle, n'augmente que du
      // dernier passage. On n'envoie donc que la suite, avec ce qui est déjà
      // relevé en rappel — sauf si le praticien a réécrit en amont, auquel cas
      // les repères ne valent plus rien et on repart du texte entier.
      const suite = !complet && text.startsWith(texteAnalyseRef.current)
      const CHEVAUCHEMENT = 200
      const envoi = suite
        ? text.slice(Math.max(0, texteAnalyseRef.current.length - CHEVAUCHEMENT))
        : text
      if (suite && envoi.trim().length < 15) return

      const known = suite
        ? (Object.entries(signalsRef.current) as [SignalId, boolean | undefined][])
            .filter(([, value]) => value !== undefined)
            .map(([id, value]) => ({ id, value: value as boolean }))
        : []

      setExtracting(true)
      try {
        const res = await fetch('/api/ai/extract-signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: envoi, reason, known }),
        })
        const data = await res.json()
        // Une analyse qui échoue en silence est pire qu'une analyse absente :
        // le praticien dicte et croit que le copilote a écouté.
        if (!res.ok) {
          setAiStatus('error')
          return
        }
        setAiStatus(data.unconfigured ? 'unconfigured' : 'ok')
        texteAnalyseRef.current = text
        const extracted = (data.signals ?? []) as { id: SignalId; value: boolean; verbatim?: string }[]
        if (extracted.length === 0) return

        // Ce que le praticien a répondu lui-même fait autorité : l'extraction
        // complète le relevé, elle ne le corrige pas.
        setSignals((current) => {
          const next = { ...current }
          for (const signal of extracted) {
            const trace = tracesRef.current[signal.id]
            if (trace && trace.source !== 'dictée') continue
            next[signal.id] = signal.value
          }
          return next
        })
        setTraces((current) => {
          const next = { ...current }
          for (const signal of extracted) {
            if (next[signal.id] && next[signal.id]!.source !== 'dictée') continue
            next[signal.id] = { source: 'dictée', verbatim: signal.verbatim }
          }
          return next
        })
      } catch {
        // Le copilote reste pilotable à la main : on le signale, on n'échoue pas.
        setAiStatus('error')
      } finally {
        setExtracting(false)
      }
    },
    [reason],
  )

  /**
   * Cadence de l'analyse, distincte de celle de la transcription.
   *
   * Les segments partent toutes les quelques secondes pour que le texte suive
   * la parole. Relancer l'analyse à chaque segment ferait des dizaines
   * d'appels sur un texte qui ne cesse de croître, pour un copilote qui bouge
   * à peine entre deux. On analyse donc peu après que la parole s'arrête, et
   * au moins une fois toutes les douze secondes si elle ne s'arrête pas.
   */
  const ANALYSE_APRES_SILENCE_MS = 2_500
  const ANALYSE_AU_PLUS_TARD_MS = 12_000

  const analyseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const derniereAnalyseRef = useRef(0)
  const texteEnAttenteRef = useRef('')

  const scheduleExtraction = useCallback(
    (text: string) => {
      texteEnAttenteRef.current = text
      const run = () => {
        derniereAnalyseRef.current = Date.now()
        void extract(texteEnAttenteRef.current)
      }
      if (analyseTimerRef.current) clearTimeout(analyseTimerRef.current)
      if (Date.now() - derniereAnalyseRef.current >= ANALYSE_AU_PLUS_TARD_MS) {
        run()
        return
      }
      analyseTimerRef.current = setTimeout(run, ANALYSE_APRES_SILENCE_MS)
    },
    [extract],
  )

  useEffect(
    () => () => {
      if (analyseTimerRef.current) clearTimeout(analyseTimerRef.current)
    },
    [],
  )

  const dictation = useDictation({
    onText: (text) => {
      setAnamnesis((current) => {
        const combined = current.trim() ? `${current.trimEnd()} ${text}` : text
        // On réanalyse le texte entier plutôt que le seul segment : une phrase
        // à cheval sur deux segments se relit correctement, et une extraction
        // ratée se rattrape au passage suivant.
        scheduleExtraction(combined)
        return combined
      })
    },
  })

  const markDone = useCallback((actionId: string) => {
    setDoneActions((current) => (current.includes(actionId) ? current : [...current, actionId]))
  }, [])

  const answerSignal = useCallback((signal: SignalId, value: boolean) => {
    setSignals((current) => applySignal(current, signal, value))
    setTraces((current) => ({ ...current, [signal]: { source: 'praticien' } }))
  }, [])

  const appendTo = useCallback((field: Exclude<Field, 'reason'>, text: string) => {
    const setters = { anamnesis: setAnamnesis, examination: setExamination, advice: setAdvice }
    setters[field]((current) => (current.trim() ? `${current}\n\n${text}` : text))
  }, [])

  // ── Enregistrement ───────────────────────────────────────────────────────
  const finish = useCallback(async () => {
    if (!reason.trim()) {
      toast({ title: 'Le motif est requis', variant: 'destructive' })
      document.getElementById('cockpit-reason')?.focus()
      return
    }
    setSaving(true)
    try {
      const { data, error } = await db
        .from('consultations')
        .insert({
          patient_id: patient.id,
          date_time: new Date().toISOString(),
          reason: reason.trim(),
          anamnesis: anamnesis.trim() || null,
          examination: examination.trim() || null,
          advice: advice.trim() || null,
          follow_up_7d: false,
        })
        .select()
        .single()

      if (error) throw error
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* sans importance : la consultation est enregistrée */
      }
      toast({ title: 'Consultation enregistrée' })
      router.push(`/consultations/${data.id}`)
    } catch (error) {
      console.error('[cockpit] enregistrement', error)
      toast({
        title: 'Enregistrement impossible',
        description: 'Vos notes restent à l\'écran. Réessayez dans un instant.',
        variant: 'destructive',
      })
      setSaving(false)
    }
  }, [advice, anamnesis, db, draftKey, examination, patient.id, reason, router, toast])

  // ── Raccourcis ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setShowPalette((open) => !open)
      } else if (meta && event.key === 'Enter') {
        event.preventDefault()
        void finish()
      } else if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        dictation.toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dictation, finish])

  const commands: Command[] = useMemo(
    () => [
      { id: 'dictee', label: dictation.state === 'recording' ? 'Arrêter la dictée' : 'Dicter l\'anamnèse', shortcut: '⌘D', run: dictation.toggle },
      { id: 'analyser', label: 'Relire toute l\'anamnèse et mettre à jour le copilote', run: () => void extract(anamnesis, { complet: true }) },
      { id: 'toolbox', label: 'Caisse à outils — questionnaires', hint: 'DN4, Oswestry, STarT Back…', run: () => { setToolboxQuestionnaire(undefined); setShowToolbox(true) } },
      { id: 'ortho', label: 'Tests orthopédiques', run: () => setShowOrthoTests(true) },
      { id: 'topo', label: 'Topographie de la douleur', run: () => setShowTopography(true) },
      { id: 'patient', label: 'Ouvrir la fiche patient', run: () => router.push(`/patients/${patient.id}`) },
      { id: 'classique', label: 'Basculer sur le formulaire complet', hint: 'facturation, pièces jointes', run: onUseClassicForm },
      { id: 'terminer', label: 'Terminer la consultation', shortcut: '⌘↵', run: () => void finish() },
    ],
    [anamnesis, dictation.state, dictation.toggle, extract, finish, onUseClassicForm, patient.id, router],
  )

  const started = anamnesis.trim().length > 0
  const recording = dictation.state === 'recording'
  const transcribing = dictation.pendingSegments > 0
  const relevéCount = Object.values(signals).filter((value) => value !== undefined).length

  // Dès qu'il y a de quoi lire, on montre le relevé : c'est ce qui rend la
  // dictée exploitable en séance. Le texte reste à une bascule.
  useEffect(() => {
    if (!viewChosenRef.current && relevéCount > 0) setAnamnesisView('elements')
  }, [relevéCount])

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Barre supérieure */}
      <header className="h-14 shrink-0 border-b border-border/50 flex items-center gap-3 px-4 lg:px-6">
        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1 shrink-0" asChild>
          <Link href={`/patients/${patient.id}`} aria-label="Retour à la fiche patient">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="text-[14px] font-semibold tracking-tight truncate">
            {patient.first_name} {patient.last_name}
          </span>
          <span className="text-[12px] text-muted-foreground/60 shrink-0">
            {calculateAge(patient.birth_date)} ans
          </span>
        </div>

        <div className="flex-1" />

        <span className="text-[12px] tabular-nums text-muted-foreground/50">
          {formatDuration(elapsed)}
        </span>
        <button
          type="button"
          onClick={() => setShowPalette(true)}
          className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-muted-foreground/60 hover:text-foreground px-2 py-1 rounded-md hover:bg-foreground/[0.04] transition-colors"
        >
          <CommandIcon className="h-3 w-3" />
          K
        </button>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => void finish()} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Terminer
        </Button>
      </header>

      {restorable && (
        <div className="shrink-0 flex items-center gap-3 px-4 lg:px-6 py-2 bg-amber-50/70 dark:bg-amber-950/25 border-b border-amber-200/60 dark:border-amber-900/40">
          <p className="text-[12px] text-amber-900 dark:text-amber-200 flex-1">
            Une consultation non terminée a été retrouvée pour ce patient.
          </p>
          <button
            type="button"
            onClick={() => {
              setReason(restorable.reason)
              setAnamnesis(restorable.anamnesis)
              setExamination(restorable.examination)
              setAdvice(restorable.advice)
              setRestorable(null)
              if (restorable.anamnesis) void extract(restorable.anamnesis, { complet: true })
            }}
            className="text-[12px] font-semibold text-amber-900 dark:text-amber-200 hover:underline"
          >
            Reprendre
          </button>
          <button
            type="button"
            onClick={() => { setRestorable(null); try { localStorage.removeItem(draftKey) } catch { /* rien */ } }}
            className="text-[12px] text-amber-800/70 dark:text-amber-300/70 hover:underline"
          >
            Ignorer
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Le compte rendu */}
        <main className="flex-1 overflow-y-auto relative">
          <div className="max-w-[680px] mx-auto px-6 lg:px-10 py-8 pb-32">
            <input
              id="cockpit-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Motif de consultation"
              className="w-full bg-transparent border-0 p-0 text-[24px] font-semibold tracking-tight outline-none placeholder:text-muted-foreground/25 focus:ring-0"
            />

            {started && (
            <div className="mt-8 space-y-8">
              {SECTIONS.map((section) => (
                <section key={section.field}>
                  <div className="flex items-center justify-between mb-1.5 h-6">
                    <label
                      htmlFor={`cockpit-${section.field}`}
                      className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/45"
                    >
                      {section.label}
                    </label>
                    {section.field === 'anamnesis' && (
                      <div className="flex items-center gap-2">
                        {relevéCount > 0 && (
                          <div className="flex gap-0.5 p-0.5 rounded-lg bg-foreground/[0.04]">
                            {(['elements', 'texte'] as const).map((view) => (
                              <button
                                key={view}
                                type="button"
                                onClick={() => { viewChosenRef.current = true; setAnamnesisView(view) }}
                                className={cn(
                                  'text-[10.5px] font-medium px-2 py-0.5 rounded-md transition-colors',
                                  anamnesisView === view
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {view === 'elements' ? 'Éléments' : 'Texte'}
                              </button>
                            ))}
                          </div>
                        )}
                        {anamnesis.trim() && !recording && (
                          <button
                            type="button"
                            onClick={() => void extract(anamnesis, { complet: true })}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-primary transition-colors"
                          >
                            <Sparkles className="h-3 w-3" />
                            Relire
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={dictation.toggle}
                          className={cn(
                            'flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md transition-colors',
                            recording
                              ? 'bg-rose-500 text-white hover:bg-rose-600'
                              : 'text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.05]',
                          )}
                        >
                          {recording ? (
                            <>
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 animate-ping" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                              </span>
                              {formatDuration(dictation.elapsed)}
                            </>
                          ) : transcribing ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Transcription…
                            </>
                          ) : (
                            <>
                              <Mic className="h-3 w-3" />
                              Dicter
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {section.field === 'anamnesis' && anamnesisView === 'elements' ? (
                    <AnamnesisSummary signals={signals} traces={traces} />
                  ) : (
                    <GrowingTextarea
                      id={`cockpit-${section.field}`}
                      value={
                        section.field === 'anamnesis'
                          ? anamnesis
                          : section.field === 'examination'
                            ? examination
                            : advice
                      }
                      onChange={
                        section.field === 'anamnesis'
                          ? setAnamnesis
                          : section.field === 'examination'
                            ? setExamination
                            : setAdvice
                      }
                      placeholder={section.placeholder}
                    />
                  )}

                  {section.field === 'anamnesis' && dictation.error && (
                    <p className="mt-2 text-[11.5px] text-rose-600 dark:text-rose-400">
                      {dictation.error}
                    </p>
                  )}
                </section>
              ))}
            </div>
            )}

            {!started && (
              <div className="flex flex-col items-center justify-center text-center pt-24 pb-16">
                <button
                  type="button"
                  onClick={dictation.toggle}
                  className={cn(
                    'group relative flex items-center justify-center h-20 w-20 rounded-full transition-all',
                    recording
                      ? 'bg-rose-500 text-white'
                      : 'bg-foreground text-background hover:scale-[1.04] active:scale-[0.98] shadow-lg hover:shadow-xl',
                  )}
                >
                  {recording && (
                    <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
                  )}
                  {recording ? (
                    <Square className="h-6 w-6 fill-current" />
                  ) : transcribing ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <Mic className="h-7 w-7" />
                  )}
                </button>
                <p className="mt-5 text-[14px] font-medium">
                  {recording
                    ? formatDuration(dictation.elapsed)
                    : transcribing
                      ? 'Transcription…'
                      : 'Dictez l’anamnèse'}
                </p>
                <p className="mt-1 text-[12.5px] text-muted-foreground/60">
                  {recording
                    ? 'Parlez sans vous arrêter — le copilote suit'
                    : 'ou commencez à écrire ci-dessous'}
                </p>
                {dictation.error && (
                  <p className="mt-3 text-[11.5px] text-rose-600 dark:text-rose-400 max-w-xs">
                    {dictation.error}
                  </p>
                )}
                <textarea
                  value={anamnesis}
                  onChange={(event) => setAnamnesis(event.target.value)}
                  placeholder="…"
                  rows={1}
                  aria-label="Anamnèse"
                  className="mt-6 w-full resize-none bg-transparent border-0 p-0 text-center text-[15px] leading-[1.75] outline-none placeholder:text-muted-foreground/25 focus:ring-0"
                />
              </div>
            )}
          </div>
        </main>

        <Copilot
          region={region}
          signals={signals}
          traces={traces}
          busy={extracting}
          started={started}
          done={doneActions}
          aiStatus={aiStatus}
          onAnswer={answerSignal}
          onOpenQuestionnaire={(questionnaireId, actionId) => {
            setToolboxQuestionnaire(questionnaireId)
            setPendingAction(actionId)
            setShowToolbox(true)
          }}
          onRegionChange={setRegionOverride}
        />
      </div>

      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} commands={commands} />

      <ClinicalToolboxDialog
        open={showToolbox}
        initialQuestionnaireId={toolboxQuestionnaire}
        onClose={() => { setShowToolbox(false); setToolboxQuestionnaire(undefined); setPendingAction(undefined) }}
        onInject={(text, target, result) => {
          appendTo(target, text)
          if (pendingAction) markDone(pendingAction)
          if (!result) return
          // Un questionnaire rempli vaut mieux qu'une question posée au vol :
          // ce qu'il tranche prend la place de la réponse du praticien.
          const learned = signalsFromQuestionnaire(result.questionnaireId, result.score)
          const entries = Object.entries(learned) as [SignalId, boolean][]
          if (entries.length === 0) return
          setSignals((current) =>
            entries.reduce((accumulator, [signal, value]) => applySignal(accumulator, signal, value), current),
          )
          setTraces((current) => {
            const next = { ...current }
            for (const [signal] of entries) next[signal] = { source: 'test' }
            return next
          })
        }}
      />
      <OrthoTestsPickerDialog
        open={showOrthoTests}
        onClose={() => setShowOrthoTests(false)}
        onInject={(text) => appendTo('examination', text)}
      />
      <TopographyPanel open={showTopography} onClose={() => setShowTopography(false)} />
    </div>
  )
}
