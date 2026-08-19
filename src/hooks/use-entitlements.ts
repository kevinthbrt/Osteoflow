'use client'

import { useEffect, useState } from 'react'
import type { Entitlements } from '@/lib/entitlements'

/**
 * Droits d'accès du compte connecté, lus depuis la licence locale.
 *
 * Pendant le chargement, on part du principe que tout est accordé : afficher
 * puis masquer un widget serait plus déstabilisant que l'inverse, et le
 * serveur reste de toute façon l'autorité — un compte sans OsteoUpgrade
 * reçoit un 403 même si l'interface se trompait.
 */
export function useEntitlements(): Entitlements & { loading: boolean } {
  const [etat, setEtat] = useState<Entitlements & { loading: boolean }>({
    osteoflow: true,
    osteoupgrade: true,
    loading: true,
  })

  useEffect(() => {
    let annule = false
    fetch('/api/license')
      .then((r) => r.json())
      .then((data) => {
        if (annule) return
        const e = data?.entitlements
        setEtat({
          osteoflow: e?.osteoflow !== false,
          osteoupgrade: e?.osteoupgrade !== false,
          loading: false,
        })
      })
      .catch(() => {
        if (!annule) setEtat((p) => ({ ...p, loading: false }))
      })
    return () => {
      annule = true
    }
  }, [])

  return etat
}
