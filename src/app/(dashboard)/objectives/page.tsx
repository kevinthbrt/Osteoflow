'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Target, Settings, Users, Euro, Check, Pencil, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

interface ObjectivesData {
  settings: {
    annual_revenue_objective: number | null
    vacation_weeks_per_year: number
    working_days_per_week: number
    average_consultation_price: number | null
  }
  computed: {
    working_weeks: number
    working_days: number
    daily_objective: number
    weekly_objective: number
    monthly_objective: number
  }
  revenue: {
    today: number
    this_week: number
    this_month: number
    this_year: number
    monthly_breakdown: Array<{ month: number; actual: number; manual: number; total: number }>
  }
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function formatPatients(value: number, price: number): string {
  if (price <= 0) return '—'
  return `${Math.round(value / price)} patients`
}

interface ProgressBarProps {
  label: string
  sublabel: string
  actual: number
  objective: number
  showPatients: boolean
  consultationPrice: number | null
}

function ProgressBar({ label, sublabel, actual, objective, showPatients, consultationPrice }: ProgressBarProps) {
  const pct = objective > 0 ? Math.min(100, (actual / objective) * 100) : 0
  const isComplete = pct >= 100

  const displayActual = showPatients && consultationPrice
    ? formatPatients(actual, consultationPrice)
    : formatEuro(actual)

  const displayObjective = showPatients && consultationPrice
    ? formatPatients(objective, consultationPrice)
    : formatEuro(objective)

  return (
    <Card className={isComplete ? 'border-emerald-200 bg-emerald-50/50' : ''}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          </div>
          <Badge
            variant={isComplete ? 'default' : pct >= 75 ? 'secondary' : 'outline'}
            className={isComplete ? 'bg-emerald-600 text-white' : ''}
          >
            {pct.toFixed(0)} %
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{displayActual}</span>
            <span>sur {displayObjective}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface AnnualTimelineProps {
  data: ObjectivesData
  year: number
}

function AnnualProgressTimeline({ data, year }: AnnualTimelineProps) {
  const now = new Date()
  const startOfYear = new Date(year, 0, 1)
  const isLeap = (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0)
  const totalDays = isLeap ? 366 : 365

  // How far through the year we are (0–100)
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
  const datePct = Math.min(100, (dayOfYear / totalDays) * 100)

  const annualObj = data.settings.annual_revenue_objective!
  // How far toward the annual objective we are (0–100)
  const caPct = Math.min(100, (data.revenue.this_year / annualObj) * 100)

  const isAhead = caPct >= datePct
  const expectedRevenue = (datePct / 100) * annualObj
  const diff = data.revenue.this_year - expectedRevenue

  // Month tick positions (start of each month as % of year)
  const monthTicks = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(year, i, 1)
    const d = Math.floor((monthStart.getTime() - startOfYear.getTime()) / 86400000)
    return { month: i, pct: (d / totalDays) * 100 }
  })

  // Center of each month for labels
  const monthCenters = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(year, i, 1)
    const monthEnd = new Date(year, i + 1, 0)
    const startDay = Math.floor((monthStart.getTime() - startOfYear.getTime()) / 86400000)
    const endDay = Math.floor((monthEnd.getTime() - startOfYear.getTime()) / 86400000)
    return ((startDay + endDay + 1) / 2 / totalDays) * 100
  })

  const todayLabel = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Trajectoire annuelle {year}</CardTitle>
          <div
            className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
              isAhead ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isAhead ? '▲' : '▼'} {isAhead ? 'En avance' : 'En retard'} de {formatEuro(Math.abs(diff))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Timeline — extra top padding for the needle label */}
        <div className="relative" style={{ paddingTop: '2.75rem' }}>

          {/* Today needle label + triangle */}
          <div
            className="absolute z-20 flex flex-col items-center"
            style={{ left: `${datePct}%`, top: 0, transform: 'translateX(-50%)' }}
          >
            <div className="bg-foreground text-background text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mb-1">
              {todayLabel}
            </div>
            <div
              style={{
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '7px solid hsl(var(--foreground))',
              }}
            />
          </div>

          {/* Bar */}
          <div className="relative h-10 w-full rounded-full bg-muted overflow-hidden">

            {/* CA fill */}
            <div
              className={`absolute left-0 top-0 h-full transition-all duration-700 ${
                isAhead ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${caPct}%`, borderRadius: caPct >= 100 ? '9999px' : '9999px 0 0 9999px' }}
            />

            {/* Month separator ticks (skip Jan which is at 0) */}
            {monthTicks.slice(1).map(({ month, pct }) => (
              <div
                key={month}
                className="absolute top-0 bottom-0 w-px bg-background/40 z-10"
                style={{ left: `${pct}%` }}
              />
            ))}

            {/* Today vertical line through bar */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/70 z-20"
              style={{ left: `${datePct}%`, transform: 'translateX(-50%)' }}
            />

            {/* CA value label inside fill */}
            {caPct > 10 && (
              <div
                className="absolute top-1/2 text-xs font-bold text-white pointer-events-none z-10"
                style={{
                  left: `${Math.min(caPct - 1, 96)}%`,
                  transform: 'translateY(-50%) translateX(-100%)',
                  paddingRight: '6px',
                }}
              >
                {formatEuro(data.revenue.this_year)}
              </div>
            )}
          </div>

          {/* Month labels */}
          <div className="relative h-6 mt-1.5">
            {monthCenters.map((centerPct, i) => (
              <div
                key={i}
                className="absolute text-[11px] text-muted-foreground"
                style={{ left: `${centerPct}%`, transform: 'translateX(-50%)', top: 0 }}
              >
                {MONTHS_FR[i].slice(0, 3)}
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t text-sm">
          <div>
            <span className="text-muted-foreground">CA réel </span>
            <span className="font-semibold">{formatEuro(data.revenue.this_year)}</span>
            <span className="text-muted-foreground ml-1">({caPct.toFixed(1)} %)</span>
          </div>
          <div>
            <span className="text-muted-foreground">Attendu au {todayLabel} </span>
            <span className="font-semibold">{formatEuro(expectedRevenue)}</span>
            <span className="text-muted-foreground ml-1">({datePct.toFixed(1)} %)</span>
          </div>
          <div>
            <span className="text-muted-foreground">Objectif annuel </span>
            <span className="font-semibold">{formatEuro(annualObj)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface EditableManualEntryProps {
  month: number
  year: number
  actual: number
  manual: number
  onSaved: () => void
}

function EditableManualEntry({ month, year, actual, manual, onSaved }: EditableManualEntryProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(String(manual || ''))
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const amount = Number(value) || 0
      const res = await fetch('/api/objectives/manual-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, amount }),
      })
      if (!res.ok) throw new Error('Erreur')
      setIsEditing(false)
      onSaved()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setValue(String(manual || ''))
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          step="10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-28 text-xs"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-600" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <button
      className="group flex items-center gap-1 text-sm hover:text-primary"
      onClick={() => { setValue(String(manual || '')); setIsEditing(true) }}
    >
      <span>{manual > 0 ? formatEuro(manual) : <span className="text-muted-foreground italic">0 €</span>}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  )
}

export default function ObjectivesPage() {
  const [data, setData] = useState<ObjectivesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showPatients, setShowPatients] = useState(false)
  const { toast } = useToast()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/objectives')
      if (!res.ok) throw new Error('Erreur')
      const json = await res.json()
      setData(json)
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les objectifs' })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasObjective = data?.settings.annual_revenue_objective != null && data.settings.annual_revenue_objective > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Objectifs {currentYear}</h1>
          <p className="text-muted-foreground">Suivez votre progression vers votre chiffre d&apos;affaires annuel</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.settings.average_consultation_price && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPatients((v) => !v)}
              className="gap-2"
            >
              {showPatients ? <Euro className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {showPatients ? 'Afficher en €' : 'Afficher en patients'}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Paramétrer
            </Link>
          </Button>
        </div>
      </div>

      {/* No objective configured */}
      {!hasObjective && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Aucun objectif configuré</p>
              <p className="text-muted-foreground text-sm mt-1">
                Définissez votre objectif de chiffre d&apos;affaires annuel pour commencer à suivre votre progression.
              </p>
            </div>
            <Button asChild>
              <Link href="/settings?tab=objectives">
                <Target className="mr-2 h-4 w-4" />
                Configurer mes objectifs
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress bars */}
      {hasObjective && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ProgressBar
              label="Aujourd'hui"
              sublabel={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              actual={data.revenue.today}
              objective={data.computed.daily_objective}
              showPatients={showPatients}
              consultationPrice={data.settings.average_consultation_price}
            />
            <ProgressBar
              label="Cette semaine"
              sublabel={`Objectif hebdo : ${formatEuro(data.computed.weekly_objective)}`}
              actual={data.revenue.this_week}
              objective={data.computed.weekly_objective}
              showPatients={showPatients}
              consultationPrice={data.settings.average_consultation_price}
            />
            <ProgressBar
              label={`${MONTHS_FR[new Date().getMonth()]}`}
              sublabel={`Objectif mensuel : ${formatEuro(data.computed.monthly_objective)}`}
              actual={data.revenue.this_month}
              objective={data.computed.monthly_objective}
              showPatients={showPatients}
              consultationPrice={data.settings.average_consultation_price}
            />
            <ProgressBar
              label={`Année ${currentYear}`}
              sublabel={`Objectif annuel : ${formatEuro(data.settings.annual_revenue_objective!)}`}
              actual={data.revenue.this_year}
              objective={data.settings.annual_revenue_objective!}
              showPatients={showPatients}
              consultationPrice={data.settings.average_consultation_price}
            />
          </div>

          {/* Annual timeline bar */}
          <AnnualProgressTimeline data={data} year={currentYear} />

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{data.computed.working_weeks} semaines travaillées</Badge>
            <Badge variant="outline">{data.computed.working_days} jours travaillés</Badge>
            <Badge variant="outline">{data.settings.working_days_per_week} j/semaine</Badge>
            <Badge variant="outline">{data.settings.vacation_weeks_per_year} sem. de congés</Badge>
            {data.settings.average_consultation_price && (
              <Badge variant="outline">{formatEuro(data.settings.average_consultation_price)} / consultation</Badge>
            )}
          </div>

          {/* Monthly breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détail mensuel {currentYear}</CardTitle>
              <CardDescription>
                Cliquez sur la colonne &quot;Correction&quot; pour ajouter un CA réalisé avant l&apos;utilisation du logiciel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Mois</th>
                      <th className="text-right py-2 pr-4 font-medium">CA enregistré</th>
                      <th className="text-right py-2 pr-4 font-medium">
                        <span className="flex items-center justify-end gap-1">
                          Correction manuelle
                          <Pencil className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="text-right py-2 pr-4 font-medium">Total</th>
                      <th className="text-right py-2 font-medium">Objectif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenue.monthly_breakdown.map((row) => {
                      const isCurrentMonth = row.month === currentMonth
                      const isFuture = row.month > currentMonth
                      const pct = data.computed.monthly_objective > 0
                        ? Math.min(100, (row.total / data.computed.monthly_objective) * 100)
                        : 0
                      return (
                        <tr
                          key={row.month}
                          className={`border-b last:border-0 ${isCurrentMonth ? 'bg-primary/5' : ''} ${isFuture ? 'opacity-40' : ''}`}
                        >
                          <td className="py-2.5 pr-4 font-medium">
                            {MONTHS_FR[row.month - 1]}
                            {isCurrentMonth && <Badge variant="secondary" className="ml-2 text-[10px]">En cours</Badge>}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {row.actual > 0 ? formatEuro(row.actual) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            {!isFuture ? (
                              <EditableManualEntry
                                month={row.month}
                                year={currentYear}
                                actual={row.actual}
                                manual={row.manual}
                                onSaved={fetchData}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                            {row.total > 0 ? formatEuro(row.total) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isFuture && row.total > 0 && (
                                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                              <span className={`text-xs tabular-nums ${!isFuture && pct >= 100 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}`}>
                                {!isFuture ? `${pct.toFixed(0)} %` : '—'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold bg-muted/30">
                      <td className="py-3 pr-4">Total annuel</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatEuro(data.revenue.monthly_breakdown.reduce((s, r) => s + r.actual, 0))}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatEuro(data.revenue.monthly_breakdown.reduce((s, r) => s + r.manual, 0))}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatEuro(data.revenue.this_year)}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`text-sm ${data.revenue.this_year >= data.settings.annual_revenue_objective! ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {data.settings.annual_revenue_objective! > 0
                            ? `${Math.min(100, (data.revenue.this_year / data.settings.annual_revenue_objective!) * 100).toFixed(0)} %`
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
