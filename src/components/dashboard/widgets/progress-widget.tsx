'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Target, TrendingUp, TrendingDown, Minus, Settings, Calendar, Sun, Umbrella } from 'lucide-react'
import { resolveWorkingWeekdays, workingDayRatio } from '@/lib/utils/working-days'

function formatEuros(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

type ObjectivesData = {
  settings: {
    annual_revenue_objective: number | null
    vacation_weeks_per_year: number
    working_days_per_week: number
    working_weekdays: number[] | null
    average_consultation_price: number | null
  }
  computed: {
    working_weeks: number
    daily_objective: number
    weekly_objective: number
    monthly_objective: number
  }
  revenue: {
    today: number
    this_week: number
    this_month: number
    this_year: number
  }
}

function getStatusInfo(pct: number, datePct: number) {
  const diff = pct - datePct
  if (diff >= 10) return { label: 'En avance', color: 'text-emerald-600', bg: 'bg-emerald-500', icon: TrendingUp, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }
  if (diff >= -5) return { label: 'Dans les temps', color: 'text-sky-600', bg: 'bg-sky-500', icon: Minus, badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' }
  return { label: 'À rattraper', color: 'text-amber-600', bg: 'bg-amber-500', icon: TrendingDown, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
}

function VisualBar({ pct, datePct, color }: { pct: number; datePct: number; color: string }) {
  return (
    <div className="relative h-3 w-full rounded-full bg-muted overflow-visible">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
      {/* Date cursor */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-foreground/50 rounded-full"
        style={{ left: `${Math.min(99, datePct)}%` }}
      />
    </div>
  )
}

function VacationDots({ days }: { days: number }) {
  const shown = Math.min(days, 14)
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className="text-sm" role="img" aria-hidden>🌴</span>
      ))}
      {days > 14 && <span className="text-xs text-muted-foreground self-center">+{days - 14}</span>}
    </div>
  )
}

type StatusInfo = ReturnType<typeof getStatusInfo>

function PeriodBlock({
  icon: Icon,
  iconColor,
  label,
  status,
  revenue,
  objective,
  revPct,
  datePct,
  message,
}: {
  icon: typeof Sun
  iconColor: string
  label: string
  status: StatusInfo
  revenue: number
  objective: number
  revPct: number
  datePct: number
  message: string
}) {
  const StatusIcon = status.icon
  const expected = objective * (datePct / 100)
  const gap = revenue - expected
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {label}
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${status.badge}`}>
          <StatusIcon className="h-3 w-3" /> {status.label}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">
          {formatEuros(revenue)}
          <span className="text-muted-foreground font-normal"> / {formatEuros(objective)}</span>
        </p>
        <p className="text-xs text-muted-foreground">{Math.round(revPct)} %</p>
      </div>
      <VisualBar pct={revPct} datePct={datePct} color={status.bg} />
      <p className="text-xs text-muted-foreground">
        Attendu à ce jour : <span className="font-medium text-foreground">{formatEuros(expected)}</span>
        {' '}
        <span className={gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
          ({gap >= 0 ? '+' : '−'}{formatEuros(Math.abs(gap))})
        </span>
      </p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

export function ProgressWidget({ layout = 'vertical' }: { layout?: 'vertical' | 'horizontal' }) {
  const [data, setData] = useState<ObjectivesData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/objectives')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const year = now.getFullYear()
  const startOfToday = new Date(year, now.getMonth(), now.getDate())
  const workingWeekdays = resolveWorkingWeekdays(
    data?.settings.working_weekdays,
    data?.settings.working_days_per_week ?? 4
  )

  // Fraction of working days elapsed so far, per period (vacation weeks
  // aren't pinned to specific calendar weeks so they can't be excluded
  // precisely).
  const dow = now.getDay() === 0 ? 7 : now.getDay() // 1=Mon ... 7=Sun
  const weekStart = new Date(year, now.getMonth(), now.getDate() - (dow - 1))
  const weekEnd = new Date(year, now.getMonth(), now.getDate() - (dow - 1) + 7)
  const weekPct = workingDayRatio(weekStart, weekEnd, startOfToday, workingWeekdays) * 100

  const monthStart = new Date(year, now.getMonth(), 1)
  const monthEnd = new Date(year, now.getMonth() + 1, 1)
  const monthPct = workingDayRatio(monthStart, monthEnd, startOfToday, workingWeekdays) * 100

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const yearPct = workingDayRatio(yearStart, yearEnd, startOfToday, workingWeekdays) * 100

  const annual = data?.settings.annual_revenue_objective
  const hasObjectives = annual && annual > 0

  if (loading) {
    return (
      <Card className="border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <Target className="h-4 w-4 text-violet-500" />
            </div>
            <span className="text-violet-600 dark:text-violet-400">Progression</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="h-3 bg-muted/40 rounded w-1/3" />
              <div className="h-3 bg-muted/30 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!hasObjectives) {
    return (
      <Card className="border-border/30 h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <Target className="h-4 w-4 text-violet-500" />
            </div>
            <span className="text-violet-600 dark:text-violet-400">Progression</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-6 text-center">
          <Target className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Objectifs non configurés</p>
            <p className="text-xs text-muted-foreground mt-1">
              Définissez votre objectif annuel pour suivre votre progression.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/objectives">
              <Settings className="h-4 w-4 mr-1" />
              Configurer
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const weekRevPct = data.computed.weekly_objective > 0
    ? Math.min(100, (data.revenue.this_week / data.computed.weekly_objective) * 100) : 0
  const monthRevPct = data.computed.monthly_objective > 0
    ? Math.min(100, (data.revenue.this_month / data.computed.monthly_objective) * 100) : 0
  const yearRevPct = annual > 0
    ? Math.min(100, (data.revenue.this_year / annual) * 100) : 0

  const weekStatus = getStatusInfo(weekRevPct, weekPct)
  const monthStatus = getStatusInfo(monthRevPct, monthPct)
  const yearStatus = getStatusInfo(yearRevPct, yearPct)

  // Vacation days ahead calculation
  const dailyObj = data.computed.daily_objective
  const diff = data.revenue.this_year - (yearPct / 100) * annual
  const vacationDaysAhead = (diff > 0 && dailyObj > 0) ? Math.floor(diff / dailyObj) : 0
  const isAhead = yearRevPct >= yearPct

  const weekBlock = (
    <PeriodBlock
      icon={Sun}
      iconColor="text-amber-500"
      label="Cette semaine"
      status={weekStatus}
      revenue={data.revenue.this_week}
      objective={data.computed.weekly_objective}
      revPct={weekRevPct}
      datePct={weekPct}
      message={
        weekRevPct >= 100
          ? 'Objectif hebdomadaire atteint !'
          : weekRevPct >= weekPct
          ? 'Vous êtes en avance sur votre semaine'
          : 'Il reste quelques consultations pour la semaine'
      }
    />
  )

  const monthBlock = (
    <PeriodBlock
      icon={Calendar}
      iconColor="text-indigo-500"
      label="Ce mois-ci"
      status={monthStatus}
      revenue={data.revenue.this_month}
      objective={data.computed.monthly_objective}
      revPct={monthRevPct}
      datePct={monthPct}
      message={
        monthRevPct >= 100
          ? 'Objectif mensuel atteint !'
          : monthRevPct >= monthPct
          ? 'Bon rythme, vous êtes en avance ce mois-ci'
          : 'Quelques consultations supplémentaires pour atteindre l\'objectif'
      }
    />
  )

  const yearBlock = (
    <PeriodBlock
      icon={Target}
      iconColor="text-violet-500"
      label="Cette année"
      status={yearStatus}
      revenue={data.revenue.this_year}
      objective={annual}
      revPct={yearRevPct}
      datePct={yearPct}
      message={
        yearRevPct >= 100
          ? 'Objectif annuel atteint !'
          : isAhead
          ? 'Vous êtes en avance sur l\'objectif annuel'
          : 'Continuez, vous progressez vers votre objectif annuel'
      }
    />
  )

  const vacationBlock = isAhead && vacationDaysAhead > 0 && (
    <div className={layout === 'horizontal' ? '' : 'pt-1 border-t border-border/40'}>
      <div className="flex items-center gap-2 mb-2">
        <Umbrella className="h-4 w-4 text-emerald-500" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Jours de congés en avance
        </p>
      </div>
      <VacationDots days={vacationDaysAhead} />
      <p className="text-xs text-muted-foreground mt-1.5">
        Votre avance représente environ {vacationDaysAhead} jour{vacationDaysAhead > 1 ? 's' : ''} de congés supplémentaires.
      </p>
    </div>
  )

  return (
    <Card className="border-border/30 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <Target className="h-4 w-4 text-violet-500" />
          </div>
          <span className="text-violet-600 dark:text-violet-400">Progression</span>
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
          <Link href="/objectives">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      {layout === 'horizontal' ? (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {weekBlock}
            {monthBlock}
            {yearBlock}
          </div>
          {vacationBlock && (
            <div className="pt-3 border-t border-border/40">{vacationBlock}</div>
          )}
        </CardContent>
      ) : (
        <CardContent className="space-y-5">
          {weekBlock}
          {monthBlock}
          {yearBlock}
          {vacationBlock}
        </CardContent>
      )}
    </Card>
  )
}
