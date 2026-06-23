'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Sparkles, Loader2, RotateCcw, Check, AlertCircle, WifiOff, Download, UserPen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sectionsToMarkdown } from '@/lib/anamnesis'
import type { PatientFieldsDetected } from '@/types/ai'

export type { PatientFieldsDetected }

interface PatientContext {
  age?: number | null
  sex?: string | null
  profession?: string | null
  sport_activity?: string | null
  primary_physician?: string | null
  pregnancy_due_date?: string | null
  surgical_history?: string | null
  trauma_history?: string | null
  medical_history?: string | null
  family_history?: string | null
}

interface AnamnesisRecorderProps {
  onApply: (data: { reason: string; anamnesis: string; sections?: AnamnesisSection[] }) => void
  /** Fired at the start of the parallel hypotheses fetch so the parent can show a loader. */
  onHypothesesStart?: () => void
  /** Fired when the parallel hypotheses fetch resolves. null means failure/no result. */
  onHypothesesReady?: (payload: Record<string, unknown> | null) => void
  disabled?: boolean
  /** Consultation reason forwarded to the parallel hypotheses call. */
  reason?: string
  patientContext?: PatientContext
  patientId?: string
  onPatientFieldsDetected?: (fields: PatientFieldsDetected) => void
}

type RecorderState =
  | 'idle'
  | 'recording'
  | 'reconnecting'
  | 'transcribing'
  | 'processing'
  | 'done'
  | 'error'

// ─── Web Speech API types ────────────────────────

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  )
}

const MAX_RESTARTS = 10
const MAX_RECORD_SECONDS = 600  // 10 minutes
const WARN_RECORD_SECONDS = 540 // avertissement à 9 minutes

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI?.isDesktop
}

// ─── IndexedDB — cache audio blob (survie à la veille / erreur réseau) ────

const IDB_NAME = 'osteoflow-audio'
const IDB_STORE = 'drafts'
const IDB_KEY = 'current'
const IDB_TTL_MS = 24 * 60 * 60 * 1000

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      // Si la base existe déjà mais sans le store (création partielle ou
      // schéma plus ancien), onupgradeneeded ne se redéclenche pas à version
      // égale : on rouvre en incrémentant la version pour forcer la création.
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const nextVersion = db.version + 1
        db.close()
        const upgradeReq = indexedDB.open(IDB_NAME, nextVersion)
        upgradeReq.onupgradeneeded = () => {
          const upDb = upgradeReq.result
          if (!upDb.objectStoreNames.contains(IDB_STORE)) upDb.createObjectStore(IDB_STORE)
        }
        upgradeReq.onsuccess = () => resolve(upgradeReq.result)
        upgradeReq.onerror = () => reject(upgradeReq.error)
        return
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

async function saveAudioBlob(blob: Blob): Promise<void> {
  try {
    const db = await openAudioDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put({ blob, savedAt: Date.now() }, IDB_KEY)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) { console.warn('[AudioCache] save failed', e) }
}

async function loadAudioBlob(): Promise<Blob | null> {
  try {
    const db = await openAudioDB()
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => {
        db.close()
        const record = req.result
        if (!record || Date.now() - record.savedAt > IDB_TTL_MS) { resolve(null); return }
        resolve(record.blob)
      }
      req.onerror = () => { db.close(); resolve(null) }
    })
  } catch { return null }
}

async function clearAudioBlob(): Promise<void> {
  try {
    const db = await openAudioDB()
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(IDB_KEY)
    tx.oncomplete = () => db.close()
  } catch { /* silencieux */ }
}

export interface AnamnesisSection {
  id: string
  label: string
  icon: string
  color: 'red' | 'green' | 'slate' | 'sky' | 'teal' | 'indigo' | 'stone'
  items: string[]
  allClear?: boolean
}

export const SECTION_STYLES: Record<AnamnesisSection['color'], { card: string; label: string; item: string }> = {
  // Drapeaux rouges détectés
  red:    { card: 'bg-red-50/60 border-red-200 dark:bg-red-950/20 dark:border-red-800', label: 'text-red-600 dark:text-red-400', item: 'text-red-900 dark:text-red-200' },
  // Drapeaux rouges — aucun identifié
  green:  { card: 'bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-800', label: 'text-green-600 dark:text-green-400', item: 'text-green-900 dark:text-green-200' },
  // Sections neutres (sans connotation de gravité)
  slate:  { card: 'bg-slate-50/60 border-slate-200 dark:bg-slate-900/20 dark:border-slate-700', label: 'text-slate-600 dark:text-slate-400', item: 'text-slate-900 dark:text-slate-200' },
  sky:    { card: 'bg-sky-50/60 border-sky-200 dark:bg-sky-950/20 dark:border-sky-800', label: 'text-sky-600 dark:text-sky-400', item: 'text-sky-900 dark:text-sky-200' },
  teal:   { card: 'bg-teal-50/60 border-teal-200 dark:bg-teal-950/20 dark:border-teal-800', label: 'text-teal-600 dark:text-teal-400', item: 'text-teal-900 dark:text-teal-200' },
  indigo: { card: 'bg-indigo-50/60 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800', label: 'text-indigo-600 dark:text-indigo-400', item: 'text-indigo-900 dark:text-indigo-200' },
  stone:  { card: 'bg-stone-50/60 border-stone-200 dark:bg-stone-900/20 dark:border-stone-700', label: 'text-stone-600 dark:text-stone-400', item: 'text-stone-900 dark:text-stone-200' },
}

// ─── Composant ───────────────────────────────────────────────────────────────

export function AnamnesisRecorder({ onApply, onHypothesesStart, onHypothesesReady, disabled, reason, patientContext, patientId, onPatientFieldsDetected }: AnamnesisRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isElectronApp, setIsElectronApp] = useState(false)
  const [structured, setStructured] = useState<{ reason: string; anamnesis: string; sections?: AnamnesisSection[] } | null>(null)
  const [detectedFields, setDetectedFields] = useState<PatientFieldsDetected | null>(null)
  const [detectionSkipped, setDetectionSkipped] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [hasCachedAudio, setHasCachedAudio] = useState(false)

  // ── Refs communs ─────────────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finalTextRef = useRef('')
  const stateRef = useRef<RecorderState>('idle')

  // ── Web Speech API ────────────────────────────────────────────────────────
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restartCountRef = useRef(0)
  const intentionalStopRef = useRef(false)
  const SRRef = useRef<(new () => SpeechRecognitionInstance) | null>(null)

  // ── MediaRecorder (Electron) ──────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  // Quand true, transcribeBlob ajoute le nouveau texte à la suite du texte existant
  // au lieu de le remplacer (utilisé pour la continuation après arrêt automatique).
  const isContinuingRef = useRef(false)

  // Stable refs so the callbacks never appear in useCallback deps (avoids stale closures).
  const onHypothesesStartRef = useRef(onHypothesesStart)
  const onHypothesesReadyRef = useRef(onHypothesesReady)
  const reasonRef = useRef(reason)
  useEffect(() => { onHypothesesStartRef.current = onHypothesesStart }, [onHypothesesStart])
  useEffect(() => { onHypothesesReadyRef.current = onHypothesesReady }, [onHypothesesReady])
  useEffect(() => { reasonRef.current = reason }, [reason])

  // ── Workflow automatique ──────────────────────────────────────────────────
  // pendingStructure : on a arrêté la dictée et on veut structurer dès que le
  // transcript est prêt. applied : le résultat structuré a déjà été injecté dans
  // le formulaire (évite une double injection).
  const pendingStructureRef = useRef(false)
  const appliedRef = useRef(false)

  // ── Question hypothèses ────────────────────────────────────────────────────
  // Après la dictée, on demande explicitement si le praticien veut les hypothèses
  // (sinon on ne dépense pas de tokens). La question s'affiche PENDANT la
  // structuration : répondre « Oui » lance l'appel en parallèle (gain de latence),
  // « Non » ne déclenche rien. Le transcript sert de base aux deux appels.
  const [askHypotheses, setAskHypotheses] = useState<'hidden' | 'asking' | 'launched'>('hidden')
  const hypoTextRef = useRef('')

  // ── Persistance localStorage (survie à la veille/rechargement) ────────────
  // Clé spécifique au patient : un brouillon dicté ne doit jamais « fuiter »
  // d'un patient vers un autre. Sans patientId on retombe sur l'ancienne clé.
  const DRAFT_KEY = patientId ? `osteoflow-anamnesis-draft-${patientId}` : 'osteoflow-anamnesis-draft'
  const DRAFT_TTL_MS = 24 * 60 * 60 * 1000 // 24h

  const saveDraft = useCallback((text: string, structuredData: typeof structured) => {
    if (!text && !structuredData) { localStorage.removeItem(DRAFT_KEY); return }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, structured: structuredData, savedAt: Date.now() }))
  }, [DRAFT_KEY])

  const clearDraft = useCallback(() => { localStorage.removeItem(DRAFT_KEY) }, [DRAFT_KEY])

  // Restaure le brouillon texte et vérifie si un blob audio en attente existe
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const { text, structured: s, savedAt } = JSON.parse(raw)
        if (Date.now() - savedAt > DRAFT_TTL_MS) { clearDraft() }
        else {
          if (text) { finalTextRef.current = text; setFinalText(text) }
          if (s) { setStructured(s); setState('done') }
        }
      }
    } catch { clearDraft() }
    // Vérifie si un blob audio est en cache (transcription échouée lors d'une session précédente)
    loadAudioBlob().then((blob) => { if (blob) setHasCachedAudio(true) })
    setIsElectronApp(isElectron())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { finalTextRef.current = finalText }, [finalText])
  useEffect(() => { stateRef.current = state }, [state])
  // Sauvegarde dès que le texte ou le résultat structuré change
  useEffect(() => { saveDraft(finalText, structured) }, [finalText, structured, saveDraft])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const stopReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
  }, [])

  // ── Structuration Claude ──────────────────────────────────────────────────────

  const handleStructure = useCallback(async () => {
    const text = finalTextRef.current.trim()
    if (!text) return

    intentionalStopRef.current = true
    stopReconnectTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    stopTimer()

    setState('processing')
    setInterimText('')
    setStatusMsg('')

    // On propose les hypothèses (sans les lancer) : la question s'affiche pendant
    // que la structuration tourne. Le praticien décide → pas de tokens gaspillés.
    if (onHypothesesReadyRef.current) {
      hypoTextRef.current = text
      setAskHypotheses('asking')
    }

    try {
      const res = await fetch('/api/ai/structure-anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, currentPatient: patientContext }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Erreur lors de la structuration.'); setState('error'); return }
      // Les cartes (sections) sont la source unique : le texte est dérivé d'elles.
      // data.anamnesis n'est qu'un repli (ancien format / échec de structuration).
      const anamnesisText = data.sections && data.sections.length > 0
        ? sectionsToMarkdown(data.sections)
        : (data.anamnesis ?? '')
      setStructured({ reason: data.reason, anamnesis: anamnesisText, sections: data.sections })
      if (data.patient_fields && Object.keys(data.patient_fields).length > 0) {
        setDetectedFields(data.patient_fields)
      }
      setDetectionSkipped(!!data.detection_skipped)
      setState('done')
    } catch {
      setErrorMsg('Impossible de contacter le serveur.')
      setState('error')
    }
  }, [stopTimer, stopReconnectTimer, patientContext])

  // « Oui » à la question hypothèses : lance l'appel (en parallèle de la
  // structuration encore en cours → latence masquée). Fire-and-forget : le
  // résultat remonte au parent via onHypothesesReady.
  const requestHypotheses = useCallback(() => {
    const text = hypoTextRef.current.trim()
    if (!text || !onHypothesesReadyRef.current) return
    setAskHypotheses('launched')
    onHypothesesStartRef.current?.()
    fetch('/api/ai/generate-hypotheses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anamnesis: text, reason: reasonRef.current, patientContext }),
    })
      .then(async (hRes) => {
        if (!hRes.ok) { onHypothesesReadyRef.current?.(null); return }
        const hData = await hRes.json()
        onHypothesesReadyRef.current?.(
          hData?.hypotheses?.length ? (hData as Record<string, unknown>) : null,
        )
      })
      .catch(() => { onHypothesesReadyRef.current?.(null) })
      .finally(() => { setAskHypotheses('hidden') })
  }, [patientContext])

  // ── Réinitialisation ───────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    intentionalStopRef.current = true
    pendingStructureRef.current = false
    appliedRef.current = false
    stopReconnectTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    stopTimer()
    clearDraft()
    clearAudioBlob()
    setHasCachedAudio(false)
    setState('idle')
    setFinalText('')
    setInterimText('')
    setStructured(null)
    setDetectedFields(null)
    setDetectionSkipped(false)
    setAskHypotheses('hidden')
    setErrorMsg('')
    setStatusMsg('')
    setElapsed(0)
    restartCountRef.current = 0
    finalTextRef.current = ''
    audioChunksRef.current = []
  }, [stopTimer, stopReconnectTimer, clearDraft])

  useEffect(() => {
    return () => {
      intentionalStopRef.current = true
      stopReconnectTimer()
      recognitionRef.current?.stop()
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      stopTimer()
    }
  }, [stopTimer, stopReconnectTimer])

  // ══════════════════════════════════════════════════════════════════════════
  // MODE A – MediaRecorder + Groq Whisper API (Electron)
  // webkitSpeechRecognition nécessite les clés Google absentes d'Electron.
  // On enregistre l'audio avec MediaRecorder, puis on envoie le blob WebM
  // directement à notre API route qui appelle Groq (Whisper large-v3-turbo).
  // ══════════════════════════════════════════════════════════════════════════

  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (!blob || blob.size === 0) {
      setErrorMsg("Aucun audio enregistré.")
      setState('error')
      return
    }

    // Vercel functions cap at 4,5 Mo — reject early with a clear message
    if (blob.size > 4 * 1024 * 1024) {
      setErrorMsg(`L'enregistrement est trop long (${(blob.size / 1024 / 1024).toFixed(1)} Mo). Arrêtez la dictée plus tôt et utilisez « Continuer la dictée » pour enchaîner plusieurs segments.`)
      setState('error')
      return
    }

    const continuing = isContinuingRef.current
    isContinuingRef.current = false
    const previousText = continuing ? finalTextRef.current : ''

    // Sauvegarde le blob avant l'envoi — permet de réessayer en cas d'échec
    await saveAudioBlob(blob)
    setHasCachedAudio(true)

    setState('transcribing')
    setStatusMsg('Transcription en cours…')

    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Erreur de transcription.')
        setState('error')
        return
      }

      const newText = (data.transcript ?? '').trim()
      if (!newText) {
        setErrorMsg("Aucun texte détecté. Vérifiez que le micro capte bien votre voix.")
        setState('error')
        return
      }

      // Transcription réussie — on peut effacer le cache audio
      clearAudioBlob()
      setHasCachedAudio(false)

      const combined = previousText ? previousText.trimEnd() + ' ' + newText : newText
      finalTextRef.current = combined
      setFinalText(combined)
      setStatusMsg('')
      setState('idle')
    } catch (err) {
      console.error('[Groq transcribe]', err)
      setErrorMsg("Erreur de transcription. Vérifiez votre connexion internet.")
      setState('error')
    }
  }, [])

  const retryTranscription = useCallback(async () => {
    const blob = await loadAudioBlob()
    if (!blob) { setErrorMsg("Aucun enregistrement en cache."); return }
    setErrorMsg('')
    transcribeBlob(blob).catch((err) => {
      console.error('[Retry] transcribeBlob:', err)
      setErrorMsg('Erreur inattendue lors de la transcription.')
      setState('error')
    })
  }, [transcribeBlob])

  const startMediaRecorder = useCallback(async () => {
    finalTextRef.current = ''
    setFinalText('')
    setInterimText('')
    setStructured(null)
    setErrorMsg('')
    setStatusMsg('')
    setElapsed(0)
    audioChunksRef.current = []
    intentionalStopRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      // 32 kbps Opus : qualité vocale largement suffisante (~16 min pour 4 Mo)
      const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond: 32000 }
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        recorderOptions.mimeType = 'audio/webm;codecs=opus'
      }
      const recorder = new MediaRecorder(stream, recorderOptions)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        // .catch() is mandatory — an unhandled async rejection triggers webpack
        // HMR full reload which shows a white screen in dev mode.
        transcribeBlob(blob).catch((err) => {
          console.error('[Recorder] transcribeBlob:', err)
          setErrorMsg('Erreur inattendue lors de la transcription.')
          setState('error')
        })
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setState('recording')
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      setErrorMsg("Impossible d'accéder au microphone. Vérifiez les permissions.")
      setState('error')
    }
  }, [transcribeBlob])

  const stopMediaRecorder = useCallback(() => {
    stopTimer()
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }, [stopTimer])

  // Relance l'enregistrement en conservant le texte déjà transcrit.
  const continueMediaRecorder = useCallback(async () => {
    isContinuingRef.current = true
    setInterimText('')
    setStructured(null)
    setErrorMsg('')
    setStatusMsg('')
    setElapsed(0)
    audioChunksRef.current = []
    intentionalStopRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond: 32000 }
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        recorderOptions.mimeType = 'audio/webm;codecs=opus'
      }
      const recorder = new MediaRecorder(stream, recorderOptions)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        transcribeBlob(blob).catch((err) => {
          console.error('[Recorder] transcribeBlob:', err)
          setErrorMsg('Erreur inattendue lors de la transcription.')
          setState('error')
        })
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setState('recording')
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      isContinuingRef.current = false
      setErrorMsg("Impossible d'accéder au microphone. Vérifiez les permissions.")
      setState('error')
    }
  }, [transcribeBlob])

  // Auto-stop à MAX_RECORD_SECONDS — doit être après stopMediaRecorder
  useEffect(() => {
    if (state === 'recording' && elapsed >= MAX_RECORD_SECONDS) {
      stopMediaRecorder()
    }
  }, [elapsed, state, stopMediaRecorder])

  // ══════════════════════════════════════════════════════════════════════════
  // MODE B – Web Speech API (navigateur)
  // Transcription en temps réel via l'API speech intégrée au navigateur.
  // ══════════════════════════════════════════════════════════════════════════

  const attachHandlers = useCallback(
    (recognition: SpeechRecognitionInstance) => {
      recognition.onresult = (e: SpeechRecognitionEvent) => {
        let interim = ''
        let newFinal = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript
          if (e.results[i].isFinal) newFinal += t + ' '
          else interim += t
        }
        if (newFinal) { finalTextRef.current += newFinal; setFinalText(finalTextRef.current) }
        setInterimText(interim)
      }
      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'no-speech' || e.error === 'aborted' || e.error === 'network') return
        setErrorMsg(`Erreur microphone : ${e.error}`)
        setState('error')
        stopTimer()
      }
      recognition.onend = () => {
        setInterimText('')
        if (intentionalStopRef.current) return
        const cur = stateRef.current
        if (cur !== 'recording' && cur !== 'reconnecting') return
        if (restartCountRef.current >= MAX_RESTARTS) {
          setState('error')
          setErrorMsg('Connexion interrompue. Le texte dicté est conservé — vous pouvez le structurer.')
          stopTimer()
          return
        }
        restartCountRef.current++
        setState('reconnecting')
        stopReconnectTimer()
        reconnectTimerRef.current = setTimeout(() => {
          if (intentionalStopRef.current || !SRRef.current) return
          const SR = SRRef.current
          const newRec = new SR()
          newRec.continuous = true
          newRec.interimResults = true
          newRec.lang = 'fr-FR'
          attachHandlers(newRec)
          recognitionRef.current = newRec
          try { newRec.start(); setState('recording') }
          catch { setState('error'); setErrorMsg("Impossible de redémarrer l'écoute."); stopTimer() }
        }, 1500)
      }
    },
    [stopTimer, stopReconnectTimer]
  )

  const startSpeechRecognition = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) { setErrorMsg("La reconnaissance vocale n'est pas disponible dans ce navigateur."); setState('error'); return }
    SRRef.current = SR
    finalTextRef.current = ''
    setFinalText('')
    setInterimText('')
    setStructured(null)
    setErrorMsg('')
    setStatusMsg('')
    setElapsed(0)
    restartCountRef.current = 0
    intentionalStopRef.current = false
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'fr-FR'
    attachHandlers(recognition)
    recognitionRef.current = recognition
    recognition.start()
    setState('recording')
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }, [attachHandlers])

  const stopSpeechRecognition = useCallback(() => {
    intentionalStopRef.current = true
    stopReconnectTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopTimer()
    setState('idle')
  }, [stopTimer, stopReconnectTimer])

  // ─── Handlers unifiés ────────────────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    appliedRef.current = false
    pendingStructureRef.current = false
    setAskHypotheses('hidden')
    if (isElectron()) startMediaRecorder()
    else startSpeechRecognition()
  }, [startMediaRecorder, startSpeechRecognition])

  const stopRecording = useCallback(() => {
    // Marque qu'on veut structurer automatiquement dès que le transcript est prêt.
    pendingStructureRef.current = true
    if (isElectron()) stopMediaRecorder()
    else stopSpeechRecognition()
  }, [stopMediaRecorder, stopSpeechRecognition])

  // Auto-structuration : dès que la dictée est arrêtée et le transcript prêt.
  // Web uniquement (dictée continue). En Electron on garde le flux manuel pour
  // permettre « Continuer la dictée » en plusieurs segments avant de structurer.
  useEffect(() => {
    if (
      pendingStructureRef.current &&
      !isElectron() &&
      state === 'idle' &&
      finalText.trim().length > 0 &&
      !structured
    ) {
      pendingStructureRef.current = false
      void handleStructure()
    }
  }, [state, finalText, structured, handleStructure])

  // Auto-injection : dès que la structuration est terminée, on injecte directement
  // dans le champ Anamnèse (cartes éditables). On laisse ensuite l'éventuelle revue
  // des infos patient détectées, puis on replie le bloc une fois tout traité.
  useEffect(() => {
    if (state !== 'done') return
    if (structured && !appliedRef.current) {
      appliedRef.current = true
      onApply(structured)
      clearDraft()
      // Le résultat vit désormais dans le champ Anamnèse : on masque l'aperçu ici.
      setStructured(null)
      return
    }
    if (appliedRef.current && !structured && !detectedFields) {
      clearAudioBlob()
      setHasCachedAudio(false)
      setState('idle')
      setFinalText('')
      setInterimText('')
      setDetectionSkipped(false)
      setElapsed(0)
      finalTextRef.current = ''
    }
  }, [state, structured, detectedFields, onApply, clearDraft, clearAudioBlob])

  const acceptField = useCallback((key: keyof PatientFieldsDetected) => {
    if (!detectedFields || !onPatientFieldsDetected) return
    const value = detectedFields[key]
    if (value !== undefined) onPatientFieldsDetected({ [key]: value } as PatientFieldsDetected)
    setDetectedFields((prev) => {
      if (!prev) return null
      const next = { ...prev }
      delete next[key]
      return Object.keys(next).length > 0 ? next : null
    })
  }, [detectedFields, onPatientFieldsDetected])

  const rejectField = useCallback((key: keyof PatientFieldsDetected) => {
    setDetectedFields((prev) => {
      if (!prev) return null
      const next = { ...prev }
      delete next[key]
      return Object.keys(next).length > 0 ? next : null
    })
  }, [])

  const acceptAllFields = useCallback(() => {
    if (!detectedFields || !onPatientFieldsDetected) return
    onPatientFieldsDetected(detectedFields)
    setDetectedFields(null)
  }, [detectedFields, onPatientFieldsDetected])

  // ─── Rendu ────────────────────────────────────────────────────────────────────────────

  const hasTranscript = finalText.trim().length > 0

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-muted/30 p-4 space-y-3 transition-all',
        state === 'recording' && 'border-red-300 bg-red-50/50 dark:bg-red-950/20',
        state === 'reconnecting' && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20',
        state === 'transcribing' && 'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20',
        state === 'done' && 'border-green-300 bg-green-50/50 dark:bg-green-950/20'
      )}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state === 'recording' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {isElectron() ? 'Enregistrement — ' : 'Écoute en cours — '}
              {formatTime(elapsed)}
            </span>
          ) : state === 'reconnecting' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
              <WifiOff className="h-3.5 w-3.5 animate-pulse" />
              Reconnexion en cours…
            </span>
          ) : state === 'transcribing' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
              {statusMsg.includes('éléchargement') ? (
                <Download className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {statusMsg || 'Transcription…'}
            </span>
          ) : state === 'processing' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Structuration de l&apos;anamnèse en cours…
            </span>
          ) : state === 'done' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <Check className="h-3.5 w-3.5" />
              Anamnèse structurée
            </span>
          ) : state === 'error' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Écoute interrompue
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Mic className="h-3.5 w-3.5" />
              Dictée de l&apos;anamnèse
              {isElectronApp && (
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded px-1.5 py-0.5 font-normal">
                  Groq Whisper
                </span>
              )}
            </span>
          )}
        </div>

        {state === 'idle' && !hasTranscript && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Ne citez pas le nom du patient.
          </p>
        )}

        {(state !== 'idle' || hasTranscript || !!structured) && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* Question hypothèses — affichée pendant la structuration. « Oui » lance
          l'appel en parallèle (latence masquée), « Non » n'engage aucun token. */}
      {askHypotheses === 'asking' && (state === 'processing' || state === 'done') && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 dark:border-violet-800/50 dark:bg-violet-950/30">
          <span className="flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Besoin des hypothèses de diagnostic ?
          </span>
          <div className="flex gap-2 shrink-0">
            <Button type="button" size="sm" onClick={requestHypotheses} className="h-7 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
              <Sparkles className="h-3.5 w-3.5" />
              Oui
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAskHypotheses('hidden')} className="h-7 text-muted-foreground">
              Non
            </Button>
          </div>
        </div>
      )}
      {askHypotheses === 'launched' && (state === 'processing' || state === 'done') && (
        <div className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm font-medium text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Génération des hypothèses en cours…
        </div>
      )}

      {/* Avertissement durée — à 9 min, arrêt automatique à 10 min */}
      {state === 'recording' && elapsed >= WARN_RECORD_SECONDS && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Arrêt automatique dans {formatTime(MAX_RECORD_SECONDS - elapsed)} — pensez à structurer l&apos;anamnèse.
        </div>
      )}

      {/* Transcript */}
      {(state === 'recording' ||
        state === 'reconnecting' ||
        state === 'error' ||
        (hasTranscript && state !== 'done')) && (
        <div className="min-h-[80px] max-h-[200px] overflow-y-auto rounded-lg bg-background border px-3 py-2 text-sm leading-relaxed">
          <span>{finalText}</span>
          {interimText && <span className="text-muted-foreground italic">{interimText}</span>}
          {!finalText && !interimText && (
            <span className="text-muted-foreground">
              {state === 'recording' && isElectron()
                ? 'Parlez, puis appuyez sur Arrêter pour transcrire…'
                : 'Parlez maintenant…'}
            </span>
          )}
        </div>
      )}

      {state === 'error' && errorMsg && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}

      {/* Résultat structuré */}
      {state === 'done' && structured && (
        <div className="space-y-2">
          {/* Motif pill */}
          {structured.reason && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 max-w-full break-words bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full px-3 py-1">
                🎯 {structured.reason}
              </span>
            </div>
          )}

          {/* Cards sections */}
          {structured.sections && structured.sections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {structured.sections.map((section) => {
                const isRedFlags = section.id === 'red_flags'
                const effectiveColor = isRedFlags
                  ? (section.allClear ? 'green' : 'red')
                  : section.color
                const styles = SECTION_STYLES[effectiveColor] ?? SECTION_STYLES.slate
                return (
                  <div
                    key={section.id}
                    className={cn(
                      'rounded-lg border px-2.5 py-2 text-xs min-w-0',
                      styles.card,
                      isRedFlags && 'sm:col-span-2'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                      <span className="shrink-0">{section.icon}</span>
                      <span className={cn('font-semibold uppercase tracking-wide text-[10px] leading-tight break-words min-w-0', styles.label)}>
                        {section.label}
                      </span>
                      {isRedFlags && section.allClear && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                          <Check className="h-3 w-3" /> Aucun identifié
                        </span>
                      )}
                    </div>
                    {isRedFlags && section.allClear ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                        {section.items.filter(i => i !== '—').map((item, i) => (
                          <span key={i} className={cn('flex items-center gap-1', styles.item)}>
                            <Check className="h-2.5 w-2.5 text-green-500 shrink-0" />
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <ul className="space-y-0.5 list-none pl-0">
                        {section.items.map((item, i) => (
                          <li key={i} className={cn('leading-relaxed break-words', item === '—' ? 'text-muted-foreground italic' : styles.item)}>
                            {item !== '—' && <span className="mr-1 opacity-40">·</span>}
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Fallback texte si pas de sections (réponse ancienne format) */
            <div className="rounded-lg bg-background border px-3 py-2 text-sm leading-relaxed max-h-[300px] overflow-y-auto">
              <div className="text-muted-foreground space-y-1">
                {structured.anamnesis.split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} className="h-1" />
                  const parts = line.split(/\*\*(.+?)\*\*/g)
                  return (
                    <p key={i} className="leading-relaxed">
                      {parts.map((part, j) =>
                        j % 2 === 1 ? (
                          <strong key={j} className="font-semibold text-foreground">{part}</strong>
                        ) : part
                      )}
                    </p>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detected patient fields */}
      {state === 'done' && detectedFields && onPatientFieldsDetected && (() => {
        const FIELDS: { key: keyof PatientFieldsDetected; label: string; color?: string; format?: (v: string) => string }[] = [
          { key: 'profession', label: 'Profession' },
          { key: 'sport_activity', label: 'Activité sportive' },
          { key: 'primary_physician', label: 'Médecin traitant' },
          { key: 'pregnancy_due_date', label: 'Terme grossesse', format: (v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) },
          { key: 'surgical_history', label: 'Chirurgical', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' },
          { key: 'trauma_history', label: 'Traumatique', color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700' },
          { key: 'medical_history', label: 'Médical', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
          { key: 'family_history', label: 'Familial', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
        ]
        const active = FIELDS.filter(({ key }) => detectedFields[key] !== undefined)
        return (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/30 px-3 py-2.5 space-y-2">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
              <UserPen className="h-3.5 w-3.5" />
              Informations patient détectées
            </p>
            <div className="space-y-1.5">
              {active.map(({ key, label, color, format }) => {
                const value = detectedFields[key] as string
                return (
                  <div key={key} className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      {color && (
                        <span className={`shrink-0 mt-0.5 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
                          {label}
                        </span>
                      )}
                      <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                        {!color && <span className="font-medium">{label} :{' '}</span>}
                        {format ? format(value) : value}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0 mt-0.5">
                      <button
                        type="button"
                        onClick={() => acceptField(key)}
                        className="h-5 w-5 rounded flex items-center justify-center text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                        title="Accepter"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectField(key)}
                        className="h-5 w-5 rounded flex items-center justify-center text-indigo-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                        title="Ignorer"
                      >
                        <span className="text-[10px] font-bold leading-none">✕</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {active.length > 1 && (
              <div className="flex items-center gap-2 pt-0.5 border-t border-indigo-100 dark:border-indigo-800">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700"
                  onClick={acceptAllFields}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Valider tout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-indigo-500"
                  onClick={() => setDetectedFields(null)}
                >
                  Tout ignorer
                </Button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Detection skipped hint */}
      {state === 'done' && detectionSkipped && onPatientFieldsDetected && (
        <p className="text-xs text-muted-foreground">
          💡 La détection automatique des informations patient sera disponible après mise à jour du serveur IA.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {state === 'idle' && !hasTranscript && (
          <>
            <Button type="button" size="sm" onClick={startRecording} disabled={disabled} className="gap-1.5">
              <Mic className="h-3.5 w-3.5" />
              Démarrer l&apos;écoute
            </Button>
            {hasCachedAudio && (
              <Button type="button" size="sm" variant="outline" onClick={retryTranscription} className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50">
                <RotateCcw className="h-3.5 w-3.5" />
                Réessayer la transcription
              </Button>
            )}
          </>
        )}

        {state === 'recording' && (
          <Button type="button" size="sm" variant="destructive" onClick={stopRecording} className="gap-1.5">
            <MicOff className="h-3.5 w-3.5" />
            Arrêter
          </Button>
        )}

        {state === 'reconnecting' && (
          <Button type="button" size="sm" variant="outline" onClick={stopRecording} className="gap-1.5">
            <MicOff className="h-3.5 w-3.5" />
            Annuler
          </Button>
        )}

        {(state === 'idle' || state === 'error') && hasTranscript && (
          <>
            <Button type="button" size="sm" onClick={handleStructure} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Transcrire et structurer
            </Button>
            {isElectron() && state === 'idle' && (
              <Button type="button" size="sm" variant="outline" onClick={continueMediaRecorder} className="gap-1.5">
                <Mic className="h-3.5 w-3.5" />
                Continuer la dictée
              </Button>
            )}
          </>
        )}

        {state === 'error' && !hasTranscript && hasCachedAudio && (
          <Button type="button" size="sm" variant="outline" onClick={retryTranscription} className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50">
            <RotateCcw className="h-3.5 w-3.5" />
            Réessayer la transcription
          </Button>
        )}

      </div>
    </div>
  )
}
