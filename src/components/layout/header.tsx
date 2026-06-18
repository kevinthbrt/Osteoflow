'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Settings, Search, HelpCircle, Lock, Building2, ChevronDown } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { buildSearchOrFilters } from '@/lib/utils/search'
import type { Practitioner } from '@/types/database'
import { Input } from '@/components/ui/input'
import { NotificationBell } from '@/components/layout/notification-bell'
import { BackupButton } from '@/components/layout/backup-button'
import { HeaderWeather } from '@/components/layout/header-weather'
import { useTour } from '@/contexts/tour-context'

interface LocalUser {
  id: string
  email: string
  user_metadata?: { first_name?: string; last_name?: string }
}

interface HeaderProps {
  user: LocalUser
  practitioner: Practitioner | null
}

interface PatientResult {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
}

const pageTitles: Record<string, { title: string; description: string }> = {
  '/dashboard': { title: 'Tableau de bord', description: 'Vue d\'ensemble de votre activité' },
  '/patients': { title: 'Patients', description: 'Gérez vos patients et leurs informations' },
  '/consultations': { title: 'Consultations', description: 'Historique de toutes vos consultations' },
  '/invoices': { title: 'Factures', description: 'Gérez vos factures et paiements' },
  '/messages': { title: 'Messagerie', description: 'Communiquez avec vos patients' },
  '/accounting': { title: 'Comptabilité', description: 'Analysez votre activité' },
  '/settings': { title: 'Paramètres', description: 'Configurez votre cabinet' },
  '/changelog': { title: 'Changelog', description: 'Historique des mises à jour' },
}

export function Header({ user, practitioner }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  // useRef so createClient() is called once — not on every render.
  // Calling it on every render produces a new object reference, which
  // causes searchPatients (useCallback with [db] dep) to be recreated
  // each render, triggering the search useEffect in an infinite loop.
  const dbRef = useRef(createClient())
  const { startTour } = useTour()

  // Patient search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PatientResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleSignOut = async () => {
    // Libère la licence (verrou « une seule instance active par utilisateur »)
    // avant de se déconnecter, puis revient sur la connexion Osteoupgrade.
    try { await fetch('/api/license', { method: 'DELETE' }) } catch {}
    await dbRef.current.auth.signOut()
    router.push('/osteoupgrade')
    router.refresh()
  }

  const handleLock = async () => {
    // Sauvegarde des brouillons en cours avant de verrouiller, puis bascule
    // sur l'écran de code PIN. Même comportement que dans la barre latérale.
    window.dispatchEvent(new Event('myosteoflow:before-lock'))
    await new Promise((r) => setTimeout(r, 400))
    await fetch('/api/session/lock', { method: 'POST' })
    router.push('/pin?mode=unlock')
  }

  const displayName = practitioner
    ? `${practitioner.first_name} ${practitioner.last_name}`
    : user.email

  const initials = practitioner
    ? getInitials(practitioner.first_name, practitioner.last_name)
    : user.email?.charAt(0).toUpperCase() || 'U'

  // Get current page info
  const currentPage = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] || { title: 'Dashboard', description: 'Bienvenue sur MyOsteoFlow' }

  // Patient search
  const searchPatients = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    try {
      const db = dbRef.current
      let builder = db
        .from('patients')
        .select('id, first_name, last_name, phone, email')
        .is('archived_at', null)

      for (const filter of buildSearchOrFilters(query, ['first_name', 'last_name', 'phone', 'email'])) {
        builder = builder.or(filter)
      }

      const { data, error } = await builder.limit(8).order('last_name')

      if (error) {
        console.error('Search error:', error)
        return
      }

      setSearchResults(data || [])
      setShowResults(true)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  // dbRef is a ref — stable by definition, no need in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    searchTimerRef.current = setTimeout(() => {
      searchPatients(searchQuery)
    }, 300)

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [searchQuery, searchPatients])

  // Close results on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectPatient = (patientId: string) => {
    setShowResults(false)
    setSearchQuery('')
    router.push(`/patients/${patientId}`)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/40 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-6 lg:px-8">
        {/* Spacer for mobile menu button */}
        <div className="w-10 lg:hidden" />

        {/* Page title */}
        <div className="hidden lg:block min-w-0">
          <h1 className="text-lg font-semibold text-foreground leading-tight">{currentPage.title}</h1>
          <p className="text-xs text-muted-foreground">{currentPage.description}</p>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search bar - patient search */}
        <div className="hidden md:block relative" ref={searchRef} data-tour="header-search">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowResults(true)
              }}
              className="pl-10 w-72 bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 h-9 rounded-xl"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search results dropdown */}
          {showResults && (
            <div className="absolute top-full mt-2 w-full glass-card rounded-2xl shadow-xl overflow-hidden z-50">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  Aucun patient trouvé
                </div>
              ) : (
                <div className="py-1 max-h-80 overflow-y-auto">
                  {searchResults.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent/50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {patient.first_name[0]}{patient.last_name[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {patient.last_name} {patient.first_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {patient.phone}
                          {patient.email && ` · ${patient.email}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Weather chip */}
        <HeaderWeather />

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Help button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={startTour}
            data-tour="header-help"
            className="hidden sm:flex rounded-full text-muted-foreground hover:text-foreground h-9 w-9"
            title="Visite guidée"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <NotificationBell />

          {/* Sauvegarde des données */}
          <BackupButton />

          {/* Separator */}
          <div className="hidden sm:block w-px h-6 bg-border/50 mx-1" />

          {/* User / cabinet menu — encadré pour être bien visible */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 gap-2 rounded-full pl-1 pr-2 border border-border bg-accent/40 hover:bg-accent/70 hover:border-primary/40 transition-colors"
                title="Mon cabinet"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-white text-xs font-medium gradient-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium text-foreground">
                  {practitioner?.first_name || 'Utilisateur'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2 rounded-2xl" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-3 bg-accent/50 rounded-xl mb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-white gradient-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground mt-1">
                      {user.email}
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => window.dispatchEvent(new Event('open-cabinet-dialog'))}
                className="rounded-xl py-2.5"
              >
                <Building2 className="mr-3 h-4 w-4" />
                <span>Changer de cabinet</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
                className="rounded-xl py-2.5"
              >
                <Settings className="mr-3 h-4 w-4" />
                <span>Paramètres</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem
                onClick={handleLock}
                className="rounded-xl py-2.5"
              >
                <Lock className="mr-3 h-4 w-4" />
                <span>Verrouiller</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="rounded-xl py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
