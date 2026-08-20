'use client'

import { useEffect, useState } from 'react'
import type { Entitlements } from '@/lib/entitlements'
import { simulationActive } from '@/lib/plan-simulation'

export type EtatEntitlements = Entitlements & { loading: boolean; role: string | null; simule: boolean }

/**
 * Droits d'accès du compte connecté, lus depuis la licence locale.
 *
 * Pendant le chargement, on part du principe que tout est accordé : afficher
 * puis masquer un widget serait plus déstabilisant que l'inverse, et le
 * serveur reste de toute façon l'autorité — un compte sans OsteoUpgrade
 * reçoit un 403 même si l'interface se trompait.
 *
 * Un compte administrateur peut simuler l'absence d'OsteoUpgrade
 * (cf. lib/plan-simulation.ts) : la simulation ne peut que retirer un droit,
 * jamais en accorder un.
 */
export function useEntitlements(): EtatEntitlements {
  const [etat, setEtat] = useState<EtatEntitlements>({
    osteoflow: true,
    osteoupgrade: true,
    loading: true,
    role: null,
    simule: false,
  })

  useEffect(() => {
    let annule = false
    fetch('/api/license')
      .then((r) => r.json())
      .then((data) => {
        if (annule) return
        const e = data?.entitlements
        const role = data?.role ?? null
        const simule = role === 'admin' && simulationActive()
        setEtat({
          osteoflow: e?.osteoflow !== false,
          osteoupgrade: simule ? false : e?.osteoupgrade !== false,
          loading: false,
          role,
          simule,
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
