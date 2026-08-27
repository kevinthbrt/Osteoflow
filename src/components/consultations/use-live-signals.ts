'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applySignal, type SignalId, type SignalSet } from '@/lib/reasoning/signals'

export type LiveSignalsStatus = 'ok' | 'unconfigured' | 'error'

export interface SignalTrace {
  source: 'dictée' | 'praticien' | 'dossier'
  /** Les mots du patient qui ont produit l'élément — la preuve, pas la reformulation. */
  verbatim?: string
}

/**
 * Analyse d'une anamnèse pendant qu'elle se dicte.
 *
 * Une anamnèse dictée fait vingt lignes de langage parlé, avec les hésitations
 * et les redites : illisible d'un coup d'œil en consultation. Ce qui est utile
 * à l'écran, ce sont les éléments retenus, et ils doivent apparaître à mesure
 * que le patient parle — pas dix minutes plus tard.
 *
 * Le texte brut reste la source ; l'analyse ne fait que le donner à lire
 * autrement, et elle n'est jamais bloquante : si elle échoue, la dictée
 * continue et le compte rendu part quand même.
 */

/** Analyse peu après que la parole s'arrête. */
const APRES_SILENCE_MS = 2_500
/** …et au moins une fois par tranche, si elle ne s'arrête pas. */
const AU_PLUS_TARD_MS = 12_000
/**
 * Recouvrement entre deux envois.
 *
 * On n'envoie que la suite du texte, pas tout depuis le début : l'information
 * n'augmente que du dernier passage, alors que le coût augmenterait à chaque
 * fois. Le recouvrement évite de couper un élément à cheval sur deux envois.
 */
const CHEVAUCHEMENT = 200
/** En deçà, la suite ne porte rien : on attend le passage suivant. */
const MINIMUM_UTILE = 15

/**
 * Ce qu'il faut envoyer à l'analyse, et s'il faut envoyer quelque chose.
 *
 * C'est ici que se joue le coût : relire tout le texte à chaque passage ferait
 * grossir l'appel à mesure que l'anamnèse s'allonge, pour une information qui,
 * elle, n'augmente que du dernier passage. On n'envoie donc que la suite — avec
 * un recouvrement, pour ne pas couper un élément à cheval sur deux envois.
 *
 * Le rattrapage compte autant : si le texte a été réécrit en amont plutôt que
 * simplement prolongé, les repères ne valent plus rien et il faut tout
 * reprendre, sinon l'analyse raisonnerait sur une version qui n'existe plus.
 */
export function envoiIncremental(
  texte: string,
  dejaAnalyse: string,
  { complet = false } = {},
): { envoi: string; suite: boolean } | null {
  if (!texte.trim()) return null

  const suite = !complet && dejaAnalyse.length > 0 && texte.startsWith(dejaAnalyse)
  const envoi = suite
    ? texte.slice(Math.max(0, dejaAnalyse.length - CHEVAUCHEMENT))
    : texte
  // Une suite trop courte ne porte rien : on attend le passage suivant plutôt
  // que de payer un appel pour trois mots. Le seuil porte sur le texte
  // réellement neuf, pas sur l'envoi — celui-ci contient le recouvrement, qui
  // suffisait à lui seul à franchir le seuil et le rendait inopérant.
  if (suite && texte.slice(dejaAnalyse.length).trim().length < MINIMUM_UTILE) return null
  if (!envoi.trim()) return null
  return { envoi, suite }
}

export function useLiveSignals(reason?: string) {
  const [signals, setSignals] = useState<SignalSet>({})
  const [traces, setTraces] = useState<Partial<Record<SignalId, SignalTrace>>>({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<LiveSignalsStatus>('ok')

  const signalsRef = useRef<SignalSet>({})
  const tracesRef = useRef<Partial<Record<SignalId, SignalTrace>>>({})
  const texteAnalyseRef = useRef('')
  const enAttenteRef = useRef('')
  const minuterieRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const derniereRef = useRef(0)
  const reasonRef = useRef(reason)
  reasonRef.current = reason

  useEffect(() => {
    signalsRef.current = signals
  }, [signals])
  useEffect(() => {
    tracesRef.current = traces
  }, [traces])
  useEffect(
    () => () => {
      if (minuterieRef.current) clearTimeout(minuterieRef.current)
    },
    [],
  )

  const extract = useCallback(async (text: string, { complet = false } = {}) => {
    if (!text.trim()) return

    const decision = envoiIncremental(text, texteAnalyseRef.current, { complet })
    if (!decision) return
    const { envoi, suite } = decision

    const known = suite
      ? (Object.entries(signalsRef.current) as [SignalId, boolean | undefined][])
          .filter(([, value]) => value !== undefined)
          .map(([id, value]) => ({ id, value: value as boolean }))
      : []

    setBusy(true)
    try {
      const res = await fetch('/api/ai/extract-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: envoi, reason: reasonRef.current, known }),
      })
      const data = await res.json()
      // Une analyse qui échoue en silence est pire qu'une analyse absente : le
      // praticien dicte et croit qu'elle a écouté.
      if (!res.ok) {
        setStatus('error')
        return
      }
      setStatus(data.unconfigured ? 'unconfigured' : 'ok')
      texteAnalyseRef.current = text

      const extracted = (data.signals ?? []) as {
        id: SignalId
        value: boolean
        verbatim?: string
      }[]
      if (extracted.length === 0) return

      // Ce que le praticien a saisi lui-même fait autorité : l'analyse complète
      // le relevé, elle ne le corrige pas.
      setSignals((current) => {
        // Le relevé passe par `applySignal`, qui porte les propagations du
        // vocabulaire : désigner un siège de douleur écarte les autres, un
        // signal en implique d'autres, et poser un signal à faux met à faux ce
        // qui l'implique.
        let next = current
        for (const signal of extracted) {
          const trace = tracesRef.current[signal.id]
          if (trace && trace.source !== 'dictée') continue
          next = applySignal(next, signal.id, signal.value)
        }
        for (const [id, trace] of Object.entries(tracesRef.current)) {
          if (!trace || trace.source === 'dictée') continue
          const signal = id as SignalId
          if (current[signal] !== undefined) next[signal] = current[signal]
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
      setStatus('error')
    } finally {
      setBusy(false)
    }
  }, [])

  /**
   * Programme une analyse.
   *
   * Chaque passage transcrit fait grandir le texte de quelques mots : analyser
   * à chaque fois multiplierait les appels pour un relevé qui bouge à peine
   * entre deux. On analyse donc peu après que la parole s'arrête, et au moins
   * une fois par tranche si elle ne s'arrête jamais.
   */
  const analyse = useCallback(
    (text: string) => {
      enAttenteRef.current = text
      const lancer = () => {
        derniereRef.current = Date.now()
        void extract(enAttenteRef.current)
      }
      if (minuterieRef.current) clearTimeout(minuterieRef.current)
      if (Date.now() - derniereRef.current >= AU_PLUS_TARD_MS) {
        lancer()
        return
      }
      minuterieRef.current = setTimeout(lancer, APRES_SILENCE_MS)
    },
    [extract],
  )

  /** Analyse tout de suite ce qui reste, sans attendre le silence. */
  const analyseMaintenant = useCallback(
    async (text: string) => {
      if (minuterieRef.current) clearTimeout(minuterieRef.current)
      minuterieRef.current = null
      await extract(text)
    },
    [extract],
  )

  const reset = useCallback(() => {
    if (minuterieRef.current) clearTimeout(minuterieRef.current)
    minuterieRef.current = null
    texteAnalyseRef.current = ''
    enAttenteRef.current = ''
    derniereRef.current = 0
    signalsRef.current = {}
    tracesRef.current = {}
    setSignals({})
    setTraces({})
    setBusy(false)
  }, [])

  return { signals, traces, busy, status, analyse, analyseMaintenant, reset }
}
