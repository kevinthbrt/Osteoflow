'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/db/client'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart3,
  Download,
  TrendingUp,
  Users,
  FileText,
  CreditCard,
  Banknote,
  Loader2,
  Mail,
  Pencil,
  ChevronDown,
  Check,
  X,
  Wallet,
  Coins,
  Receipt,
  ArrowLeftRight,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { getCurrencySymbol } from '@/lib/utils/currency'
import { paymentMethodLabels } from '@/lib/validations/invoice'
import type { Invoice, Payment, Patient, Consultation } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface InvoiceWithDetails extends Invoice {
  consultation: Consultation & { patient: Patient }
  payments: Payment[]
}

interface AccountingSummary {
  totalRevenue: number
  totalConsultations: number
  averageAmount: number
  revenueByMethod: Record<string, number>
}

const monthNamesShort = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

// Libellés & icônes par mode de paiement (code couleur cohérent dans toute la page)
const methodStyles: Record<string, { label: string; icon: typeof CreditCard }> = {
  card:     { label: 'CB',       icon: CreditCard },
  cash:     { label: 'Espèces',  icon: Coins },
  check:    { label: 'Chèque',   icon: Receipt },
  transfer: { label: 'Virement', icon: ArrowLeftRight },
  other:    { label: 'Autre',    icon: Wallet },
}

function CompactMonthEditor({
  year,
  month,
  value,
  onSaved,
}: {
  year: number
  month: number
  value: number
  onSaved: (key: string, value: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value.toString())
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    const amount = parseFloat(draft)
    if (isNaN(amount)) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Montant invalide' })
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/objectives/manual-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, amount }),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
      onSaved(`${year}-${month}`, amount)
      setEditing(false)
      toast({ variant: 'success', title: 'Enregistré', description: `${monthNamesShort[month - 1]} ${year} mis à jour` })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder' })
    } finally {
      setIsSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-primary/40 bg-primary/5 px-2.5 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">{monthNamesShort[month - 1]} {year}</span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="0.01"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 w-full text-xs"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-600" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setDraft(value.toString()); setEditing(false) }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(value.toString()); setEditing(true) }}
      className={`group flex flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 ${
        value !== 0 ? 'border-border bg-muted/30' : 'border-dashed border-border'
      }`}
    >
      <span className="text-[11px] font-medium text-muted-foreground">{monthNamesShort[month - 1]} {year}</span>
      <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
        {value !== 0 ? formatCurrency(value) : <span className="text-muted-foreground/60 font-normal">—</span>}
        <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
      </span>
    </button>
  )
}

export default function AccountingPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
  const [summary, setSummary] = useState<AccountingSummary | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [isSendingReport, setIsSendingReport] = useState(false)
  const [manualEntries, setManualEntries] = useState<Record<string, number>>({})
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [showManualCorrections, setShowManualCorrections] = useState(false)
  const { toast } = useToast()
  const db = createClient()

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1) // First day of current month
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const date = new Date()
    return date.toISOString().split('T')[0]
  })
  const [period, setPeriod] = useState<string>('month')
  const [paymentMethod, setPaymentMethod] = useState<string>('all')
  const [sendStartDate, setSendStartDate] = useState<string>('')
  const [sendEndDate, setSendEndDate] = useState<string>('')

  // Set dates based on period
  useEffect(() => {
    const toLocalStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const today = new Date()
    let start = new Date()

    switch (period) {
      case 'day':
        start = today
        break
      case 'week':
        start.setDate(today.getDate() - 7)
        break
      case 'month':
        start.setDate(1)
        break
      case 'year':
        start = new Date(today.getFullYear(), 0, 1)
        break
      case 'custom':
        return // Don't change dates for custom
    }

    setStartDate(toLocalStr(start))
    setEndDate(toLocalStr(today))
  }, [period])

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)

      try {
        let query = db
          .from('invoices')
          .select(`
            *,
            consultation:consultations (
              *,
              patient:patients (id, first_name, last_name)
            ),
            payments (*)
          `)
          .eq('status', 'paid')
          .gte('paid_at', `${startDate}T00:00:00`)
          .lte('paid_at', `${endDate}T23:59:59`)
          .order('paid_at', { ascending: false })

        const { data, error } = await query

        if (error) throw error

        let filteredInvoices = data as InvoiceWithDetails[]

        // Filter by payment method
        if (paymentMethod !== 'all') {
          filteredInvoices = filteredInvoices.filter((inv) =>
            inv.payments.some((p) => p.method === paymentMethod)
          )
        }

        setInvoices(filteredInvoices)

        // Calculate summary
        const totalRevenue = filteredInvoices.reduce(
          (sum, inv) => sum + inv.amount,
          0
        )
        const totalConsultations = filteredInvoices.length

        const revenueByMethod: Record<string, number> = {}
        for (const inv of filteredInvoices) {
          for (const payment of inv.payments) {
            revenueByMethod[payment.method] =
              (revenueByMethod[payment.method] || 0) + payment.amount
          }
        }

        setSummary({
          totalRevenue,
          totalConsultations,
          averageAmount:
            totalConsultations > 0 ? totalRevenue / totalConsultations : 0,
          revenueByMethod,
        })

        // Fetch manual revenue entries for the period
        try {
          const { data: practUser } = await db.auth.getUser()
          if (practUser.user) {
            const { data: practRow } = await db
              .from('practitioners')
              .select('id')
              .eq('user_id', practUser.user.id)
              .single()
            if (practRow) {
              setPractitionerId(practRow.id)
              const start = new Date(startDate)
              const end = new Date(endDate)
              const newManual: Record<string, number> = {}
              for (
                let d = new Date(start.getFullYear(), start.getMonth(), 1);
                d <= end;
                d.setMonth(d.getMonth() + 1)
              ) {
                const yr = d.getFullYear()
                const mo = d.getMonth() + 1
                const key = `${yr}-${mo}`
                const { data: mrows } = await db
                  .from('manual_revenue_entries')
                  .select('amount')
                  .eq('practitioner_id', practRow.id)
                  .eq('year', yr)
                  .eq('month', mo)
                  .single()
                if (mrows) newManual[key] = mrows.amount
              }
              setManualEntries(newManual)
            }
          }
        } catch {
          // non-blocking
        }
      } catch (error) {
        console.error('Error fetching accounting data:', error)
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de charger les données',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, paymentMethod, db, toast])

  // Group invoices by date for daily recap
  const getDailyRecaps = () => {
    const recaps: Record<string, {
      date: string
      count: number
      total: number
      byMethod: Record<string, { count: number; amount: number }>
    }> = {}

    for (const inv of invoices) {
      const date = inv.paid_at ? formatDate(inv.paid_at) : formatDate(inv.issued_at || '')

      if (!recaps[date]) {
        recaps[date] = { date, count: 0, total: 0, byMethod: {} }
      }

      recaps[date].count++
      recaps[date].total += inv.amount

      for (const payment of inv.payments) {
        if (!recaps[date].byMethod[payment.method]) {
          recaps[date].byMethod[payment.method] = { count: 0, amount: 0 }
        }
        recaps[date].byMethod[payment.method].count++
        recaps[date].byMethod[payment.method].amount += payment.amount
      }
    }

    return Object.values(recaps).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  // Export to CSV - Anonymized daily recap
  const handleExportCSV = () => {
    const dailyRecaps = getDailyRecaps()

    const headers = [
      'Date',
      'Nombre de consultations',
      'Chiffre d\'affaires',
      'CB',
      'Espèces',
      'Chèque',
      'Virement',
      'Autre',
    ]

    const rows = dailyRecaps.map((recap) => [
      recap.date,
      recap.count.toString(),
      recap.total.toFixed(2),
      (recap.byMethod['card']?.amount || 0).toFixed(2),
      (recap.byMethod['cash']?.amount || 0).toFixed(2),
      (recap.byMethod['check']?.amount || 0).toFixed(2),
      (recap.byMethod['transfer']?.amount || 0).toFixed(2),
      (recap.byMethod['other']?.amount || 0).toFixed(2),
    ])

    // Add total row
    const totalRow = [
      'TOTAL',
      summary?.totalConsultations.toString() || '0',
      summary?.totalRevenue.toFixed(2) || '0.00',
      (summary?.revenueByMethod['card'] || 0).toFixed(2),
      (summary?.revenueByMethod['cash'] || 0).toFixed(2),
      (summary?.revenueByMethod['check'] || 0).toFixed(2),
      (summary?.revenueByMethod['transfer'] || 0).toFixed(2),
      (summary?.revenueByMethod['other'] || 0).toFixed(2),
    ]

    const csvContent = [
      `Récapitulatif comptable du ${formatDate(startDate)} au ${formatDate(endDate)}`,
      '',
      headers.join(';'),
      ...rows.map((row) => row.join(';')),
      '',
      totalRow.join(';'),
    ].join('\n')

    const blob = new Blob(['﻿' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `recap_comptable_${startDate}_${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Export to XLSX - Anonymized daily recap
  const handleExportXLSX = async () => {
    setIsExporting(true)

    try {
      const XLSX = await import('xlsx')
      const dailyRecaps = getDailyRecaps()

      // Daily recap sheet
      const recapData = dailyRecaps.map((recap) => ({
        'Date': recap.date,
        'Consultations': recap.count,
        'Chiffre d\'affaires': recap.total,
        'CB': recap.byMethod['card']?.amount || 0,
        'Espèces': recap.byMethod['cash']?.amount || 0,
        'Chèque': recap.byMethod['check']?.amount || 0,
        'Virement': recap.byMethod['transfer']?.amount || 0,
        'Autre': recap.byMethod['other']?.amount || 0,
      }))

      // Add total row
      recapData.push({
        'Date': 'TOTAL',
        'Consultations': summary?.totalConsultations || 0,
        'Chiffre d\'affaires': summary?.totalRevenue || 0,
        'CB': summary?.revenueByMethod['card'] || 0,
        'Espèces': summary?.revenueByMethod['cash'] || 0,
        'Chèque': summary?.revenueByMethod['check'] || 0,
        'Virement': summary?.revenueByMethod['transfer'] || 0,
        'Autre': summary?.revenueByMethod['other'] || 0,
      })

      const ws = XLSX.utils.json_to_sheet(recapData)

      // Format currency columns
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = 2; C <= 7; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
          if (cell) {
            cell.z = `#,##0.00 ${getCurrencySymbol()}`
          }
        }
      }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Récapitulatif quotidien')

      XLSX.writeFile(wb, `recap_comptable_${startDate}_${endDate}.xlsx`)

      toast({
        variant: 'success',
        title: 'Export réussi',
        description: 'Le récapitulatif comptable a été téléchargé',
      })
    } catch (error) {
      console.error('Error exporting XLSX:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'exporter le fichier Excel",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleOpenSendDialog = () => {
    setSendStartDate(startDate)
    setSendEndDate(endDate)
    setShowSendDialog(true)
  }

  const handleSendReport = async () => {
    if (!sendStartDate || !sendEndDate) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner une période valide',
      })
      return
    }

    setIsSendingReport(true)
    try {
      const response = await fetch('/api/accounting/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: sendStartDate,
          endDate: sendEndDate,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Erreur lors de l\'envoi')
      }

      toast({
        variant: 'success',
        title: 'Envoi effectué',
        description: 'Le récapitulatif a été envoyé à la comptable',
      })

      setShowSendDialog(false)
    } catch (error) {
      console.error('Error sending accounting report:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'envoyer le rapport',
      })
    } finally {
      setIsSendingReport(false)
    }
  }

  const totalManual = Object.values(manualEntries).reduce((s, v) => s + v, 0)
  const grandTotal = (summary?.totalRevenue || 0) + totalManual

  // Build list of months in current date range for corrections UI
  const monthsInRange: { year: number; month: number }[] = []
  if (period !== 'day' && period !== 'week') {
    const s = new Date(startDate)
    const e = new Date(endDate)
    for (
      let d = new Date(s.getFullYear(), s.getMonth(), 1);
      d <= e;
      d.setMonth(d.getMonth() + 1)
    ) {
      monthsInRange.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    }
  }

  // Max method amount for proportional bars in hero
  const methodEntries = summary ? Object.entries(summary.revenueByMethod).sort((a, b) => b[1] - a[1]) : []
  const maxMethod = methodEntries.length ? Math.max(...methodEntries.map(([, v]) => v)) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comptabilité</h1>
          <p className="text-muted-foreground">
            Analysez votre chiffre d&apos;affaires et exportez vos données
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenSendDialog}>
            <Mail className="mr-2 h-4 w-4" />
            Envoi direct comptable
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button onClick={handleExportXLSX} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Excel
          </Button>
        </div>
      </div>

      {/* Compact filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl glass-card p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Période</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Aujourd&apos;hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date début</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPeriod('custom') }}
            className="h-9 w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date fin</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPeriod('custom') }}
            className="h-9 w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mode de paiement</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {period !== 'day' && period !== 'week' && monthsInRange.length > 0 && practitionerId && (
          <div className="space-y-1.5">
            <Label className="text-xs opacity-0">Corrections</Label>
            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() => setShowManualCorrections(!showManualCorrections)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Corrections
              {totalManual > 0 && (
                <Badge variant="secondary" className="ml-0.5 text-xs">{formatCurrency(totalManual)}</Badge>
              )}
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showManualCorrections ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        )}
      </div>

      {/* Corrections manuelles — panneau dépliable sous la barre de filtres */}
      {showManualCorrections && period !== 'day' && period !== 'week' && monthsInRange.length > 0 && practitionerId && (
        <div className="rounded-2xl glass-card px-4 py-4">
          <p className="text-xs text-muted-foreground mb-3">
            S&apos;ajoutent au CA facturé (ex. : CA réalisé avant l&apos;utilisation du logiciel). Cliquez sur un mois pour l&apos;éditer.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {monthsInRange.map(({ year, month }) => (
              <CompactMonthEditor
                key={`${year}-${month}`}
                year={year}
                month={month}
                value={manualEntries[`${year}-${month}`] ?? 0}
                onSaved={(key, value) => setManualEntries((prev) => ({ ...prev, [key]: value }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hero gradient card: CA + KPIs + ventilation paiements */}
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : summary ? (
        <div className="relative overflow-hidden rounded-2xl gradient-primary text-white p-6 shadow-lg">
          <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-black/10 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            {/* Left: big CA + mini KPIs */}
            <div>
              <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
                <TrendingUp className="h-3.5 w-3.5" />
                Chiffre d&apos;affaires · {formatDate(startDate)} → {formatDate(endDate)}
              </div>
              <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums leading-none">
                {formatCurrency(grandTotal)}
              </p>
              {totalManual > 0 && (
                <p className="mt-1.5 text-xs text-white/75">
                  CA facturé {formatCurrency(summary.totalRevenue)} + corrections {formatCurrency(totalManual)}
                </p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-3">
                  <div className="flex items-center gap-1.5 text-white/75 text-[11px] font-medium">
                    <Users className="h-3.5 w-3.5" /> Consultations
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{summary.totalConsultations}</p>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-3">
                  <div className="flex items-center gap-1.5 text-white/75 text-[11px] font-medium">
                    <BarChart3 className="h-3.5 w-3.5" /> Panier moyen
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(summary.averageAmount)}</p>
                </div>
              </div>
            </div>

            {/* Right: ventilation par mode de paiement */}
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium mb-3">
                <CreditCard className="h-3.5 w-3.5" /> Répartition par mode de paiement
              </div>
              {methodEntries.length === 0 ? (
                <p className="text-sm text-white/70">Aucune donnée sur la période</p>
              ) : (
                <div className="space-y-2.5">
                  {methodEntries.map(([method, amount]) => {
                    const style = methodStyles[method]
                    const pct = grandTotal > 0 ? (amount / (summary.totalRevenue || 1)) * 100 : 0
                    const barPct = maxMethod > 0 ? (amount / maxMethod) * 100 : 0
                    return (
                      <div key={method}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-1.5 text-white/90">
                            {style?.icon && <style.icon className="h-3.5 w-3.5" />}
                            {style?.label ?? paymentMethodLabels[method]}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatCurrency(amount)}
                            <span className="ml-1.5 text-[11px] font-normal text-white/60">{pct.toFixed(0)} %</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                          <div className="h-full rounded-full bg-white/80 transition-all duration-700" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Daily Recap Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Récapitulatif quotidien
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-10">
              <Banknote className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aucune facture payée sur cette période
              </p>
            </div>
          ) : (
            <div className="rounded-2xl glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Consultations</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">CB</TableHead>
                    <TableHead className="text-right">Espèces</TableHead>
                    <TableHead className="text-right">Chèque</TableHead>
                    <TableHead className="text-right">Virement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getDailyRecaps().map((recap) => (
                    <TableRow key={recap.date}>
                      <TableCell className="font-medium">
                        {recap.date}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{recap.count}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(recap.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {recap.byMethod['card']
                          ? formatCurrency(recap.byMethod['card'].amount)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {recap.byMethod['cash']
                          ? formatCurrency(recap.byMethod['cash'].amount)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {recap.byMethod['check']
                          ? formatCurrency(recap.byMethod['check'].amount)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {recap.byMethod['transfer']
                          ? formatCurrency(recap.byMethod['transfer'].amount)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-center">
                      <Badge>{summary?.totalConsultations || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-primary">
                      {formatCurrency(summary?.totalRevenue || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(summary?.revenueByMethod['card'] || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(summary?.revenueByMethod['cash'] || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(summary?.revenueByMethod['check'] || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(summary?.revenueByMethod['transfer'] || 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Report Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer le récapitulatif comptable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date début</Label>
              <Input
                type="date"
                value={sendStartDate}
                onChange={(e) => setSendStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date fin</Label>
              <Input
                type="date"
                value={sendEndDate}
                onChange={(e) => setSendEndDate(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Le PDF sera envoyé à l&apos;adresse comptable configurée dans les paramètres.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSendReport} disabled={isSendingReport}>
              {isSendingReport ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                'Envoyer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
