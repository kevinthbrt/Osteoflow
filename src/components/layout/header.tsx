'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
import { LogOut, Settings, User, Bell, Search, HelpCircle } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Practitioner } from '@/types/database'
import { Input } from '@/components/ui/input'

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
}

export function Header({ user, practitioner }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoadingUnread, setIsLoadingUnread] = useState(true)

  // Patient search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PatientResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
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
  )?.[1] || { title: 'Dashboard', description: 'Bienvenue sur Osteoflow' }

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return 'Aucune notification'
    if (unreadCount > 99) return '99+ notifications'
    return `${unreadCount} notification${unreadCount > 1 ? 's' : ''}`
  }, [unreadCount])

  // Fetch unread count
  useEffect(() => {
    let isMounted = true

    const fetchUnreadCount = async () => {
      setIsLoadingUnread(true)
      const { data, error } = await supabase
        .from('conversations')
        .select('unread_count')
        .gt('unread_count', 0)

      if (!isMounted) return
      if (error) {
        console.error('Error fetching unread count:', error)
        setUnreadCount(0)
      } else {
        const total = (data || []).reduce((sum: number, conv: any) => sum + (conv.unread_count || 0), 0)
        setUnreadCount(total)
      }
      setIsLoadingUnread(false)
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [supabase])

  // Patient search
  const searchPatients = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, phone, email')
        .is('archived_at', null)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(8)
        .order('last_name')

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
  }, [supabase])

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
    <header className="sticky top-0 z-30 border-b border-border/40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
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
        <div className="hidden md:block relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowResults(true)
              }}
              className="pl-10 w-72 bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 h-9"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search results dropdown */}
          {showResults && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-900 rounded-xl border border-border shadow-lg overflow-hidden z-50">
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
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3"
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

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Help button */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex rounded-full text-muted-foreground hover:text-foreground h-9 w-9"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full text-muted-foreground hover:text-foreground h-9 w-9"
            onClick={() => router.push('/messages')}
            aria-label={unreadLabel}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            {isLoadingUnread && unreadCount === 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 animate-pulse rounded-full bg-muted-foreground/60" />
            )}
          </Button>

          {/* Separator */}
          <div className="hidden sm:block w-px h-6 bg-border/50 mx-1" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 gap-2 rounded-full pl-1 pr-3 hover:bg-muted/50"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium text-foreground">
                  {practitioner?.first_name || 'Utilisateur'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-3 bg-muted/50 rounded-lg mb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
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
                onClick={() => router.push('/settings')}
                className="rounded-lg py-2.5"
              >
                <User className="mr-3 h-4 w-4" />
                <span>Mon profil</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
                className="rounded-lg py-2.5"
              >
                <Settings className="mr-3 h-4 w-4" />
                <span>Paramètres</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="rounded-lg py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span>Changer de praticien</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
