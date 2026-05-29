'use client'

import Link from 'next/link'
import Image from 'next/image'
import logo from '@/assets/icon.png'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Users,
  Calendar,
  BarChart3,
  Settings,
  Menu,
  X,
  MessageCircle,
  Sparkles,
  LayoutDashboard,
  TrendingUp,
  LogOut,
  Lock,
  Mail,
  Upload,
  Target,
  ClipboardList,
  AlertTriangle,
  FileText,
  GraduationCap,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/db/client'
import packageJson from '../../../package.json'

interface ElectronAPI {
  isDesktop: boolean
  onUpdateDownloaded: (callback: (version: string) => void) => void
  installUpdate: () => void
}

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, description: 'Vue d\'ensemble' },
  { name: 'Patients', href: '/patients', icon: Users, description: 'Gérer vos patients' },
  { name: 'Consultations', href: '/consultations', icon: Calendar, description: 'Historique' },
  { name: 'Messagerie', href: '/messages', icon: MessageCircle, description: 'Communications' },
  { name: 'Statistiques', href: '/statistics', icon: TrendingUp, description: 'Analyses & tendances' },
  { name: 'Comptabilité', href: '/accounting', icon: BarChart3, description: 'Rapports' },
  { name: 'Objectifs', href: '/objectives', icon: Target, description: 'Suivi des objectifs' },
  { name: 'Emails', href: '/scheduled-emails', icon: Mail, description: 'Emails programmés' },
  { name: 'Sondages', href: '/surveys', icon: ClipboardList, description: 'Retours patients' },
  { name: 'Communication', href: '/communication', icon: FileText, description: 'Courriers & documents' },
  { name: 'E-Learning', href: '/elearning', icon: GraduationCap, description: 'Formations OsteoUpgrade' },
  { name: 'Importer CSV', href: '/import', icon: Upload, description: 'Importer des données' },
  { name: 'Paramètres', href: '/settings', icon: Settings, description: 'Configuration' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const db = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [updateReady, setUpdateReady] = useState<string | null>(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

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

  const handleLogout = async () => {
    await fetch('/api/license', { method: 'DELETE' })
    await db.auth.signOut()
    router.push('/osteoupgrade')
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

      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Déconnexion</h2>
            </div>
            <p className="text-slate-300 text-sm mb-6">
              Vous allez être déconnecté de votre compte Osteoupgrade. Vous devrez vous reconnecter pour utiliser MyOsteoFlow.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => { setShowLogoutModal(false); handleLogout() }}
                className="flex-1 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-all"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

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
          'fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 border-r border-white/5 transform transition-all duration-300 ease-out lg:translate-x-0 shadow-2xl',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 shrink-0 items-center px-6 border-b border-white/10 [-webkit-app-region:drag]" data-tour="sidebar-logo">
            <Link href="/patients" className="flex items-center space-x-3 group [-webkit-app-region:no-drag]">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-xl">
                  <Image src={logo} alt="MyOsteoFlow" width={40} height={40} className="object-cover" priority />
                </div>
              </div>
              <div>
                <span className="text-xl font-bold text-white [font-family:var(--font-playfair)] italic tracking-wide">
                  MyOsteoFlow
                </span>
                <p className="text-[10px] text-indigo-300/70 font-medium tracking-wider uppercase">
                  Gestion de cabinet
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-hide">
            <p className="px-3 text-[10px] font-semibold text-indigo-300/50 uppercase tracking-wider mb-3">
              Menu
            </p>
            {navigation.map((item) => {
              const isActive = item.href === '/elearning'
                ? (pathname.startsWith('/elearning') || pathname.startsWith('/formation'))
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  data-tour={`nav-${item.href.replace('/', '')}`}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'sidebar-active'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-white/20'
                      : 'bg-white/5 group-hover:bg-indigo-500/20 group-hover:text-indigo-300'
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span>{item.name}</span>
                  {isActive && (
                    <Sparkles className="h-3.5 w-3.5 text-white/70 ml-auto" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-white/10 p-4 space-y-2">
            <button
              onClick={handleLock}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-300 transition-all duration-200"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5">
                <Lock className="h-4 w-4" />
              </div>
              <span>Verrouiller</span>
            </button>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5">
                <LogOut className="h-4 w-4" />
              </div>
              <span>Déconnexion</span>
            </button>
            {updateReady ? (
              <button
                onClick={() => {
                  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
                  api?.installUpdate()
                }}
                className="block w-full rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 p-3 hover:from-emerald-500/30 hover:to-teal-500/30 transition-all duration-200 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-semibold text-emerald-300">v{updateReady} disponible</p>
                    <p className="text-[9px] text-emerald-400/70">Cliquez pour mettre à jour</p>
                  </div>
                </div>
              </button>
            ) : (
              <Link
                href="/changelog"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/10 p-3 hover:from-indigo-500/20 hover:to-violet-500/20 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-300">MyOsteoFlow v{packageJson.version}</p>
                    <p className="text-[9px] text-indigo-300/50">Voir le changelog</p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
