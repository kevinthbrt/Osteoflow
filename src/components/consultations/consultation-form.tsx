'use client'

import { useEffect, useState } from 'react'
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
import { Loader2, Plus, Trash2, Stethoscope, ClipboardList, CreditCard, CalendarCheck } from 'lucide-react'
import { generateInvoiceNumber } from '@/lib/utils'
import { paymentMethodLabels } from '@/lib/validations/invoice'
import { InvoiceActionModal } from '@/components/invoices/invoice-action-modal'
import { MedicalHistorySectionWrapper } from '@/components/patients/medical-history-section-wrapper'
import type { Patient, Consultation, Practitioner, SessionType, MedicalHistoryEntry } from '@/types/database'

interface ConsultationFormProps {
  patient: Patient
  practitioner: Practitioner
  consultation?: Consultation
  mode: 'create' | 'edit'
  medicalHistoryEntries?: MedicalHistoryEntry[]
}

interface PaymentEntry {
  id: string
  amount: number
  method: 'card' | 'cash' | 'check' | 'transfer' | 'other'
  check_number?: string
  notes?: string
}

interface CreatedInvoice {
  id: string
  invoice_number: string
}

export function ConsultationForm({
  patient,
  practitioner,
  consultation,
  mode,
  medicalHistoryEntries,
}: ConsultationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [createInvoice, setCreateInvoice] = useState(mode === 'create')
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([])
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { id: crypto.randomUUID(), amount: practitioner.default_rate, method: 'card' },
  ])
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null)
  const [sendPostSessionAdvice, setSendPostSessionAdvice] = useState(false)
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
      session_type_id: consultation?.session_type_id ?? null,
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
  const selectedSessionTypeId = watch('session_type_id')

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)

  useEffect(() => {
    async function loadSessionTypes() {
      const { data, error } = await supabase
        .from('session_types')
        .select('*')
        .eq('practitioner_id', practitioner.id)
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('Error loading session types:', error)
        return
      }

      if (data) {
        setSessionTypes(data)
      }
    }

    loadSessionTypes()
  }, [supabase, practitioner.id])

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

  const handleSessionTypeChange = (value: string) => {
    const nextValue = value === 'none' ? null : value
    setValue('session_type_id', nextValue)

    if (nextValue) {
      const selectedType = sessionTypes.find((type) => type.id === nextValue)
      if (selectedType) {
        setPayments((prev) => {
          if (prev.length === 0) return prev
          const [first, ...rest] = prev
          return [{ ...first, amount: selectedType.price }, ...rest]
        })
      }
    }
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
            session_type_id: data.session_type_id || null,
            reason: data.reason,
            anamnesis: data.anamnesis || null,
            examination: data.examination || null,
            advice: data.advice || null,
            follow_up_7d: data.follow_up_7d,
          })
          .select()
          .single()

        if (consultationError) throw consultationError

        // Variables for invoice to access outside the block
        let invoiceId: string | null = null
        let invoiceNumber: string | null = null

        // Create invoice if requested
        if (createInvoice && newConsultation) {
          invoiceNumber = generateInvoiceNumber(
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
            invoiceId = newInvoice.id

            const paymentInserts = payments.map((p) => ({
              invoice_id: newInvoice.id,
              amount: p.amount,
              method: p.method,
              payment_date: new Date().toISOString().split('T')[0],
              check_number: p.method === 'check' && p.check_number ? p.check_number : null,
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

        // Send post-session advice email immediately if requested
        if (sendPostSessionAdvice && newConsultation && patient.email) {
          try {
            await fetch('/api/emails/post-session-advice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ consultationId: newConsultation.id }),
            })
          } catch (e) {
            console.error('Error sending post-session advice:', e)
          }
        }

        // Show invoice action modal if invoice was created
        if (invoiceId && invoiceNumber) {
          setCreatedInvoice({
            id: invoiceId,
            invoice_number: invoiceNumber,
          })
          setShowInvoiceModal(true)
          setIsLoading(false)
          return // Don't navigate yet, wait for modal action
        }

        toast({
          variant: 'success',
          title: 'Consultation créée',
          description: 'La consultation a été créée',
        })

        router.push(`/patients/${patient.id}`)
      } else if (consultation) {
        // Update consultation
        const { error } = await supabase
          .from('consultations')
          .update({
            date_time: data.date_time,
            session_type_id: data.session_type_id || null,
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

  const formContent = (
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

          <div className="space-y-2 sm:col-span-2">
            <Label>Type de séance (facturation)</Label>
            <Select
              value={selectedSessionTypeId || 'none'}
              onValueChange={handleSessionTypeChange}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type de séance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {sessionTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} - {Number(type.price).toFixed(2)} €
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Le type de séance sera affiché sur la facture à la place du motif.
            </p>
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
          {mode === 'create' && (
            <div className="flex items-center space-x-2 mt-4">
              <Checkbox
                id="send_post_session_advice"
                checked={sendPostSessionAdvice}
                onCheckedChange={(checked) => setSendPostSessionAdvice(!!checked)}
                disabled={isLoading}
              />
              <Label htmlFor="send_post_session_advice" className="cursor-pointer">
                Envoyer des conseils post-séance par email (immédiat)
              </Label>
            </div>
          )}
          {sendPostSessionAdvice && !patient.email && (
            <p className="text-sm text-yellow-600 mt-2">
              Le patient n&apos;a pas d&apos;adresse email. L&apos;email ne pourra pas être envoyé.
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
                      {payment.method === 'check' && (
                        <div className="flex-1 space-y-2">
                          <Label>N° chèque</Label>
                          <Input
                            type="text"
                            placeholder="N° de chèque"
                            value={payment.check_number || ''}
                            onChange={(e) =>
                              updatePayment(payment.id, 'check_number', e.target.value)
                            }
                          />
                        </div>
                      )}
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
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? (
            <>
              <Stethoscope className="h-4 w-4" />
              Enregistrer la consultation
            </>
          ) : (
            'Mettre à jour'
          )}
        </Button>
      </div>

      {/* Invoice Action Modal */}
      {createdInvoice && (
        <InvoiceActionModal
          open={showInvoiceModal}
          onOpenChange={setShowInvoiceModal}
          invoiceId={createdInvoice.id}
          invoiceNumber={createdInvoice.invoice_number}
          patientEmail={patient.email}
          patientName={`${patient.last_name} ${patient.first_name}`}
          onComplete={() => {
            router.push(`/patients/${patient.id}`)
            router.refresh()
          }}
        />
      )}
    </form>
  )

  if (medicalHistoryEntries) {
    return (
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="lg:sticky lg:top-6 self-start">
          <MedicalHistorySectionWrapper
            patientId={patient.id}
            initialEntries={medicalHistoryEntries}
          />
        </div>
        <div>{formContent}</div>
      </div>
    )
  }

  return formContent
}
