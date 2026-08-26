'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ContinuousDictationState = 'idle' | 'recording' | 'error'

/**
 * Dictée transcrite au fil de l'eau.
 *
 * Le praticien parle sans s'arrêter ; l'enregistrement est découpé en segments
 * transcrits pendant la consultation, et le texte apparaît à mesure au lieu
 * d'arriver d'un bloc à la fin.
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
 *
 * Coût
 * ----
 * Aucun surcoût par rapport à un envoi unique : Whisper est facturé à la
 * seconde d'audio, et découper la même consultation ne change pas le nombre de
 * secondes. Le découpage supprime en revanche la limite de taille qui obligeait
 * jusqu'ici à relancer la dictée toutes les seize minutes.
 */

/** En dessous, on considère que personne ne parle. */
const SILENCE_RMS = 0.015
/**
 * Durée de silence qui déclenche l'envoi d'un segment.
 *
 * Dans un échange à deux, les blancs entre tours de parole durent quelques
 * centaines de millisecondes seulement : attendre plus longtemps reviendrait à
 * n'envoyer un segment qu'en fin de consultation. On se cale juste au-dessus
 * des pauses intra-phrase, qui tournent autour de 200 à 250 ms.
 */
const SILENCE_MS = 380
const MIN_SEGMENT_MS = 3_500
const MAX_SEGMENT_MS = 20_000
/** Longueur du contexte transmis à Whisper d'un segment à l'autre. */
const CONTEXT_CHARS = 300

/**
 * Remet les segments dans l'ordre où ils ont été dits.
 *
 * Les segments partent à la suite mais reviennent quand ils reviennent : un
 * segment court transcrit vite peut doubler le précédent. Les ajouter dans
 * l'ordre d'arrivée intervertirait des phrases, et sur un compte rendu médical
 * c'est inacceptable — le texte doit dire ce qui a été dit, dans l'ordre où ça
 * a été dit.
 *
 * Chaque segment reçoit donc un numéro à l'émission ; les résultats sont mis en
 * attente et publiés dès que leur tour vient. Un segment perdu est publié vide
 * plutôt qu'oublié : sans cela, tout ce qui suit resterait bloqué derrière lui.
 */
export function creerAssembleur(publier: (texte: string) => void) {
  let prochainNumero = 0
  let attendu = 0
  const enAttente = new Map<number, string>()

  return {
    /** Réserve le rang du prochain segment envoyé. */
    reserver(): number {
      return prochainNumero++
    },
    /** Dépose le texte d'un segment ; libère tout ce qui devient publiable. */
    deposer(numero: number, texte: string) {
      enAttente.set(numero, texte)
      while (enAttente.has(attendu)) {
        const texteDuTour = enAttente.get(attendu)!
        enAttente.delete(attendu)
        attendu += 1
        if (texteDuTour) publier(texteDuTour)
      }
    },
    reinitialiser() {
      prochainNumero = 0
      attendu = 0
      enAttente.clear()
    },
  }
}

export type Assembleur = ReturnType<typeof creerAssembleur>

interface UseContinuousDictationOptions {
  /**
   * Reçoit chaque segment transcrit, **dans l'ordre où il a été dit**.
   * Voir `ordonnancement` ci-dessous : ce n'est pas l'ordre d'arrivée.
   */
  onText: (text: string) => void
}

export function useContinuousDictation({ onText }: UseContinuousDictationOptions) {
  const [state, setState] = useState<ContinuousDictationState>('idle')
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

  const assembleurRef = useRef<Assembleur | null>(null)
  if (!assembleurRef.current) {
    assembleurRef.current = creerAssembleur((texte) => onTextRef.current(texte))
  }

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

  const envoyer = useCallback(async (blob: Blob, contexte: string): Promise<string | null> => {
    const headers: Record<string, string> = { 'Content-Type': 'audio/webm' }
    if (contexte) {
      headers['x-transcribe-context'] = encodeURIComponent(contexte.slice(-CONTEXT_CHARS))
    }
    const res = await fetch('/api/ai/transcribe', { method: 'POST', headers, body: blob })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erreur de transcription.')
    return ((data.transcript ?? '') as string).trim() || null
  }, [])

  const transcribe = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) return
      const numero = assembleurRef.current!.reserver()
      // Le contexte est figé au moment de l'émission : c'est la fin du segment
      // précédent, pas celle du dernier segment revenu.
      const contexte = contextRef.current

      setPendingSegments((count) => count + 1)
      try {
        let texte: string | null
        try {
          texte = await envoyer(blob, contexte)
        } catch {
          // Un échec réseau isolé ne doit pas trouer le compte rendu : on
          // retente une fois avant d'abandonner ce segment.
          texte = await envoyer(blob, contexte)
        }
        if (texte) contextRef.current = texte
        assembleurRef.current!.deposer(numero, texte ?? '')
        setError(null)
      } catch (err) {
        // Le numéro est publié vide malgré tout, sans quoi tous les segments
        // suivants resteraient bloqués derrière celui-ci.
        assembleurRef.current!.deposer(numero, '')
        setError(
          err instanceof Error && err.message !== 'Failed to fetch'
            ? err.message
            : 'Un passage n’a pas pu être transcrit. Vérifiez votre connexion.',
        )
      } finally {
        setPendingSegments((count) => Math.max(0, count - 1))
      }
    },
    [envoyer],
  )

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
    assembleurRef.current!.reinitialiser()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      runningRef.current = true

      // Analyse du niveau sonore : c'est elle qui décide où couper.
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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

  return {
    state,
    /** Durée de la dictée en cours, en secondes. */
    elapsed,
    /** Segments encore en transcription — la dictée continue pendant ce temps. */
    pendingSegments,
    error,
    start,
    stop,
    clearError: useCallback(() => setError(null), []),
  }
}

/**
 * La plateforme sait-elle découper la dictée ?
 *
 * Le découpage repose sur l'analyse du niveau sonore. Là où l'API audio n'est
 * pas disponible, on garde l'enregistrement d'un seul tenant plutôt que de
 * refuser la dictée.
 */
export function supportsContinuousDictation(): boolean {
  if (typeof window === 'undefined') return false
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return typeof AudioContextClass === 'function' && typeof MediaRecorder !== 'undefined'
}
