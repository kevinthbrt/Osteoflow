'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Sparkles, Loader2, RotateCcw, Check, AlertCircle, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnamnesisRecorderProps {
  onApply: (data: { reason: string; anamnesis: string }) => void
  disabled?: boolean
}

type RecorderState = 'idle' | 'recording' | 'reconnecting' | 'processing' | 'done' | 'error'

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

export function AnamnesisRecorder({ onApply, disabled }: AnamnesisRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [structured, setStructured] = useState<{ reason: string; anamnesis: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Refs that are always fresh inside recognition callbacks
  const finalTextRef = useRef('')
  const stateRef = useRef<RecorderState>('idle')
  const restartCountRef = useRef(0)
  const intentionalStopRef = useRef(false)
  // Keep SR constructor accessible for restarts without closure issues
  const SRRef = useRef<(new () => SpeechRecognitionInstance) | null>(null)

  useEffect(() => { finalTextRef.current = finalText }, [finalText])
  useEffect(() => { stateRef.current = state }, [state])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const stopReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
  }, [])

  // Attach handlers to a recognition instance — never clears transcript
  const attachHandlers = useCallback((recognition: SpeechRecognitionInstance) => {
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let newFinal = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) newFinal += t + ' '
        else interim += t
      }
      if (newFinal) {
        finalTextRef.current += newFinal
        setFinalText(finalTextRef.current)
      }
      setInterimText(interim)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') return
      if (e.error === 'aborted') return
      if (e.error === 'network') return // handled in onend
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
        try {
          newRec.start()
          setState('recording')
        } catch {
          setState('error')
          setErrorMsg('Impossible de redémarrer l\'écoute.')
          stopTimer()
        }
      }, 1500)
    }
  }, [stopTimer, stopReconnectTimer])

  const startRecording = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) {
      setErrorMsg("La reconnaissance vocale n'est pas disponible dans ce navigateur.")
      setState('error')
      return
    }

    // Full reset
    SRRef.current = SR
    finalTextRef.current = ''
    setFinalText('')
    setInterimText('')
    setStructured(null)
    setErrorMsg('')
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

  const stopRecording = useCallback(() => {
    intentionalStopRef.current = true
    stopReconnectTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopTimer()
    setState('idle')
  }, [stopTimer, stopReconnectTimer])

  const handleStructure = useCallback(async () => {
    const text = finalTextRef.current.trim()
    if (!text) return

    intentionalStopRef.current = true
    stopReconnectTimer()
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      stopTimer()
    }

    setState('processing')
    setInterimText('')

    try {
      const res = await fetch('/api/ai/structure-anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Erreur lors de la structuration.')
        setState('error')
        return
      }
      setStructured(data)
      setState('done')
    } catch {
      setErrorMsg('Impossible de contacter le serveur.')
      setState('error')
    }
  }, [stopTimer, stopReconnectTimer])

  const handleApply = useCallback(() => {
    if (!structured) return
    onApply(structured)
    setTimeout(() => {
      setState('idle')
      setFinalText('')
      setInterimText('')
      setStructured(null)
      setErrorMsg('')
      setElapsed(0)
      finalTextRef.current = ''
    }, 300)
  }, [structured, onApply])

  const handleReset = useCallback(() => {
    intentionalStopRef.current = true
    stopReconnectTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopTimer()
    setState('idle')
    setFinalText('')
    setInterimText('')
    setStructured(null)
    setErrorMsg('')
    setElapsed(0)
    restartCountRef.current = 0
    finalTextRef.current = ''
  }, [stopTimer, stopReconnectTimer])

  useEffect(() => {
    return () => {
      intentionalStopRef.current = true
      stopReconnectTimer()
      recognitionRef.current?.stop()
      stopTimer()
    }
  }, [stopTimer, stopReconnectTimer])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const hasTranscript = finalText.trim().length > 0

  return (
    <div className={cn(
      'rounded-xl border bg-muted/30 p-4 space-y-3 transition-all',
      state === 'recording' && 'border-red-300 bg-red-50/50 dark:bg-red-950/20',
      state === 'reconnecting' && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20',
      state === 'done' && 'border-green-300 bg-green-50/50 dark:bg-green-950/20',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state === 'recording' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Écoute en cours — {formatTime(elapsed)}
            </span>
          ) : state === 'reconnecting' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
              <WifiOff className="h-3.5 w-3.5 animate-pulse" />
              Reconnexion en cours…
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
            </span>
          )}
        </div>

        {state === 'idle' && !hasTranscript && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Ne citez pas le nom du patient dans la dictée.
          </p>
        )}

        {state !== 'idle' && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Recommencer
          </Button>
        )}
      </div>

      {/* Transcript */}
      {(state === 'recording' || state === 'reconnecting' || state === 'error' || (hasTranscript && state !== 'done')) && (
        <div className="min-h-[80px] max-h-[200px] overflow-y-auto rounded-lg bg-background border px-3 py-2 text-sm leading-relaxed">
          <span>{finalText}</span>
          {interimText && <span className="text-muted-foreground italic">{interimText}</span>}
          {!finalText && !interimText && <span className="text-muted-foreground">Parlez maintenant…</span>}
        </div>
      )}

      {state === 'error' && errorMsg && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}

      {/* Structured result */}
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
                    j % 2 === 1
                      ? <strong key={j} className="font-semibold text-foreground">{part}</strong>
                      : part
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
            {hasTranscript && (
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
          <Button type="button" size="sm" onClick={handleStructure} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Structurer avec Claude
          </Button>
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
