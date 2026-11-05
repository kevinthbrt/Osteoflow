'use client'

import { useEffect, useState } from 'react'
import { DOCTOLIB_EXTENSION_PUBLISHED, DOCTOLIB_TESTING_KEY } from '@/lib/doctolib/config'

/**
 * Faut-il montrer l'import Doctolib ? Oui une fois l'extension publiée ;
 * avant, seulement sur un poste de test (`?doctolib=1` une fois, `?doctolib=0`
 * pour revenir en arrière).
 */
export function useDoctolibFeature(): boolean {
  const [visible, setVisible] = useState(DOCTOLIB_EXTENSION_PUBLISHED)
  useEffect(() => {
    if (DOCTOLIB_EXTENSION_PUBLISHED) return
    try {
      const flag = new URLSearchParams(window.location.search).get('doctolib')
      if (flag === '1') localStorage.setItem(DOCTOLIB_TESTING_KEY, '1')
      if (flag === '0') localStorage.removeItem(DOCTOLIB_TESTING_KEY)
      setVisible(localStorage.getItem(DOCTOLIB_TESTING_KEY) === '1')
    } catch {
      setVisible(false)
    }
  }, [])
  return visible
}

export interface DoctolibSyncSummary {
  at: string
  received: number
  added: number
  removed: number
  toReview: number
  newToReview: number
  firstReviewDate: string | null
}

export interface DoctolibStatus {
  seen: { at: string; version: string | null } | null
  lastImport: { at: string; count: number } | null
  lastSync: DoctolibSyncSummary | null
  autoAdd: boolean
}

/** État de l'extension, relu régulièrement tant qu'elle n'est pas connectée. */
export function useDoctolibStatus(enabled: boolean) {
  const [status, setStatus] = useState<DoctolibStatus | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const res = await fetch('/api/doctolib/status', { headers: { 'x-osteoflow-app': '1' }, cache: 'no-store' })
        const data = (await res.json()) as DoctolibStatus
        if (cancelled) return
        setStatus(data)
        // En attente de l'installation : on regarde souvent. Ensuite, rarement.
        timer = setTimeout(load, data.seen ? 60_000 : 3_000)
      } catch {
        if (!cancelled) timer = setTimeout(load, 10_000)
      }
    }
    load()
    const onFocus = () => {
      clearTimeout(timer)
      load()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, reloadKey])
  return { status, reload: () => setReloadKey((key) => key + 1) }
}
