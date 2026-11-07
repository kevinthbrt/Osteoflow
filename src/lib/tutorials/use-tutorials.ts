'use client'

import { useEffect, useState } from 'react'
import type { TutorialCatalog } from '@/lib/tutorials/types'

let memo: TutorialCatalog | null = null

/** Le catalogue, gardé en mémoire le temps de la session pour une navigation instantanée. */
export function useTutorialCatalog(): { catalog: TutorialCatalog | null; failed: boolean } {
  const [catalog, setCatalog] = useState<TutorialCatalog | null>(memo)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (memo) return
    let cancelled = false
    fetch('/api/tutorials')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: TutorialCatalog) => {
        memo = data
        if (!cancelled) setCatalog(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { catalog, failed }
}
