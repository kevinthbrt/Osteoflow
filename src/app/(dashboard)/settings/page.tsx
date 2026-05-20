'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/db/client'
import {
  practitionerSettingsSchema,
  type PractitionerSettingsFormData,
  emailSettingsSchema,
  type EmailSettingsFormData,
  emailProviderPresets,
} from '@/lib/validations/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Building, Mail, FileText, Download, Trash2, X, Image, Link, CheckCircle2, ExternalLink, RefreshCw, AlertCircle, HardDrive, FolderOpen, Lock, Eye, EyeOff, Target, Pencil, Check, Shield, Sparkles, Mic } from 'lucide-react'
import { CGU_SECTIONS, PRIVACY_SECTIONS, CGU_VERSION, CGU_DATE, type LegalSection } from '@/lib/legal/documents'
import type { Practitioner, SessionType } from '@/types/database'

interface PatientListItem {
  id: string
  first_name: string
  last_name: string
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function renderInline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{part}</strong> : part
  )
}

function LegalDoc({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-2 text-sm">
      {sections.map((s, i) => {
        switch (s.type) {
          case 'h1': return <h1 key={i} className="text-base font-bold text-foreground pt-1">{s.content}</h1>
          case 'h2': return <h2 key={i} className="text-sm font-semibold text-foreground border-b pb-1 mt-4">{s.content}</h2>
          case 'h3': return <h3 key={i} className="text-sm font-medium text-foreground mt-3">{s.content}</h3>
          case 'p': return <p key={i} className="text-muted-foreground leading-relaxed">{renderInline(s.content ?? '')}</p>
          case 'ul': return (
            <ul key={i} className="list-disc list-inside space-y-1 pl-2">
              {s.items?.map((item, j) => (
                <li key={j} className="text-muted-foreground leading-relaxed">{renderInline(item)}</li>
              ))}
            </ul>
          )
          case 'table': return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-border">
                <thead className="bg-muted">
                  <tr>{s.headers?.map((h, j) => <th key={j} className="border border-border px-2 py-1 text-left font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {s.rows?.map((row, j) => (
                    <tr key={j}>{row.map((cell, k) => <td key={k} className="border border-border px-2 py-1 text-muted-foreground">{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          case 'hr': return <hr key={i} className="my-2 border-border" />
          default: return null
        }
      })}
    </div>
  )
}

function LegalSettingsTab() {
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/legal/status')
      .then((r) => r.json())
      .then((d) => setAcceptedAt(d.acceptedAt ?? null))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Légal &amp; Confidentialité
          </CardTitle>
          <CardDescription>
            Version {CGU_VERSION} · En vigueur depuis le {CGU_DATE}
            {acceptedAt && (
              <span className="ml-2 text-green-600">
                · Acceptées le {new Date(acceptedAt).toLocaleDateString('fr-FR')}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="cgu">
            <TabsList className="mb-4">
              <TabsTrigger value="cgu" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                CGU
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-1.5 text-xs">
                <Shield className="h-3.5 w-3.5" />
                Confidentialité
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cgu">
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <LegalDoc sections={CGU_SECTIONS} />
              </div>
            </TabsContent>
            <TabsContent value="privacy">
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <LegalDoc sections={PRIVACY_SECTIONS} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsPageInner() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'profile'
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [exportPatientId, setExportPatientId] = useState<string>('')
  const [patients, setPatients] = useState<PatientListItem[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [stampUrl, setStampUrl] = useState<string | null>(null)
  const [isUploadingStamp, setIsUploadingStamp] = useState(false)
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([])
  const [newSessionTypeName, setNewSessionTypeName] = useState('')
  const [newSessionTypePrice, setNewSessionTypePrice] = useState('')
  const [isSavingSessionType, setIsSavingSessionType] = useState(false)
  const [editingSessionTypeId, setEditingSessionTypeId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingPrice, setEditingPrice] = useState('')

  // Objectives settings state
  const [objectivesSettings, setObjectivesSettings] = useState({
    annual_revenue_objective: '',
    vacation_weeks_per_year: '5',
    working_days_per_week: '4',
    average_consultation_price: '',
  })
  const [isSavingObjectives, setIsSavingObjectives] = useState(false)
  const [followUpDelay, setFollowUpDelay] = useState('7')
  const [isSavingFollowUpDelay, setIsSavingFollowUpDelay] = useState(false)

  // Email connection states
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [emailSettings, setEmailSettings] = useState<{
    id?: string
    smtp_host?: string
    smtp_port?: number
    smtp_secure?: boolean
    smtp_user?: string
    imap_host?: string
    imap_port?: number
    imap_secure?: boolean
    imap_user?: string
    from_name?: string
    from_email?: string
    sync_enabled?: boolean
    is_verified?: boolean
    last_sync_at?: string
    last_error?: string
    last_error_at?: string
  } | null>(null)
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false)
  const [isDeletingEmailSettings, setIsDeletingEmailSettings] = useState(false)
  const [showEmailPassword, setShowEmailPassword] = useState(false)

  const { toast } = useToast()
  const db = createClient()

  // Settings form
  const {
    register: registerSettings,
    handleSubmit: handleSubmitSettings,
    setValue: setSettingsValue,
    formState: { errors: settingsErrors },
  } = useForm<PractitionerSettingsFormData>({
    resolver: zodResolver(practitionerSettingsSchema),
  })

  // Email settings form
  const {
    register: registerEmailSettings,
    handleSubmit: handleSubmitEmailSettings,
    setValue: setEmailSettingsValue,
    reset: resetEmailSettings,
    formState: { errors: emailSettingsErrors },
  } = useForm<EmailSettingsFormData>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      smtp_port: 587,
      smtp_secure: false,
      imap_port: 993,
      imap_secure: true,
      sync_enabled: true,
    },
  })

  // Fetch objectives settings
  useEffect(() => {
    async function fetchObjectives() {
      try {
        const res = await fetch('/api/objectives')
        if (res.ok) {
          const data = await res.json()
          if (data.settings) {
            setObjectivesSettings({
              annual_revenue_objective: data.settings.annual_revenue_objective != null ? String(data.settings.annual_revenue_objective) : '',
              vacation_weeks_per_year: String(data.settings.vacation_weeks_per_year ?? 5),
              working_days_per_week: String(data.settings.working_days_per_week ?? 4),
              average_consultation_price: data.settings.average_consultation_price != null ? String(data.settings.average_consultation_price) : '',
            })
          }
        }
      } catch (error) {
        console.error('Error fetching objectives:', error)
      }
    }
    fetchObjectives()
  }, [])

  // Save objectives settings
  const handleSaveObjectives = async () => {
    setIsSavingObjectives(true)
    try {
      const res = await fetch('/api/objectives', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annual_revenue_objective: objectivesSettings.annual_revenue_objective ? Number(objectivesSettings.annual_revenue_objective) : null,
          vacation_weeks_per_year: Number(objectivesSettings.vacation_weeks_per_year) || 5,
          working_days_per_week: Number(objectivesSettings.working_days_per_week) || 4,
          average_consultation_price: objectivesSettings.average_consultation_price ? Number(objectivesSettings.average_consultation_price) : null,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast({ variant: 'success', title: 'Objectifs enregistrés', description: 'Vos paramètres d\'objectifs ont été sauvegardés' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder les objectifs' })
    } finally {
      setIsSavingObjectives(false)
    }
  }

  // Save follow-up delay
  const handleSaveFollowUpDelay = async () => {
    if (!practitioner) return
    const days = parseInt(followUpDelay, 10)
    if (isNaN(days) || days < 1 || days > 365) {
      toast({ variant: 'destructive', title: 'Valeur invalide', description: 'Entrez un nombre de jours entre 1 et 365.' })
      return
    }
    setIsSavingFollowUpDelay(true)
    try {
      const { error } = await db
        .from('practitioners')
        .update({ follow_up_delay_days: days } as any)
        .eq('id', practitioner.id)
      if (error) throw error
      toast({ variant: 'success', title: 'Délai enregistré', description: `Les emails de suivi seront envoyés à J+${days}.` })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder le délai.' })
    } finally {
      setIsSavingFollowUpDelay(false)
    }
  }

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await db.auth.getUser()
        if (!user) return

        // Get practitioner
        const { data: practitionerData } = await db
          .from('practitioners')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (practitionerData) {
          setPractitioner(practitionerData)

          // Set form values
          setSettingsValue('first_name', practitionerData.first_name)
          setSettingsValue('last_name', practitionerData.last_name)
          setSettingsValue('email', practitionerData.email)
          setSettingsValue('accountant_email', practitionerData.accountant_email || '')
          setSettingsValue('phone', practitionerData.phone || '')
          setSettingsValue('practice_name', practitionerData.practice_name || '')
          setSettingsValue('specialty', practitionerData.specialty || '')
          setSettingsValue('google_review_url', practitionerData.google_review_url || '')
          setSettingsValue('address', practitionerData.address || '')
          setSettingsValue('city', practitionerData.city || '')
          setSettingsValue('postal_code', practitionerData.postal_code || '')
          setSettingsValue('siret', practitionerData.siret || '')
          setSettingsValue('rpps', practitionerData.rpps || '')
          setSettingsValue('status', practitionerData.status || '')
          setSettingsValue('default_rate', practitionerData.default_rate)
          setSettingsValue('invoice_prefix', practitionerData.invoice_prefix)
          setSettingsValue('primary_color', practitionerData.primary_color)
          setStampUrl(practitionerData.stamp_url)
          setFollowUpDelay(String((practitionerData as any).follow_up_delay_days ?? 7))

          // Get patients for export
          const { data: patientsData } = await db
            .from('patients')
            .select('id, first_name, last_name')
            .eq('practitioner_id', practitionerData.id)
            .order('last_name')

          if (patientsData) {
            setPatients(patientsData)
          }

          const { data: sessionTypesData, error: sessionTypesError } = await db
            .from('session_types')
            .select('*')
            .eq('practitioner_id', practitionerData.id)
            .eq('is_active', true)
            .order('name')

          if (sessionTypesError) {
            console.error('Error fetching session types:', sessionTypesError)
          } else if (sessionTypesData) {
            setSessionTypes(sessionTypesData)
          }

          // Fetch email settings
          try {
            const response = await fetch('/api/emails/settings')
            if (response.ok) {
              const { settings } = await response.json()
              if (settings) {
                setEmailSettings(settings)
                // Pre-fill form with existing settings
                setEmailSettingsValue('smtp_host', settings.smtp_host || '')
                setEmailSettingsValue('smtp_port', settings.smtp_port || 587)
                setEmailSettingsValue('smtp_secure', settings.smtp_secure || false)
                setEmailSettingsValue('smtp_user', settings.smtp_user || '')
                setEmailSettingsValue('imap_host', settings.imap_host || '')
                setEmailSettingsValue('imap_port', settings.imap_port || 993)
                setEmailSettingsValue('imap_secure', settings.imap_secure || true)
                setEmailSettingsValue('imap_user', settings.imap_user || '')
                setEmailSettingsValue('from_name', settings.from_name || '')
                setEmailSettingsValue('from_email', settings.from_email || '')
                setEmailSettingsValue('sync_enabled', settings.sync_enabled ?? true)
              }
            }
          } catch (emailError) {
            console.error('Error fetching email settings:', emailError)
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de charger les paramètres',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [db, setSettingsValue, setEmailSettingsValue, toast])

  // Save settings
  const onSaveSettings = async (data: PractitionerSettingsFormData) => {
    if (!practitioner) return

    setIsSaving(true)

    try {
      const { error } = await db
        .from('practitioners')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          accountant_email: data.accountant_email || null,
          phone: data.phone || null,
          practice_name: data.practice_name || null,
          specialty: data.specialty || null,
          google_review_url: data.google_review_url || null,
          address: data.address || null,
          city: data.city || null,
          postal_code: data.postal_code || null,
          siret: data.siret || null,
          rpps: data.rpps || null,
          status: data.status || null,
          default_rate: data.default_rate,
          invoice_prefix: data.invoice_prefix,
          primary_color: data.primary_color,
        })
        .eq('id', practitioner.id)

      if (error) throw error

      toast({
        variant: 'success',
        title: 'Paramètres enregistrés',
        description: 'Vos modifications ont été sauvegardées',
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddSessionType = async () => {
    if (!practitioner) return
    const priceValue = Number(newSessionTypePrice)

    if (!newSessionTypeName.trim() || Number.isNaN(priceValue)) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez saisir un nom et un tarif valide.',
      })
      return
    }

    setIsSavingSessionType(true)

    try {
      const { data, error } = await db
        .from('session_types')
        .insert({
          practitioner_id: practitioner.id,
          name: newSessionTypeName.trim(),
          price: priceValue,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setSessionTypes((prev) => [...prev, data])
      }
      setNewSessionTypeName('')
      setNewSessionTypePrice('')
      toast({
        variant: 'success',
        title: 'Type de séance créé',
        description: 'Le type de séance est disponible pour la facturation.',
      })
    } catch (error) {
      console.error('Error creating session type:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer le type de séance.',
      })
    } finally {
      setIsSavingSessionType(false)
    }
  }

  const handleDeleteSessionType = async (id: string) => {
    try {
      const { error } = await db
        .from('session_types')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
      setSessionTypes((prev) => prev.filter((t) => t.id !== id))
      toast({ variant: 'success', title: 'Type de séance supprimé' })
    } catch (error) {
      console.error('Error deleting session type:', error)
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer le type de séance.' })
    }
  }

  const handleUpdateSessionType = async (id: string) => {
    const priceValue = Number(editingPrice)
    if (!editingName.trim() || Number.isNaN(priceValue)) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez saisir un nom et un tarif valide.' })
      return
    }
    try {
      const { error } = await db
        .from('session_types')
        .update({ name: editingName.trim(), price: priceValue })
        .eq('id', id)
      if (error) throw error
      setSessionTypes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name: editingName.trim(), price: priceValue } : t))
      )
      setEditingSessionTypeId(null)
      toast({ variant: 'success', title: 'Type de séance modifié' })
    } catch (error) {
      console.error('Error updating session type:', error)
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de modifier le type de séance.' })
    }
  }

  // Export patient data (GDPR)
  const handleExportPatient = async () => {
    if (!exportPatientId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un patient',
      })
      return
    }

    setIsExporting(true)

    try {
      // Get patient with all related data
      const { data: patient } = await db
        .from('patients')
        .select(`
          *,
          consultations (
            *,
            invoices (
              *,
              payments (*)
            )
          )
        `)
        .eq('id', exportPatientId)
        .single()

      if (!patient) {
        throw new Error('Patient non trouvé')
      }

      // Create JSON export
      const exportData = {
        exportDate: new Date().toISOString(),
        patient: {
          ...patient,
          consultations: undefined,
        },
        consultations: patient.consultations,
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `export_${patient.last_name}_${patient.first_name}_${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)

      toast({
        title: 'Export réussi',
        description: 'Les données du patient ont été exportées',
      })
    } catch (error) {
      console.error('Error exporting patient:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'exporter les données",
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Upload stamp image (local file storage via API)
  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !practitioner) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Le fichier doit être une image (PNG, JPG)',
      })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'L\'image ne doit pas dépasser 2 Mo',
      })
      return
    }

    setIsUploadingStamp(true)

    try {
      // Read file as base64 data URI (avoids FormData multipart parsing issues in Electron)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })

      const response = await fetch('/api/stamps/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          practitioner_id: practitioner.id,
          mimetype: file.type,
          filename: file.name,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setStampUrl(result.stampUrl)

      toast({
        variant: 'success',
        title: 'Tampon enregistré',
        description: 'Votre tampon/signature a été ajouté',
      })
    } catch (error) {
      console.error('Error uploading stamp:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de télécharger l\'image',
      })
    } finally {
      setIsUploadingStamp(false)
    }
  }

  // Remove stamp
  const handleRemoveStamp = async () => {
    if (!practitioner) return

    try {
      // Update practitioner to remove stamp URL
      const { error } = await db
        .from('practitioners')
        .update({ stamp_url: null })
        .eq('id', practitioner.id)

      if (error) throw error

      setStampUrl(null)

      toast({
        title: 'Tampon supprimé',
        description: 'Votre tampon/signature a été retiré',
      })
    } catch (error) {
      console.error('Error removing stamp:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer le tampon',
      })
    }
  }

  // Delete patient (GDPR right to be forgotten)
  const handleDeletePatient = async () => {
    if (!exportPatientId) return

    try {
      const { error } = await db
        .from('patients')
        .delete()
        .eq('id', exportPatientId)

      if (error) throw error

      setPatients(patients.filter((p) => p.id !== exportPatientId))
      setExportPatientId('')
      setShowDeleteDialog(false)

      toast({
        title: 'Patient supprimé',
        description: 'Les données du patient ont été supprimées définitivement',
      })
    } catch (error) {
      console.error('Error deleting patient:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer le patient',
      })
    }
  }

  // Handle provider selection
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId)
    if (providerId && emailProviderPresets[providerId as keyof typeof emailProviderPresets]) {
      const preset = emailProviderPresets[providerId as keyof typeof emailProviderPresets]
      setEmailSettingsValue('smtp_host', preset.smtp_host)
      setEmailSettingsValue('smtp_port', preset.smtp_port)
      setEmailSettingsValue('smtp_secure', preset.smtp_secure)
      setEmailSettingsValue('imap_host', preset.imap_host)
      setEmailSettingsValue('imap_port', preset.imap_port)
      setEmailSettingsValue('imap_secure', preset.imap_secure)
    }
  }

  // Save email settings
  const onSaveEmailSettings = async (data: EmailSettingsFormData) => {
    setIsSavingEmailSettings(true)

    try {
      // Copy SMTP credentials to IMAP (same for Gmail, Outlook, etc.)
      const payload = {
        ...data,
        imap_user: data.smtp_user,
        imap_password: data.smtp_password,
      }

      const response = await fetch('/api/emails/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Erreur de connexion')
      }

      setEmailSettings(result.settings)
      toast({
        variant: 'success',
        title: 'Connexion email configurée',
        description: 'Vos paramètres email ont été enregistrés avec succès',
      })
    } catch (error) {
      console.error('Error saving email settings:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur de connexion',
        description: error instanceof Error ? error.message : 'Impossible de configurer la connexion email',
      })
    } finally {
      setIsSavingEmailSettings(false)
    }
  }

  // Delete email settings
  const handleDeleteEmailSettings = async () => {
    setIsDeletingEmailSettings(true)

    try {
      const response = await fetch('/api/emails/settings', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression')
      }

      setEmailSettings(null)
      setSelectedProvider('')
      resetEmailSettings()

      toast({
        title: 'Configuration supprimée',
        description: 'Votre connexion email a été supprimée',
      })
    } catch (error) {
      console.error('Error deleting email settings:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer la configuration',
      })
    } finally {
      setIsDeletingEmailSettings(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">
          Configurez votre cabinet et vos préférences
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">
            <Building className="mr-2 h-4 w-4" />
            Cabinet
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="mr-2 h-4 w-4" />
            Facturation
          </TabsTrigger>
          <TabsTrigger value="email-connection">
            <Link className="mr-2 h-4 w-4" />
            Connexion Email
          </TabsTrigger>
          <TabsTrigger value="gdpr">
            <Download className="mr-2 h-4 w-4" />
            RGPD
          </TabsTrigger>
          <TabsTrigger value="storage">
            <HardDrive className="mr-2 h-4 w-4" />
            Stockage
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="mr-2 h-4 w-4" />
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="audit">
            Journal
          </TabsTrigger>
          <TabsTrigger value="objectives">
            <Target className="mr-2 h-4 w-4" />
            Objectifs
          </TabsTrigger>
          <TabsTrigger value="legal">
            <Shield className="mr-2 h-4 w-4" />
            Légal
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="mr-2 h-4 w-4" />
            IA
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <form onSubmit={handleSubmitSettings(onSaveSettings)}>
            <Card>
              <CardHeader>
                <CardTitle>Informations du cabinet</CardTitle>
                <CardDescription>
                  Ces informations apparaîtront sur vos factures
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Prénom *</Label>
                    <Input
                      id="first_name"
                      {...registerSettings('first_name')}
                    />
                    {settingsErrors.first_name && (
                      <p className="text-sm text-destructive">
                        {settingsErrors.first_name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nom *</Label>
                    <Input
                      id="last_name"
                      {...registerSettings('last_name')}
                    />
                    {settingsErrors.last_name && (
                      <p className="text-sm text-destructive">
                        {settingsErrors.last_name.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      {...registerSettings('email')}
                    />
                    {settingsErrors.email && (
                      <p className="text-sm text-destructive">
                        {settingsErrors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input id="phone" {...registerSettings('phone')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountant_email">Email comptable</Label>
                  <Input
                    id="accountant_email"
                    type="email"
                    {...registerSettings('accountant_email')}
                    placeholder="comptable@cabinet.fr"
                  />
                  {settingsErrors.accountant_email && (
                    <p className="text-sm text-destructive">
                      {settingsErrors.accountant_email.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Utilisé pour l&apos;envoi direct des récapitulatifs comptables.
                  </p>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="practice_name">Nom du cabinet</Label>
                    <Input
                      id="practice_name"
                      {...registerSettings('practice_name')}
                      placeholder="Cabinet d'ostéopathie"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialty">Spécialité</Label>
                    <Input
                      id="specialty"
                      {...registerSettings('specialty')}
                      placeholder="Ostéopathe D.O."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google_review_url">Lien d'avis Google</Label>
                  <Input
                    id="google_review_url"
                    type="url"
                    {...registerSettings('google_review_url')}
                    placeholder="https://g.page/votre-cabinet/review"
                  />
                  {settingsErrors.google_review_url && (
                    <p className="text-sm text-destructive">
                      {settingsErrors.google_review_url.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Ce lien sera proposé aux patients lors de l'envoi des factures.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    {...registerSettings('address')}
                    placeholder="123 rue Example"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Code postal</Label>
                    <Input
                      id="postal_code"
                      {...registerSettings('postal_code')}
                      placeholder="75000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      {...registerSettings('city')}
                      placeholder="Paris"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="siret">N° SIREN/SIRET</Label>
                    <Input
                      id="siret"
                      {...registerSettings('siret')}
                      placeholder="12345678901234"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rpps">N° RPPS</Label>
                    <Input
                      id="rpps"
                      {...registerSettings('rpps')}
                      placeholder="10123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Statut juridique</Label>
                    <Input
                      id="status"
                      {...registerSettings('status')}
                      placeholder="EI"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <form onSubmit={handleSubmitSettings(onSaveSettings)}>
            <Card>
              <CardHeader>
                <CardTitle>Paramètres de facturation</CardTitle>
                <CardDescription>
                  Configurez les valeurs par défaut pour vos factures
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="default_rate">Tarif par défaut (€) *</Label>
                    <Input
                      id="default_rate"
                      type="number"
                      step="0.01"
                      {...registerSettings('default_rate', { valueAsNumber: true })}
                    />
                    {settingsErrors.default_rate && (
                      <p className="text-sm text-destructive">
                        {settingsErrors.default_rate.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_prefix">Préfixe de facture *</Label>
                    <Input
                      id="invoice_prefix"
                      {...registerSettings('invoice_prefix')}
                      placeholder="FACT"
                    />
                    {settingsErrors.invoice_prefix && (
                      <p className="text-sm text-destructive">
                        {settingsErrors.invoice_prefix.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Exemple: {practitioner?.invoice_prefix || 'FACT'}-
                      {new Date().toISOString().slice(2, 10).replace(/-/g, '')}-001
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primary_color">Couleur principale</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      {...registerSettings('primary_color')}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      {...registerSettings('primary_color')}
                      placeholder="#2563eb"
                      className="flex-1"
                    />
                  </div>
                  {settingsErrors.primary_color && (
                    <p className="text-sm text-destructive">
                      {settingsErrors.primary_color.message}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label>Tampon / Signature</Label>
                    <p className="text-sm text-muted-foreground">
                      Cette image sera ajoutée automatiquement sur vos factures
                    </p>
                  </div>

                  {stampUrl ? (
                    <div className="flex items-start gap-4">
                      <div className="relative border rounded-lg p-2 bg-white">
                        <img
                          src={stampUrl}
                          alt="Tampon"
                          className="max-w-[200px] max-h-[100px] object-contain"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={handleRemoveStamp}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cliquez sur la croix pour supprimer
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <label
                        htmlFor="stamp-upload"
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg hover:border-primary hover:bg-muted/50 transition-colors"
                      >
                        {isUploadingStamp ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Image className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="text-sm">
                          {isUploadingStamp ? 'Envoi en cours...' : 'Ajouter un tampon'}
                        </span>
                        <input
                          id="stamp-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleStampUpload}
                          disabled={isUploadingStamp}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">
                        PNG ou JPG, max 2 Mo
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label>Types de séance</Label>
                    <p className="text-sm text-muted-foreground">
                      Créez des types de séance avec un tarif associé pour la facturation.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1fr_160px_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="session-type-name">Nom</Label>
                      <Input
                        id="session-type-name"
                        value={newSessionTypeName}
                        onChange={(event) => setNewSessionTypeName(event.target.value)}
                        placeholder="Adulte, Enfant..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-type-price">Tarif (€)</Label>
                      <Input
                        id="session-type-price"
                        type="number"
                        step="0.01"
                        value={newSessionTypePrice}
                        onChange={(event) => setNewSessionTypePrice(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={handleAddSessionType}
                        disabled={isSavingSessionType}
                      >
                        {isSavingSessionType && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Ajouter
                      </Button>
                    </div>
                  </div>

                  {sessionTypes.length > 0 ? (
                    <div className="space-y-2">
                      {sessionTypes.map((type) => (
                        <div
                          key={type.id}
                          className="flex items-center gap-2 rounded-lg border px-3 py-2"
                        >
                          {editingSessionTypeId === type.id ? (
                            <>
                              <Input
                                className="flex-1 h-8 text-sm"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                              />
                              <Input
                                className="w-24 h-8 text-sm"
                                type="number"
                                step="0.01"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                              />
                              <span className="text-sm text-muted-foreground">€</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                onClick={() => handleUpdateSessionType(type.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditingSessionTypeId(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm font-medium">{type.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {Number(type.price).toFixed(2)} €
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingSessionTypeId(type.id)
                                  setEditingName(type.name)
                                  setEditingPrice(String(type.price))
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteSessionType(type.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun type de séance enregistré.
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Email Connection Tab */}
        <TabsContent value="email-connection">
          <div className="space-y-6">
            {/* Status Card */}
            {emailSettings?.is_verified && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">Email connecté</p>
                        <p className="text-sm text-green-700">{emailSettings.from_email}</p>
                        {emailSettings.last_sync_at && (
                          <p className="text-xs text-green-600">
                            Dernière synchronisation: {new Date(emailSettings.last_sync_at).toLocaleString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteEmailSettings}
                      disabled={isDeletingEmailSettings}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {isDeletingEmailSettings ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="ml-2">Déconnecter</span>
                    </Button>
                  </div>
                  {emailSettings.last_error && (
                    <div className="mt-4 p-3 bg-red-100 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Erreur de synchronisation</p>
                        <p className="text-xs text-red-700">{emailSettings.last_error}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Connecter votre messagerie</CardTitle>
                <CardDescription>
                  Envoyez et recevez des emails directement depuis MyOsteoFlow via votre adresse email personnelle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Provider Selection */}
                <div className="space-y-3">
                  <Label>1. Choisissez votre fournisseur email</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {Object.entries(emailProviderPresets).map(([key, preset]) => (
                      <Button
                        key={key}
                        type="button"
                        variant={selectedProvider === key ? 'default' : 'outline'}
                        className="h-auto py-3"
                        onClick={() => handleProviderChange(key)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                {selectedProvider && emailProviderPresets[selectedProvider as keyof typeof emailProviderPresets] && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="font-medium text-blue-900">
                          2. Créez un mot de passe d&apos;application
                        </p>
                        <ol className="text-sm text-blue-800 space-y-1">
                          {emailProviderPresets[selectedProvider as keyof typeof emailProviderPresets].instructions.map((instruction, i) => (
                            <li key={i}>{instruction}</li>
                          ))}
                        </ol>
                        <a
                          href={emailProviderPresets[selectedProvider as keyof typeof emailProviderPresets].helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Voir le guide complet
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Configuration Form */}
                <form onSubmit={handleSubmitEmailSettings(onSaveEmailSettings)} className="space-y-6">
                  <div className="space-y-3">
                    <Label>3. Entrez vos identifiants</Label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="from_email">Adresse email *</Label>
                        <Input
                          id="from_email"
                          type="email"
                          placeholder="votre.email@gmail.com"
                          {...registerEmailSettings('from_email')}
                        />
                        {emailSettingsErrors.from_email && (
                          <p className="text-sm text-destructive">{emailSettingsErrors.from_email.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="from_name">Nom d&apos;expéditeur</Label>
                        <Input
                          id="from_name"
                          placeholder="Dr. Dupont - Cabinet Ostéo"
                          {...registerEmailSettings('from_name')}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="smtp_user">Identifiant (email) *</Label>
                        <Input
                          id="smtp_user"
                          placeholder="votre.email@gmail.com"
                          {...registerEmailSettings('smtp_user')}
                        />
                        {emailSettingsErrors.smtp_user && (
                          <p className="text-sm text-destructive">{emailSettingsErrors.smtp_user.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp_password">Mot de passe d&apos;application *</Label>
                        <div className="relative">
                          <Input
                            id="smtp_password"
                            type={showEmailPassword ? 'text' : 'password'}
                            placeholder="xxxx xxxx xxxx xxxx"
                            {...registerEmailSettings('smtp_password')}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                            onClick={() => setShowEmailPassword(!showEmailPassword)}
                          >
                            {showEmailPassword ? 'Masquer' : 'Afficher'}
                          </Button>
                        </div>
                        {emailSettingsErrors.smtp_password && (
                          <p className="text-sm text-destructive">{emailSettingsErrors.smtp_password.message}</p>
                        )}
                      </div>
                    </div>

                    </div>

                  {/* Advanced settings (collapsed by default) */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      Paramètres avancés (SMTP/IMAP)
                    </summary>
                    <div className="mt-4 space-y-4 pl-4 border-l-2">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="smtp_host">Serveur SMTP</Label>
                          <Input id="smtp_host" {...registerEmailSettings('smtp_host')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smtp_port">Port SMTP</Label>
                          <Input
                            id="smtp_port"
                            type="number"
                            {...registerEmailSettings('smtp_port', { valueAsNumber: true })}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <input
                            type="checkbox"
                            id="smtp_secure"
                            {...registerEmailSettings('smtp_secure')}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="smtp_secure">SSL/TLS</Label>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="imap_host">Serveur IMAP</Label>
                          <Input id="imap_host" {...registerEmailSettings('imap_host')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="imap_port">Port IMAP</Label>
                          <Input
                            id="imap_port"
                            type="number"
                            {...registerEmailSettings('imap_port', { valueAsNumber: true })}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <input
                            type="checkbox"
                            id="imap_secure"
                            {...registerEmailSettings('imap_secure')}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="imap_secure">SSL/TLS</Label>
                        </div>
                      </div>
                    </div>
                  </details>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="sync_enabled"
                      {...registerEmailSettings('sync_enabled')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="sync_enabled">Activer la synchronisation des emails entrants</Label>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSavingEmailSettings}>
                      {isSavingEmailSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {emailSettings?.is_verified ? 'Mettre à jour' : 'Tester et connecter'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comment ça fonctionne ?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium mb-1">Envoi</h4>
                    <p className="text-sm text-muted-foreground">
                      Vos factures et messages partent depuis votre adresse email personnelle
                    </p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <RefreshCw className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium mb-1">Synchronisation</h4>
                    <p className="text-sm text-muted-foreground">
                      Les réponses de vos patients apparaissent automatiquement dans MyOsteoFlow
                    </p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium mb-1">Sécurisé</h4>
                    <p className="text-sm text-muted-foreground">
                      Mot de passe d&apos;application dédié, vos identifiants principaux restent protégés
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Follow-up delay */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-primary" />
                  Délai d&apos;envoi du suivi patient
                </CardTitle>
                <CardDescription>
                  Nombre de jours après la consultation avant l&apos;envoi automatique de l&apos;email de satisfaction (J+7 par défaut).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground shrink-0">Envoyer à J+</span>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={followUpDelay}
                    onChange={(e) => setFollowUpDelay(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">jours</span>
                  <Button
                    onClick={handleSaveFollowUpDelay}
                    disabled={isSavingFollowUpDelay}
                    size="sm"
                  >
                    {isSavingFollowUpDelay && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GDPR Tab */}
        <TabsContent value="gdpr">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des données RGPD</CardTitle>
              <CardDescription>
                Exportez ou supprimez les données d&apos;un patient
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Sélectionner un patient</Label>
                <Select value={exportPatientId} onValueChange={setExportPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.last_name} {patient.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={handleExportPatient}
                  disabled={!exportPatientId || isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exporter les données (JSON)
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={!exportPatientId}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer définitivement
                </Button>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Informations RGPD</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Les données sont stockées localement sur votre ordinateur (SQLite)</li>
                  <li>Aucune donnée ne transite par un serveur externe</li>
                  <li>L&apos;export inclut toutes les données du patient, consultations et factures</li>
                  <li>La suppression est définitive et irréversible</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage">
          <StorageSettings />
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6">
            <InactivitySettings />
            <PasswordSettings practitioner={practitioner} />
          </div>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>

        {/* Objectives Tab */}
        <TabsContent value="objectives">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Objectifs de chiffre d&apos;affaires
              </CardTitle>
              <CardDescription>
                Configurez votre objectif annuel pour suivre votre progression quotidienne, hebdomadaire et mensuelle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="annual_revenue_objective">Objectif CA annuel (€)</Label>
                  <Input
                    id="annual_revenue_objective"
                    type="number"
                    step="100"
                    min="0"
                    placeholder="Ex: 80000"
                    value={objectivesSettings.annual_revenue_objective}
                    onChange={(e) => setObjectivesSettings((prev) => ({ ...prev, annual_revenue_objective: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Votre objectif de chiffre d&apos;affaires pour l&apos;année en cours.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="average_consultation_price">Tarif moyen consultation (€)</Label>
                  <Input
                    id="average_consultation_price"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Ex: 60"
                    value={objectivesSettings.average_consultation_price}
                    onChange={(e) => setObjectivesSettings((prev) => ({ ...prev, average_consultation_price: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Utilisé pour convertir vos objectifs en nombre de patients.</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vacation_weeks_per_year">Semaines de congés par an</Label>
                  <Input
                    id="vacation_weeks_per_year"
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    value={objectivesSettings.vacation_weeks_per_year}
                    onChange={(e) => setObjectivesSettings((prev) => ({ ...prev, vacation_weeks_per_year: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="working_days_per_week">Jours travaillés par semaine</Label>
                  <Input
                    id="working_days_per_week"
                    type="number"
                    min="1"
                    max="7"
                    step="1"
                    value={objectivesSettings.working_days_per_week}
                    onChange={(e) => setObjectivesSettings((prev) => ({ ...prev, working_days_per_week: e.target.value }))}
                  />
                </div>
              </div>

              {objectivesSettings.annual_revenue_objective && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Objectifs calculés</p>
                  {(() => {
                    const annualObj = Number(objectivesSettings.annual_revenue_objective) || 0
                    const vacWeeks = Number(objectivesSettings.vacation_weeks_per_year) || 5
                    const workDays = Number(objectivesSettings.working_days_per_week) || 4
                    const workingWeeks = 52 - vacWeeks
                    const workingDays = workingWeeks * workDays
                    const dailyObj = workingDays > 0 ? annualObj / workingDays : 0
                    const weeklyObj = workingWeeks > 0 ? annualObj / workingWeeks : 0
                    const monthlyObj = annualObj / 12
                    return (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Journalier</span><span className="font-medium">{dailyObj.toFixed(0)} €</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Hebdomadaire</span><span className="font-medium">{weeklyObj.toFixed(0)} €</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Mensuel</span><span className="font-medium">{monthlyObj.toFixed(0)} €</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Semaines travaillées</span><span className="font-medium">{workingWeeks} sem.</span></div>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveObjectives} disabled={isSavingObjectives}>
                  {isSavingObjectives && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Tab */}
        <TabsContent value="legal">
          <LegalSettingsTab />
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai">
          <AiSettings />
        </TabsContent>

      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données du patient seront
              supprimées définitivement, y compris les consultations et factures
              associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePatient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Storage settings component for managing database location.
 */
function StorageSettings() {
  const [dbInfo, setDbInfo] = useState<{
    currentDir: string
    defaultDir: string
    dbPath: string
    dbExists: boolean
    isCustom: boolean
  } | null>(null)
  const [newPath, setNewPath] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchDbInfo()
  }, [])

  const fetchDbInfo = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/settings/database')
      if (res.ok) {
        const info = await res.json()
        setDbInfo(info)
        setNewPath(info.currentDir)
      }
    } catch (error) {
      console.error('Error fetching db info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!newPath.trim()) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseDir: newPath.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erreur', description: data.error })
        return
      }
      toast({ title: 'Dossier mis à jour', description: 'Redémarrez l\'application pour appliquer.' })
      fetchDbInfo()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le chemin' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseDir: null }),
      })
      if (res.ok) {
        toast({ title: 'Réinitialisé', description: 'Dossier par défaut restauré. Redémarrez l\'application.' })
        fetchDbInfo()
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de réinitialiser' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <Card><CardContent className="p-6"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Dossier de stockage
          </CardTitle>
          <CardDescription>
            Choisissez où stocker la base de données de l&apos;application.
            Le fichier <code className="text-xs bg-muted px-1 rounded">myosteoflow.db</code> sera
            créé dans le dossier choisi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dbInfo && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Emplacement actuel :</span>
              </div>
              <code className="text-xs block break-all bg-background p-2 rounded border">
                {dbInfo.dbPath}
              </code>
              {dbInfo.isCustom && (
                <Badge variant="outline" className="text-xs">Personnalisé</Badge>
              )}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="db-path">Nouveau dossier de stockage</Label>
            <div className="flex gap-2">
              <Input
                id="db-path"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/chemin/vers/dossier"
                className="font-mono text-sm"
              />
              <Button onClick={handleSave} disabled={isSaving || !newPath.trim()}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Collez le chemin complet du dossier. Le dossier doit exister et être accessible en écriture.
            </p>
          </div>

          {dbInfo?.isCustom && (
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Réinitialiser au dossier par défaut
            </Button>
          )}

          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Important</p>
                <ul className="space-y-1 list-disc list-inside text-amber-700 dark:text-amber-300">
                  <li>Changer le dossier ne déplace pas les données existantes</li>
                  <li>Si vous changez le dossier, copiez manuellement <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">myosteoflow.db</code> vers le nouveau dossier</li>
                  <li>Redémarrez l&apos;application après le changement</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <BackupRestoreSettings />
    </div>
  )
}

function BackupRestoreSettings() {
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const { toast } = useToast()

  const handleBackup = async () => {
    setIsBackingUp(true)
    try {
      const res = await fetch('/api/settings/database/backup')
      if (!res.ok) {
        const data = await res.json()
        toast({ variant: 'destructive', title: 'Erreur', description: data.error })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `myosteoflow-backup-${new Date().toISOString().split('T')[0]}.db`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Sauvegarde téléchargée', description: 'Conservez ce fichier en lieu sûr.' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de créer la sauvegarde.' })
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.db')) {
      toast({ variant: 'destructive', title: 'Fichier invalide', description: 'Sélectionnez un fichier .db' })
      return
    }
    setIsRestoring(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/settings/database/restore', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erreur', description: data.error })
        return
      }
      toast({ title: 'Restauration effectuée', description: data.message })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de restaurer la base.' })
    } finally {
      setIsRestoring(false)
      e.target.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Sauvegarde et restauration
        </CardTitle>
        <CardDescription>
          Sauvegardez vos données régulièrement pour éviter toute perte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleBackup} disabled={isBackingUp} variant="outline" className="gap-2">
            {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger la sauvegarde
          </Button>
          <label>
            <Button asChild variant="outline" className="gap-2 cursor-pointer" disabled={isRestoring}>
              <span>
                {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Restaurer depuis une sauvegarde
              </span>
            </Button>
            <input type="file" accept=".db" className="hidden" onChange={handleRestore} disabled={isRestoring} />
          </label>
        </div>
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg text-xs text-amber-800 dark:text-amber-200">
          ⚠️ La restauration remplace toutes les données actuelles. L&apos;application redémarre après la restauration.
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Password settings component for setting/changing login password.
 */
function PasswordSettings({ practitioner }: { practitioner: Practitioner | null }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const db = createClient()

  useEffect(() => {
    async function checkPassword() {
      if (!practitioner) return
      try {
        // Check if practitioner has a password by looking at the practitioner data
        const { data } = await db
          .from('practitioners')
          .select('password_hash')
          .eq('id', practitioner.id)
          .single()
        setHasPassword(!!data?.password_hash)
      } catch {
        // Ignore
      } finally {
        setIsLoading(false)
      }
    }
    checkPassword()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practitioner?.id])

  const handleSave = async () => {
    if (!practitioner) return

    if (newPassword.length < 4) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 4 caractères',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
      })
      return
    }

    if (hasPassword && !oldPassword) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez saisir votre ancien mot de passe',
      })
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: practitioner.email,
          password: newPassword,
          oldPassword: hasPassword ? oldPassword : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: data.error || 'Impossible de modifier le mot de passe',
        })
        return
      }

      toast({
        variant: 'success',
        title: hasPassword ? 'Mot de passe modifié' : 'Mot de passe défini',
        description: 'Votre mot de passe a été enregistré avec succès',
      })

      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setHasPassword(true)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de modifier le mot de passe',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          {hasPassword ? 'Modifier le mot de passe' : 'Définir un mot de passe'}
        </CardTitle>
        <CardDescription>
          {hasPassword
            ? 'Changez votre mot de passe de connexion à l\u2019application.'
            : 'Protégez l\u2019accès à votre compte en définissant un mot de passe.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasPassword && (
          <div className="space-y-2">
            <Label htmlFor="old-password">Ancien mot de passe</Label>
            <div className="relative">
              <Input
                id="old-password"
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Votre mot de passe actuel"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                onClick={() => setShowOld(!showOld)}
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="4 caractères minimum"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <Input
              id="confirm-password"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmer"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-destructive">
                Les mots de passe ne correspondent pas
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || !newPassword || !confirmPassword || newPassword !== confirmPassword}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hasPassword ? 'Modifier le mot de passe' : 'Définir le mot de passe'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function InactivitySettings() {
  const [minutes, setMinutes] = useState(30)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/settings/security')
      .then((r) => r.json())
      .then((d) => { if (d.inactivity_timeout_minutes) setMinutes(d.inactivity_timeout_minutes) })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inactivity_timeout_minutes: minutes }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erreur', description: data.error })
        return
      }
      toast({ title: 'Enregistré', description: `Verrouillage automatique après ${minutes} minutes d'inactivité.` })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Verrouillage automatique
        </CardTitle>
        <CardDescription>
          L&apos;application se verrouille automatiquement après une période d&apos;inactivité.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="inactivity-timeout">Délai d&apos;inactivité (minutes)</Label>
          <div className="flex items-center gap-3">
            <Input
              id="inactivity-timeout"
              type="number"
              min={1}
              max={480}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Math.min(480, parseInt(e.target.value) || 30)))}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">minutes (1 à 480)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Par défaut : 30 minutes. La session se verrouille et demande le PIN pour reprendre.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  )
}

function AuditLogViewer() {
  const [logs, setLogs] = useState<Array<{ id: string; table_name: string; record_id: string; action: string; created_at: string }>>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const limit = 50

  const fetchLogs = async (p = page, a = action) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (a) params.set('action', a)
      const res = await fetch(`/api/audit-logs?${params}`)
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs)
        setTotal(data.total)
        setPage(p)
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les logs.' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchLogs(1, '') }, [])

  const handleExportCsv = () => {
    const header = 'Date,Action,Table,Record ID\n'
    const rows = logs.map((l) => `"${l.created_at}","${l.action}","${l.table_name}","${l.record_id}"`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const actionColors: Record<string, string> = {
    INSERT: 'bg-emerald-100 text-emerald-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Journal d&apos;audit
            </CardTitle>
            <CardDescription>Historique des modifications de données ({total} entrées)</CardDescription>
          </div>
          <div className="flex gap-2">
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); fetchLogs(1, e.target.value) }}
              className="text-sm border rounded-md px-2 py-1.5 bg-background"
            >
              <option value="">Toutes les actions</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun enregistrement</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">Action</th>
                    <th className="text-left p-2 font-medium">Table</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell">Enregistrement</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${actionColors[log.action] || 'bg-muted'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-xs">{log.table_name}</td>
                      <td className="p-2 font-mono text-xs hidden sm:table-cell truncate max-w-[120px]">{log.record_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > limit && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Page {page} / {Math.ceil(total / limit)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1, action)}>Précédent</Button>
                  <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => fetchLogs(page + 1, action)}>Suivant</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


/**
 * AI settings: OpenAI API key for Whisper transcription (Electron dictation).
 */
function AiSettings() {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/ai/openai-key')
      .then((r) => r.json())
      .then((d) => {
        setSaved(d.configured)
        setPreview(d.preview)
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!key.trim()) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/ai/openai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      })
      if (res.ok) {
        setSaved(true)
        setPreview(`sk-...${key.trim().slice(-4)}`)
        setKey('')
        toast({ variant: 'success', title: 'Clé enregistrée', description: 'La clé OpenAI a été sauvegardée.' })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder la clé.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await fetch('/api/ai/openai-key', { method: 'DELETE' })
      setSaved(false)
      setPreview(null)
      setKey('')
      toast({ variant: 'success', title: 'Clé supprimée' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer la clé.' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          Dictée vocale — Whisper (Electron)
        </CardTitle>
        <CardDescription>
          Dans l&apos;application de bureau, la dictée utilise OpenAI Whisper.
          Ajoutez votre clé API OpenAI pour activer la transcription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved && preview && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>Clé configurée : <code className="font-mono">{preview}</code></span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="openai_key">{saved ? 'Remplacer la clé' : 'Clé API OpenAI'}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="openai_key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={handleSave} disabled={!key.trim() || isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Obtenez votre clé sur{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              platform.openai.com/api-keys
            </a>
            . La transcription coûte ~0,006 $ / minute.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            Comment ça fonctionne ?
          </p>
          <p>Dans le navigateur : reconnaissance vocale en temps réel (Google Speech API intégrée au navigateur).</p>
          <p>Dans l&apos;application de bureau : enregistrement audio local, puis transcription via OpenAI Whisper.</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  )
}
