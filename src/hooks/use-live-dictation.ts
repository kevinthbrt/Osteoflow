'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dictée incrémentale : émet des PASSAGES au fil de la parole, au lieu d'un
 * texte unique à la fin.
 *
 * Deux chemins, imposés par l'environnement :
 *
 * - Navigateur : la Web Speech API est déjà incrémentale, on regroupe ses
 *   segments finaux et on les émet par paquets.
 * - Electron : webkitSpeechRecognition y est indisponible (elle réclame des clés
 *   Google absentes du binaire). La dictée existante enregistre donc tout puis
 *   transcrit à la fin, ce qui interdit le temps réel. On enregistre ici par
 *   segments roulants : le MediaRecorder est arrêté et relancé toutes les
 *   quinze secondes sur le MÊME flux micro, et chaque segment part en
 *   transcription pendant que le suivant s'enregistre.
 *
 * Pourquoi arrêter et relancer plutôt que d'utiliser `start(timeslice)` : les
 * fragments WebM produits par timeslice n'ont pas d'en-tête après le premier et
 * ne sont pas décodables isolément. Un segment complet l'est.
 */

/** Durée d'un segment audio en mode Electron. */
const SEGMENT_MS = 15000
/** Intervalle de regroupement des segments finaux en mode navigateur. */
const FLUSH_MS = 6000

export type DictationState = 'idle' | 'recording' | 'transcribing' | 'error'

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

/** Les capacités que l'on cherche sur `window`, sans passer par `any`. */
interface DictationWindow {
  SpeechRecognition?: new () => SpeechRecognitionInstance
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  electronAPI?: { isDesktop?: boolean }
}

function dictationWindow(): DictationWindow | null {
  return typeof window === 'undefined' ? null : (window as unknown as DictationWindow)
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = dictationWindow()
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null
}

export function isElectron(): boolean {
  return !!dictationWindow()?.electronAPI?.isDesktop
}

interface UseLiveDictationOptions {
  /** Appelé à chaque passage prononcé. Reçoit le texte nouveau, jamais l'intégralité. */
  onPassage: (passage: string) => void
}

export function useLiveDictation({ onPassage }: UseLiveDictationOptions) {
  const [state, setState] = useState<DictationState>('idle')
  const [interim, setInterim] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  /** Texte intégral dicté, conservé comme filet en cas d'échec de l'extraction. */
  const [transcript, setTranscript] = useState('')

  const onPassageRef = useRef(onPassage)
  useEffect(() => { onPassageRef.current = onPassage }, [onPassage])

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bufferRef = useRef('')
  const stoppingRef = useRef(false)

  const emit = useCallback((passage: string) => {
    const text = passage.trim()
    if (!text) return
    setTranscript((prev) => (prev ? `${prev} ${text}` : text))
    onPassageRef.current(text)
  }, [])

  const flushBuffer = useCallback(() => {
    const pending = bufferRef.current.trim()
    bufferRef.current = ''
    if (pending) emit(pending)
  }, [emit])

  const clearTimers = useCallback(() => {
    for (const ref of [segmentTimerRef, flushTimerRef, tickTimerRef]) {
      if (ref.current) { clearInterval(ref.current); ref.current = null }
    }
  }, [])

  /* ── Mode Electron : segments roulants ─────────────────────────────────── */

  const transcribeSegment = useCallback(async (blob: Blob) => {
    if (!blob || blob.size === 0) return
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      })
      const data = await res.json()
      if (!res.ok) {
        // Un segment perdu ne doit pas arrêter la dictée : le suivant est déjà
        // en cours d'enregistrement. On le signale sans changer d'état.
        console.error('[dictée] segment non transcrit', data?.error)
        return
      }
      emit((data.transcript ?? '').trim())
    } catch (err) {
      console.error('[dictée] segment', err)
    }
  }, [emit])

  const startSegment = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    const options: MediaRecorderOptions = { audioBitsPerSecond: 32000 }
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options.mimeType = 'audio/webm;codecs=opus'
    }
    const recorder = new MediaRecorder(stream, options)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      // Volontairement sans await : le segment suivant démarre immédiatement,
      // la transcription de celui-ci se fait pendant qu'on continue d'écouter.
      void transcribeSegment(blob)
    }
    recorder.start()
    recorderRef.current = recorder
  }, [transcribeSegment])

  const rollSegment = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    if (!stoppingRef.current) startSegment()
  }, [startSegment])

  /* ── Démarrage / arrêt ─────────────────────────────────────────────────── */

  const start = useCallback(async () => {
    setError('')
    setInterim('')
    setElapsed(0)
    bufferRef.current = ''
    stoppingRef.current = false
    tickTimerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)

    if (isElectron()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        startSegment()
        segmentTimerRef.current = setInterval(rollSegment, SEGMENT_MS)
        setState('recording')
      } catch {
        clearTimers()
        setError("Impossible d'accéder au microphone. Vérifiez les permissions.")
        setState('error')
      }
      return
    }

    const SR = getSpeechRecognition()
    if (!SR) {
      clearTimers()
      setError('La dictée en direct n\'est pas disponible dans ce navigateur.')
      setState('error')
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'fr-FR'
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let pendingInterim = ''
      let newFinal = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript
        if (e.results[i].isFinal) newFinal += `${text} `
        else pendingInterim += text
      }
      if (newFinal) bufferRef.current += newFinal
      setInterim(pendingInterim)
    }
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      // « no-speech » et « aborted » arrivent en usage normal (silences, pauses).
      if (e.error === 'no-speech' || e.error === 'aborted' || e.error === 'network') return
      setError(`Erreur microphone : ${e.error}`)
      setState('error')
    }
    recognition.onend = () => {
      setInterim('')
      // La reconnaissance s'arrête d'elle-même après un silence prolongé : on la
      // relance tant que le praticien n'a pas explicitement arrêté la dictée.
      if (stoppingRef.current) return
      try { recognition.start() } catch { /* déjà redémarrée */ }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      flushTimerRef.current = setInterval(flushBuffer, FLUSH_MS)
      setState('recording')
    } catch {
      clearTimers()
      setError("Impossible de démarrer la dictée.")
      setState('error')
    }
  }, [clearTimers, flushBuffer, rollSegment, startSegment])

  const stop = useCallback(() => {
    stoppingRef.current = true
    clearTimers()
    setInterim('')

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      flushBuffer()
      setState('idle')
      return
    }

    if (recorderRef.current?.state === 'recording') {
      // Le dernier segment part en transcription : on attend son retour avant
      // de rendre la main, sinon la fin de l'anamnèse serait perdue.
      setState('transcribing')
      recorderRef.current.stop()
      recorderRef.current = null
      // La transcription du dernier segment est asynchrone ; on repasse à l'état
      // au repos après un délai suffisant pour qu'elle ait abouti.
      setTimeout(() => setState('idle'), 200)
    } else {
      setState('idle')
    }

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [clearTimers, flushBuffer])

  // Filet de sécurité : un démontage pendant la dictée (navigation, fermeture)
  // doit couper le micro, sans quoi la pastille d'enregistrement reste allumée.
  useEffect(() => {
    return () => {
      stoppingRef.current = true
      for (const ref of [segmentTimerRef, flushTimerRef, tickTimerRef]) {
        if (ref.current) clearInterval(ref.current)
      }
      recognitionRef.current?.stop()
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { state, interim, elapsed, error, transcript, start, stop, isRecording: state === 'recording' }
}
