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
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2, Stethoscope, CreditCard, CalendarCheck, Clock, Eye, Pencil, Paperclip, Upload, FileText, Image, X, MapPin, GitBranch, Dumbbell, Sparkles, Brain, Activity, Lightbulb, Mail, Printer, Download, ArrowLeft, ArrowRight, CalendarClock, HeartPulse } from 'lucide-react'
import { generateInvoiceNumber, formatDateTime, formatDate, calculateAge, cn } from '@/lib/utils'
import { paymentMethodLabels } from '@/lib/validations/invoice'
import { MedicalHistorySectionWrapper } from '@/components/patients/medical-history-section-wrapper'
import { EditPatientModal } from '@/components/patients/edit-patient-modal'
import { TopographyPanel } from '@/components/consultations/topography-panel'
import { LowBackPainTree } from '@/components/consultations/low-back-pain-tree'
import { NeckPainTree } from '@/components/consultations/neck-pain-tree'
import { AnamnesisRecorder, type AnamnesisSection } from '@/components/consultations/anamnesis-recorder'
import { AnamnesisCards } from '@/components/consultations/anamnesis-cards'
import { AnamnesisDisplay } from '@/components/consultations/anamnesis-display'
import { HypothesesDisplay } from '@/components/consultations/hypotheses-display'
import { sectionsToMarkdown } from '@/lib/anamnesis'
import { HypothesesCard, type HypothesesState } from '@/components/consultations/hypotheses-card'
import type { HypothesesPayload } from '@/lib/hypotheses'
import { MarkdownField } from '@/components/ui/markdown-field'
import { MarkdownText } from '@/components/ui/markdown-text'
import { ExercisePrescriptionDialog } from '@/components/exercises/exercise-prescription-dialog'
import { AiExerciseGenerationDialog } from '@/components/exercises/ai-exercise-generation-dialog'
import { PatientPrescriptionsListDialog } from '@/components/exercises/patient-prescriptions-list-dialog'
import { TestsSuggestionsPanel } from '@/components/consultations/tests-suggestions-panel'
import { OrthoTestsPickerDialog } from '@/components/consultations/ortho-tests-picker-dialog'
import { AtMentionDropdown } from '@/components/consultations/at-mention-dropdown'
import {
  POST_SESSION_ADVICE_OPTIONS,
  ADVICE_CATEGORY_LABELS,
  DEFAULT_ADVICE_IDS,
  type AdviceCategory,
} from '@/lib/consultations/post-session-advice-options'
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

/** Initiales du patient pour l'avatar (ex. « Jean Dupont » → « JD »). */
function getInitials(firstName?: string | null, lastName?: string | null): string {
  const a = (firstName || '').trim().charAt(0)
  const b = (lastName || '').trim().charAt(0)
  return (b + a || a || b || '?').toUpperCase()
}

/** Pastille d'icône colorée + titre, pour rendre les sections scannables d'un coup d'œil. */
function SectionHeading({
  icon: Icon,
  title,
  tone,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  tone: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      </div>
      {action}
    </div>
  )
}

const SECTION_TONES = {
  anamnese: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  hypotheses: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
  examen: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  conseils: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
  clinique: 'bg-primary/10 text-primary',
} as const

/** Teinte bleutée + relief pour les cartes de la page (contraste avec le fond). */
const CARD_TINT = 'border-blue-100/80 shadow-[0_6px_20px_-10px_rgba(37,99,235,0.22)] dark:border-blue-900/40'

/** Encart bleuté pour les sous-sections, afin de créer du relief dans une carte. */
const ENCART = 'rounded-xl border border-blue-100/80 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20'

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
  const [sendPostSessionAdvice, setSendPostSessionAdvice] = useState(false)
  const [selectedAdviceIds, setSelectedAdviceIds] = useState<string[]>(DEFAULT_ADVICE_IDS)
  const [followUpDays, setFollowUpDays] = useState<number>((practitioner as any).follow_up_delay_days ?? 7)
  const [contactEmail, setContactEmail] = useState(currentPatient.email || '')
  const [medicalHistoryRefreshKey, setMedicalHistoryRefreshKey] = useState(0)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<ConsultationAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
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
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  // "Finaliser la consultation" wizard (create mode only) — one deliberate
  // step at a time so nothing gets skipped: facturation, envoi de la
  // facture, conseils post-séance, suivi J+X, relance à venir.
  const [finalizeStepId, setFinalizeStepId] = useState<
    'invoice' | 'delivery' | 'advice' | 'followup' | 'relaunch'
  >('invoice')
  const [invoiceDeliveryChoice, setInvoiceDeliveryChoice] = useState<
    'email' | 'print' | 'download' | 'skip'
  >('email')
  // undefined = practitioner hasn't touched this step (leave any existing
  // schedule untouched) ; null = explicitly "no relaunch" (clears it) ;
  // 3/6/12 = schedule a relaunch that many months out.
  const [scheduledRelaunchMonths, setScheduledRelaunchMonths] = useState<number | null | undefined>(undefined)
  const [anamnesisCardSections, setAnamnesisCardSections] = useState<AnamnesisSection[] | null>(() => {
    if (consultation?.anamnesis_sections) {
      try {
        const parsed = JSON.parse(consultation.anamnesis_sections)
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
      } catch { return null }
    }
    return null
  })
  const [anamnesisCardReason, setAnamnesisCardReason] = useState<string | undefined>(consultation?.reason || undefined)
  const anamnesisCardSectionsRef = useRef(anamnesisCardSections)
  // Carte « Hypothèses cliniques » — persistée avec la consultation (payload IA + réponses).
  const initialHypotheses = (() => {
    if (!consultation?.clinical_hypotheses) return { payload: null as HypothesesPayload | null, state: undefined as HypothesesState | undefined }
    try {
      const parsed = JSON.parse(consultation.clinical_hypotheses)
      return { payload: (parsed?.payload ?? null) as HypothesesPayload | null, state: parsed?.state as HypothesesState | undefined }
    } catch { return { payload: null as HypothesesPayload | null, state: undefined as HypothesesState | undefined } }
  })()
  const [hypotheses, setHypotheses] = useState<HypothesesPayload | null>(initialHypotheses.payload)
  const [hypothesesState, setHypothesesState] = useState<HypothesesState | undefined>(initialHypotheses.state)
  const hypothesesRef = useRef(hypotheses)
  const hypothesesStateRef = useRef(hypothesesState)
  const [hypothesesLoading, setHypothesesLoading] = useState(false)
  const [hypothesesError, setHypothesesError] = useState<string | null>(null)
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
      document.getElementById('sec-infos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  useEffect(() => { anamnesisCardSectionsRef.current = anamnesisCardSections }, [anamnesisCardSections])
  useEffect(() => { hypothesesRef.current = hypotheses }, [hypotheses])
  useEffect(() => { hypothesesStateRef.current = hypothesesState }, [hypothesesState])

  // Reset the finalize wizard to its first step each time it opens, and
  // default the invoice delivery choice to whatever this patient chose last
  // time (falls back to email if they have one, print otherwise).
  useEffect(() => {
    if (showFinalizeModal) {
      setFinalizeStepId('invoice')
      const remembered = (currentPatient as unknown as { preferred_invoice_delivery?: string | null }).preferred_invoice_delivery
      setInvoiceDeliveryChoice(
        (remembered as 'email' | 'print' | 'download' | 'skip' | undefined) || (currentPatient.email ? 'email' : 'print')
      )
      setScheduledRelaunchMonths(undefined)
      setSelectedAdviceIds(DEFAULT_ADVICE_IDS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFinalizeModal])

  // Exposé via ref pour être appelé immédiatement depuis onApply (sans debounce)
  const saveDraftNow = useCallback(() => {
    if (mode !== 'create' || submittedRef.current) return
    const values = getValues()
    fetch('/api/consultation/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, payments: paymentsRef.current, anamnesis_sections: anamnesisCardSectionsRef.current ? JSON.stringify(anamnesisCardSectionsRef.current) : undefined, clinical_hypotheses: hypothesesRef.current ? JSON.stringify({ payload: hypothesesRef.current, state: hypothesesStateRef.current }) : undefined }),
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
        body: JSON.stringify({ ...values, payments: paymentsRef.current, anamnesis_sections: anamnesisCardSectionsRef.current ? JSON.stringify(anamnesisCardSectionsRef.current) : undefined, clinical_hypotheses: hypothesesRef.current ? JSON.stringify({ payload: hypothesesRef.current, state: hypothesesStateRef.current }) : undefined }),
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
          if (draft.anamnesis_sections) {
            try {
              const sections = JSON.parse(draft.anamnesis_sections)
              if (Array.isArray(sections) && sections.length > 0) {
                setAnamnesisCardSections(sections)
                if (draft.reason) setAnamnesisCardReason(draft.reason)
              }
            } catch { /* ignore malformed sections */ }
          }
          if (draft.clinical_hypotheses) {
            try {
              const parsed = JSON.parse(draft.clinical_hypotheses)
              if (parsed?.payload) {
                setHypotheses(parsed.payload as HypothesesPayload)
                setHypothesesState(parsed.state as HypothesesState | undefined)
              }
            } catch { /* ignore malformed hypotheses */ }
          }
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
        // Re-vérifie au moment du déclenchement : si la consultation vient
        // d'être validée, ce save tardif recréerait le brouillon après sa
        // suppression (le brouillon « ressuscite » après validation).
        if (submittedRef.current) return
        const values = getValues()
        fetch('/api/consultation/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, payments: paymentsRef.current, anamnesis_sections: anamnesisCardSectionsRef.current ? JSON.stringify(anamnesisCardSectionsRef.current) : undefined, clinical_hypotheses: hypothesesRef.current ? JSON.stringify({ payload: hypothesesRef.current, state: hypothesesStateRef.current }) : undefined }),
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
            anamnesis_sections: anamnesisCardSections ? JSON.stringify(anamnesisCardSections) : null,
            clinical_hypotheses: hypotheses ? JSON.stringify({ payload: hypotheses, state: hypothesesState }) : null,
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
              body: JSON.stringify({ consultationId: newConsultation.id, adviceIds: selectedAdviceIds }),
            })
          } catch (e) {
            console.error('Error sending post-session advice:', e)
          }
        }

        // Persist wizard choices for next time: how this patient likes to
        // receive their invoice, and whether a future relaunch was scheduled.
        const patientUpdates: Record<string, unknown> = {}
        if (invoiceId) {
          patientUpdates.preferred_invoice_delivery = invoiceDeliveryChoice
        }
        if (scheduledRelaunchMonths !== undefined) {
          if (scheduledRelaunchMonths === null) {
            patientUpdates.next_relaunch_due_at = null
            patientUpdates.next_relaunch_months = null
          } else {
            const dueDate = new Date(data.date_time)
            dueDate.setMonth(dueDate.getMonth() + scheduledRelaunchMonths)
            patientUpdates.next_relaunch_due_at = dueDate.toISOString()
            patientUpdates.next_relaunch_months = scheduledRelaunchMonths
          }
        } else if (newConsultation) {
          // The practitioner didn't touch the "Relance à venir" step for this
          // new consultation — any relaunch scheduled from a previous visit
          // is now stale (the patient just came back on their own) and must
          // not keep counting down to send an unwanted "come back" email.
          patientUpdates.next_relaunch_due_at = null
          patientUpdates.next_relaunch_months = null
        }
        if (Object.keys(patientUpdates).length > 0) {
          await db.from('patients').update(patientUpdates).eq('id', currentPatient.id)
        }

        submittedRef.current = true
        try {
          await fetch('/api/consultation/draft', { method: 'DELETE' })
        } catch {}

        // The delivery method was already decided in the wizard (step
        // "Envoi de la facture") — act on it directly instead of asking again.
        if (invoiceId && invoiceNumber) {
          try {
            if (invoiceDeliveryChoice === 'email' && resolvedEmail) {
              const emailRes = await fetch('/api/emails/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId }),
              })
              if (!emailRes.ok) throw new Error('Échec de l\'envoi de la facture par email')
              toast({ variant: 'success', title: 'Facture envoyée', description: `Envoyée à ${resolvedEmail}` })
            } else if (invoiceDeliveryChoice === 'print') {
              window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')
              toast({ title: 'PDF ouvert', description: 'Utilisez Ctrl/Cmd + P pour imprimer' })
            } else if (invoiceDeliveryChoice === 'download') {
              const pdfResponse = await fetch(`/api/invoices/${invoiceId}/pdf`)
              const pdfBlob = await pdfResponse.blob()
              const blobUrl = URL.createObjectURL(pdfBlob)
              const link = document.createElement('a')
              link.href = blobUrl
              link.download = `facture_${invoiceNumber}.pdf`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              URL.revokeObjectURL(blobUrl)
              toast({ variant: 'success', title: 'Téléchargement terminé', description: `facture_${invoiceNumber}.pdf` })
            }
          } catch (deliveryError) {
            console.error('Error delivering invoice:', deliveryError)
            toast({
              variant: 'destructive',
              title: 'Facture non transmise',
              description: 'La consultation est enregistrée, mais l\'envoi de la facture a échoué. Vous pouvez réessayer depuis la fiche patient.',
            })
          }
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
            anamnesis_sections: anamnesisCardSections ? JSON.stringify(anamnesisCardSections) : null,
            clinical_hypotheses: hypotheses ? JSON.stringify({ payload: hypotheses, state: hypothesesState }) : null,
            examination: data.examination || null,
            advice: data.advice || null,
            follow_up_7d: data.follow_up_7d,
          })
          .eq('id', consultation.id)

        if (error) throw error

        // Réconcilier la tâche de suivi (créer / mettre à jour / annuler) lors d'une édition.
        // Sans ça, (ré)activer ou modifier le suivi sur une consultation enregistrée
        // ne programmait aucun email.
        await db
          .from('scheduled_tasks')
          .delete()
          .eq('consultation_id', consultation.id)
          .eq('type', 'follow_up_email')
          .eq('status', 'pending')

        if (data.follow_up_7d) {
          // Ne pas reprogrammer si un suivi a déjà été envoyé pour cette consultation
          const { data: alreadySent } = await db
            .from('scheduled_tasks')
            .select('id')
            .eq('consultation_id', consultation.id)
            .eq('type', 'follow_up_email')
            .eq('status', 'completed')

          if (!alreadySent || alreadySent.length === 0) {
            const scheduledFor = new Date(data.date_time)
            scheduledFor.setDate(scheduledFor.getDate() + followUpDays)
            await db.from('scheduled_tasks').insert({
              practitioner_id: practitioner.id,
              type: 'follow_up_email',
              consultation_id: consultation.id,
              scheduled_for: scheduledFor.toISOString(),
            })
          }
        }

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

  // Contexte patient transmis à l'IA (structuration + hypothèses) : démographie + ATCD.
  const computeAge = (birthDate?: string | null): number | null => {
    if (!birthDate) return null
    const b = new Date(birthDate)
    if (Number.isNaN(b.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - b.getFullYear()
    const m = now.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
    return age >= 0 && age < 130 ? age : null
  }
  const patientClinicalContext = {
    age: computeAge(currentPatient.birth_date),
    sex: currentPatient.gender === 'F' ? 'femme' : currentPatient.gender === 'M' ? 'homme' : null,
    profession: currentPatient.profession,
    sport_activity: currentPatient.sport_activity,
    primary_physician: currentPatient.primary_physician,
    pregnancy_due_date: currentPatient.pregnancy_due_date,
    surgical_history: currentPatient.surgical_history,
    trauma_history: currentPatient.trauma_history,
    medical_history: currentPatient.medical_history,
    family_history: currentPatient.family_history,
  }

  const generateHypotheses = async () => {
    if (!anamnesis?.trim()) return
    setHypothesesLoading(true)
    setHypothesesError(null)
    try {
      const res = await fetch('/api/ai/generate-hypotheses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anamnesis, reason, patientContext: patientClinicalContext }),
      })
      const data = await res.json()
      if (!res.ok) {
        setHypothesesError(data.error || 'Erreur lors de la génération.')
        return
      }
      if (!data.hypotheses || data.hypotheses.length === 0) {
        setHypothesesError('Aucune hypothèse générée.')
        return
      }
      setHypotheses(data as HypothesesPayload)
      setHypothesesState(undefined)
      // Persiste aussitôt dans le brouillon (survie à la veille).
      setTimeout(saveDraftNow, 0)
    } catch {
      setHypothesesError('Impossible de contacter le serveur.')
    } finally {
      setHypothesesLoading(false)
    }
  }

  // Auto-resize textareas when values are set programmatically (e.g. via decision tree)
  useEffect(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea[data-autoresize]')
    textareas.forEach((ta) => {
      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight}px`
    })
  }, [anamnesis, examination, advice])

  const attachmentsCard = (
    <Card className={CARD_TINT}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Pièces jointes</CardTitle>
        </div>
        <CardDescription>Comptes rendus, radios, ordonnances, etc.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onClick={() => document.getElementById('attachment-input')?.click()}
        >
          <Upload className="h-7 w-7 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Glissez-déposez ou <span className="text-primary underline">parcourir</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">PDF, images, documents (max 20 Mo)</p>
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
                <div key={att.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <a
                    href={`/api/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 min-w-0 flex-1 hover:underline"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate">{att.original_name}</span>
                    {att.file_size && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">{formatFileSize(att.file_size)}</span>
                    )}
                  </a>
                  <Button type="button" variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={() => handleDeleteAttachment(att.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Fichiers à envoyer ({pendingFiles.length})</p>
            {pendingFiles.map((file, index) => {
              const Icon = getFileIcon(file.name)
              return (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border border-dashed p-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatFileSize(file.size)}</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={() => removePendingFile(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )

  // Steps shown for a new consultation — "delivery" only applies when an
  // invoice is actually being created. Edit mode keeps the old single-screen
  // dialog (billing/relance aren't relevant when editing a past session).
  type FinalizeStep = 'invoice' | 'delivery' | 'advice' | 'followup' | 'relaunch'
  const wizardSteps: FinalizeStep[] =
    mode === 'create'
      ? ['invoice', ...(createInvoice ? (['delivery'] as const) : []), 'advice', 'followup', 'relaunch']
      : ['followup']
  const currentStepIndex = Math.max(0, wizardSteps.indexOf(finalizeStepId))
  const isFirstWizardStep = currentStepIndex === 0
  const isLastWizardStep = currentStepIndex === wizardSteps.length - 1
  const goToNextStep = () => {
    if (currentStepIndex < wizardSteps.length - 1) setFinalizeStepId(wizardSteps[currentStepIndex + 1])
  }
  const goToPrevStep = () => {
    if (currentStepIndex > 0) setFinalizeStepId(wizardSteps[currentStepIndex - 1])
  }
  const stepLabels: Record<string, string> = {
    invoice: 'Facturation',
    delivery: 'Envoi de la facture',
    advice: 'Conseils post-séance',
    followup: 'Suivi',
    relaunch: 'Relance à venir',
  }

  const finalizeModal = (
    <Dialog open={showFinalizeModal} onOpenChange={setShowFinalizeModal}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finaliser la consultation</DialogTitle>
          <DialogDescription>{stepLabels[finalizeStepId] || 'Suivi du patient et facturation avant l’enregistrement.'}</DialogDescription>
        </DialogHeader>

        {wizardSteps.length > 1 && (
          <div className="flex items-center gap-1.5">
            {wizardSteps.map((step, i) => (
              <div
                key={step}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i <= currentStepIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}

        <div className="space-y-6 min-h-[220px]">
          {shouldCollectEmail && (
            <div className="space-y-2 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
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

          {finalizeStepId === 'invoice' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Facturation</h3>
              </div>
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
                      <Button type="button" variant="outline" size="sm" onClick={addPayment}>
                        <Plus className="mr-1 h-4 w-4" />
                        Ajouter
                      </Button>
                    </div>

                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-end gap-2 p-3 border rounded-lg">
                        <div className="flex-1 space-y-2">
                          <Label>Montant</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={payment.amount}
                            onChange={(e) =>
                              updatePayment(payment.id, 'amount', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label>Mode</Label>
                          <Select
                            value={payment.method}
                            onValueChange={(value) => updatePayment(payment.id, 'method', value)}
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
                      <span className="text-lg font-bold">{totalPayments.toFixed(2)} €</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {finalizeStepId === 'delivery' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Envoi de la facture</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Comment le patient souhaite-t-il recevoir sa facture ?
              </p>
              <div className="grid gap-2">
                {(
                  [
                    { id: 'email', icon: Mail, title: 'Par email', description: effectiveEmail ? `Envoyer à ${effectiveEmail}` : 'Aucun email renseigné', disabled: !effectiveEmail },
                    { id: 'print', icon: Printer, title: 'Imprimer', description: 'Ouvrir le PDF pour impression', disabled: false },
                    { id: 'download', icon: Download, title: 'Télécharger', description: 'Télécharger le PDF sur cet ordinateur', disabled: false },
                    { id: 'skip', icon: X, title: 'Ne rien faire', description: 'Gérer la facture plus tard', disabled: false },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.disabled || isLoading}
                    onClick={() => setInvoiceDeliveryChoice(option.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                      invoiceDeliveryChoice === option.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/40',
                      option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      invoiceDeliveryChoice === option.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      <option.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{option.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Ce choix sera mémorisé pour ce patient et proposé par défaut la prochaine fois.
              </p>
            </div>
          )}

          {finalizeStepId === 'advice' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Conseils post-séance</h3>
              </div>
              <div className="flex items-center space-x-2">
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
              <p className="text-xs text-muted-foreground">
                Cochez les conseils adaptés à ce patient : ils formeront le contenu de l&apos;email envoyé immédiatement à son adresse.
              </p>
              {sendPostSessionAdvice && !effectiveEmail && (
                <p className="text-sm text-yellow-600">
                  Le patient n&apos;a pas d&apos;adresse email. L&apos;email ne pourra pas être envoyé.
                </p>
              )}
              {sendPostSessionAdvice && (
                <div className="space-y-4 rounded-lg border p-4">
                  {(['general', 'acute', 'chronic', 'redflags'] as AdviceCategory[]).map((category) => {
                    const items = POST_SESSION_ADVICE_OPTIONS.filter((o) => o.category === category)
                    return (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {ADVICE_CATEGORY_LABELS[category]}
                        </p>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-start space-x-2">
                              <Checkbox
                                id={`advice_${item.id}`}
                                checked={selectedAdviceIds.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedAdviceIds((prev) =>
                                    checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                                  )
                                }}
                                disabled={isLoading}
                                className="mt-0.5"
                              />
                              <Label htmlFor={`advice_${item.id}`} className="cursor-pointer font-normal leading-snug">
                                <span className="font-medium">{item.title}</span>
                                <span className="text-muted-foreground"> — {item.text}</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {finalizeStepId === 'followup' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Suivi</h3>
              </div>
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
                <p className="text-sm text-yellow-600">
                  Le patient n&apos;a pas d&apos;adresse email. L&apos;email de suivi ne pourra pas être envoyé.
                </p>
              )}
            </div>
          )}

          {finalizeStepId === 'relaunch' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Relance à venir</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Souhaitez-vous relancer {currentPatient.first_name} pour une consultation dans les mois à venir ?
                Il/elle apparaîtra automatiquement dans les relances patients à l&apos;échéance choisie.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[3, 6, 12].map((months) => (
                  <Button
                    key={months}
                    type="button"
                    variant={scheduledRelaunchMonths === months ? 'default' : 'outline'}
                    onClick={() => setScheduledRelaunchMonths(months)}
                    disabled={isLoading}
                  >
                    {months} mois
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={scheduledRelaunchMonths === null ? 'default' : 'outline'}
                  onClick={() => setScheduledRelaunchMonths(null)}
                  disabled={isLoading}
                  className="col-span-2 sm:col-span-1"
                >
                  Non
                </Button>
              </div>
              {!effectiveEmail && scheduledRelaunchMonths && (
                <p className="text-sm text-yellow-600">
                  Le patient n&apos;a pas d&apos;adresse email. La relance ne pourra pas être envoyée le moment venu.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFinalizeModal(false)}
            disabled={isLoading}
          >
            Continuer la consultation
          </Button>
          {!isFirstWizardStep && (
            <Button type="button" variant="outline" onClick={goToPrevStep} disabled={isLoading} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </Button>
          )}
          {!isLastWizardStep && (
            <Button type="button" onClick={goToNextStep} disabled={isLoading} className="gap-2">
              Suivant
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {isLastWizardStep && (
          <Button
            type="button"
            onClick={handleSubmit(onSubmit, () => {
              setShowFinalizeModal(false)
              toast({
                variant: 'destructive',
                title: 'Informations manquantes',
                description: 'Veuillez compléter les champs requis de la consultation avant de l’enregistrer.',
              })
            })}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-6">
      <div className="space-y-6">
          <Card className={CARD_TINT}>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:p-5">
              <div className="space-y-1.5">
                <Label htmlFor="date_time" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Date et heure *
                </Label>
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

              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Motif de consultation *
                </Label>
                <Input
                  id="reason"
                  className="font-medium"
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

          <Card className={CARD_TINT}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', SECTION_TONES.clinique)}>
                    <Stethoscope className="h-[18px] w-[18px]" />
                  </span>
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
                key={currentPatient.id}
                patientId={currentPatient.id}
                reason={reason}
                onHypothesesStart={() => {
                  setHypothesesLoading(true)
                  setHypothesesError(null)
                }}
                onHypothesesReady={(payload) => {
                  setHypothesesLoading(false)
                  if (payload) {
                    setHypotheses(payload as unknown as HypothesesPayload)
                    setHypothesesState(undefined)
                    // Sauvegarde immédiate — les hypothèses doivent survivre à une
                    // mise en veille qui surviendrait avant l'intervalle de 30s.
                    setTimeout(saveDraftNow, 0)
                  }
                }}
                onApply={(data) => {
                  if (data.reason) setValue('reason', data.reason, { shouldDirty: true })
                  if (data.sections && data.sections.length > 0) {
                    setAnamnesisCardSections(data.sections)
                    setAnamnesisCardReason(data.reason)
                    // Texte dérivé des cartes (source unique) pour lettres/exports/recherche.
                    setValue('anamnesis', sectionsToMarkdown(data.sections), { shouldDirty: true })
                  } else if (data.anamnesis) {
                    // Repli : ancien format / échec de structuration.
                    setValue('anamnesis', data.anamnesis, { shouldDirty: true })
                  }
                  // Sauvegarde immédiate — sans attendre le debounce de 3s
                  // car l'utilisateur peut mettre l'ordi en veille juste après.
                  setTimeout(saveDraftNow, 0)
                }}
                disabled={isLoading}
                patientContext={patientClinicalContext}
                onPatientFieldsDetected={async (fields) => {
                  const failedKeys: (keyof typeof fields)[] = []

                  // Flat patient fields (replace) — indépendant des antécédents ci-dessous.
                  const patientUpdates: Pick<Patient, 'profession' | 'sport_activity' | 'primary_physician' | 'pregnancy_due_date'> = {
                    profession: currentPatient.profession,
                    sport_activity: currentPatient.sport_activity,
                    primary_physician: currentPatient.primary_physician,
                    pregnancy_due_date: currentPatient.pregnancy_due_date,
                  }
                  const patientFieldKeys: (keyof typeof fields)[] = ['profession', 'sport_activity', 'primary_physician', 'pregnancy_due_date']
                  let hasPatientUpdate = false
                  for (const key of patientFieldKeys) {
                    if (fields[key] !== undefined) { (patientUpdates as Record<string, unknown>)[key] = fields[key]; hasPatientUpdate = true }
                  }
                  if (hasPatientUpdate) {
                    try {
                      await db.from('patients').update(patientUpdates).eq('id', currentPatient.id)
                      setCurrentPatient((prev) => ({ ...prev, ...patientUpdates }))
                    } catch {
                      failedKeys.push(...patientFieldKeys.filter((key) => fields[key] !== undefined))
                    }
                  }

                  // History fields → insert into medical_history_entries.
                  // Chaque antécédent est traité indépendamment : l'échec de l'un ne doit pas
                  // empêcher l'injection des suivants (sinon "Valider tout" s'arrête au premier échec).
                  const historyMap: { field: keyof typeof fields; type: MedicalHistoryType }[] = [
                    { field: 'surgical_history', type: 'surgical' },
                    { field: 'trauma_history', type: 'traumatic' },
                    { field: 'medical_history', type: 'medical' },
                    { field: 'family_history', type: 'family' },
                  ]
                  let historyInserted = false
                  for (const { field, type } of historyMap) {
                    const value = fields[field]
                    if (value === undefined) continue
                    try {
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
                    } catch {
                      failedKeys.push(field)
                    }
                  }
                  if (historyInserted) setMedicalHistoryRefreshKey((k) => k + 1)

                  if (failedKeys.length === 0) {
                    toast({ title: 'Dossier patient mis à jour', variant: 'success' })
                  } else {
                    toast({
                      title: failedKeys.length === Object.keys(fields).length
                        ? 'Erreur lors de la mise à jour'
                        : `Dossier mis à jour partiellement (${failedKeys.length} élément(s) en échec)`,
                      variant: 'destructive',
                    })
                  }
                  return failedKeys
                }}
              />
              <div id="sec-anamnese" className={cn('space-y-3 scroll-mt-24', ENCART)}>
                <SectionHeading icon={FileText} title="Anamnèse" tone={SECTION_TONES.anamnese} />
                {anamnesisCardSections ? (
                  <AnamnesisCards
                    reason={anamnesisCardReason}
                    sections={anamnesisCardSections}
                    disabled={isLoading}
                    onChange={(next) => {
                      setAnamnesisCardSections(next)
                      setValue('anamnesis', sectionsToMarkdown(next), { shouldDirty: true })
                    }}
                    onReasonChange={(r) => {
                      setAnamnesisCardReason(r)
                      setValue('reason', r, { shouldDirty: true })
                    }}
                    onEdit={() => {
                      // Filet de sécurité : repasse en texte libre en partant du
                      // contenu actuel des cartes.
                      setValue('anamnesis', sectionsToMarkdown(anamnesisCardSections), { shouldDirty: true })
                      setAnamnesisCardSections(null)
                    }}
                  />
                ) : (
                  <MarkdownField
                    id="anamnesis"
                    value={anamnesis || ''}
                    onChange={(val) => setValue('anamnesis', val, { shouldDirty: true })}
                    disabled={isLoading}
                    placeholder="Histoire de la maladie, circonstances d'apparition, évolution..."
                    rows={4}
                  />
                )}
                {errors.anamnesis && (
                  <p className="text-sm text-destructive">{errors.anamnesis.message}</p>
                )}
              </div>

              <div id="sec-hypotheses" className={cn('space-y-3 scroll-mt-24', ENCART)}>
                <SectionHeading icon={Brain} title="Hypothèses cliniques" tone={SECTION_TONES.hypotheses} />
                {!hypotheses && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateHypotheses}
                    disabled={!anamnesis?.trim() || hypothesesLoading || isLoading}
                    className="w-full gap-1.5 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
                  >
                    {hypothesesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                    Générer les hypothèses
                  </Button>
                )}
                {hypothesesError && (
                  <p className="text-sm text-destructive">{hypothesesError}</p>
                )}
                {hypotheses && (
                  <HypothesesCard
                    payload={hypotheses}
                    initialState={hypothesesState}
                    onStateChange={setHypothesesState}
                    onClose={() => { setHypotheses(null); setHypothesesState(undefined) }}
                  />
                )}
              </div>

              <div id="sec-examen" className={cn('space-y-3 scroll-mt-24', ENCART)}>
                <SectionHeading
                  icon={Activity}
                  title="Examen clinique et traitement"
                  tone={SECTION_TONES.examen}
                  action={
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
                  }
                />
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

              <div id="sec-conseils" className={cn('space-y-3 scroll-mt-24', ENCART)}>
                <SectionHeading icon={Lightbulb} title="Conseils donnés" tone={SECTION_TONES.conseils} />
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

      </div>

      <div className="sticky bottom-0 z-10 flex justify-end gap-4 pt-4 pb-2 -mx-1 px-1 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Annuler
        </Button>
        <Button
          key="finalize"
          type="button"
          onClick={() => setShowFinalizeModal(true)}
          disabled={isLoading}
          className="gap-2"
        >
          <CalendarCheck className="h-4 w-4" />
          Terminer la consultation
        </Button>
      </div>
    </form>
  )

  const modals = (
    <>
      {finalizeModal}
      <EditPatientModal
        open={showEditPatient}
        onOpenChange={setShowEditPatient}
        patient={currentPatient}
        onUpdated={(updatedPatient) => {
          setCurrentPatient(updatedPatient)
          setContactEmail(updatedPatient.email || '')
        }}
      />
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
          <Card className={cn('overflow-hidden', CARD_TINT)}>
            <div className="flex items-start gap-3 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-primary text-base font-semibold text-white shadow-sm">
                {getInitials(currentPatient.first_name, currentPatient.last_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{currentPatient.last_name} {currentPatient.first_name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[
                    currentPatient.gender ? (currentPatient.gender === 'M' ? 'Homme' : 'Femme') : null,
                    currentPatient.birth_date ? `${calculateAge(currentPatient.birth_date)} ans` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Patient'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setShowEditPatient(true)}
                aria-label="Modifier le patient"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <CardContent className="space-y-2.5 pt-4 text-sm">
              {(currentPatient.pregnancy_due_date || currentPatient.birth_date) && (
                <div className="flex flex-wrap gap-1.5">
                  {currentPatient.pregnancy_due_date && (
                    <span className="inline-flex items-center rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-950/50 dark:text-pink-300">
                      Grossesse · terme {new Date(currentPatient.pregnancy_due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                  {medicalHistoryEntries.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {medicalHistoryEntries.length} ATCD
                    </span>
                  )}
                </div>
              )}
              <dl className="space-y-1.5 text-muted-foreground">
                {currentPatient.birth_date && (
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span>{formatDate(currentPatient.birth_date)}</span>
                  </div>
                )}
                {currentPatient.profession && (
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{currentPatient.profession}</span>
                  </div>
                )}
                {currentPatient.sport_activity && (
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{currentPatient.sport_activity}</span>
                  </div>
                )}
                {currentPatient.primary_physician && (
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">Médecin traitant : {currentPatient.primary_physician}</span>
                  </div>
                )}
                {currentPatient.phone && (
                  <div className="flex items-center gap-2">
                    <span className="truncate">{currentPatient.phone}</span>
                  </div>
                )}
                {currentPatient.email && (
                  <div className="flex items-center gap-2">
                    <span className="truncate">{currentPatient.email}</span>
                  </div>
                )}
              </dl>
              {currentPatient.notes && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-300">Notes</p>
                  <p className="whitespace-pre-wrap text-xs text-amber-900 dark:text-amber-200">{currentPatient.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <MedicalHistorySectionWrapper
            patientId={currentPatient.id}
            initialEntries={medicalHistoryEntries}
            refreshTrigger={medicalHistoryRefreshKey}
          />

          {attachmentsCard}

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
            <Card className={CARD_TINT}>
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
                    {(viewingConsultation.anamnesis || viewingConsultation.anamnesis_sections) && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Anamnèse
                        </h4>
                        <AnamnesisDisplay
                          anamnesis={viewingConsultation.anamnesis}
                          anamnesisSections={viewingConsultation.anamnesis_sections}
                          reason={viewingConsultation.reason}
                        />
                      </div>
                    )}
                    {viewingConsultation.clinical_hypotheses && (
                      <div>
                        {(viewingConsultation.anamnesis || viewingConsultation.anamnesis_sections) && <Separator />}
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1 mt-3">
                          Hypothèses cliniques
                        </h4>
                        <HypothesesDisplay clinicalHypotheses={viewingConsultation.clinical_hypotheses} />
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
                    {!viewingConsultation.anamnesis && !viewingConsultation.examination && !viewingConsultation.advice && !viewingConsultation.clinical_hypotheses && (
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

  return (
    <>
      {formContent}
      <div className="mt-6">{attachmentsCard}</div>
      {modals}
    </>
  )
}
