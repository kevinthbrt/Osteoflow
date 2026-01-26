'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import {
  consultationWithInvoiceSchema,
  type ConsultationWithInvoiceFormData,
} from '@/lib/validations/consultation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { generateInvoiceNumber } from '@/lib/utils'
import { paymentMethodLabels } from '@/lib/validations/invoice'
import type { Patient, Consultation, Practitioner } from '@/types/database'

interface ConsultationFormProps {
  patient: Patient
  practitioner: Practitioner
  consultation?: Consultation
  mode: 'create' | 'edit'
}

interface PaymentEntry {
  id: string
  amount: number
  method: 'card' | 'cash' | 'check' | 'transfer' | 'other'
  notes?: string
}

export function ConsultationForm({
  patient,
  practitioner,
  consultation,
  mode,
}: ConsultationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [createInvoice, setCreateInvoice] = useState(mode === 'create')
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { id: crypto.randomUUID(), amount: practitioner.default_rate, method: 'card' },
  ])
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const now = new Date()
  const defaultDateTime = consultation?.date_time
    ? new Date(consultation.date_time).toISOString().slice(0, 16)
    : now.toISOString().slice(0, 16)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ConsultationWithInvoiceFormData>({
    resolver: zodResolver(consultationWithInvoiceSchema),
    defaultValues: {
      patient_id: patient.id,
      date_time: defaultDateTime,
      reason: consultation?.reason || '',
      anamnesis: consultation?.anamnesis || '',
      examination: consultation?.examination || '',
      advice: consultation?.advice || '',
      follow_up_7d: consultation?.follow_up_7d || false,
      create_invoice: mode === 'create',
      invoice_amount: practitioner.default_rate,
    },
  })

  const followUp7d = watch('follow_up_7d')

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)

  const addPayment = () => {
    setPayments([
      ...payments,
      { id: crypto.randomUUID(), amount: 0, method: 'cash' },
    ])
  }

  const removePayment = (id: string) => {
    if (payments.length > 1) {
      setPayments(payments.filter((p) => p.id !== id))
    }
  }

  const updatePayment = (id: string, field: keyof PaymentEntry, value: unknown) => {
    setPayments(
      payments.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  const onSubmit = async (data: ConsultationWithInvoiceFormData) => {
    setIsLoading(true)

    try {
      if (mode === 'create') {
        // Create consultation
        const { data: newConsultation, error: consultationError } = await supabase
          .from('consultations')
          .insert({
            patient_id: data.patient_id,
            date_time: data.date_time,
            reason: data.reason,
            anamnesis: data.anamnesis || null,
            examination: data.examination || null,
            advice: data.advice || null,
            follow_up_7d: data.follow_up_7d,
          })
          .select()
          .single()

        if (consultationError) throw consultationError

        // Create invoice if requested
        if (createInvoice && newConsultation) {
          const invoiceNumber = generateInvoiceNumber(
            practitioner.invoice_prefix,
            practitioner.invoice_next_number
          )

          const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
              consultation_id: newConsultation.id,
              invoice_number: invoiceNumber,
              amount: totalPayments,
              status: 'paid',
              issued_at: new Date().toISOString(),
              paid_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (invoiceError) throw invoiceError

          // Create payments
          if (newInvoice) {
            const paymentInserts = payments.map((p) => ({
              invoice_id: newInvoice.id,
              amount: p.amount,
              method: p.method,
              payment_date: new Date().toISOString().split('T')[0],
              notes: p.notes || null,
            }))

            const { error: paymentsError } = await supabase
              .from('payments')
              .insert(paymentInserts)

            if (paymentsError) throw paymentsError

            // Update practitioner's next invoice number
            await supabase
              .from('practitioners')
              .update({ invoice_next_number: practitioner.invoice_next_number + 1 })
              .eq('id', practitioner.id)
          }
        }

        // Create scheduled task for follow-up if requested
        if (data.follow_up_7d && newConsultation) {
          const scheduledFor = new Date(data.date_time)
          scheduledFor.setDate(scheduledFor.getDate() + 7)

          await supabase.from('scheduled_tasks').insert({
            practitioner_id: practitioner.id,
            type: 'follow_up_email',
            consultation_id: newConsultation.id,
            scheduled_for: scheduledFor.toISOString(),
          })
        }

        toast({
          variant: 'success',
          title: 'Consultation créée',
          description: createInvoice
            ? 'La consultation et la facture ont été créées'
            : 'La consultation a été créée',
        })

        router.push(`/patients/${patient.id}`)
      } else if (consultation) {
        // Update consultation
        const { error } = await supabase
          .from('consultations')
          .update({
            date_time: data.date_time,
            reason: data.reason,
            anamnesis: data.anamnesis || null,
            examination: data.examination || null,
            advice: data.advice || null,
            follow_up_7d: data.follow_up_7d,
          })
          .eq('id', consultation.id)

        if (error) throw error

        toast({
          variant: 'success',
          title: 'Consultation mise à jour',
          description: 'Les modifications ont été enregistrées',
        })

        router.push(`/consultations/${consultation.id}`)
      }

      router.refresh()
    } catch (error) {
      console.error('Error saving consultation:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder la consultation',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Date and Reason */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date_time">Date et heure *</Label>
            <Input
              id="date_time"
              type="datetime-local"
              {...register('date_time')}
              disabled={isLoading}
            />
            {errors.date_time && (
              <p className="text-sm text-destructive">{errors.date_time.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="reason">Motif de consultation *</Label>
            <Input
              id="reason"
              {...register('reason')}
              disabled={isLoading}
              placeholder="Lombalgie, cervicalgie, suivi..."
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clinical Content */}
      <Card>
        <CardHeader>
          <CardTitle>Contenu clinique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="anamnesis">Anamnèse</Label>
            <Textarea
              id="anamnesis"
              {...register('anamnesis')}
              disabled={isLoading}
              placeholder="Histoire de la maladie, circonstances d'apparition, évolution..."
              rows={4}
            />
            {errors.anamnesis && (
              <p className="text-sm text-destructive">{errors.anamnesis.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="examination">Examen clinique et manipulations</Label>
            <Textarea
              id="examination"
              {...register('examination')}
              disabled={isLoading}
              placeholder="Tests effectués, dysfonctions trouvées, techniques utilisées..."
              rows={4}
            />
            {errors.examination && (
              <p className="text-sm text-destructive">{errors.examination.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="advice">Conseils donnés</Label>
            <Textarea
              id="advice"
              {...register('advice')}
              disabled={isLoading}
              placeholder="Exercices, postures, recommandations..."
              rows={3}
            />
            {errors.advice && (
              <p className="text-sm text-destructive">{errors.advice.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Follow-up */}
      <Card>
        <CardHeader>
          <CardTitle>Suivi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="follow_up_7d"
              checked={followUp7d}
              onCheckedChange={(checked) => setValue('follow_up_7d', !!checked)}
              disabled={isLoading}
            />
            <Label htmlFor="follow_up_7d" className="cursor-pointer">
              Demander des nouvelles à J+7 (email automatique)
            </Label>
          </div>
          {followUp7d && !patient.email && (
            <p className="text-sm text-yellow-600 mt-2">
              Le patient n&apos;a pas d&apos;adresse email. L&apos;email de suivi ne pourra pas être envoyé.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invoice & Payment (only in create mode) */}
      {mode === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle>Facturation</CardTitle>
            <CardDescription>
              Créez une facture pour cette consultation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create_invoice"
                checked={createInvoice}
                onCheckedChange={(checked) => setCreateInvoice(!!checked)}
                disabled={isLoading}
              />
              <Label htmlFor="create_invoice" className="cursor-pointer">
                Créer une facture
              </Label>
            </div>

            {createInvoice && (
              <>
                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Paiements</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPayment}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Ajouter
                    </Button>
                  </div>

                  {payments.map((payment, index) => (
                    <div
                      key={payment.id}
                      className="flex items-end gap-2 p-3 border rounded-lg"
                    >
                      <div className="flex-1 space-y-2">
                        <Label>Montant</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payment.amount}
                          onChange={(e) =>
                            updatePayment(
                              payment.id,
                              'amount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label>Mode</Label>
                        <Select
                          value={payment.method}
                          onValueChange={(value) =>
                            updatePayment(payment.id, 'method', value)
                          }
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
                      {payments.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePayment(payment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Total</span>
                    <span className="text-lg font-bold">
                      {totalPayments.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Enregistrer la consultation' : 'Mettre à jour'}
        </Button>
      </div>
    </form>
  )
}
