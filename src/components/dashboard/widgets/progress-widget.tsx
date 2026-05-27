'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Target, TrendingUp, TrendingDown, Minus, Settings, Calendar, Sun, Umbrella } from 'lucide-react'

type ObjectivesData = {
  settings: {
    annual_revenue_objective: number | null
    vacation_weeks_per_year: number
    working_days_per_week: number
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

export function ProgressWidget() {
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

  // Day-of-year percentage
  const startOfYear = new Date(year, 0, 1)
  const isLeap = (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0)
  const totalDays = isLeap ? 366 : 365
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
  const yearPct = (dayOfYear / totalDays) * 100

  // Week percentage (Mon–Sun)
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  const weekPct = ((dayOfWeek - 1) / 7) * 100

  // Month percentage
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate()
  const monthPct = ((now.getDate() - 1) / daysInMonth) * 100

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
            Progression
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
            Progression
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

  const WeekIcon = weekStatus.icon
  const MonthIcon = monthStatus.icon
  const YearIcon = yearStatus.icon

  return (
    <Card className="border-border/30 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <Target className="h-4 w-4 text-violet-500" />
          </div>
          Progression
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
          <Link href="/objectives">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* This week */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Sun className="h-4 w-4 text-amber-500" />
              Cette semaine
            </div>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${weekStatus.badge}`}>
              <WeekIcon className="h-3 w-3" /> {weekStatus.label}
            </span>
          </div>
          <VisualBar pct={weekRevPct} datePct={weekPct} color={weekStatus.bg} />
          <p className="text-xs text-muted-foreground">
            {weekRevPct >= 100
              ? 'Objectif hebdomadaire atteint !'
              : weekRevPct >= weekPct
              ? 'Vous êtes en avance sur votre semaine'
              : 'Il reste quelques consultations pour la semaine'}
          </p>
        </div>

        {/* This month */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Calendar className="h-4 w-4 text-indigo-500" />
              Ce mois-ci
            </div>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${monthStatus.badge}`}>
              <MonthIcon className="h-3 w-3" /> {monthStatus.label}
            </span>
          </div>
          <VisualBar pct={monthRevPct} datePct={monthPct} color={monthStatus.bg} />
          <p className="text-xs text-muted-foreground">
            {monthRevPct >= 100
              ? 'Objectif mensuel atteint !'
              : monthRevPct >= monthPct
              ? 'Bon rythme, vous êtes en avance ce mois-ci'
              : 'Quelques consultations supplémentaires pour atteindre l\'objectif'}
          </p>
        </div>

        {/* This year */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Target className="h-4 w-4 text-violet-500" />
              Cette année
            </div>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${yearStatus.badge}`}>
              <YearIcon className="h-3 w-3" /> {yearStatus.label}
            </span>
          </div>
          <VisualBar pct={yearRevPct} datePct={yearPct} color={yearStatus.bg} />
          <p className="text-xs text-muted-foreground">
            {yearRevPct >= 100
              ? 'Objectif annuel atteint !'
              : isAhead
              ? 'Vous êtes en avance sur l\'objectif annuel'
              : 'Continuez, vous progressez vers votre objectif annuel'}
          </p>
        </div>

        {/* Vacation days ahead */}
        {isAhead && vacationDaysAhead > 0 && (
          <div className="pt-1 border-t border-border/40">
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
        )}

      </CardContent>
    </Card>
  )
}
