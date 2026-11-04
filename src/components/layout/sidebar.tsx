'use client'

import Link from 'next/link'
import Image from 'next/image'
import logo from '@/assets/icon.png'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Menu, X, Sparkles, Lock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import packageJson from '../../../package.json'
import { navigationGroups, settingsNavItem, isNavItemActive, type NavItem } from './navigation'

interface ElectronAPI {
  isDesktop: boolean
  onUpdateDownloaded: (callback: (version: string) => void) => void
  installUpdate: () => void
}

/**
 * Pastille « Nouveau » sur les entrées de menu introduites par une version
 * récente. Elle disparaît définitivement dès que la page a été ouverte : le
 * but est d'attirer l'œil une fois, pas de décorer le menu en permanence.
 */
const NEW_BADGE_SEEN_KEY = 'myosteoflow_seen_new_nav'
const appVersion = packageJson.version

interface SidebarProps {
  displayName?: string
  initials?: string
}

export function Sidebar({ displayName, initials }: SidebarProps) {
  const pathname = usePathname()
  const [seenNewNav, setSeenNewNav] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NEW_BADGE_SEEN_KEY)
      setSeenNewNav(stored ? (JSON.parse(stored) as string[]) : [])
    } catch {
      setSeenNewNav([])
    }
  }, [])

  const markNavSeen = (href: string) => {
    setSeenNewNav((previous) => {
      if (previous.includes(href)) return previous
      const next = [...previous, href]
      try {
        localStorage.setItem(NEW_BADGE_SEEN_KEY, JSON.stringify(next))
      } catch {
        // Un stockage indisponible ne doit pas empêcher la navigation.
      }
      return next
    })
  }
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [updateReady, setUpdateReady] = useState<string | null>(null)

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
    if (!api?.isDesktop) return
    api.onUpdateDownloaded((v) => setUpdateReady(v))
  }, [])

  const handleLock = async () => {
    window.dispatchEvent(new Event('myosteoflow:before-lock'))
    await new Promise((r) => setTimeout(r, 400))
    await fetch('/api/session/lock', { method: 'POST' })
    router.push('/pin?mode=unlock')
  }

  const renderItem = (item: NavItem) => {
    const isActive = isNavItemActive(item, pathname)
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => {
          setMobileMenuOpen(false)
          if (item.newIn) markNavSeen(item.href)
        }}
        data-tour={`nav-${item.href.replace('/', '')}`}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
          isActive
            ? 'sidebar-active'
            : 'font-medium text-sidebar-foreground/85 hover:bg-sidebar-hover hover:text-sidebar-foreground'
        )}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{item.name}</span>
        {item.newIn === appVersion && !seenNewNav.includes(item.href) && (
          <span className="ml-auto rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
            Nouveau
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        data-mobile-menu
        className="fixed top-3 left-3 z-50 lg:hidden bg-card border border-border shadow-sm"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        data-app-sidebar
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-out lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center px-5 [-webkit-app-region:drag]" data-tour="sidebar-logo">
            <Link href="/dashboard" className="flex items-center gap-2.5 [-webkit-app-region:no-drag]">
              <Image src={logo} alt="" width={32} height={32} className="rounded-lg" priority />
              <span className="text-[19px] font-semibold text-sidebar-foreground [font-family:var(--font-playfair)] italic">
                MyOsteoFlow
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto px-3 py-3 scrollbar-hide">
            {navigationGroups.map((group) => (
              <div key={group.label} className="space-y-0.5">
                <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {group.label}
                </p>
                {group.items.map(renderItem)}
              </div>
            ))}
            <div className="border-t border-sidebar-border pt-3">{renderItem(settingsNavItem)}</div>
          </nav>

          {/* Footer */}
          <div className="space-y-2 border-t border-sidebar-border p-3">
            {updateReady && (
              <button
                onClick={() => {
                  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
                  api?.installUpdate()
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-success/30 bg-success-soft px-3 py-2.5 text-left transition-colors hover:border-success/60"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-success" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-success">v{updateReady} disponible</span>
                  <span className="block text-xs text-muted-foreground">Cliquez pour mettre à jour</span>
                </span>
              </button>
            )}
            <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-active/70 p-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {initials || 'MO'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{displayName || 'Mon cabinet'}</span>
                <Link
                  href="/changelog"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block truncate text-xs text-sidebar-muted hover:text-sidebar-foreground"
                >
                  v{packageJson.version} · nouveautés
                </Link>
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLock}
                aria-label="Verrouiller la session"
                title="Verrouiller la session"
                className="h-9 w-9 shrink-0 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
              >
                <Lock className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
