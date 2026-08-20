'use client'

/**
 * Simulation d'offre — pendant de celle d'OsteoUpgrade, côté application.
 *
 * MyOsteoFlow n'a que deux états qui changent quelque chose à l'écran : avec
 * ou sans OsteoUpgrade (sans MyOsteoFlow, l'application ne s'ouvre pas). La
 * simulation se réduit donc à forcer `osteoupgrade: false`, ce qui permet de
 * vérifier les masquages avant de publier une version.
 *
 * Réservée aux comptes dont la licence porte le rôle `admin` : la valeur est
 * lue localement, mais elle ne peut que **retirer** un droit. Un utilisateur
 * qui la forcerait ne ferait que se verrouiller lui-même — et le serveur
 * reste de toute façon l'autorité.
 */

const CLE = 'simulation_sans_osteoupgrade'

export function simulationActive(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CLE) === '1'
  } catch {
    return false
  }
}

export function definirSimulation(active: boolean) {
  try {
    if (active) window.localStorage.setItem(CLE, '1')
    else window.localStorage.removeItem(CLE)
  } catch {
    // stockage indisponible : la simulation est un confort, pas une fonction
  }
}
