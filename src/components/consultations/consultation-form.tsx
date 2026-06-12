'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2, Stethoscope, ClipboardList, CreditCard, CalendarCheck, Clock, Eye, Pencil, Paperclip, Upload, FileText, Image, X, ArrowRight, MapPin, GitBranch, Dumbbell, Sparkles } from 'lucide-react'
import { generateInvoiceNumber, formatDateTime, formatDate, calculateAge } from '@/lib/utils'
import { paymentMethodLabels } from '@/lib/validations/invoice'
import { InvoiceActionModal } from '@/components/invoices/invoice-action-modal'
import { MedicalHistorySectionWrapper } from '@/components/patients/medical-history-section-wrapper'
import { EditPatientModal } from '@/components/patients/edit-patient-modal'
import { TopographyPanel } from '@/components/consultations/topography-panel'
import { LowBackPainTree } from '@/components/consultations/low-back-pain-tree'
import { NeckPainTree } from '@/components/consultations/neck-pain-tree'
import { AnamnesisRecorder } from '@/components/consultations/anamnesis-recorder'
import { MarkdownField } from '@/components/ui/markdown-field'
import { MarkdownText } from '@/components/ui/markdown-text'
import { ExercisePrescriptionDialog } from '@/components/exercises/exercise-prescription-dialog'
import { AiExerciseGenerationDialog } from '@/components/exercises/ai-exercise-generation-dialog'
import { PatientPrescriptionsListDialog } from '@/components/exercises/patient-prescriptions-list-dialog'
import { TestsSuggestionsPanel } from '@/components/consultations/tests-suggestions-panel'
import { OrthoTestsPickerDialog } from '@/components/consultations/ortho-tests-picker-dialog'
import { AtMentionDropdown } from '@/components/consultations/at-mention-dropdown'
import type { Patient, Consultation, Practitioner, SessionType, MedicalHistoryEntry, ConsultationAttachment, MedicalHistoryType } from '@/types/database'

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
  const [followUpDays, setFollowUpDays] = useState<number>((practitioner as any).follow_up_delay_days ?? 7)
  const [contactEmail, setContactEmail] = useState(currentPatient.email || '')
  const [medicalHistoryRefreshKey, setMedicalHistoryRefreshKey] = useState(0)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<ConsultationAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState('consultation')
  const router = useRouter()
  const { toast } = useToast()
  const db = createClient()
  const paymentsRef = useRef(payments)
  const submittedRef = useRef(false)
  const [showTopography, setShowTopography] = useState(false)
  const [showDiagnosticSelector, setShowDiagnosticSelector] = useState(false)
  const [showDecisionTree, setShowDecisionTree] = useState(false)
  const [showNeckTree, setShowNeckTree] = useState(false)
  const [showExercises, setShowExercises] = useState(false)
  const [showAiExercises, setShowAiExercises] = useState(false)
  const [showPrescriptionsList, setShowPrescriptionsList] = useState(false)
  const [prescriptionsRefreshKey, setPrescriptionsRefreshKey] = useState(0)
  const [showTestsSuggestions, setShowTestsSuggestions] = useState(false)
  const [showOrthoTestsPicker, setShowOrthoTestsPicker] = useState(false)
  const [orthoPickerRegionFilter, setOrthoPickerRegionFilter] = useState<string | undefined>(undefined)
  const [techMentionRegion, setTechMentionRegion] = useState<string | null>(null)
  const [techItems, setTechItems] = useState<{ id: string; name: string; region: string | null; description: string | null; use_count: number }[]>([])
  // @ec inline dropdown
  const [ecMentionRegion, setEcMentionRegion] = useState<string | null>(null)
  const [orthoTests, setOrthoTests] = useState<{ id: string; name: string; region: string | null; indications: string | null }[]>([])
  const examinationRef = useRef<HTMLTextAreaElement | null>(null)

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
    getValues,
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

  useEffect(() => { paymentsRef.current = payments }, [payments])

  // Exposé via ref pour être appelé immédiatement depuis onApply (sans debounce)
  const saveDraftNow = useCallback(() => {
    if (mode !== 'create' || submittedRef.current) return
    const values = getValues()
    fetch('/api/consultation/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, payments: paymentsRef.current }),
    }).catch(() => {})
  }, [mode, getValues])

  // Auto-save draft every 30s + restore on unlock (create mode only)
  useEffect(() => {
    if (mode !== 'create') return

    const saveDraft = () => {
      if (submittedRef.current) return
      const values = getValues()
      fetch('/api/consultation/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, payments: paymentsRef.current }),
      }).catch(() => {})
    }

    window.addEventListener('myosteoflow:before-lock', saveDraft)

    // Restauration — via clic "Reprendre" sur le banner OU automatiquement
    // si un brouillon pour ce patient existe (ex: app rechargée après veille).
    const shouldRestore = sessionStorage.getItem('restore_consultation_draft')
    const restoreFromDraft = (auto = false) => {
      fetch('/api/consultation/draft')
        .then((r) => r.json())
        .then(({ draft }) => {
          if (!draft) return
          if (draft.patient_id !== currentPatient.id) return
          if (draft.reason) setValue('reason', draft.reason)
          if (draft.anamnesis) setValue('anamnesis', draft.anamnesis)
          if (draft.examination) setValue('examination', draft.examination)
          if (draft.advice) setValue('advice', draft.advice)
          if (draft.date_time) setValue('date_time', draft.date_time)
          if (draft.payments) setPayments(draft.payments)
          if (!auto) toast({ title: 'Brouillon restauré', description: 'La consultation a été restaurée depuis votre dernière session.' })
        })
        .catch(() => {})
    }

    if (shouldRestore) {
      sessionStorage.removeItem('restore_consultation_draft')
      restoreFromDraft(false)
    } else {
      // Restauration automatique silencieuse si un brouillon existe pour ce patient
      restoreFromDraft(true)
    }

    const interval = setInterval(saveDraft, 30 * 1000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('myosteoflow:before-lock', saveDraft)
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sauvegarde debouncée 3s après chaque modification du formulaire
  useEffect(() => {
    if (mode !== 'create') return
    let timer: ReturnType<typeof setTimeout>
    const subscription = watch(() => {
      clearTimeout(timer)
      if (submittedRef.current) return
      timer = setTimeout(() => {
        const values = getValues()
        fetch('/api/consultation/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, payments: paymentsRef.current }),
        }).catch(() => {})
      }, 3000)
    })
    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

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
    e.target.value = ''
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

        if (pendingFiles.length > 0 && newConsultation) {
          await uploadAttachments(newConsultation.id)
        }

        let invoiceId: string | null = null
        let invoiceNumber: string | null = null

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

            await db
              .from('practitioners')
              .update({ invoice_next_number: practitioner.invoice_next_number + 1 })
              .eq('id', practitioner.id)
          }
        }

        if (data.follow_up_7d && newConsultation) {
          const scheduledFor = new Date(data.date_time)
          scheduledFor.setDate(scheduledFor.getDate() + followUpDays)

          await db.from('scheduled_tasks').insert({
            practitioner_id: practitioner.id,
            type: 'follow_up_email',
            consultation_id: newConsultation.id,
            scheduled_for: scheduledFor.toISOString(),
          })
        }

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

        submittedRef.current = true
        try {
          await fetch('/api/consultation/draft', { method: 'DELETE' })
        } catch {}

        if (invoiceId && invoiceNumber) {
          setCreatedInvoice({
            id: invoiceId,
            invoice_number: invoiceNumber,
          })
          setShowInvoiceModal(true)
          setIsLoading(false)
          return
        }

        toast({
          variant: 'success',
          title: 'Consultation créée',
          description: 'La consultation a été créée',
        })

        router.push(`/patients/${currentPatient.id}`)
      } else if (consultation) {
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

  const reason = watch('reason')
  const anamnesis = watch('anamnesis')
  const examination = watch('examination')
  const advice = watch('advice')
  const consultationFilled = !!(reason && (anamnesis || examination || advice))

  // Auto-resize textareas when values are set programmatically (e.g. via decision tree)
  useEffect(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea[data-autoresize]')
    textareas.forEach((ta) => {
      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight}px`
    })
  }, [anamnesis, examination, advice])
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

        <TabsContent value="consultation" forceMount className="data-[state=inactive]:hidden data-[state=active]:animate-fade-in mt-4 space-y-6">
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

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Contenu clinique</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50"
                    onClick={() => setShowTopography(true)}
                  >
                    <MapPin className="h-4 w-4" />
                    Topographie
                  </Button>
                  {/* AI suggest-tests button — temporarily hidden in favour of manual picker
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                    onClick={() => setShowTestsSuggestions(true)}
                  >
                    <Stethoscope className="h-4 w-4" />
                    Tests orthos
                  </Button>
                  */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
                    onClick={() => setShowExercises(true)}
                  >
                    <Dumbbell className="h-4 w-4" />
                    Exercices
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 hover:text-fuchsia-800 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/50"
                    onClick={() => setShowAiExercises(true)}
                  >
                    <Sparkles className="h-4 w-4" />
                    Exercices par IA
                  </Button>
                </div>
              </div>
              <CardDescription>Anamnèse, examen et conseils</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnamnesisRecorder
                onApply={(data) => {
                  if (data.reason) setValue('reason', data.reason, { shouldDirty: true })
                  if (data.anamnesis) setValue('anamnesis', data.anamnesis, { shouldDirty: true })
                  // Sauvegarde immédiate — sans attendre le debounce de 3s
                  // car l'utilisateur peut mettre l'ordi en veille juste après.
                  setTimeout(saveDraftNow, 0)
                }}
                disabled={isLoading}
                patientContext={{
                  profession: currentPatient.profession,
                  sport_activity: currentPatient.sport_activity,
                  primary_physician: currentPatient.primary_physician,
                  pregnancy_due_date: currentPatient.pregnancy_due_date,
                }}
                onPatientFieldsDetected={async (fields) => {
                  try {
                    // Flat patient fields (replace)
                    const patientUpdates: Pick<Patient, 'profession' | 'sport_activity' | 'primary_physician' | 'pregnancy_due_date'> = {
                      profession: currentPatient.profession,
                      sport_activity: currentPatient.sport_activity,
                      primary_physician: currentPatient.primary_physician,
                      pregnancy_due_date: currentPatient.pregnancy_due_date,
                    }
                    let hasPatientUpdate = false
                    if (fields.profession !== undefined) { patientUpdates.profession = fields.profession; hasPatientUpdate = true }
                    if (fields.sport_activity !== undefined) { patientUpdates.sport_activity = fields.sport_activity; hasPatientUpdate = true }
                    if (fields.primary_physician !== undefined) { patientUpdates.primary_physician = fields.primary_physician; hasPatientUpdate = true }
                    if (fields.pregnancy_due_date !== undefined) { patientUpdates.pregnancy_due_date = fields.pregnancy_due_date; hasPatientUpdate = true }
                    if (hasPatientUpdate) {
                      await db.from('patients').update(patientUpdates).eq('id', currentPatient.id)
                      setCurrentPatient((prev) => ({ ...prev, ...patientUpdates }))
                    }

                    // History fields → insert into medical_history_entries
                    const historyMap: { field: keyof typeof fields; type: MedicalHistoryType }[] = [
                      { field: 'surgical_history', type: 'surgical' },
                      { field: 'trauma_history', type: 'traumatic' },
                      { field: 'medical_history', type: 'medical' },
                      { field: 'family_history', type: 'family' },
                    ]
                    let historyInserted = false
                    for (const { field, type } of historyMap) {
                      const value = fields[field]
                      if (value !== undefined) {
                        const { error } = await db.from('medical_history_entries').insert({
                          patient_id: currentPatient.id,
                          history_type: type,
                          description: value,
                          onset_date: null,
                          onset_age: null,
                          onset_duration_value: null,
                          onset_duration_unit: null,
                          is_vigilance: false,
                          note: null,
                        })
                        if (error) throw new Error(error.message)
                        historyInserted = true
                      }
                    }
                    if (historyInserted) setMedicalHistoryRefreshKey((k) => k + 1)

                    toast({ title: 'Dossier patient mis à jour', variant: 'success' })
                  } catch {
                    toast({ title: 'Erreur lors de la mise à jour', variant: 'destructive' })
                  }
                }}
              />
              <div className="space-y-2">
                <Label htmlFor="anamnesis">Anamnèse</Label>
                <MarkdownField
                  id="anamnesis"
                  value={anamnesis || ''}
                  onChange={(val) => setValue('anamnesis', val, { shouldDirty: true })}
                  disabled={isLoading}
                  placeholder="Histoire de la maladie, circonstances d'apparition, évolution..."
                  rows={4}
                />
                {errors.anamnesis && (
                  <p className="text-sm text-destructive">{errors.anamnesis.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="examination">Examen clinique et traitement</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                    onClick={() => setShowOrthoTestsPicker(true)}
                  >
                    <Stethoscope className="h-4 w-4" />
                    Tests orthos
                  </Button>
                </div>
                <Textarea
                  id="examination"
                  data-autoresize
                  {...(() => {
                    const { ref: registerRef, onChange: registerOnChange, ...rest } = register('examination')
                    return {
                      ...rest,
                      ref: (el: HTMLTextAreaElement | null) => {
                        registerRef(el)
                        examinationRef.current = el
                      },
                      onChange: async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        await registerOnChange(e)
                        const val = e.target.value
                        const ecMatch = val.match(/@ec([a-zA-ZÀ-ÿ]*)$/)
                        if (ecMatch) {
                          if (orthoTests.length === 0) {
                            try {
                              const res = await fetch('/api/ortho-tests')
                              const json = await res.json()
                              setOrthoTests(json?.tests || [])
                            } catch { /* silent */ }
                          }
                          setEcMentionRegion(ecMatch[1])
                          return
                        }
                        if (ecMentionRegion !== null) setEcMentionRegion(null)
                        const techMatch = val.match(/@tech([a-zA-ZÀ-ÿ]*)$/)
                        if (techMatch) {
                          if (techItems.length === 0) {
                            try {
                              const { createClient: cc } = await import('@/lib/db/client')
                              const db = cc()
                              const { data } = await db
                                .from('custom_clinical_content')
                                .select('id, name, region, description, use_count')
                                .eq('content_type', 'technique')
                                .order('use_count', { ascending: false })
                              setTechItems(data || [])
                            } catch { /* silent */ }
                          }
                          setTechMentionRegion(techMatch[1])
                          return
                        }
                        if (techMentionRegion !== null) setTechMentionRegion(null)
                      },
                    }
                  })()}
                  onInput={autoResize}
                  disabled={isLoading}
                  placeholder="Tests effectués, dysfonctions trouvées... (@ec<région> pour tests ortho, @tech<région> pour vos techniques)"
                  rows={4}
                  className="min-h-[100px] resize-none overflow-hidden transition-[height] duration-200"
                />
                {ecMentionRegion !== null && (
                  <AtMentionDropdown
                    items={orthoTests}
                    regionQuery={ecMentionRegion}
                    anchorRef={examinationRef as React.RefObject<HTMLTextAreaElement>}
                    showResultPicker={true}
                    onSelect={(text) => {
                      const current = watch('examination') || ''
                      const cleaned = current.replace(/@ec[a-zA-ZÀ-ÿ]*$/, '')
                      setValue('examination', cleaned ? `${cleaned}\n${text}` : text, { shouldDirty: true })
                      setEcMentionRegion(null)
                    }}
                    onClose={() => {
                      const current = watch('examination') || ''
                      setValue('examination', current.replace(/@ec[a-zA-ZÀ-ÿ]*$/, ''), { shouldDirty: true })
                      setEcMentionRegion(null)
                    }}
                  />
                )}
                {techMentionRegion !== null && (
                  <AtMentionDropdown
                    items={techItems}
                    regionQuery={techMentionRegion}
                    anchorRef={examinationRef as React.RefObject<HTMLTextAreaElement>}
                    showResultPicker={false}
                    onSelect={(text) => {
                      const current = watch('examination') || ''
                      const cleaned = current.replace(/@tech[a-zA-ZÀ-ÿ]*$/, '')
                      const match = techItems.find(t => t.name === text)
                      if (match) {
                        import('@/lib/db/client').then(({ createClient: cc }) => {
                          cc().from('custom_clinical_content').update({ use_count: (match.use_count || 0) + 1 }).eq('id', match.id)
                        })
                        setTechItems(prev => prev.map(t => t.id === match.id ? { ...t, use_count: (t.use_count || 0) + 1 } : t))
                      }
                      setValue('examination', cleaned ? `${cleaned}\n${text}` : text, { shouldDirty: true })
                      setTechMentionRegion(null)
                    }}
                    onClose={() => {
                      const current = watch('examination') || ''
                      setValue('examination', current.replace(/@tech[a-zA-ZÀ-ÿ]*$/, ''), { shouldDirty: true })
                      setTechMentionRegion(null)
                    }}
                  />
                )}
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

        <TabsContent value="suivi-facturation" forceMount className="data-[state=inactive]:hidden data-[state=active]:animate-fade-in mt-4 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Suivi</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center flex-wrap gap-x-2 gap-y-2">
                <Checkbox
                  id="follow_up_7d"
                  checked={followUp7d}
                  onCheckedChange={(checked) => setValue('follow_up_7d', !!checked)}
                  disabled={isLoading}
                />
                <Label htmlFor="follow_up_7d" className="cursor-pointer">
                  Demander des nouvelles à J+
                </Label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isLoading || !followUp7d}
                  className="w-16 h-7 rounded-md border border-input bg-background px-2 text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-muted-foreground">jours (email automatique)</span>
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

                    {sessionTypes.length > 0 && (
                      <div className="space-y-2">
                        <Label>Type de séance</Label>
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
                          Affiché sur la facture à la place du motif.
                        </p>
                      </div>
                    )}

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

                      <div className="flex justify-between items-center p-3 glass-inner">
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
          <Button key="next-tab" type="button" onClick={(e) => { e.preventDefault(); setActiveTab('suivi-facturation') }} className="gap-2">
            Passer au suivi et à la facturation
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button key="submit" type="submit" disabled={isLoading} className="gap-2">
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
      <EditPatientModal
        open={showEditPatient}
        onOpenChange={setShowEditPatient}
        patient={currentPatient}
        onUpdated={(updatedPatient) => {
          setCurrentPatient(updatedPatient)
          setContactEmail(updatedPatient.email || '')
        }}
      />
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
      <TopographyPanel open={showTopography} onClose={() => setShowTopography(false)} />

      <OrthoTestsPickerDialog
        open={showOrthoTestsPicker}
        onClose={() => { setShowOrthoTestsPicker(false); setOrthoPickerRegionFilter(undefined) }}
        initialRegion={orthoPickerRegionFilter}
        onInject={(text) => {
          const current = watch('examination') || ''
          const next = current ? `${current}\n${text}` : text
          setValue('examination', next, { shouldDirty: true })
        }}
      />
      <Dialog open={showTestsSuggestions} onOpenChange={setShowTestsSuggestions}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tests orthopédiques suggérés</DialogTitle>
            <DialogDescription>
              Analyse de l&apos;anamnèse par IA — tests issus de la base OsteoUpgrade (clusters inclus)
            </DialogDescription>
          </DialogHeader>
          {anamnesis?.trim() ? (
            <TestsSuggestionsPanel anamnesis={anamnesis} reason={reason} autoAnalyze />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Renseignez l&apos;anamnèse pour obtenir des suggestions de tests.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={showDiagnosticSelector} onOpenChange={setShowDiagnosticSelector}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Aide au diagnostic</DialogTitle>
            <DialogDescription>Choisissez la région à analyser</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={() => { setShowDiagnosticSelector(false); setShowDecisionTree(true) }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium"
            >
              <span className="text-2xl">🦴</span>
              Lombalgie
            </button>
            <button
              onClick={() => { setShowDiagnosticSelector(false); setShowNeckTree(true) }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium"
            >
              <span className="text-2xl">🫀</span>
              Cervicalgie
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <LowBackPainTree
        open={showDecisionTree}
        onClose={() => setShowDecisionTree(false)}
        onApply={(summary, examination, advice) => {
          const current = getValues('anamnesis') || ''
          const separator = current.trim() ? '\n\n' : ''
          setValue('anamnesis', current + separator + summary, { shouldDirty: true })
          if (examination) {
            const currentExam = getValues('examination') || ''
            const examSep = currentExam.trim() ? '\n\n' : ''
            setValue('examination', currentExam + examSep + examination, { shouldDirty: true })
          }
          if (advice) {
            const currentAdvice = getValues('advice') || ''
            const adviceSep = currentAdvice.trim() ? '\n\n' : ''
            setValue('advice', currentAdvice + adviceSep + advice, { shouldDirty: true })
          }
        }}
      />
      <NeckPainTree
        open={showNeckTree}
        onClose={() => setShowNeckTree(false)}
        onApply={(summary, examination, advice) => {
          const current = getValues('anamnesis') || ''
          const separator = current.trim() ? '\n\n' : ''
          setValue('anamnesis', current + separator + summary, { shouldDirty: true })
          if (examination) {
            const currentExam = getValues('examination') || ''
            const examSep = currentExam.trim() ? '\n\n' : ''
            setValue('examination', currentExam + examSep + examination, { shouldDirty: true })
          }
          if (advice) {
            const currentAdvice = getValues('advice') || ''
            const adviceSep = currentAdvice.trim() ? '\n\n' : ''
            setValue('advice', currentAdvice + adviceSep + advice, { shouldDirty: true })
          }
        }}
      />
      <ExercisePrescriptionDialog
        open={showExercises}
        onClose={() => setShowExercises(false)}
        patientId={currentPatient.id}
        patientName={`${currentPatient.first_name} ${currentPatient.last_name}`}
        consultationId={consultation?.id}
        onSaved={() => setPrescriptionsRefreshKey((k) => k + 1)}
      />
      <PatientPrescriptionsListDialog
        open={showPrescriptionsList}
        onClose={() => setShowPrescriptionsList(false)}
        patientId={currentPatient.id}
        patientName={`${currentPatient.first_name} ${currentPatient.last_name}`}
        consultationId={consultation?.id}
        refreshKey={prescriptionsRefreshKey}
      />
      <AiExerciseGenerationDialog
        open={showAiExercises}
        onClose={() => setShowAiExercises(false)}
        patientId={currentPatient.id}
        patientName={`${currentPatient.first_name} ${currentPatient.last_name}`}
        consultationId={consultation?.id}
        consultationData={{ reason, anamnesis, examination }}
        onSaved={() => setPrescriptionsRefreshKey((k) => k + 1)}
      />
    </>
  )

  if (medicalHistoryEntries) {
    return (
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="lg:sticky lg:top-6 self-start space-y-6">
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
                <p className="text-muted-foreground">{formatDate(currentPatient.birth_date)} · {calculateAge(currentPatient.birth_date)} ans</p>
              )}
              {currentPatient.phone && <p className="text-muted-foreground">{currentPatient.phone}</p>}
              {currentPatient.email && <p className="text-muted-foreground">{currentPatient.email}</p>}
              {currentPatient.profession && <p className="text-muted-foreground">{currentPatient.profession}</p>}
              {currentPatient.pregnancy_due_date && (
                <p className="text-pink-600 font-medium">
                  Grossesse — terme : {new Date(currentPatient.pregnancy_due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
              {currentPatient.notes && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-xs font-medium text-amber-800 mb-1">Notes</p>
                  <p className="text-xs text-amber-900 whitespace-pre-wrap">{currentPatient.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <MedicalHistorySectionWrapper
            patientId={currentPatient.id}
            initialEntries={medicalHistoryEntries}
            refreshTrigger={medicalHistoryRefreshKey}
          />

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
            onClick={() => setShowPrescriptionsList(true)}
          >
            <Dumbbell className="h-4 w-4" />
            Fiches exercices du patient
          </Button>

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
                        <MarkdownText text={viewingConsultation.anamnesis} />
                      </div>
                    )}
                    {viewingConsultation.examination && (
                      <div>
                        <Separator />
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1 mt-3">
                          Examen clinique et traitement
                        </h4>
                        <MarkdownText text={viewingConsultation.examination} />
                      </div>
                    )}
                    {viewingConsultation.advice && (
                      <div>
                        <Separator />
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1 mt-3">
                          Conseils donnés
                        </h4>
                        <MarkdownText text={viewingConsultation.advice} />
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
