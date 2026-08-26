'use client'

import { useCallback, useEffect, useState } from 'react'

export type AnamnesisView = 'cards' | 'summary'

export const ANAMNESIS_VIEW_DEFAULT: AnamnesisView = 'cards'

/** Clé de cache local. Évite le clignotement d'un mode à l'autre au montage. */
const CACHE = 'anamnesis_view'

function lire(): AnamnesisView {
  if (typeof window === 'undefined') return ANAMNESIS_VIEW_DEFAULT
  try {
    const value = window.localStorage.getItem(CACHE)
    return value === 'summary' || value === 'cards' ? value : ANAMNESIS_VIEW_DEFAULT
  } catch {
    return ANAMNESIS_VIEW_DEFAULT
  }
}

/**
 * Mode d'affichage de l'anamnèse, tel que réglé dans les paramètres.
 *
 * Le réglage vit en base (`app_config`) pour suivre le poste de travail, et il
 * est doublé d'un cache local : sans lui, chaque écran s'afficherait d'abord
 * dans le mode par défaut puis basculerait, ce qui saute aux yeux sur une liste
 * de consultations.
 *
 * Un échec de lecture n'est jamais bloquant — on retombe sur le mode cartes,
 * qui est le comportement historique.
 */
export function useAnamnesisView(): {
  view: AnamnesisView
  ready: boolean
  setView: (view: AnamnesisView) => Promise<void>
} {
  const [view, setLocal] = useState<AnamnesisView>(lire)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let annule = false
    fetch('/api/settings/anamnesis-view')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (annule || !data?.anamnesis_view) return
        setLocal(data.anamnesis_view)
        try {
          window.localStorage.setItem(CACHE, data.anamnesis_view)
        } catch {
          /* mode privé : le cache est un confort, pas une dépendance */
        }
      })
      .catch(() => {
        /* hors ligne : le cache local fait foi */
      })
      .finally(() => {
        if (!annule) setReady(true)
      })
    return () => {
      annule = true
    }
  }, [])

  const setView = useCallback(async (next: AnamnesisView) => {
    setLocal(next)
    try {
      window.localStorage.setItem(CACHE, next)
    } catch {
      /* ignoré */
    }
    await fetch('/api/settings/anamnesis-view', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anamnesis_view: next }),
    })
  }, [])

  return { view, ready, setView }
}
