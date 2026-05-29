'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/db/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { invoiceStatusLabels, paymentMethodLabels } from '@/lib/validations/invoice'
import { Eye, FileText, Calendar, Download, Check, Loader2 } from 'lucide-react'

type PaymentMethod = 'card' | 'cash' | 'check' | 'transfer' | 'other'

interface Payment {
  id: string
  amount: number
  method: PaymentMethod
  check_number?: string | null
}

interface Invoice {
  id: string
  invoice_number: string
  amount: number
  status: string
}

interface Consultation {
  id: string
  date_time: string
  reason: string
  patient: { id: string; first_name: string; last_name: string } | null
  invoices: (Invoice & { payments: Payment[] })[]
}

const periodOptions = [
  { value: '10', label: '10 dernières' },
  { value: '30', label: '30 dernières' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'custom', label: 'Période personnalisée' },
]

export function ConsultationsTab() {
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState('10')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [editingPayment, setEditingPayment] = useState<string | null>(null)
  const [editMethod, setEditMethod] = useState<PaymentMethod>('card')
  const [editCheckNumber, setEditCheckNumber] = useState('')
  const [savingPayment, setSavingPayment] = useState<string | null>(null)
  const [editingAmount, setEditingAmount] = useState<string | null>(null)
  const [editAmountValue, setEditAmountValue] = useState('')
  const [savingAmount, setSavingAmount] = useState<string | null>(null)
  const { toast } = useToast()
  const db = createClient()

  const fetchConsultations = useCallback(async () => {
    setIsLoading(true)
    try {
      let query = db
        .from('consultations')
        .select(`*, patient:patients (id, first_name, last_name), invoices (id, invoice_number, amount, status, payments (*))`)
        .is('archived_at', null)
        .order('date_time', { ascending: false })

      if (period === '10') {
        query = query.limit(10)
      } else if (period === '30') {
        query = query.limit(30)
      } else if (period === 'custom' && startDate && endDate) {
        query = query.gte('date_time', `${startDate}T00:00:00`).lte('date_time', `${endDate}T23:59:59`)
      } else if (period !== 'custom') {
        const now = new Date()
        let from: Date
        if (period === 'week') {
          from = new Date(now)
          const day = from.getDay()
          from.setDate(from.getDate() - (day === 0 ? 6 : day - 1))
        } else if (period === 'month') {
          from = new Date(now.getFullYear(), now.getMonth(), 1)
        } else {
          from = new Date(now.getFullYear(), 0, 1)
        }
        from.setHours(0, 0, 0, 0)
        query = query.gte('date_time', from.toISOString())
      }

      const { data, error } = await query
      if (!error) setConsultations(data || [])
    } finally {
      setIsLoading(false)
    }
  }, [db, period, startDate, endDate])

  useEffect(() => {
    if (period === 'custom' && (!startDate || !endDate)) return
    fetchConsultations()
  }, [fetchConsultations, period, startDate, endDate])

  const startEditPayment = (payment: Payment) => {
    setEditingPayment(payment.id)
    setEditMethod(payment.method)
    setEditCheckNumber(payment.check_number || '')
  }

  const savePayment = async (paymentId: string) => {
    setSavingPayment(paymentId)
    try {
      const { error } = await db
        .from('payments')
        .update({ method: editMethod, check_number: editMethod === 'check' ? editCheckNumber || null : null })
        .eq('id', paymentId)
      if (error) throw error
      toast({ variant: 'success', title: 'Paiement mis à jour' })
      setEditingPayment(null)
      fetchConsultations()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le paiement.' })
    } finally {
      setSavingPayment(null)
    }
  }

  const saveAmount = async (invoiceId: string, consultationId: string) => {
    const parsed = parseFloat(editAmountValue.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) {
      toast({ variant: 'destructive', title: 'Montant invalide' })
      return
    }
    setSavingAmount(consultationId)
    try {
      const { error } = await db.from('invoices').update({ amount: parsed }).eq('id', invoiceId)
      if (error) throw error
      toast({ variant: 'success', title: 'Montant mis à jour' })
      setEditingAmount(null)
      fetchConsultations()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le montant.' })
    } finally {
      setSavingAmount(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {period === 'custom' && (
          <>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[160px]" />
            <span className="text-muted-foreground">à</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[160px]" />
          </>
        )}
        <span className="text-sm text-muted-foreground">
          {consultations.length} consultation{consultations.length > 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : consultations.length === 0 ? (
        <div className="text-center py-10 rounded-2xl glass-card">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune consultation sur cette période</p>
        </div>
      ) : (
        <div className="rounded-2xl glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead>Facture</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultations.map((consultation) => {
                const patient = consultation.patient
                const invoice = consultation.invoices?.[0]
                const payment = invoice?.payments?.[0]
                return (
                  <TableRow key={consultation.id}>
                    <TableCell className="font-medium whitespace-nowrap">{formatDateTime(consultation.date_time)}</TableCell>
                    <TableCell>
                      {patient ? (
                        <Link href={`/patients/${patient.id}`} className="hover:underline whitespace-nowrap">
                          {patient.last_name} {patient.first_name}
                        </Link>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{consultation.reason}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {invoice ? (
                        editingAmount === consultation.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editAmountValue}
                              onChange={e => setEditAmountValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveAmount(invoice.id, consultation.id); if (e.key === 'Escape') setEditingAmount(null) }}
                              className="h-7 w-[80px] text-xs"
                              autoFocus
                            />
                            <span className="text-xs text-muted-foreground">€</span>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => saveAmount(invoice.id, consultation.id)} disabled={savingAmount === consultation.id}>
                              {savingAmount === consultation.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditingAmount(null)}>&times;</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingAmount(consultation.id); setEditAmountValue(String(invoice.amount)) }}
                            className="font-medium hover:underline text-left"
                            title="Cliquer pour modifier"
                          >
                            {formatCurrency(invoice.amount)}
                          </button>
                        )
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {payment ? (
                        editingPayment === payment.id ? (
                          <div className="flex items-center gap-1.5">
                            <Select value={editMethod} onValueChange={(v) => setEditMethod(v as PaymentMethod)}>
                              <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(paymentMethodLabels).map(([val, label]) => (
                                  <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editMethod === 'check' && (
                              <Input value={editCheckNumber} onChange={e => setEditCheckNumber(e.target.value)} placeholder="N°" className="h-7 w-[70px] text-xs" />
                            )}
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => savePayment(payment.id)} disabled={savingPayment === payment.id}>
                              {savingPayment === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditingPayment(null)}>&times;</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditPayment(payment)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/20 bg-primary/5 text-sm font-medium hover:bg-primary/10 transition-colors"
                            title="Cliquer pour modifier"
                          >
                            {paymentMethodLabels[payment.method] || payment.method}
                            {payment.method === 'check' && payment.check_number && (
                              <span className="text-muted-foreground text-xs">n°{payment.check_number}</span>
                            )}
                          </button>
                        )
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {invoice ? (
                        <Link href={`/invoices/${invoice.id}`}>
                          <Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'cancelled' ? 'destructive' : 'outline'} className="cursor-pointer whitespace-nowrap">
                            {invoiceStatusLabels[invoice.status]}
                          </Badge>
                        </Link>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                          <Link href={`/consultations/${consultation.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        {invoice && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                              <Link href={`/invoices/${invoice.id}`}><FileText className="h-3.5 w-3.5" /></Link>
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                              <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a>
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
