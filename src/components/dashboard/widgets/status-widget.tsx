'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, MessageCircle, BarChart3, Users, ClipboardList } from 'lucide-react'

interface StatusWidgetProps {
  unreadMessages: number
}

type StatusLevel = 'good' | 'attention' | 'neutral'

function StatusDot({ level }: { level: StatusLevel }) {
  const colors: Record<StatusLevel, string> = {
    good: 'bg-emerald-500',
    attention: 'bg-amber-500 animate-pulse',
    neutral: 'bg-muted-foreground/30',
  }
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[level]}`} />
}

function StatusRow({
  icon: Icon,
  label,
  sublabel,
  status,
  href,
  iconColor,
}: {
  icon: React.ElementType
  label: string
  sublabel?: string
  status: StatusLevel
  href: string
  iconColor: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-150 group"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <StatusDot level={status} />
    </Link>
  )
}

export function StatusWidget({ unreadMessages }: StatusWidgetProps) {
  const rows = [
    {
      icon: Users,
      label: 'Nouveau patient',
      sublabel: 'Créer un dossier',
      status: 'neutral' as StatusLevel,
      href: '/patients/new',
      iconColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    },
    {
      icon: MessageCircle,
      label: 'Messagerie',
      sublabel: unreadMessages > 0 ? 'Messages non lus' : 'À jour',
      status: (unreadMessages > 0 ? 'attention' : 'good') as StatusLevel,
      href: '/messages',
      iconColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: ClipboardList,
      label: 'Sondages',
      sublabel: 'Réponses patients',
      status: 'neutral' as StatusLevel,
      href: '/surveys',
      iconColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    {
      icon: BarChart3,
      label: 'Comptabilité',
      sublabel: 'Analyse financière',
      status: 'neutral' as StatusLevel,
      href: '/accounting',
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
          Accès rapides
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
