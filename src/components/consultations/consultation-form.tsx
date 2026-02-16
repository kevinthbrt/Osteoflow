'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/db/client'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2, Stethoscope, ClipboardList, CreditCard, CalendarCheck, Clock, Eye, Pencil, Paperclip, Upload, FileText, Image, X, ArrowRight } from 'lucide-react'
import { generateInvoiceNumber, formatDateTime, formatDate } from '@/lib/utils'
import { paymentMethodLabels } from '@/lib/validations/invoice'
import { InvoiceActionModal } from '@/components/invoices/invoice-action-modal'
import { MedicalHistorySectionWrapper } from '@/components/patients/medical-history-section-wrapper'
import { EditPatientModal } from '@/components/patients/edit-patient-modal'
import type { Patient, Consultation, Practitioner, SessionType, MedicalHistoryEntry, ConsultationAttachment } from '@/types/database'

interface ConsultationFormProps {
  patient: Patient
  practitioner: Practitioner
  consultation?: Consultation
  mode: 'create' | 'edit'
  medicalHistoryEntries?: MedicalHistoryEntry[]
  pastConsultations?: Consultation[]
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
  pastConsultations,
}: ConsultationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showEditPatient, setShowEditPatient] = useState(false)
  const [currentPatient, setCurrentPatient] = useState<Patient>(patient)
  const [viewingConsultation, setViewingConsultation] = useState<Consultation | null>(null)
  const [createInvoice, setCreateInvoice] = useState(mode === 'create')
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([])
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { id: crypto.randomUUID(), amount: practitioner.default_rate, method: 'card' },
  ])
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null)
  const [sendPostSessionAdvice, setSendPostSessionAdvice] = useState(false)
  const [contactEmail, setContactEmail] = useState(currentPatient.email || '')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<ConsultationAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState('consultation')
  const router = useRouter()
  const { toast } = useToast()
  const db = createClient()

  const now = new Date()
  const toLocalDateTimeString = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  const defaultDateTime = consultation?.date_time
    ? toLocalDateTimeString(new Date(consultation.date_time))
    : toLocalDateTimeString(now)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ConsultationWithInvoiceFormData>({
    resolver: zodResolver(consultationWithInvoiceSchema),
    defaultValues: {
      patient_id: currentPatient.id,
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
  const effectiveEmail = contactEmail.trim() || currentPatient.email || ''
  const shouldCollectEmail =
    !currentPatient.email &&
    (followUp7d || sendPostSessionAdvice || (mode === 'create' && createInvoice))

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)

  useEffect(() => {
    async function loadSessionTypes() {
      const { data, error } = await db
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
  }, [db, practitioner.id])

  // Load existing attachments in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !consultation) return

    async function loadAttachments() {
      const { data } = await db
        .from('consultation_attachments')
        .select('*')
        .eq('consultation_id', consultation!.id)
        .order('created_at')

      if (data) setExistingAttachments(data as ConsultationAttachment[])
    }

    loadAttachments()
  }, [mode, consultation, db])

  // Auto-switch to the tab containing validation errors
  useEffect(() => {
    const errorKeys = Object.keys(errors)
    if (errorKeys.length === 0) return
    const consultationFields = ['date_time', 'reason', 'anamnesis', 'examination', 'advice']
    if (errorKeys.some((k) => consultationFields.includes(k))) {
      setActiveTab('consultation')
    }
  }, [errors])

  // Auto-resize textareas on mount (for edit mode with pre-existing content)
  useEffect(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea[data-autoresize]')
    textareas.forEach((ta) => {
      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight}px`
    })
  }, [])

  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget
    target.style.height = 'auto'
    target.style.height = `${target.scrollHeight}px`
  }

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

  const uploadAttachments = async (consultationId: string) => {
    for (const file of pendingFiles) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      await fetch('/api/attachments/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          consultation_id: consultationId,
          original_name: file.name,
          mimetype: file.type,
        }),
      })
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    const res = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' })
    if (res.ok) {
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
      toast({ variant: 'success', title: 'Pièce jointe supprimée' })
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    setPendingFiles((prev) => [...prev, ...files])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setPendingFiles((prev) => [...prev, ...files])
    }
    e.target.value = '' // Reset so same file can be re-selected
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return Image
    return FileText
  }

  const onSubmit = async (data: ConsultationWithInvoiceFormData) => {
    setIsLoading(true)

    try {
      let resolvedEmail = currentPatient.email || null
      if (!currentPatient.email && contactEmail.trim()) {
        const { error: patientUpdateError } = await db
          .from('patients')
          .update({ email: contactEmail.trim() })
          .eq('id', currentPatient.id)

        if (patientUpdateError) throw patientUpdateError
        resolvedEmail = contactEmail.trim()
      }

      if (mode === 'create') {
        // Create consultation
        const { data: newConsultation, error: consultationError } = await db
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

        // Upload pending attachments
        if (pendingFiles.length > 0 && newConsultation) {
          await uploadAttachments(newConsultation.id)
        }

        // Variables for invoice to access outside the block
        let invoiceId: string | null = null
        let invoiceNumber: string | null = null

        // Create invoice if requested
        if (createInvoice && newConsultation) {
          invoiceNumber = generateInvoiceNumber(
            practitioner.invoice_prefix,
            practitioner.invoice_next_number
          )
          const consultationDate = new Date(data.date_time)
          const consultationDateIso = consultationDate.toISOString()
          const consultationDateOnly = consultationDateIso.split('T')[0]

          const { data: newInvoice, error: invoiceError } = await db
            .from('invoices')
            .insert({
              consultation_id: newConsultation.id,
              invoice_number: invoiceNumber,
              amount: totalPayments,
              status: 'paid',
              issued_at: consultationDateIso,
              paid_at: consultationDateIso,
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
              payment_date: consultationDateOnly,
              check_number: p.method === 'check' && p.check_number ? p.check_number : null,
              notes: p.notes || null,
            }))

            const { error: paymentsError } = await db
              .from('payments')
              .insert(paymentInserts)

            if (paymentsError) throw paymentsError

            // Update practitioner's next invoice number
            await db
              .from('practitioners')
              .update({ invoice_next_number: practitioner.invoice_next_number + 1 })
              .eq('id', practitioner.id)
          }
        }

        // Create scheduled task for follow-up if requested
        if (data.follow_up_7d && newConsultation) {
          const scheduledFor = new Date(data.date_time)
          scheduledFor.setDate(scheduledFor.getDate() + 7)

          await db.from('scheduled_tasks').insert({
            practitioner_id: practitioner.id,
            type: 'follow_up_email',
            consultation_id: newConsultation.id,
            scheduled_for: scheduledFor.toISOString(),
          })
        }

        // Send post-session advice email immediately if requested
        if (sendPostSessionAdvice && newConsultation && resolvedEmail) {
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

        router.push(`/patients/${currentPatient.id}`)
      } else if (consultation) {
        // Update consultation
        const { error } = await db
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

        // Upload pending attachments
        if (pendingFiles.length > 0) {
          await uploadAttachments(consultation.id)
        }

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault()
    }
  }

  // Tab completion indicators
  const reason = watch('reason')
  const anamnesis = watch('anamnesis')
  const examination = watch('examination')
  const advice = watch('advice')
  const consultationFilled = !!(reason && (anamnesis || examination || advice))
  const suiviFacturationFilled = followUp7d || sendPostSessionAdvice || (createInvoice && totalPayments > 0)

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="consultation" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Consultation</span>
            <span className="sm:hidden">Consult.</span>
            {consultationFilled && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
          </TabsTrigger>
          <TabsTrigger value="suivi-facturation" className="gap-2">
            <CalendarCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Suivi et facturation</span>
            <span className="sm:hidden">Suivi</span>
            {suiviFacturationFilled && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Consultation */}
        <TabsContent value="consultation" forceMount className="data-[state=inactive]:hidden data-[state=active]:animate-fade-in mt-4 space-y-6">
          {/* General Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Informations générales</CardTitle>
              </div>
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
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Contenu clinique</CardTitle>
              </div>
              <CardDescription>Anamnèse, examen et conseils</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="anamnesis">Anamnèse</Label>
                <Textarea
                  id="anamnesis"
                  data-autoresize
                  {...register('anamnesis')}
                  onInput={autoResize}
                  disabled={isLoading}
                  placeholder="Histoire de la maladie, circonstances d'apparition, évolution..."
                  rows={4}
                  className="min-h-[100px] resize-none overflow-hidden transition-[height] duration-200"
                />
                {errors.anamnesis && (
                  <p className="text-sm text-destructive">{errors.anamnesis.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="examination">Examen clinique et manipulations</Label>
                <Textarea
                  id="examination"
                  data-autoresize
                  {...register('examination')}
                  onInput={autoResize}
                  disabled={isLoading}
                  placeholder="Tests effectués, dysfonctions trouvées, techniques utilisées..."
                  rows={4}
                  className="min-h-[100px] resize-none overflow-hidden transition-[height] duration-200"
                />
                {errors.examination && (
                  <p className="text-sm text-destructive">{errors.examination.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="advice">Conseils donnés</Label>
                <Textarea
                  id="advice"
                  data-autoresize
                  {...register('advice')}
                  onInput={autoResize}
                  disabled={isLoading}
                  placeholder="Exercices, postures, recommandations..."
                  rows={3}
                  className="min-h-[100px] resize-none overflow-hidden transition-[height] duration-200"
                />
                {errors.advice && (
                  <p className="text-sm text-destructive">{errors.advice.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Pièces jointes</CardTitle>
              </div>
              <CardDescription>
                Comptes rendus, radios, ordonnances, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onClick={() => document.getElementById('attachment-input')?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Glissez-déposez vos fichiers ici ou <span className="text-primary underline">parcourir</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, images, documents (max 20 Mo par fichier)
                </p>
                <input
                  id="attachment-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.dicom,.dcm"
                />
              </div>

              {/* Existing attachments (edit mode) */}
              {existingAttachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Fichiers existants</p>
                  {existingAttachments.map((att) => {
                    const Icon = getFileIcon(att.original_name)
                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <a
                          href={`/api/attachments/${att.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 min-w-0 flex-1 hover:underline"
                        >
                          <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span className="text-sm truncate">{att.original_name}</span>
                          {att.file_size && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatFileSize(att.file_size)}
                            </span>
                          )}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 h-8 w-8"
                          onClick={() => handleDeleteAttachment(att.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pending files (not yet uploaded) */}
              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Fichiers à envoyer ({pendingFiles.length})
                  </p>
                  {pendingFiles.map((file, index) => {
                    const Icon = getFileIcon(file.name)
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-dashed p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 h-8 w-8"
                          onClick={() => removePendingFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Suivi et facturation */}
        <TabsContent value="suivi-facturation" forceMount className="data-[state=inactive]:hidden data-[state=active]:animate-fade-in mt-4 space-y-6">
          {/* Type de séance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Type de séance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
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

          {/* Follow-up */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Suivi</CardTitle>
              </div>
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
              {followUp7d && !effectiveEmail && (
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
              {sendPostSessionAdvice && !effectiveEmail && (
                <p className="text-sm text-yellow-600 mt-2">
                  Le patient n&apos;a pas d&apos;adresse email. L&apos;email ne pourra pas être envoyé.
                </p>
              )}
              {shouldCollectEmail && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="contact_email">Adresse email du patient</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    placeholder="email@exemple.com"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Indispensable pour l&apos;envoi des emails (suivi, conseils immédiats ou facture).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facturation (create mode only) */}
          {mode === 'create' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Facturation</CardTitle>
                </div>
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

                      {payments.map((payment) => (
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
        </TabsContent>
      </Tabs>

      {/* Sticky Actions */}
      <div className="sticky bottom-0 z-10 flex justify-end gap-4 pt-4 pb-2 -mx-1 px-1 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Annuler
        </Button>
        {activeTab === 'consultation' ? (
          <Button type="button" onClick={() => setActiveTab('suivi-facturation')} className="gap-2">
            Passer au suivi et à la facturation
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
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
        )}
      </div>
    </form>
  )

  const modals = (
    <>
      {/* Edit Patient Modal - must be outside <form> to prevent submit event bubbling */}
      <EditPatientModal
        open={showEditPatient}
        onOpenChange={setShowEditPatient}
        patient={currentPatient}
        onUpdated={(updatedPatient) => {
          setCurrentPatient(updatedPatient)
          setContactEmail(updatedPatient.email || '')
        }}
      />
      {/* Invoice Action Modal - must be outside <form> to prevent submit event bubbling */}
      {createdInvoice && (
        <InvoiceActionModal
          open={showInvoiceModal}
          onOpenChange={setShowInvoiceModal}
          invoiceId={createdInvoice.id}
          invoiceNumber={createdInvoice.invoice_number}
          patientEmail={effectiveEmail || undefined}
          patientName={`${currentPatient.last_name} ${currentPatient.first_name}`}
          onComplete={() => {
            router.push(`/patients/${currentPatient.id}`)
            router.refresh()
          }}
        />
      )}
    </>
  )

  if (medicalHistoryEntries) {
    return (
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="lg:sticky lg:top-6 self-start space-y-6">
          {/* Edit Patient Button */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Patient</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditPatient(true)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Modifier
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{currentPatient.last_name} {currentPatient.first_name}</p>
              {currentPatient.gender && (
                <p className="text-muted-foreground">{currentPatient.gender === 'M' ? 'Homme' : 'Femme'}</p>
              )}
              {currentPatient.birth_date && (
                <p className="text-muted-foreground">{formatDate(currentPatient.birth_date)}</p>
              )}
              {currentPatient.phone && <p className="text-muted-foreground">{currentPatient.phone}</p>}
              {currentPatient.email && <p className="text-muted-foreground">{currentPatient.email}</p>}
              {currentPatient.profession && <p className="text-muted-foreground">{currentPatient.profession}</p>}
            </CardContent>
          </Card>

          <MedicalHistorySectionWrapper
            patientId={currentPatient.id}
            initialEntries={medicalHistoryEntries}
          />

          {/* Past Consultations */}
          {pastConsultations && pastConsultations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Consultations passées</CardTitle>
                <p className="text-xs text-muted-foreground">{pastConsultations.length} consultation{pastConsultations.length > 1 ? 's' : ''}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {pastConsultations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setViewingConsultation(c)}
                    className="block w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatDateTime(c.date_time)}
                      </p>
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium line-clamp-1">{c.reason}</p>
                    {c.examination && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {c.examination}
                      </p>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Past Consultation Detail Modal */}
          <Dialog open={!!viewingConsultation} onOpenChange={(open) => !open && setViewingConsultation(null)}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              {viewingConsultation && (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      Consultation du {formatDateTime(viewingConsultation.date_time)}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">{viewingConsultation.reason}</p>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    {viewingConsultation.anamnesis && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Anamnèse
                        </h4>
                        <p className="text-sm whitespace-pre-wrap">{viewingConsultation.anamnesis}</p>
                      </div>
                    )}
                    {viewingConsultation.examination && (
                      <div>
                        <Separator />
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1 mt-3">
                          Examen clinique et manipulations
                        </h4>
                        <p className="text-sm whitespace-pre-wrap">{viewingConsultation.examination}</p>
                      </div>
                    )}
                    {viewingConsultation.advice && (
                      <div>
                        <Separator />
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1 mt-3">
                          Conseils donnés
                        </h4>
                        <p className="text-sm whitespace-pre-wrap">{viewingConsultation.advice}</p>
                      </div>
                    )}
                    {!viewingConsultation.anamnesis && !viewingConsultation.examination && !viewingConsultation.advice && (
                      <p className="text-sm text-muted-foreground italic">
                        Aucun contenu clinique renseigné
                      </p>
                    )}
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
        <div>{formContent}</div>
        {modals}
      </div>
    )
  }

  return <>{formContent}{modals}</>
}
