'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Sparkles, Loader2, RotateCcw, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnamnesisRecorderProps {
  onApply: (data: { reason: string; anamnesis: string }) => void
  disabled?: boolean
}

type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

// Minimal SpeechRecognition type declarations
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

export function AnamnesisRecorder({ onApply, disabled }: AnamnesisRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [structured, setStructured] = useState<{ reason: string; anamnesis: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finalTextRef = useRef('')

  // Keep ref in sync so onend closure has fresh value
  useEffect(() => {
    finalTextRef.current = finalText
  }, [finalText])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) {
      setErrorMsg("La reconnaissance vocale n'est pas disponible dans ce navigateur.")
      setState('error')
      return
    }

    setFinalText('')
    setInterimText('')
    setStructured(null)
    setErrorMsg('')
    setElapsed(0)
    finalTextRef.current = ''

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'fr-FR'

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let newFinal = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          newFinal += t + ' '
        } else {
          interim += t
        }
      }
      if (newFinal) {
        setFinalText((prev) => prev + newFinal)
      }
      setInterimText(interim)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') return
      if (e.error === 'aborted') return
      setErrorMsg(`Erreur microphone : ${e.error}`)
      setState('error')
      stopTimer()
    }

    recognition.onend = () => {
      setInterimText('')
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('recording')

    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }, [stopTimer])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopTimer()
    setState('idle')
  }, [stopTimer])

  const handleStructure = useCallback(async () => {
    const text = finalTextRef.current.trim()
    if (!text) return

    // Stop recording if still running
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
  }, [stopTimer])

  const handleApply = useCallback(() => {
    if (!structured) return
    onApply(structured)
  }, [structured, onApply])

  const handleReset = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopTimer()
    setState('idle')
    setFinalText('')
    setInterimText('')
    setStructured(null)
    setErrorMsg('')
    setElapsed(0)
    finalTextRef.current = ''
  }, [stopTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      stopTimer()
    }
  }, [stopTimer])

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
          ) : state === 'processing' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Claude structure l'anamnèse…
            </span>
          ) : state === 'done' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <Check className="h-3.5 w-3.5" />
              Anamnèse structurée
            </span>
          ) : state === 'error' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Erreur
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

      {/* Transcript area */}
      {(state === 'recording' || (hasTranscript && state !== 'done')) && (
        <div className="min-h-[80px] max-h-[200px] overflow-y-auto rounded-lg bg-background border px-3 py-2 text-sm leading-relaxed">
          <span>{finalText}</span>
          {interimText && (
            <span className="text-muted-foreground italic">{interimText}</span>
          )}
          {!finalText && !interimText && (
            <span className="text-muted-foreground">Parlez maintenant…</span>
          )}
        </div>
      )}

      {/* Structured result */}
      {state === 'done' && structured && (
        <div className="rounded-lg bg-background border px-3 py-2 text-sm leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
          {structured.reason && (
            <p className="font-semibold text-foreground mb-2">
              Motif : {structured.reason}
            </p>
          )}
          <p className="text-muted-foreground">{structured.anamnesis}</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && errorMsg && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {state === 'idle' && !hasTranscript && (
          <Button
            type="button"
            size="sm"
            onClick={startRecording}
            disabled={disabled}
            className="gap-1.5"
          >
            <Mic className="h-3.5 w-3.5" />
            Démarrer l&apos;écoute
          </Button>
        )}

        {state === 'recording' && (
          <>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={stopRecording}
              className="gap-1.5"
            >
              <MicOff className="h-3.5 w-3.5" />
              Arrêter
            </Button>
            {hasTranscript && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleStructure}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Structurer maintenant
              </Button>
            )}
          </>
        )}

        {state === 'idle' && hasTranscript && (
          <Button
            type="button"
            size="sm"
            onClick={handleStructure}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Structurer avec Claude
          </Button>
        )}

        {state === 'done' && (
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="gap-1.5 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-3.5 w-3.5" />
            Injecter dans la consultation
          </Button>
        )}
      </div>
    </div>
  )
}
