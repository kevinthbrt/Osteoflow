'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type DictationState = 'idle' | 'recording' | 'transcribing' | 'error'

/**
 * Dictée par segments : on enregistre, on arrête, on transcrit. Même approche
 * que l'enregistreur historique — `webkitSpeechRecognition` réclame des clés
 * Google absentes d'Electron, donc MediaRecorder puis Whisper côté serveur.
 *
 * Le découpage en segments n'est pas une limitation subie : il donne au
 * praticien un point d'arrêt naturel, et c'est à ce moment que le copilote se
 * met à jour, plutôt qu'en continu pendant qu'il parle.
 */
export function useDictation({ onText }: { onText: (text: string) => void }) {
  const [state, setState] = useState<DictationState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(
    () => () => {
      stopTimer()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    },
    [stopTimer],
  )

  const transcribe = useCallback(async (blob: Blob) => {
    if (blob.size === 0) {
      setState('idle')
      return
    }
    // Au-delà, la fonction serverless refuse le corps : mieux vaut le dire
    // avant l'envoi que de laisser échouer une dictée de dix minutes.
    if (blob.size > 4 * 1024 * 1024) {
      setError('Segment trop long. Arrêtez la dictée plus tôt et enchaînez un nouveau segment.')
      setState('error')
      return
    }

    setState('transcribing')
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur de transcription.')
        setState('error')
        return
      }
      const text = (data.transcript ?? '').trim()
      if (text) onTextRef.current(text)
      setState('idle')
    } catch {
      setError('Transcription indisponible. Vérifiez votre connexion.')
      setState('error')
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    chunksRef.current = []
    setElapsed(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const options: MediaRecorderOptions = { audioBitsPerSecond: 32000 }
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus'
      }
      const recorder = new MediaRecorder(stream, options)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        // Le .catch est obligatoire : une promesse rejetée non gérée déclenche
        // un rechargement complet en développement (écran blanc).
        transcribe(blob).catch(() => {
          setError('Erreur inattendue pendant la transcription.')
          setState('error')
        })
      }
      recorder.start()
      recorderRef.current = recorder
      setState('recording')
      timerRef.current = setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    } catch {
      setError('Micro inaccessible. Vérifiez les autorisations du système.')
      setState('error')
    }
  }, [transcribe])

  const stop = useCallback(() => {
    stopTimer()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [stopTimer])

  const toggle = useCallback(() => {
    if (state === 'recording') stop()
    else if (state !== 'transcribing') void start()
  }, [state, start, stop])

  return { state, elapsed, error, start, stop, toggle, clearError: () => setError(null) }
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
