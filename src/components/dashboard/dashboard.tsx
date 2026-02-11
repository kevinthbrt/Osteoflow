'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Users,
  Calendar,
  TrendingUp,
  MessageCircle,
  Plus,
  ArrowRight,
  Cake,
  Clock,
  Sparkles,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react'
import { formatCurrency, formatDateTime, getInitials } from '@/lib/utils'

import type { Practitioner } from '@/types/database'

interface DashboardProps {
  practitioner: Practitioner
  stats: {
    totalPatients: number
    todayConsultations: number
    monthlyRevenue: number
    unreadMessages: number
  }
  birthdaysThisWeek: Array<{
    id: string
    first_name: string
    last_name: string
    birth_date: string
  }>
  recentConsultations: Array<{
    id: string
    date_time: string
    reason: string
    patient: { id: string; first_name: string; last_name: string } | null
  }>
  patientsForConsultation: Array<{
    id: string
    first_name: string
    last_name: string
    email?: string | null
  }>
}

export function Dashboard({
  practitioner,
  stats,
  birthdaysThisWeek,
  recentConsultations,
  patientsForConsultation,
}: DashboardProps) {
  const [isNewConsultationOpen, setIsNewConsultationOpen] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const router = useRouter()
  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  const filteredPatients = useMemo(() => {
    const query = patientSearch.trim().toLowerCase()
    if (!query) return patientsForConsultation
    return patientsForConsultation.filter((patient) =>
      `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(query)
    )
  }, [patientSearch, patientsForConsultation])

  const quickActions = [
    {
      label: 'Nouveau patient',
      href: '/patients/new',
      icon: Users,
      color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      iconBg: 'from-indigo-500 to-indigo-600',
    },
    {
      label: 'Messagerie',
      href: '/messages',
      icon: MessageCircle,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      iconBg: 'from-emerald-500 to-emerald-600',
      badge: stats.unreadMessages > 0 ? stats.unreadMessages : undefined,
    },
    {
      label: 'Factures',
      href: '/invoices',
      icon: FileText,
      color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      iconBg: 'from-violet-500 to-violet-600',
    },
    {
      label: 'Comptabilité',
      href: '/accounting',
      icon: BarChart3,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      iconBg: 'from-amber-500 to-amber-600',
    },
  ]

  const statCards = [
    {
      label: 'Patients actifs',
      value: stats.totalPatients,
      icon: Users,
      gradient: 'from-indigo-500 to-indigo-600',
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: "Consultations aujourd'hui",
      value: stats.todayConsultations,
      icon: Calendar,
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'CA du mois',
      value: formatCurrency(stats.monthlyRevenue),
      icon: TrendingUp,
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-500/10',
      text: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Messages non lus',
      value: stats.unreadMessages,
      icon: MessageCircle,
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="relative overflow-hidden rounded-2xl p-8 text-white gradient-primary">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3 blur-lg" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/5 rounded-full animate-float" />
        <div className="relative z-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-white/80" />
                <span className="text-sm font-medium text-white/70">
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
              </div>
              <h1 className="text-3xl font-bold mb-1">
                {greeting()}, {practitioner.first_name} !
              </h1>
              <p className="text-white/70">
                {stats.todayConsultations > 0
                  ? `Vous avez ${stats.todayConsultations} consultation${
                      stats.todayConsultations > 1 ? 's' : ''
                    } aujourd'hui`
                  : "Pas de consultation prévue aujourd'hui"}
              </p>
            </div>
            <Button
              className="gap-2 bg-white/15 text-white border border-white/20 hover:bg-white/25 backdrop-blur-sm"
              onClick={() => setIsNewConsultationOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Nouvelle consultation
            </Button>
          </div>
          <Dialog open={isNewConsultationOpen} onOpenChange={setIsNewConsultationOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nouvelle consultation</DialogTitle>
                <DialogDescription>
                  Recherchez un patient pour créer une consultation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Rechercher par nom ou prénom..."
                    value={patientSearch}
                    onChange={(event) => setPatientSearch(event.target.value)}
                  />
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredPatients.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-6">
                      Aucun patient trouvé.
                    </div>
                  ) : (
                    filteredPatients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setIsNewConsultationOpen(false)
                          setPatientSearch('')
                          router.push(`/patients/${patient.id}/consultation/new`)
                        }}
                        className="w-full rounded-xl border border-border/60 px-4 py-3 text-left transition-all duration-200 hover:border-primary/40 hover:bg-accent/50 hover:shadow-sm"
                      >
                        <p className="font-medium">
                          {patient.first_name} {patient.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {patient.email || 'Email non renseigné'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" asChild>
                    <Link href="/patients/new">Créer un nouveau patient</Link>
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="card-hover cursor-pointer h-full border-border/30 hover:border-primary/20">
              <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center ${action.color}`}>
                  <action.icon className="h-6 w-6" />
                  {action.badge && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center">
                      {action.badge}
                    </Badge>
                  )}
                </div>
                <span className="font-medium text-sm">{action.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
        {statCards.map((stat) => (
          <Card key={stat.label} className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-6 w-6 ${stat.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent consultations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Dernières consultations
              </CardTitle>
              <CardDescription>Vos consultations récentes</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/consultations">
                Voir tout
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentConsultations.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aucune consultation récente</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/patients">
                    <Plus className="h-4 w-4 mr-1" />
                    Créer une consultation
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentConsultations.map((consultation) => (
                  <Link
                    key={consultation.id}
                    href={`/consultations/${consultation.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-all duration-200"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {consultation.patient
                          ? getInitials(
                              consultation.patient.first_name,
                              consultation.patient.last_name
                            )
                          : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {consultation.patient
                          ? `${consultation.patient.first_name} ${consultation.patient.last_name}`
                          : 'Patient inconnu'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {consultation.reason}
                      </p>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">
                      {formatDateTime(consultation.date_time)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Birthdays & Tips */}
        <div className="space-y-6">
          {/* Birthdays this week */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Cake className="h-5 w-5 text-pink-500" />
                Anniversaires cette semaine
              </CardTitle>
            </CardHeader>
            <CardContent>
              {birthdaysThisWeek.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Aucun anniversaire cette semaine
                </p>
              ) : (
                <div className="space-y-3">
                  {birthdaysThisWeek.map((patient) => {
                    const bday = new Date(patient.birth_date)
                    const thisYearBday = new Date(
                      new Date().getFullYear(),
                      bday.getMonth(),
                      bday.getDate()
                    )
                    const age =
                      new Date().getFullYear() - bday.getFullYear()

                    return (
                      <Link
                        key={patient.id}
                        href={`/patients/${patient.id}`}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/50 transition-all duration-200"
                      >
                        <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                          <Cake className="h-5 w-5 text-pink-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {age} ans le{' '}
                            {thisYearBday.toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                            })}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.location.href = `/messages?patient=${patient.id}`
                          }}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips card */}
          <Card className="bg-gradient-to-br from-indigo-500/5 via-violet-500/5 to-purple-500/10 border-primary/15">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 gradient-primary">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Astuce du jour</h3>
                  <p className="text-sm text-muted-foreground">
                    Activez le suivi J+7 sur vos consultations pour envoyer
                    automatiquement un email de suivi à vos patients et maintenir
                    une relation de qualité.
                  </p>
                  <Button variant="link" className="p-0 h-auto mt-2" asChild>
                    <Link href="/settings">
                      Configurer les emails
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
