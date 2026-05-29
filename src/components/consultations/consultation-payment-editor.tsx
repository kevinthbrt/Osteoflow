'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { paymentMethodLabels } from '@/lib/validations/invoice'
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
}

interface ConsultationPaymentEditorProps {
  payments: PaymentRow[]
  invoiceId?: string
  invoiceAmount?: number
}

export function ConsultationPaymentEditor({
  payments,
  invoiceId,
  invoiceAmount,
}: ConsultationPaymentEditorProps) {
  const [entries, setEntries] = useState<PaymentRow[]>(() =>
    payments.map((payment) => ({ ...payment }))
  )
  const [amountValue, setAmountValue] = useState(invoiceAmount !== undefined ? String(invoiceAmount) : '')
  const [savingAmount, setSavingAmount] = useState(false)
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
      toast({ variant: 'success', title: 'Montant mis à jour', description: 'Le montant de la consultation a été mis à jour.' })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le montant.' })
    } finally {
      setSavingAmount(false)
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
            <Label>Montant de la consultation</Label>
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
              <span className="text-sm text-muted-foreground">€</span>
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
        {entries.map((payment) => (
          <div key={payment.id} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Montant</span>
              <span className="font-medium">{Number(payment.amount).toFixed(2)} €</span>
            </div>

            <div className="space-y-2">
              <Label>Mode de paiement</Label>
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
