'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, MessageCircle, FileText, Users, Calendar } from 'lucide-react'

interface StatusWidgetProps {
  todayConsultations: number
  unreadMessages: number
  totalPatients: number
}

type StatusLevel = 'good' | 'attention' | 'neutral'

function StatusDot({ level }: { level: StatusLevel }) {
  const colors: Record<StatusLevel, string> = {
    good: 'bg-emerald-500',
    attention: 'bg-amber-500',
    neutral: 'bg-muted-foreground/40',
  }
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[level]}`} />
}

function StatusRow({
  icon: Icon,
  label,
  status,
  href,
  iconColor,
}: {
  icon: React.ElementType
  label: string
  status: StatusLevel
  href: string
  iconColor: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-150"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm flex-1">{label}</span>
      <StatusDot level={status} />
    </Link>
  )
}

export function StatusWidget({ todayConsultations, unreadMessages, totalPatients }: StatusWidgetProps) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5

  const rows = [
    {
      icon: Calendar,
      label: todayConsultations > 0
        ? `${todayConsultations > 1 ? 'Consultations' : 'Consultation'} aujourd'hui`
        : isWorkday ? 'Aucune consultation prévue' : 'Pas de travail prévu',
      status: (todayConsultations > 0 ? 'good' : isWorkday ? 'attention' : 'neutral') as StatusLevel,
      href: '/consultations',
      iconColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    },
    {
      icon: MessageCircle,
      label: unreadMessages > 0 ? 'Messages non lus' : 'Messagerie à jour',
      status: (unreadMessages > 0 ? 'attention' : 'good') as StatusLevel,
      href: '/messages',
      iconColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: FileText,
      label: 'Factures et comptabilité',
      status: 'neutral' as StatusLevel,
      href: '/invoices',
      iconColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      icon: Users,
      label: 'Dossiers patients',
      status: (totalPatients > 0 ? 'good' : 'neutral') as StatusLevel,
      href: '/patients',
      iconColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <Card className="border-border/30 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          Tableau de bord
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pb-4">
        {rows.map((row) => (
          <StatusRow key={row.href} {...row} />
        ))}
      </CardContent>
    </Card>
  )
}
