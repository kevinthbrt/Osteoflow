'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FolderOpen, Stethoscope, X } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { cn } from '@/lib/utils'

/**
 * Onglets patients : chaque dossier ou séance ouvert reste accessible dans
 * une barre sous l'en-tête, comme dans un navigateur.
 *
 * - Ouvrir un patient (lien, palette, Ma journée) crée ou active son onglet.
 * - Ctrl + clic ou clic molette sur un lien patient l'ouvre en arrière-plan.
 * - Ctrl + Tab / Ctrl + Maj + Tab et Ctrl + 1 à 9 pour changer d'onglet ;
 *   clic molette ou croix pour fermer. (Ctrl + W reste réservé : dans
 *   l'application de bureau, il ferme la fenêtre.)
 * - En revenant sur une séance, le brouillon est restauré automatiquement.
 *
 * Les autres composants passent par `openPatientTabs()`, sans contexte React.
 */
const STORAGE_KEY = 'myosteoflow_patient_tabs_v1'
const OPEN_EVENT = 'myosteoflow:open-patient-tabs'
const MAX_TABS = 12
const PATIENT_PATH = /^\/patients\/(?!new(?:\/|$))([^/?#]+)/

interface PatientTab {
  id: string
  firstName: string | null
  lastName: string | null
  /** Dernière page visitée pour ce patient (dossier ou séance) */
  href: string
  lastActive: number
}

interface OpenRequest {
  patients: Array<{ id: string; first_name?: string; last_name?: string; href?: string }>
  /** Patient à afficher tout de suite ; sinon les onglets s'ouvrent en arrière-plan */
  focusId?: string
}

export function openPatientTabs(request: OpenRequest) {
  window.dispatchEvent(new CustomEvent<OpenRequest>(OPEN_EVENT, { detail: request }))
}

function patientIdFromPath(pathname: string): string | null {
  return pathname.match(PATIENT_PATH)?.[1] ?? null
}

function loadTabs(): PatientTab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as PatientTab[]) : []
    return Array.isArray(parsed) ? parsed.filter((tab) => tab && typeof tab.id === 'string' && typeof tab.href === 'string') : []
  } catch {
    return []
  }
}

/** Retire les onglets en trop : les moins récents, jamais l'actif ni une séance en cours. */
function enforceLimit(tabs: PatientTab[], keep: Set<string>): PatientTab[] {
  if (tabs.length <= MAX_TABS) return tabs
  const removable = tabs
    .filter((tab) => !keep.has(tab.id))
    .sort((a, b) => a.lastActive - b.lastActive)
  const toRemove = new Set(removable.slice(0, tabs.length - MAX_TABS).map((tab) => tab.id))
  return tabs.filter((tab) => !toRemove.has(tab.id))
}

export function PatientTabsBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [db] = useState(() => createClient())
  const [tabs, setTabs] = useState<PatientTab[]>([])
  const [loaded, setLoaded] = useState(false)
  const [drafts, setDrafts] = useState<Set<string>>(new Set())
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const activeId = patientIdFromPath(pathname)

  useEffect(() => {
    setTabs(loadTabs())
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
    } catch {
      // Stockage indisponible : les onglets ne survivront pas au redémarrage.
    }
    // Hauteur de la barre, pour les éléments collants placés dessous
    document.documentElement.style.setProperty('--app-tabs-h', tabs.length > 0 ? '2.75rem' : '0px')
  }, [tabs, loaded])

  useEffect(() => () => {
    document.documentElement.style.removeProperty('--app-tabs-h')
  }, [])

  // Séances en cours (brouillon non vide) : une pastille sur l'onglet
  const refreshDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/consultation/draft?list=1', { cache: 'no-store' })
      const data = (await res.json()) as { drafts?: Array<{ patient_id: string; hasContent?: boolean }> }
      setDrafts(new Set((data.drafts ?? []).filter((d) => d.hasContent).map((d) => d.patient_id)))
    } catch {
      // Pas de pastille plutôt qu'une erreur.
    }
  }, [])

  useEffect(() => {
    refreshDrafts()
    const timer = setInterval(refreshDrafts, 20000)
    return () => clearInterval(timer)
  }, [refreshDrafts, pathname])

  const keepSet = useCallback(
    (extra?: string | null) => new Set([...(extra ? [extra] : []), ...(activeId ? [activeId] : []), ...Array.from(drafts)]),
    [activeId, drafts]
  )

  // Page patient visitée : son onglet est créé ou mis à jour
  useEffect(() => {
    if (!loaded || !activeId) return
    const href = pathname
    setTabs((previous) => {
      const existing = previous.find((tab) => tab.id === activeId)
      const next = existing
        ? previous.map((tab) => (tab.id === activeId ? { ...tab, href, lastActive: Date.now() } : tab))
        : [...previous, { id: activeId, firstName: null, lastName: null, href, lastActive: Date.now() }]
      return enforceLimit(next, keepSet(activeId))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loaded, activeId])

  // Noms manquants
  const missingIds = tabs.filter((tab) => !tab.lastName).map((tab) => tab.id).join(',')
  useEffect(() => {
    if (!missingIds) return
    const ids = missingIds.split(',')
    let cancelled = false
    db.from('patients')
      .select('id, first_name, last_name')
      .in('id', ids)
      .then(({ data }: { data: Array<{ id: string; first_name: string; last_name: string }> | null }) => {
        if (cancelled || !data) return
        const byId = new Map(data.map((p) => [p.id, p]))
        setTabs((previous) => {
          // Patient supprimé ou archivé introuvable : on retire son onglet
          const found = previous.filter((tab) => tab.lastName || byId.has(tab.id) || !ids.includes(tab.id))
          return found.map((tab) => {
            const patient = byId.get(tab.id)
            return patient ? { ...tab, firstName: patient.first_name, lastName: patient.last_name } : tab
          })
        })
      })
    return () => {
      cancelled = true
    }
  }, [missingIds, db])

  const closeTab = useCallback(
    (id: string) => {
      const current = tabsRef.current
      const index = current.findIndex((tab) => tab.id === id)
      const remaining = current.filter((tab) => tab.id !== id)
      setTabs(remaining)
      if (id === activeId) {
        const neighbour = remaining[Math.min(index, remaining.length - 1)]
        router.push(neighbour ? neighbour.href : '/patients')
      }
    },
    [activeId, router]
  )

  const activate = useCallback((tab: PatientTab) => router.push(tab.href), [router])

  // Ouverture demandée par un autre composant (Ma journée, palette…)
  useEffect(() => {
    const onOpen = (event: Event) => {
      const { patients, focusId } = (event as CustomEvent<OpenRequest>).detail
      const now = Date.now()
      setTabs((previous) => {
        let next = [...previous]
        patients.forEach((patient, index) => {
          if (next.some((tab) => tab.id === patient.id)) return
          next.push({
            id: patient.id,
            firstName: patient.first_name ?? null,
            lastName: patient.last_name ?? null,
            href: patient.href ?? `/patients/${patient.id}`,
            lastActive: now - patients.length + index,
          })
        })
        next = enforceLimit(next, new Set([...patients.map((p) => p.id), ...(activeId ? [activeId] : [])]))
        return next
      })
      const focus = patients.find((patient) => patient.id === focusId)
      if (focus) router.push(focus.href ?? `/patients/${focus.id}`)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [activeId, router])

  // Ctrl + clic / clic molette sur un lien patient : onglet en arrière-plan
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const background = event.type === 'auxclick' ? event.button === 1 : event.ctrlKey || event.metaKey
      if (!background) return
      const anchor = (event.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const id = patientIdFromPath(url.pathname)
      if (!id) return
      event.preventDefault()
      event.stopPropagation()
      openPatientTabs({ patients: [{ id, href: url.pathname }] })
    }
    document.addEventListener('click', handler, true)
    document.addEventListener('auxclick', handler, true)
    return () => {
      document.removeEventListener('click', handler, true)
      document.removeEventListener('auxclick', handler, true)
    }
  }, [])

  // Raccourcis clavier
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const list = tabsRef.current
      if (list.length === 0) return
      if (event.key === 'Tab') {
        event.preventDefault()
        const index = list.findIndex((tab) => tab.id === activeId)
        const nextIndex = index === -1
          ? 0
          : (index + (event.shiftKey ? -1 : 1) + list.length) % list.length
        activate(list[nextIndex])
      } else if (!event.shiftKey && /^[1-9]$/.test(event.key)) {
        const tab = event.key === '9' ? list[list.length - 1] : list[Number(event.key) - 1]
        if (tab) {
          event.preventDefault()
          activate(tab)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeId, activate])

  if (!loaded || tabs.length === 0) return null

  return (
    <div
      data-app-tabs
      className="sticky top-16 z-20 flex h-11 items-end gap-1 border-b border-sidebar-border bg-sidebar px-3 lg:px-6 [html[data-focus-mode]_&]:top-0"
    >
      <div role="tablist" aria-label="Patients ouverts" className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab, index) => {
          const active = tab.id === activeId
          const inSession = tab.href.includes('/consultation/')
          const hasDraft = drafts.has(tab.id)
          const name = tab.lastName ? `${tab.firstName ?? ''} ${tab.lastName}`.trim() : 'Patient…'
          const Icon = inSession ? Stethoscope : FolderOpen
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              title={`${name}${inSession ? ' · séance' : ' · dossier'}${hasDraft ? ' · consultation en cours' : ''}${index < 8 ? ` (Ctrl + ${index + 1})` : ''}`}
              onClick={() => activate(tab)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  activate(tab)
                }
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  closeTab(tab.id)
                }
              }}
              onMouseDown={(event) => {
                // Empêche le défilement automatique du clic molette
                if (event.button === 1) event.preventDefault()
              }}
              className={cn(
                'group relative flex h-9 min-w-[132px] max-w-[220px] shrink-0 cursor-pointer select-none items-center gap-2 rounded-t-lg border border-b-0 pl-3 pr-1.5 text-sm transition-colors',
                active
                  ? 'border-border bg-background font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-background'
                  : 'border-transparent text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5 shrink-0', active && inSession && 'text-primary')} />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {hasDraft && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-label="Consultation en cours" />
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
                aria-label={`Fermer l’onglet ${name}`}
                title={hasDraft ? 'Fermer (le brouillon est conservé)' : 'Fermer'}
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground',
                  !active && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      {tabs.length > 1 && (
        <button
          type="button"
          onClick={() => {
            // On garde l'onglet affiché, on ferme les autres
            setTabs((previous) => previous.filter((tab) => tab.id === activeId))
          }}
          className="mb-1.5 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Fermer tous les autres onglets (les brouillons sont conservés)"
        >
          Fermer les autres
        </button>
      )}
    </div>
  )
}
