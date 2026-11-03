'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Search,
  Stethoscope,
  UserPlus,
  FolderOpen,
  Pencil,
  ChevronRight,
  ArrowLeft,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { buildSearchOrFilters, splitSearchTokens } from '@/lib/utils/search'
import { cn, formatDate } from '@/lib/utils'
import { allNavItems } from './navigation'

/**
 * Palette de commandes (Ctrl + K) : trouver un patient et agir dessus,
 * ouvrir une page ou lancer une action sans passer par les menus.
 *
 * Ouverture depuis n'importe où : `openCommandPalette()` ou, pour choisir
 * directement le patient d'une nouvelle consultation,
 * `openCommandPalette('consultation')`.
 */
const OPEN_EVENT = 'myosteoflow:open-command-palette'

type PaletteMode = 'all' | 'consultation'

export function openCommandPalette(mode: PaletteMode = 'all') {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { mode } }))
}

interface PatientResult {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  phone: string | null
  email: string | null
}

interface PaletteItem {
  id: string
  group: string
  label: string
  hint?: string
  icon?: LucideIcon
  initials?: string
  shortcut?: string
  run: () => void
  /** Ouvre la liste des actions du patient (flèche droite) */
  patient?: PatientResult
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function CommandPalette() {
  const router = useRouter()
  const dbRef = useRef(createClient())
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PaletteMode>('all')
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<PatientResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [focusedPatient, setFocusedPatient] = useState<PatientResult | null>(null)

  const reset = useCallback((nextMode: PaletteMode = 'all') => {
    setMode(nextMode)
    setQuery('')
    setPatients([])
    setFocusedPatient(null)
    setActiveIndex(0)
  }, [])

  // Raccourci global et ouverture par événement
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((wasOpen) => {
          if (!wasOpen) reset()
          return !wasOpen
        })
      }
    }
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: PaletteMode }>).detail
      reset(detail?.mode ?? 'all')
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [reset])

  // Recherche de patients, avec un léger délai pendant la frappe
  useEffect(() => {
    if (!open || focusedPatient) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setPatients([])
      setIsSearching(false)
      return
    }
    let cancelled = false
    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        let builder = dbRef.current
          .from('patients')
          .select('id, first_name, last_name, birth_date, phone, email')
          .is('archived_at', null)
        for (const filter of buildSearchOrFilters(
          trimmed,
          ['first_name', 'last_name', 'phone', 'email', 'profession'],
          'birth_date'
        )) {
          builder = builder.or(filter)
        }
        const { data, error } = await builder.limit(6).order('last_name')
        if (!cancelled) setPatients(error ? [] : ((data as PatientResult[]) || []))
      } catch {
        if (!cancelled) setPatients([])
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open, focusedPatient])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  const patientActions = useCallback(
    (patient: PatientResult): PaletteItem[] => [
      {
        id: `${patient.id}-consultation`,
        group: `Pour ${patient.first_name} ${patient.last_name}`,
        label: 'Nouvelle consultation',
        icon: Stethoscope,
        shortcut: 'Entrée',
        run: () => go(`/patients/${patient.id}/consultation/new`),
      },
      {
        id: `${patient.id}-file`,
        group: `Pour ${patient.first_name} ${patient.last_name}`,
        label: 'Ouvrir le dossier',
        icon: FolderOpen,
        run: () => go(`/patients/${patient.id}`),
      },
      {
        id: `${patient.id}-edit`,
        group: `Pour ${patient.first_name} ${patient.last_name}`,
        label: 'Modifier la fiche patient',
        icon: Pencil,
        run: () => go(`/patients/${patient.id}/edit`),
      },
    ],
    [go]
  )

  const items = useMemo<PaletteItem[]>(() => {
    if (focusedPatient) return patientActions(focusedPatient)

    const patientItems: PaletteItem[] = patients.map((patient) => ({
      id: patient.id,
      group: mode === 'consultation' ? 'Choisir le patient' : 'Patients',
      label: `${patient.last_name} ${patient.first_name}`,
      initials: `${patient.first_name[0] ?? ''}${patient.last_name[0] ?? ''}`.toUpperCase(),
      hint: [patient.birth_date ? formatDate(patient.birth_date) : null, patient.phone, patient.email]
        .filter(Boolean)
        .join(' · '),
      patient,
      run:
        mode === 'consultation'
          ? () => go(`/patients/${patient.id}/consultation/new`)
          : () => go(`/patients/${patient.id}`),
    }))

    if (mode === 'consultation') return patientItems

    const tokens = splitSearchTokens(query)
    const matches = (text: string) => {
      if (tokens.length === 0) return true
      const haystack = normalize(text)
      return tokens.every((token) => haystack.includes(token))
    }

    const commands: PaletteItem[] = [
      {
        id: 'cmd-consultation',
        group: 'Actions',
        label: 'Nouvelle consultation…',
        icon: Stethoscope,
        run: () => reset('consultation'),
      },
      {
        id: 'cmd-patient',
        group: 'Actions',
        label: 'Nouveau patient',
        icon: UserPlus,
        run: () => go('/patients/new'),
      },
      {
        id: 'cmd-lock',
        group: 'Actions',
        label: 'Verrouiller la session',
        icon: Lock,
        run: async () => {
          setOpen(false)
          window.dispatchEvent(new Event('myosteoflow:before-lock'))
          await new Promise((resolve) => setTimeout(resolve, 400))
          await fetch('/api/session/lock', { method: 'POST' })
          router.push('/pin?mode=unlock')
        },
      },
    ].filter((command) => matches(`${command.label} nouveau creer ajouter`))

    const pages: PaletteItem[] = allNavItems
      .filter((item) => matches(`${item.name} ${item.description} ${item.keywords ?? ''}`))
      .map((item) => ({
        id: `page-${item.href}`,
        group: 'Pages',
        label: item.name,
        hint: item.description,
        icon: item.icon,
        run: () => go(item.href),
      }))

    return [...patientItems, ...commands, ...pages]
  }, [focusedPatient, patientActions, patients, mode, query, go, reset, router])

  useEffect(() => {
    setActiveIndex(0)
  }, [items.length, focusedPatient, mode])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const focusPatient = (patient: PatientResult) => {
    setFocusedPatient(patient)
    setQuery('')
    inputRef.current?.focus()
  }

  const goBack = () => {
    if (focusedPatient) setFocusedPatient(null)
    else if (mode === 'consultation') setMode('all')
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      items[activeIndex]?.run()
    } else if (event.key === 'ArrowRight' && items[activeIndex]?.patient && mode === 'all') {
      const input = event.currentTarget
      if (input.selectionStart === input.value.length) {
        event.preventDefault()
        focusPatient(items[activeIndex].patient!)
      }
    } else if ((event.key === 'Backspace' || event.key === 'ArrowLeft') && query === '' && (focusedPatient || mode === 'consultation')) {
      event.preventDefault()
      goBack()
    }
  }

  const placeholder = focusedPatient
    ? `Action pour ${focusedPatient.first_name} ${focusedPatient.last_name}…`
    : mode === 'consultation'
      ? 'Nouvelle consultation : nom, téléphone ou date de naissance…'
      : 'Rechercher un patient, une action, une page…'

  let lastGroup = ''

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Palette de commandes</DialogPrimitive.Title>

          <div className="flex h-14 items-center gap-3 border-b border-border px-4">
            {focusedPatient || mode === 'consultation' ? (
              <button
                type="button"
                onClick={goBack}
                aria-label="Revenir"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={placeholder}
              aria-label={placeholder}
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-list"
              aria-activedescendant={items[activeIndex] ? `palette-item-${activeIndex}` : undefined}
              className="h-full flex-1 bg-transparent text-base outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            />
            {isSearching && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden="true" />
            )}
            <kbd className="rounded-md border border-input px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">Échap</kbd>
          </div>

          <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
            {items.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {mode === 'consultation' && query.trim().length < 2
                  ? 'Tapez au moins deux lettres du nom du patient.'
                  : isSearching
                    ? 'Recherche…'
                    : 'Aucun résultat.'}
              </p>
            )}
            {items.map((item, index) => {
              const showGroup = item.group !== lastGroup
              lastGroup = item.group
              const active = index === activeIndex
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="px-3 pb-1 pt-2.5 text-xs font-semibold text-muted-foreground">{item.group}</p>
                  )}
                  <div
                    id={`palette-item-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={active}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => item.run()}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2',
                      active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                    )}
                  >
                    {item.initials ? (
                      <span className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        active ? 'bg-card text-accent-foreground' : 'bg-muted text-muted-foreground'
                      )}>
                        {item.initials}
                      </span>
                    ) : item.icon ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground/80">
                        <item.icon className="h-4 w-4" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', item.patient ? 'font-semibold' : 'font-medium')}>{item.label}</span>
                      {item.hint && <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>}
                    </span>
                    {item.patient && mode === 'all' && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          focusPatient(item.patient!)
                        }}
                        className="flex shrink-0 items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Actions <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {item.shortcut && (
                      <kbd className="rounded-md border border-input px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">{item.shortcut}</kbd>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden sm:flex gap-4 border-t border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            <span>↑ ↓ naviguer</span>
            <span>Entrée ouvrir</span>
            {mode === 'all' && !focusedPatient && <span>→ actions du patient</span>}
            {(focusedPatient || mode === 'consultation') && <span>← revenir</span>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
