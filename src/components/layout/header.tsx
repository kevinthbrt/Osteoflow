'use client'

import { useRef } from 'react'
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
import { LogOut, Settings, Search, HelpCircle, Lock, Building2, ChevronDown, Plus, Stethoscope, UserPlus } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Practitioner } from '@/types/database'
import { NotificationBell } from '@/components/layout/notification-bell'
import { BackupButton } from '@/components/layout/backup-button'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { CountrySwitcher } from '@/components/layout/country-switcher'
import { useTour } from '@/contexts/tour-context'
import { getPageInfo } from '@/components/layout/navigation'
import { openCommandPalette } from '@/components/layout/command-palette'

interface LocalUser {
  id: string
  email: string
  user_metadata?: { first_name?: string; last_name?: string }
}

interface HeaderProps {
  user: LocalUser
  practitioner: Practitioner | null
}

export function Header({ user, practitioner }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  // Client créé une seule fois, pas à chaque rendu.
  const dbRef = useRef(createClient())
  const { startTour } = useTour()

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

  const currentPage = getPageInfo(pathname)
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <header data-app-header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
        {/* Spacer for mobile menu button */}
        <div className="w-10 lg:hidden" />

        {/* Page title */}
        <div className="min-w-0 mr-auto">
          <h1 className="truncate text-lg font-semibold leading-tight">{currentPage.title}</h1>
          <p className="hidden sm:block text-xs text-muted-foreground first-letter:uppercase">{today}</p>
        </div>

        {/* Palette de commandes */}
        <button
          type="button"
          onClick={() => openCommandPalette()}
          data-tour="header-search"
          aria-label="Rechercher un patient, une action ou une page"
          className="flex h-10 items-center gap-2.5 rounded-lg border border-input bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card md:w-80 lg:w-96"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden md:block flex-1 truncate text-left">Patient, action, page…</span>
          <kbd className="hidden md:block rounded-md border border-input bg-card px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
            Ctrl K
          </kbd>
        </button>

        {/* Création rapide */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 gap-1.5 rounded-lg px-3 sm:px-4" aria-label="Créer">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouveau</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1.5">
            <DropdownMenuItem onClick={() => openCommandPalette('consultation')} className="py-2.5">
              <Stethoscope className="mr-3 h-4 w-4" />
              <span>Consultation</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/patients/new')} className="py-2.5">
              <UserPlus className="mr-3 h-4 w-4" />
              <span>Patient</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Pays de facturation (France / Québec) */}
          <CountrySwitcher practitioner={practitioner} />

          {/* Thème clair / sombre / système */}
          <ThemeToggle />

          {/* Help button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={startTour}
            data-tour="header-help"
            className="hidden sm:flex rounded-lg text-muted-foreground hover:text-foreground h-9 w-9"
            title="Visite guidée"
            aria-label="Visite guidée"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <NotificationBell />

          {/* Sauvegarde des données */}
          <BackupButton />

          {/* Separator */}
          <div className="hidden sm:block w-px h-6 bg-border/50 mx-1" />

          {/* Menu du cabinet */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 gap-1.5 rounded-lg pl-1 pr-2 border border-border hover:bg-muted transition-colors"
                title="Mon cabinet"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2 rounded-xl" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-3 bg-muted rounded-lg mb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
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
                className="rounded-lg py-2.5"
              >
                <Building2 className="mr-3 h-4 w-4" />
                <span>Changer de cabinet</span>
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
                onClick={handleLock}
                className="rounded-lg py-2.5"
              >
                <Lock className="mr-3 h-4 w-4" />
                <span>Verrouiller</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="rounded-lg py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
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
