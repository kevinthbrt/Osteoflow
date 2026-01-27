'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  PieChart,
  Activity,
  UserCheck,
  Clock,
  Target,
  Filter,
  RefreshCw,
  Download,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface PatientStats {
  total: number
  by_gender: { gender: string; count: number }[]
  by_age_group: { age_group: string; count: number }[]
}

interface ConsultationStats {
  total: number
  unique_patients: number
  avg_per_patient: number
  by_month: { year: number; month: number; count: number }[]
  by_reason: { reason: string; count: number }[]
  by_day_of_week: { day: number; count: number }[]
  by_year: { year: number; consultations: number; patients: number }[]
}

interface RevenueStats {
  total: number
  count: number
  average: number
  by_month: { year: number; month: number; total: number; count: number }[]
  by_payment_method: { method: string; total: number }[]
}

const ageGroups = [
  { value: '0-17', label: '0-17 ans' },
  { value: '18-29', label: '18-29 ans' },
  { value: '30-44', label: '30-44 ans' },
  { value: '45-59', label: '45-59 ans' },
  { value: '60-74', label: '60-74 ans' },
  { value: '75+', label: '75+ ans' },
]

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const paymentMethodLabels: Record<string, string> = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
  transfer: 'Virement',
  other: 'Autre',
}

export default function StatisticsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [patientStats, setPatientStats] = useState<PatientStats | null>(null)
  const [consultationStats, setConsultationStats] = useState<ConsultationStats | null>(null)
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null)

  // Filters
  const currentYear = new Date().getFullYear()
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`)
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [genderFilter, setGenderFilter] = useState<string>('all')
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>('all')

  const { toast } = useToast()
  const supabase = createClient()

  const fetchStats = useCallback(async () => {
    setIsLoading(true)

    try {
      const gender = genderFilter === 'all' ? null : genderFilter
      const ageGroup = ageGroupFilter === 'all' ? null : ageGroupFilter

      // Try to use RPC functions first
      const [patientRes, consultationRes, revenueRes] = await Promise.all([
        supabase.rpc('get_patient_statistics', {
          p_start_date: startDate,
          p_end_date: endDate,
          p_gender: gender,
        }),
        supabase.rpc('get_consultation_statistics', {
          p_start_date: startDate,
          p_end_date: endDate,
          p_gender: gender,
          p_age_group: ageGroup,
        }),
        supabase.rpc('get_revenue_statistics', {
          p_start_date: startDate,
          p_end_date: endDate,
        }),
      ])

      if (patientRes.error) {
        console.log('RPC not available, falling back to direct queries')
        // Fallback to direct queries
        await fetchStatsDirect()
        return
      }

      setPatientStats(patientRes.data)
      setConsultationStats(consultationRes.data)
      setRevenueStats(revenueRes.data)
    } catch (error) {
      console.error('Error fetching stats via RPC:', error)
      // Fallback to direct queries
      await fetchStatsDirect()
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate, genderFilter, ageGroupFilter, supabase])

  // Fallback: Direct queries when RPC functions are not available
  const fetchStatsDirect = async () => {
    try {
      const gender = genderFilter === 'all' ? null : genderFilter

      // Fetch patients
      let patientsQuery = supabase
        .from('patients')
        .select('id, gender, birth_date, created_at')
        .is('archived_at', null)

      if (gender) {
        patientsQuery = patientsQuery.eq('gender', gender)
      }

      const { data: patients } = await patientsQuery

      // Fetch consultations
      const { data: consultations } = await supabase
        .from('consultations')
        .select(`
          id,
          date_time,
          reason,
          patient_id,
          invoices (amount, status, paid_at, payments (method, amount))
        `)
        .gte('date_time', `${startDate}T00:00:00`)
        .lte('date_time', `${endDate}T23:59:59`)
        .is('archived_at', null)

      // Process patient stats
      if (patients) {
        const byGender = [
          { gender: 'M', count: patients.filter(p => p.gender === 'M').length },
          { gender: 'F', count: patients.filter(p => p.gender === 'F').length },
        ]

        const getAgeGroup = (birthDate: string) => {
          const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          if (age < 18) return '0-17'
          if (age < 30) return '18-29'
          if (age < 45) return '30-44'
          if (age < 60) return '45-59'
          if (age < 75) return '60-74'
          return '75+'
        }

        const ageGroupCounts: Record<string, number> = {}
        patients.forEach(p => {
          if (p.birth_date) {
            const group = getAgeGroup(p.birth_date)
            ageGroupCounts[group] = (ageGroupCounts[group] || 0) + 1
          }
        })

        setPatientStats({
          total: patients.length,
          by_gender: byGender,
          by_age_group: Object.entries(ageGroupCounts).map(([age_group, count]) => ({ age_group, count })),
        })
      }

      // Process consultation stats
      if (consultations) {
        const byMonth: Record<string, { year: number; month: number; count: number }> = {}
        const reasonsMap: Record<string, number> = {}
        const dayMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
        const yearMap: Record<number, { consultations: number; patients: Set<string> }> = {}
        const patientIds = new Set<string>()

        // Revenue tracking
        let totalRevenue = 0
        const monthlyRevenue: Record<string, { year: number; month: number; total: number; count: number }> = {}
        const paymentMethods: Record<string, number> = {}

        consultations.forEach(c => {
          const date = new Date(c.date_time)
          const year = date.getFullYear()
          const month = date.getMonth() + 1
          const day = date.getDay()
          const key = `${year}-${month}`

          // Monthly count
          if (!byMonth[key]) byMonth[key] = { year, month, count: 0 }
          byMonth[key].count++

          // Day of week
          dayMap[day]++

          // Patient tracking
          patientIds.add(c.patient_id)

          // Yearly
          if (!yearMap[year]) yearMap[year] = { consultations: 0, patients: new Set() }
          yearMap[year].consultations++
          yearMap[year].patients.add(c.patient_id)

          // Reason
          const reason = normalizeReason(c.reason || 'Non spécifié')
          reasonsMap[reason] = (reasonsMap[reason] || 0) + 1

          // Revenue
          const invoices = c.invoices as Array<{ amount: number; status: string; paid_at: string; payments: Array<{ method: string; amount: number }> }> | null
          if (invoices) {
            invoices.forEach(inv => {
              if (inv.status === 'paid' && inv.paid_at) {
                const paidDate = new Date(inv.paid_at)
                const paidYear = paidDate.getFullYear()
                const paidMonth = paidDate.getMonth() + 1
                const revenueKey = `${paidYear}-${paidMonth}`

                totalRevenue += inv.amount
                if (!monthlyRevenue[revenueKey]) {
                  monthlyRevenue[revenueKey] = { year: paidYear, month: paidMonth, total: 0, count: 0 }
                }
                monthlyRevenue[revenueKey].total += inv.amount
                monthlyRevenue[revenueKey].count++

                inv.payments?.forEach(p => {
                  paymentMethods[p.method] = (paymentMethods[p.method] || 0) + p.amount
                })
              }
            })
          }
        })

        setConsultationStats({
          total: consultations.length,
          unique_patients: patientIds.size,
          avg_per_patient: patientIds.size > 0 ? Number((consultations.length / patientIds.size).toFixed(2)) : 0,
          by_month: Object.values(byMonth).sort((a, b) => a.year - b.year || a.month - b.month),
          by_reason: Object.entries(reasonsMap)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15),
          by_day_of_week: Object.entries(dayMap).map(([day, count]) => ({ day: Number(day), count })),
          by_year: Object.entries(yearMap)
            .map(([year, data]) => ({
              year: Number(year),
              consultations: data.consultations,
              patients: data.patients.size,
            }))
            .sort((a, b) => a.year - b.year),
        })

        const invoiceCount = Object.values(monthlyRevenue).reduce((sum, m) => sum + m.count, 0)
        setRevenueStats({
          total: totalRevenue,
          count: invoiceCount,
          average: invoiceCount > 0 ? Number((totalRevenue / invoiceCount).toFixed(2)) : 0,
          by_month: Object.values(monthlyRevenue).sort((a, b) => a.year - b.year || a.month - b.month),
          by_payment_method: Object.entries(paymentMethods).map(([method, total]) => ({ method, total })),
        })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les statistiques',
      })
    }
  }

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const resetFilters = () => {
    setStartDate(`${currentYear}-01-01`)
    setEndDate(new Date().toISOString().split('T')[0])
    setGenderFilter('all')
    setAgeGroupFilter('all')
  }

  const exportCSV = () => {
    if (!consultationStats) return

    const rows = [
      ['Statistiques Osteoflow'],
      [`Période: ${startDate} - ${endDate}`],
      [],
      ['PATIENTS'],
      ['Genre', 'Nombre'],
      ...(patientStats?.by_gender.map(g => [g.gender === 'M' ? 'Hommes' : 'Femmes', g.count.toString()]) || []),
      [],
      ['Tranche d\'âge', 'Nombre'],
      ...(patientStats?.by_age_group.map(a => [a.age_group, a.count.toString()]) || []),
      [],
      ['CONSULTATIONS'],
      ['Total', consultationStats.total.toString()],
      ['Patients uniques', consultationStats.unique_patients.toString()],
      ['Moyenne par patient', consultationStats.avg_per_patient.toString()],
      [],
      ['Motif', 'Nombre'],
      ...consultationStats.by_reason.map(r => [r.reason, r.count.toString()]),
    ]

    const csv = rows.map(row => row.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `statistiques_${startDate}_${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Statistiques
          </h1>
          <p className="text-muted-foreground">
            Analysez votre activité en détail
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchStats()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="start_date">Date début</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Date fin</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="M">Hommes</SelectItem>
                  <SelectItem value="F">Femmes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tranche d'âge</Label>
              <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {ageGroups.map(ag => (
                    <SelectItem key={ag.value} value={ag.value}>{ag.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={resetFilters} className="w-full">
                Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Patients"
              value={patientStats?.total || 0}
              subtitle={`${patientStats?.by_gender.find(g => g.gender === 'M')?.count || 0}H / ${patientStats?.by_gender.find(g => g.gender === 'F')?.count || 0}F`}
              icon={Users}
              color="blue"
            />
            <MetricCard
              title="Consultations"
              value={consultationStats?.total || 0}
              subtitle={`${consultationStats?.unique_patients || 0} patients uniques`}
              icon={Calendar}
              color="green"
            />
            <MetricCard
              title="Chiffre d'affaires"
              value={formatCurrency(revenueStats?.total || 0)}
              subtitle={`${revenueStats?.count || 0} factures`}
              icon={TrendingUp}
              color="purple"
              isText
            />
            <MetricCard
              title="Moyenne / consultation"
              value={formatCurrency(revenueStats?.average || 0)}
              subtitle={`${consultationStats?.avg_per_patient || 0} consultations/patient`}
              icon={Target}
              color="orange"
              isText
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="patients" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="patients" className="gap-2">
                <Users className="h-4 w-4" />
                Patients
              </TabsTrigger>
              <TabsTrigger value="consultations" className="gap-2">
                <Activity className="h-4 w-4" />
                Consultations
              </TabsTrigger>
              <TabsTrigger value="revenue" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Revenus
              </TabsTrigger>
            </TabsList>

            {/* Patients Tab */}
            <TabsContent value="patients" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Gender distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-primary" />
                      Répartition par genre
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {patientStats?.by_gender.map(({ gender, count }) => {
                        const total = patientStats.total || 1
                        const label = gender === 'M' ? 'Hommes' : 'Femmes'
                        const color = gender === 'M' ? 'bg-blue-500' : 'bg-pink-500'
                        return (
                          <div key={gender} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{label}</span>
                              <span className="font-medium">
                                {count} ({Math.round((count / total) * 100)}%)
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${color}`}
                                style={{ width: `${(count / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                      {(!patientStats?.by_gender || patientStats.by_gender.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Age distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-primary" />
                      Répartition par âge
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {ageGroups.map(({ value, label }) => {
                        const stat = patientStats?.by_age_group.find(a => a.age_group === value)
                        const count = stat?.count || 0
                        const total = patientStats?.total || 1
                        return (
                          <div key={value} className="flex items-center gap-3">
                            <div className="w-20 text-sm text-muted-foreground">{label}</div>
                            <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded flex items-center justify-end pr-2 text-xs font-medium text-primary-foreground"
                                style={{
                                  width: `${Math.max((count / total) * 100, count > 0 ? 15 : 0)}%`,
                                  minWidth: count > 0 ? '2rem' : '0'
                                }}
                              >
                                {count > 0 && count}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Consultations Tab */}
            <TabsContent value="consultations" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Monthly evolution */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Évolution mensuelle
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end gap-1">
                      {consultationStats?.by_month && consultationStats.by_month.length > 0 ? (
                        consultationStats.by_month.map(({ year, month, count }) => {
                          const maxCount = Math.max(...consultationStats.by_month.map(m => m.count), 1)
                          const height = (count / maxCount) * 100
                          return (
                            <div key={`${year}-${month}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                              <span className="text-xs font-medium">{count}</span>
                              <div
                                className="w-full bg-gradient-to-t from-primary to-primary/70 rounded-t transition-all hover:opacity-80"
                                style={{ height: `${Math.max(height, 4)}%` }}
                              />
                              <span className="text-[10px] text-muted-foreground truncate">
                                {monthNames[month - 1]} {year.toString().slice(2)}
                              </span>
                            </div>
                          )
                        })
                      ) : (
                        <p className="w-full text-center text-muted-foreground py-8">Aucune donnée</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* By reason */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Top motifs de consultation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {consultationStats?.by_reason.map(({ reason, count }, index) => (
                        <div key={reason} className="flex items-center gap-3">
                          <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0 shrink-0">
                            {index + 1}
                          </Badge>
                          <span className="flex-1 text-sm truncate">{reason}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                      {(!consultationStats?.by_reason || consultationStats.by_reason.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* By day of week */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Consultations par jour
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5, 6, 0].map(dayNum => {
                        const stat = consultationStats?.by_day_of_week.find(d => d.day === dayNum)
                        const count = stat?.count || 0
                        const maxCount = Math.max(...(consultationStats?.by_day_of_week.map(d => d.count) || [1]), 1)
                        return (
                          <div key={dayNum} className="flex items-center gap-3">
                            <div className="w-12 text-sm text-muted-foreground">{dayNames[dayNum]}</div>
                            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                              <div
                                className="h-full bg-primary/80 rounded"
                                style={{ width: `${(count / maxCount) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8 text-right">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Yearly comparison */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Comparaison annuelle
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Année</th>
                            <th className="text-right py-2 font-medium">Consultations</th>
                            <th className="text-right py-2 font-medium">Patients</th>
                            <th className="text-right py-2 font-medium">Moy/patient</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consultationStats?.by_year.map(({ year, consultations, patients }) => (
                            <tr key={year} className="border-b last:border-0">
                              <td className="py-2 font-medium">{year}</td>
                              <td className="text-right py-2">{consultations}</td>
                              <td className="text-right py-2">{patients}</td>
                              <td className="text-right py-2">
                                {patients > 0 ? (consultations / patients).toFixed(1) : '-'}
                              </td>
                            </tr>
                          ))}
                          {(!consultationStats?.by_year || consultationStats.by_year.length === 0) && (
                            <tr>
                              <td colSpan={4} className="text-center py-4 text-muted-foreground">
                                Aucune donnée
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Monthly revenue */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Chiffre d'affaires mensuel
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end gap-1">
                      {revenueStats?.by_month && revenueStats.by_month.length > 0 ? (
                        revenueStats.by_month.map(({ year, month, total }) => {
                          const maxTotal = Math.max(...revenueStats.by_month.map(m => m.total), 1)
                          const height = (total / maxTotal) * 100
                          return (
                            <div key={`${year}-${month}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                              <span className="text-xs font-medium">
                                {total > 0 ? `${Math.round(total)}€` : '-'}
                              </span>
                              <div
                                className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all hover:opacity-80"
                                style={{ height: `${Math.max(height, total > 0 ? 4 : 0)}%` }}
                              />
                              <span className="text-[10px] text-muted-foreground truncate">
                                {monthNames[month - 1]} {year.toString().slice(2)}
                              </span>
                            </div>
                          )
                        })
                      ) : (
                        <p className="w-full text-center text-muted-foreground py-8">Aucune donnée</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* By payment method */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-primary" />
                      Par mode de paiement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {revenueStats?.by_payment_method.map(({ method, total }) => {
                        const percentage = revenueStats.total > 0 ? (total / revenueStats.total) * 100 : 0
                        return (
                          <div key={method} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{paymentMethodLabels[method] || method}</span>
                              <span className="font-medium">
                                {formatCurrency(total)} ({Math.round(percentage)}%)
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                      {(!revenueStats?.by_payment_method || revenueStats.by_payment_method.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Résumé période
                    </CardTitle>
                    <CardDescription>
                      {startDate} au {endDate}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">CA total</span>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(revenueStats?.total || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Consultations</span>
                        <span className="text-lg font-bold">
                          {consultationStats?.total || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Patients uniques</span>
                        <span className="text-lg font-bold">
                          {consultationStats?.unique_patients || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Facture moyenne</span>
                        <span className="text-lg font-bold">
                          {formatCurrency(revenueStats?.average || 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

// Helper components
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  isText = false,
}: {
  title: string
  value: number | string
  subtitle: string
  icon: React.ElementType
  color: 'blue' | 'green' | 'purple' | 'orange'
  isText?: boolean
}) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    purple: 'bg-purple-500/10 text-purple-600',
    orange: 'bg-orange-500/10 text-orange-600',
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {isText ? value : typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function normalizeReason(reason: string): string {
  const normalized = reason.toLowerCase().trim()

  const mappings: Record<string, string> = {
    'lombalgie': 'Lombalgie',
    'mal de dos': 'Lombalgie',
    'douleur lombaire': 'Lombalgie',
    'cervicalgie': 'Cervicalgie',
    'douleur cervicale': 'Cervicalgie',
    'torticolis': 'Cervicalgie',
    'céphalée': 'Céphalées',
    'céphalées': 'Céphalées',
    'migraine': 'Céphalées',
    'maux de tête': 'Céphalées',
    'sciatique': 'Sciatique',
    'douleur sciatique': 'Sciatique',
    'suivi': 'Suivi',
    'contrôle': 'Suivi',
    'bilan': 'Bilan',
    'première consultation': 'Bilan',
    'entorse': 'Entorse',
    'dorsalgie': 'Dorsalgie',
  }

  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key)) {
      return value
    }
  }

  return reason.charAt(0).toUpperCase() + reason.slice(1).toLowerCase()
}
