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
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
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

export default function AccountingPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
  const [summary, setSummary] = useState<AccountingSummary | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [isSendingReport, setIsSendingReport] = useState(false)
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

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
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

    const blob = new Blob(['\ufeff' + csvContent], {
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
            cell.z = '#,##0.00 €'
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Période</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Date début</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPeriod('custom')
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Date fin</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPeriod('custom')
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Chiffre d&apos;affaires</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Période du {formatDate(startDate)} au {formatDate(endDate)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Consultations</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalConsultations}</div>
              <p className="text-xs text-muted-foreground">
                Consultations facturées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Panier moyen</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.averageAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                Par consultation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Par mode de paiement</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(summary.revenueByMethod).map(([method, amount]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {paymentMethodLabels[method]}
                    </span>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                ))}
                {Object.keys(summary.revenueByMethod).length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune donnée</p>
                )}
              </div>
            </CardContent>
          </Card>
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
            <div className="rounded-md border">
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
