'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Sparkles, Loader2, RotateCcw, Check, AlertCircle, WifiOff, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnamnesisRecorderProps {
  onApply: (data: { reason: string; anamnesis: string }) => void
  disabled?: boolean
}

type RecorderState =
  | 'idle'
  | 'recording'
  | 'reconnecting'
  | 'transcribing'
  | 'processing'
  | 'done'
  | 'error'

// ─── Web Speech API types ────────────────────────────────────────────────────

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
const MAX_RECORD_SECONDS = 300  // 5 minutes — limite Groq + protection contre les oublis
const WARN_RECORD_SECONDS = 240 // avertissement à 4 minutes

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI?.isDesktop
}

// ─── Composant ───────────────────────────────────────────────────────────────

export function AnamnesisRecorder({ onApply, disabled }: AnamnesisRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [structured, setStructured] = useState<{ reason: string; anamnesis: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)

  // ── Refs communs ──────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finalTextRef = useRef('')
  const stateRef = useRef<RecorderState>('idle')

  // ── Web Speech API ─────────────────────────────────────────────────────────
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restartCountRef = useRef(0)
  const intentionalStopRef = useRef(false)
  const SRRef = useRef<(new () => SpeechRecognitionInstance) | null>(null)

  // ── MediaRecorder (Electron) ───────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  // Quand true, transcribeBlob ajoute le nouveau texte à la suite du texte existant
  // au lieu de le remplacer (utilisé pour la continuation après arrêt automatique).
  const isContinuingRef = useRef(false)

  useEffect(() => { finalTextRef.current = finalText }, [finalText])
  useEffect(() => { stateRef.current = state }, [state])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const stopReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
  }, [])

  // ── Structuration Claude ──────────────────────────────────────────────────

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

    try {
      const res = await fetch('/api/ai/structure-anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Erreur lors de la structuration.'); setState('error'); return }
      setStructured(data)
      setState('done')
    } catch {
      setErrorMsg('Impossible de contacter le serveur.')
      setState('error')
    }
  }, [stopTimer, stopReconnectTimer])

  // ── Réinitialisation ──────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    intentionalStopRef.current = true
    stopReconnectTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    stopTimer()
    setState('idle')
    setFinalText('')
    setInterimText('')
    setStructured(null)
    setErrorMsg('')
    setStatusMsg('')
    setElapsed(0)
    restartCountRef.current = 0
    finalTextRef.current = ''
    audioChunksRef.current = []
  }, [stopTimer, stopReconnectTimer])

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

  // ════════════════════════════════════════════════════════════════════════════
  // MODE A – MediaRecorder + Groq Whisper API (Electron)
  // webkitSpeechRecognition nécessite les clés Google absentes d'Electron.
  // On enregistre l'audio avec MediaRecorder, puis on envoie le blob WebM
  // directement à notre API route qui appelle Groq (Whisper large-v3-turbo).
  // ════════════════════════════════════════════════════════════════════════════

  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (!blob || blob.size === 0) {
      setErrorMsg("Aucun audio enregistré.")
      setState('error')
      return
    }

    const continuing = isContinuingRef.current
    isContinuingRef.current = false
    const previousText = continuing ? finalTextRef.current : ''

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
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
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
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
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

  // ════════════════════════════════════════════════════════════════════════════
  // MODE B – Web Speech API (navigateur)
  // Transcription en temps réel via l'API speech intégrée au navigateur.
  // ════════════════════════════════════════════════════════════════════════════

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

  // ─── Handlers unifiés ─────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    if (isElectron()) startMediaRecorder()
    else startSpeechRecognition()
  }, [startMediaRecorder, startSpeechRecognition])

  const stopRecording = useCallback(() => {
    if (isElectron()) stopMediaRecorder()
    else stopSpeechRecognition()
  }, [stopMediaRecorder, stopSpeechRecognition])

  const handleApply = useCallback(() => {
    if (!structured) return
    onApply(structured)
    setTimeout(() => {
      setState('idle')
      setFinalText('')
      setInterimText('')
      setStructured(null)
      setErrorMsg('')
      setStatusMsg('')
      setElapsed(0)
      finalTextRef.current = ''
    }, 300)
  }, [structured, onApply])

  // ─── Rendu ────────────────────────────────────────────────────────────────

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
              Claude structure l&apos;anamnèse…
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
              {isElectron() && (
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

        {state !== 'idle' && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Recommencer
          </Button>
        )}
      </div>

      {/* Avertissement durée — à 4 min, arrêt automatique à 5 min */}
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
        <div className="rounded-lg bg-background border px-3 py-2 text-sm leading-relaxed max-h-[300px] overflow-y-auto">
          {structured.reason && (
            <p className="font-semibold text-foreground mb-3">Motif : {structured.reason}</p>
          )}
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

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {state === 'idle' && !hasTranscript && (
          <Button type="button" size="sm" onClick={startRecording} disabled={disabled} className="gap-1.5">
            <Mic className="h-3.5 w-3.5" />
            Démarrer l&apos;écoute
          </Button>
        )}

        {state === 'recording' && (
          <>
            <Button type="button" size="sm" variant="destructive" onClick={stopRecording} className="gap-1.5">
              <MicOff className="h-3.5 w-3.5" />
              Arrêter
            </Button>
            {hasTranscript && !isElectron() && (
              <Button type="button" size="sm" variant="outline" onClick={handleStructure} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Structurer maintenant
              </Button>
            )}
          </>
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
              Structurer avec Claude
            </Button>
            {isElectron() && state === 'idle' && (
              <Button type="button" size="sm" variant="outline" onClick={continueMediaRecorder} className="gap-1.5">
                <Mic className="h-3.5 w-3.5" />
                Continuer la dictée
              </Button>
            )}
          </>
        )}

        {state === 'done' && (
          <Button type="button" size="sm" onClick={handleApply} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <Check className="h-3.5 w-3.5" />
            Injecter dans la consultation
          </Button>
        )}
      </div>
    </div>
  )
}
