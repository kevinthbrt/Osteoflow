'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { paymentMethodLabels } from '@/lib/validations/invoice'
import { toLocalDateOnly } from '@/lib/utils'
import { getCurrencySymbol } from '@/lib/utils/currency'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil } from 'lucide-react'

type PaymentMethod = 'card' | 'cash' | 'check' | 'transfer' | 'other'

interface PaymentRow {
  id: string
  amount: number
  method: PaymentMethod
  check_number?: string | null
  payment_date?: string | null
}

interface ConsultationPaymentEditorProps {
  payments: PaymentRow[]
  invoiceId?: string
  invoiceAmount?: number
  invoiceIssuedAt?: string | null
  invoicePaidAt?: string | null
  /**
   * Permet à l'écran appelant (modale de facture, fiche consultation) de
   * rafraîchir l'en-tête « Émise le … » sans rouvrir la facture.
   */
  onInvoiceDatesChange?: (dates: { issued_at: string; paid_at: string | null }) => void
}

export function ConsultationPaymentEditor({
  payments,
  invoiceId,
  invoiceAmount,
  invoiceIssuedAt,
  invoicePaidAt,
  onInvoiceDatesChange,
}: ConsultationPaymentEditorProps) {
  const [entries, setEntries] = useState<PaymentRow[]>(() =>
    payments.map((payment) => ({ ...payment }))
  )
  const [amountValue, setAmountValue] = useState(invoiceAmount !== undefined ? String(invoiceAmount) : '')
  const [dateValue, setDateValue] = useState(() => {
    const source = invoiceIssuedAt || invoicePaidAt || payments[0]?.payment_date
    return source ? toLocalDateOnly(source) : ''
  })
  const [savingAmount, setSavingAmount] = useState(false)
  const [savingDate, setSavingDate] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const db = createClient()

  const updateEntry = (id: string, field: keyof PaymentRow, value: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    )
  }

  const handleSaveAmount = async () => {
    if (!invoiceId) return
    const parsed = parseFloat(amountValue.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) {
      toast({ variant: 'destructive', title: 'Montant invalide' })
      return
    }
    setSavingAmount(true)
    try {
      const { error } = await db.from('invoices').update({ amount: parsed }).eq('id', invoiceId)
      if (error) throw error

      // Garde les paiements en phase avec le nouveau total, sinon la comptabilité
      // et les statistiques (qui se basent sur payments.amount) restent sur l'ancien montant.
      if (entries.length === 1) {
        const { error: paymentError } = await db
          .from('payments')
          .update({ amount: parsed })
          .eq('id', entries[0].id)
        if (paymentError) throw paymentError
        setEntries((prev) => prev.map((p) => ({ ...p, amount: parsed })))
      } else if (entries.length > 1) {
        const currentTotal = entries.reduce((sum, p) => sum + Number(p.amount), 0)
        if (currentTotal > 0) {
          const ratio = parsed / currentTotal
          const updated = entries.map((p) => ({
            id: p.id,
            amount: Math.round(Number(p.amount) * ratio * 100) / 100,
          }))
          const roundingDiff =
            Math.round((parsed - updated.reduce((sum, p) => sum + p.amount, 0)) * 100) / 100
          if (roundingDiff !== 0) {
            updated[updated.length - 1].amount =
              Math.round((updated[updated.length - 1].amount + roundingDiff) * 100) / 100
          }
          for (const p of updated) {
            const { error: paymentError } = await db
              .from('payments')
              .update({ amount: p.amount })
              .eq('id', p.id)
            if (paymentError) throw paymentError
          }
          setEntries((prev) =>
            prev.map((entry) => {
              const match = updated.find((u) => u.id === entry.id)
              return match ? { ...entry, amount: match.amount } : entry
            })
          )
        }
      }

      toast({ variant: 'success', title: 'Montant mis à jour', description: 'Le montant de la consultation a été mis à jour.' })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le montant.' })
    } finally {
      setSavingAmount(false)
    }
  }

  const handleSaveDate = async () => {
    if (!invoiceId || !dateValue) return
    const [year, month, day] = dateValue.split('-').map(Number)
    if (!year || !month || !day) {
      toast({ variant: 'destructive', title: 'Date invalide' })
      return
    }

    // On conserve l'heure existante de la facture (ou midi par défaut) : la
    // date est stockée en ISO/UTC, une heure de 00h00 basculerait sur la
    // veille dans certains fuseaux.
    const previous = invoiceIssuedAt || invoicePaidAt
    const previousDate = previous ? new Date(previous) : null
    const hours = previousDate && !Number.isNaN(previousDate.getTime()) ? previousDate.getHours() : 12
    const minutes = previousDate && !Number.isNaN(previousDate.getTime()) ? previousDate.getMinutes() : 0
    const isoDate = new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString()

    setSavingDate(true)
    try {
      // paid_at n'est renseigné que si la facture est déjà payée : on ne veut
      // pas la marquer payée en changeant simplement sa date d'émission.
      const nextPaidAt = invoicePaidAt ? isoDate : null
      const invoiceUpdates: Record<string, string> = { issued_at: isoDate }
      if (nextPaidAt) invoiceUpdates.paid_at = nextPaidAt

      const { error } = await db.from('invoices').update(invoiceUpdates).eq('id', invoiceId)
      if (error) throw error

      // La comptabilité et les objectifs se basent sur payments.payment_date :
      // sans cette mise à jour, le règlement resterait sur l'ancienne journée.
      if (entries.length > 0) {
        const { error: paymentsError } = await db
          .from('payments')
          .update({ payment_date: dateValue })
          .eq('invoice_id', invoiceId)
        if (paymentsError) throw paymentsError
        setEntries((prev) => prev.map((entry) => ({ ...entry, payment_date: dateValue })))
      }

      onInvoiceDatesChange?.({ issued_at: isoDate, paid_at: nextPaidAt })
      toast({
        variant: 'success',
        title: 'Date mise à jour',
        description: 'La facture, le règlement et la comptabilité utilisent la nouvelle date.',
      })
      router.refresh()
    } catch (error) {
      console.error('Error updating invoice date:', error)
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour la date.' })
    } finally {
      setSavingDate(false)
    }
  }

  const handleSave = async (paymentId: string) => {
    const entry = entries.find((payment) => payment.id === paymentId)
    if (!entry) return

    setSavingId(paymentId)
    try {
      const { error } = await db
        .from('payments')
        .update({
          method: entry.method,
          check_number: entry.method === 'check' ? entry.check_number || null : null,
        })
        .eq('id', paymentId)

      if (error) throw error

      toast({
        variant: 'success',
        title: 'Paiement mis à jour',
        description: 'Le mode de paiement a été mis à jour.',
      })

      router.refresh()
    } catch (error) {
      console.error('Error updating payment method:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre à jour le mode de paiement.',
      })
    } finally {
      setSavingId((current) => (current === paymentId ? null : current))
    }
  }

  if (entries.length === 0 && !invoiceId) {
    return null
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Pencil className="h-4 w-4 text-primary" />
          Modifier le paiement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoiceId && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label className="flex items-center gap-1.5">
              <Pencil className="h-3 w-3 text-primary" />
              Montant de la consultation
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amountValue}
                onChange={e => setAmountValue(e.target.value)}
                placeholder="0.00"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">{getCurrencySymbol()}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveAmount}
                disabled={savingAmount}
              >
                {savingAmount ? 'Enregistrement...' : 'Sauvegarder'}
              </Button>
            </div>
          </div>
        )}
        {invoiceId && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label className="flex items-center gap-1.5">
              <Pencil className="h-3 w-3 text-primary" />
              Date de la facture
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateValue}
                onChange={e => setDateValue(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDate}
                disabled={savingDate || !dateValue}
              >
                {savingDate ? 'Enregistrement...' : 'Sauvegarder'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Date d&apos;émission, de règlement et d&apos;encaissement comptable de cette facture.
            </p>
          </div>
        )}
        {entries.map((payment) => (
          <div key={payment.id} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Montant</span>
              <span className="font-medium">{Number(payment.amount).toFixed(2)} {getCurrencySymbol()}</span>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Pencil className="h-3 w-3 text-primary" />
                Mode de paiement
              </Label>
              <Select
                value={payment.method}
                onValueChange={(value) => updateEntry(payment.id, 'method', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {payment.method === 'check' && (
              <div className="space-y-2">
                <Label>N° chèque</Label>
                <Input
                  value={payment.check_number || ''}
                  onChange={(event) =>
                    updateEntry(payment.id, 'check_number', event.target.value)
                  }
                  placeholder="N° de chèque"
                />
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave(payment.id)}
              disabled={savingId === payment.id}
              className="w-full"
            >
              {savingId === payment.id ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Ces modifications sont immédiatement reflétées dans la facturation,
          la comptabilité et les statistiques.
        </p>
      </CardContent>
    </Card>
  )
}
