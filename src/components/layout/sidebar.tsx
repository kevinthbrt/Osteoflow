'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Users,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
  MessageCircle,
  Sparkles,
  LayoutDashboard,
  TrendingUp,
  LogOut,
  Mail,
  Upload,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/db/client'

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, description: 'Vue d\'ensemble' },
  { name: 'Patients', href: '/patients', icon: Users, description: 'Gérer vos patients' },
  { name: 'Consultations', href: '/consultations', icon: Calendar, description: 'Historique' },
  { name: 'Factures', href: '/invoices', icon: FileText, description: 'Facturation' },
  { name: 'Messagerie', href: '/messages', icon: MessageCircle, description: 'Communications' },
  { name: 'Statistiques', href: '/statistics', icon: TrendingUp, description: 'Analyses & tendances' },
  { name: 'Comptabilité', href: '/accounting', icon: BarChart3, description: 'Rapports' },
  { name: 'Emails', href: '/scheduled-emails', icon: Mail, description: 'Emails programmés' },
  { name: 'Importer CSV', href: '/import', icon: Upload, description: 'Importer des données' },
  { name: 'Paramètres', href: '/settings', icon: Settings, description: 'Configuration' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const db = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await db.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </Button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-950/80 border-r border-border/50 transform transition-all duration-300 ease-out lg:translate-x-0 shadow-xl lg:shadow-none',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 shrink-0 items-center px-6 border-b border-border/50">
            <Link href="/patients" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow duration-300">
                  <svg
                    className="w-6 h-6 text-primary-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Osteoflow
                </span>
                <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
                  GESTION DE CABINET
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-hide">
            <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Menu
            </p>
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200',
                    isActive
                      ? 'bg-white/20'
                      : 'bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary'
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span>{item.name}</span>
                  {isActive && (
                    <Sparkles className="h-3.5 w-3.5 text-primary-foreground/70 ml-auto" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-border/50 p-4 space-y-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50">
                <LogOut className="h-4 w-4" />
              </div>
              <span>Déconnexion</span>
            </button>
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-foreground">Osteoflow v1.0.0</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
