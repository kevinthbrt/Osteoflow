'use client'

import { useEffect, useMemo, useState } from 'react'
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
    // Poll every 30 seconds (replaces Supabase real-time)
    const interval = setInterval(fetchUnreadCount, 30000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [supabase])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl px-4 lg:px-8">
      {/* Spacer for mobile menu button */}
      <div className="w-10 lg:hidden" />

      {/* Page title - hidden on mobile */}
      <div className="hidden lg:block">
        <h1 className="text-lg font-semibold text-foreground">{currentPage.title}</h1>
        <p className="text-xs text-muted-foreground">{currentPage.description}</p>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search bar - hidden on mobile */}
      <div className="hidden md:flex items-center max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-10 w-64 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Help button */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex rounded-full text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => router.push('/messages')}
          aria-label={unreadLabel}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          {isLoadingUnread && unreadCount === 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 animate-pulse rounded-full bg-muted-foreground/60" />
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 gap-3 rounded-full pl-1 pr-4 hover:bg-muted/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-medium">
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
    </header>
  )
}
