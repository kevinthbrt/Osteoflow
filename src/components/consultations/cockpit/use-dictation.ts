'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type DictationState = 'idle' | 'recording' | 'transcribing' | 'error'

/**
 * Dictée continue.
 *
 * Le praticien parle sans s'arrêter ; l'enregistrement est découpé en segments
 * transcrits au fil de l'eau, ce qui permet au copilote de suivre pendant la
 * consultation plutôt qu'après.
 *
 * La découpe se fait **aux silences**, pas au chronomètre : couper toutes les
 * quinze secondes trancherait un mot sur deux et Whisper rendrait « la douleur
 * des- » puis « -cend dans la jambe ». On attend une pause de la voix, ce qui
 * arrive naturellement toutes les quelques secondes. Deux garde-fous :
 *
 * - un segment ne part jamais avant `MIN_SEGMENT_MS`, sinon la moindre
 *   respiration déclencherait un appel ;
 * - il part de force après `MAX_SEGMENT_MS` si la personne ne reprend jamais
 *   son souffle, et c'est le seul cas où une coupure peut tomber sur un mot.
 *
 * Pour ce cas résiduel, la fin de la transcription précédente est envoyée à
 * Whisper comme contexte : il recolle la phrase et garde le vocabulaire déjà
 * employé.
 */

/** En dessous, on considère que personne ne parle. */
const SILENCE_RMS = 0.015
/**
 * Durée de silence qui déclenche l'envoi d'un segment.
 *
 * Dans un échange à deux, les blancs entre tours de parole durent quelques
 * centaines de millisecondes seulement : attendre plus long revient à
 * n'envoyer un segment qu'en fin de consultation. On se cale juste au-dessus
 * des pauses intra-phrase, qui tournent autour de 200 à 250 ms.
 */
const SILENCE_MS = 380
const MIN_SEGMENT_MS = 3_500
const MAX_SEGMENT_MS = 20_000
/** Longueur du contexte transmis à Whisper d'un segment à l'autre. */
const CONTEXT_CHARS = 300

interface UseDictationOptions {
  /** Reçoit chaque segment transcrit, dans l'ordre. */
  onText: (text: string) => void
  /** Appelé quand un segment vient d'être ajouté, pour relancer l'analyse. */
  onSegment?: () => void
}

export function useDictation({ onText, onSegment }: UseDictationOptions) {
  const [state, setState] = useState<DictationState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [pendingSegments, setPendingSegments] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const watchRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const segmentStartRef = useRef(0)
  const silenceSinceRef = useRef<number | null>(null)
  /** Vrai tant que la dictée doit repartir après l'envoi d'un segment. */
  const runningRef = useRef(false)
  const contextRef = useRef('')

  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const onSegmentRef = useRef(onSegment)
  onSegmentRef.current = onSegment

  const cleanup = useCallback(() => {
    if (watchRef.current) clearInterval(watchRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    watchRef.current = null
    timerRef.current = null
    analyserRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const transcribe = useCallback(async (blob: Blob) => {
    if (blob.size === 0) return
    if (blob.size > 4 * 1024 * 1024) {
      setError('Segment audio trop volumineux — il a été ignoré.')
      return
    }

    setPendingSegments((count) => count + 1)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'audio/webm' }
      if (contextRef.current) {
        headers['x-transcribe-context'] = encodeURIComponent(contextRef.current.slice(-CONTEXT_CHARS))
      }
      const res = await fetch('/api/ai/transcribe', { method: 'POST', headers, body: blob })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur de transcription.')
        return
      }
      const text = (data.transcript ?? '').trim()
      if (!text) return
      contextRef.current = text
      onTextRef.current(text)
      onSegmentRef.current?.()
    } catch {
      setError('Transcription indisponible. Vérifiez votre connexion.')
    } finally {
      setPendingSegments((count) => Math.max(0, count - 1))
    }
  }, [])

  /** Démarre un enregistreur sur le flux déjà ouvert. */
  const startRecorder = useCallback(
    (stream: MediaStream) => {
      const options: MediaRecorderOptions = { audioBitsPerSecond: 32000 }
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus'
      }
      const recorder = new MediaRecorder(stream, options)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        // Le .catch est obligatoire : une promesse rejetée non gérée provoque
        // un rechargement complet en développement.
        transcribe(blob).catch(() => setError('Erreur inattendue pendant la transcription.'))
        if (runningRef.current && streamRef.current) {
          startRecorder(streamRef.current)
        } else {
          cleanup()
          setState('idle')
        }
      }
      recorder.start()
      recorderRef.current = recorder
      segmentStartRef.current = Date.now()
      silenceSinceRef.current = null
    },
    [cleanup, transcribe],
  )

  /** Clôt le segment en cours ; l'enregistreur suivant démarre depuis `onstop`. */
  const flush = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setElapsed(0)
    contextRef.current = ''
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      runningRef.current = true

      // Analyse du niveau sonore : c'est elle qui décide où couper.
      const AudioContextClass =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioContext = new AudioContextClass()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      audioContext.createMediaStreamSource(stream).connect(analyser)
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const samples = new Float32Array(analyser.fftSize)
      watchRef.current = setInterval(() => {
        const currentAnalyser = analyserRef.current
        if (!currentAnalyser || !runningRef.current) return
        currentAnalyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) sum += sample * sample
        const rms = Math.sqrt(sum / samples.length)

        const now = Date.now()
        const segmentAge = now - segmentStartRef.current

        if (segmentAge >= MAX_SEGMENT_MS) {
          flush()
          return
        }
        if (rms < SILENCE_RMS) {
          if (silenceSinceRef.current === null) silenceSinceRef.current = now
          else if (now - silenceSinceRef.current >= SILENCE_MS && segmentAge >= MIN_SEGMENT_MS) {
            flush()
          }
        } else {
          silenceSinceRef.current = null
        }
      }, 100)

      startRecorder(stream)
      setState('recording')
      timerRef.current = setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    } catch {
      runningRef.current = false
      cleanup()
      setError('Micro inaccessible. Vérifiez les autorisations du système.')
      setState('error')
    }
  }, [cleanup, flush, startRecorder])

  const stop = useCallback(() => {
    runningRef.current = false
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    } else {
      cleanup()
      setState('idle')
    }
  }, [cleanup])

  const toggle = useCallback(() => {
    if (state === 'recording') stop()
    else void start()
  }, [state, start, stop])

  return {
    state,
    /** Durée de la dictée en cours, en secondes. */
    elapsed,
    /** Segments en cours de transcription — la dictée continue pendant ce temps. */
    pendingSegments,
    error,
    start,
    stop,
    toggle,
    clearError: useCallback(() => setError(null), []),
  }
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
