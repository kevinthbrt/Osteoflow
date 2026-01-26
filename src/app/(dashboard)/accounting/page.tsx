'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  Save,
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
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [reportName, setReportName] = useState('')
  const { toast } = useToast()
  const supabase = createClient()

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
        let query = supabase
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
  }, [startDate, endDate, paymentMethod, supabase, toast])

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Date facture',
      'Numéro facture',
      'Patient',
      'Montant',
      'Mode(s) de paiement',
      'Date encaissement',
    ]

    const rows = invoices.map((inv) => {
      const patient = inv.consultation.patient
      const paymentMethods = inv.payments
        .map((p) => `${paymentMethodLabels[p.method]} (${formatCurrency(p.amount)})`)
        .join(', ')

      return [
        inv.issued_at ? formatDate(inv.issued_at) : '',
        inv.invoice_number,
        `${patient.last_name} ${patient.first_name}`,
        inv.amount.toFixed(2),
        paymentMethods,
        inv.paid_at ? formatDate(inv.paid_at) : '',
      ]
    })

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.join(';')),
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `comptabilite_${startDate}_${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Export to XLSX
  const handleExportXLSX = async () => {
    setIsExporting(true)

    try {
      const XLSX = await import('xlsx')

      const data = invoices.map((inv) => {
        const patient = inv.consultation.patient
        const paymentMethods = inv.payments
          .map((p) => `${paymentMethodLabels[p.method]} (${p.amount.toFixed(2)}€)`)
          .join(', ')

        return {
          'Date facture': inv.issued_at ? formatDate(inv.issued_at) : '',
          'Numéro facture': inv.invoice_number,
          'Patient': `${patient.last_name} ${patient.first_name}`,
          'Montant': inv.amount,
          'Mode(s) de paiement': paymentMethods,
          'Date encaissement': inv.paid_at ? formatDate(inv.paid_at) : '',
        }
      })

      // Add summary row
      data.push({
        'Date facture': '',
        'Numéro facture': 'TOTAL',
        'Patient': `${invoices.length} consultations`,
        'Montant': summary?.totalRevenue || 0,
        'Mode(s) de paiement': '',
        'Date encaissement': '',
      })

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Comptabilité')

      XLSX.writeFile(wb, `comptabilite_${startDate}_${endDate}.xlsx`)
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

  // Save report preset
  const handleSaveReport = async () => {
    if (!reportName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez entrer un nom pour le rapport',
      })
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) throw new Error('Praticien non trouvé')

      const { error } = await supabase.from('saved_reports').insert({
        practitioner_id: practitioner.id,
        name: reportName,
        filters: JSON.parse(JSON.stringify({
          startDate,
          endDate,
          period,
          paymentMethod,
        })),
      })

      if (error) throw error

      toast({
        title: 'Rapport sauvegardé',
        description: `Le rapport "${reportName}" a été sauvegardé`,
      })

      setShowSaveDialog(false)
      setReportName('')
    } catch (error) {
      console.error('Error saving report:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder le rapport',
      })
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
          <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
            <Save className="mr-2 h-4 w-4" />
            Sauvegarder
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

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Détail des factures
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
                    <TableHead>Numéro</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Paiement(s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const patient = invoice.consultation.patient

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          {invoice.paid_at ? formatDate(invoice.paid_at) : '-'}
                        </TableCell>
                        <TableCell className="font-mono">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>
                          {patient.last_name} {patient.first_name}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(invoice.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {invoice.payments.map((payment, idx) => (
                              <Badge key={idx} variant="outline">
                                {paymentMethodLabels[payment.method]}:{' '}
                                {formatCurrency(payment.amount)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Report Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sauvegarder le rapport</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom du rapport</Label>
              <Input
                placeholder="Ex: Rapport mensuel janvier"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Filtres actuels :</p>
              <ul className="list-disc list-inside mt-1">
                <li>Période : {formatDate(startDate)} - {formatDate(endDate)}</li>
                <li>Mode de paiement : {paymentMethod === 'all' ? 'Tous' : paymentMethodLabels[paymentMethod]}</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveReport}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
