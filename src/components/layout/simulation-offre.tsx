'use client'

import { Eye, X } from 'lucide-react'
import { useEntitlements } from '@/hooks/use-entitlements'
import { definirSimulation } from '@/lib/plan-simulation'

/**
 * Bandeau de simulation d'offre, pendant de celui d'OsteoUpgrade.
 *
 * Invisible pour tout le monde sauf un compte administrateur : discret quand
 * la simulation est éteinte (un simple bouton en coin d'écran), permanent et
 * visible quand elle est active — une simulation qu'on oublie ressemble à un
 * bug, et se signale au support comme tel.
 */
export function SimulationOffre() {
  const { role, simule, loading } = useEntitlements()

  if (loading || role !== 'admin') return null

  const basculer = (actif: boolean) => {
    definirSimulation(actif)
    window.location.reload()
  }

  if (!simule) {
    return (
      <button
        onClick={() => basculer(true)}
        title="Voir l'application comme un abonné MyOsteoFlow seul"
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
        Simuler sans OsteoUpgrade
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(94vw,32rem)] -translate-x-1/2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-lg dark:bg-amber-950/60">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
          <Eye className="h-4 w-4" />
          Simulation : sans OsteoUpgrade
        </span>
        <span className="min-w-[10rem] flex-1 text-xs text-amber-800/80 dark:text-amber-200/70">
          Vous voyez l&apos;application d&apos;un abonné MyOsteoFlow seul.
        </span>
        <button
          onClick={() => basculer(false)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-bold text-amber-50 transition-colors hover:bg-amber-800"
        >
          <X className="h-3.5 w-3.5" />
          Quitter
        </button>
      </div>
    </div>
  )
}
