'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import {
  practitionerSettingsSchema,
  type PractitionerSettingsFormData,
  emailTemplateSchema,
  type EmailTemplateFormData,
  emailTemplateTypeLabels,
  emailTemplateVariables,
  emailSettingsSchema,
  type EmailSettingsFormData,
  emailProviderPresets,
} from '@/lib/validations/settings'
import { defaultEmailTemplates } from '@/lib/email/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Building, Mail, FileText, Download, Trash2, Upload, X, Image, Link, CheckCircle2, XCircle, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'
import type { Practitioner, EmailTemplate, SessionType } from '@/types/database'

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

export default function SettingsPage() {
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null)
  const [emailTemplatesData, setEmailTemplatesData] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedTemplateType, setSelectedTemplateType] = useState<'invoice' | 'follow_up_7d'>('invoice')
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
  const supabase = createClient()

  // Settings form
  const {
    register: registerSettings,
    handleSubmit: handleSubmitSettings,
    setValue: setSettingsValue,
    formState: { errors: settingsErrors },
  } = useForm<PractitionerSettingsFormData>({
    resolver: zodResolver(practitionerSettingsSchema),
  })

  // Email template form
  const {
    register: registerTemplate,
    handleSubmit: handleSubmitTemplate,
    setValue: setTemplateValue,
    watch: watchTemplate,
    formState: { errors: templateErrors },
  } = useForm<EmailTemplateFormData>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      type: 'invoice',
      subject: '',
      body: '',
    },
  })

  const templateBody = watchTemplate('body')

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

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get practitioner
        const { data: practitionerData } = await supabase
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
          setSettingsValue('phone', practitionerData.phone || '')
          setSettingsValue('practice_name', practitionerData.practice_name || '')
          setSettingsValue('specialty', practitionerData.specialty || '')
          setSettingsValue('address', practitionerData.address || '')
          setSettingsValue('city', practitionerData.city || '')
          setSettingsValue('postal_code', practitionerData.postal_code || '')
          setSettingsValue('siret', practitionerData.siret || '')
          setSettingsValue('rpps', practitionerData.rpps || '')
          setSettingsValue('default_rate', practitionerData.default_rate)
          setSettingsValue('invoice_prefix', practitionerData.invoice_prefix)
          setSettingsValue('primary_color', practitionerData.primary_color)
          setStampUrl(practitionerData.stamp_url)

          // Get email templates
          const { data: templates } = await supabase
            .from('email_templates')
            .select('*')
            .eq('practitioner_id', practitionerData.id)

          if (templates) {
            setEmailTemplatesData(templates)
          }

          // Get patients for export
          const { data: patientsData } = await supabase
            .from('patients')
            .select('id, first_name, last_name')
            .eq('practitioner_id', practitionerData.id)
            .order('last_name')

          if (patientsData) {
            setPatients(patientsData)
          }

          const { data: sessionTypesData, error: sessionTypesError } = await supabase
            .from('session_types')
            .select('*')
            .eq('practitioner_id', practitionerData.id)
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
  }, [supabase, setSettingsValue, setEmailSettingsValue, toast])

  // Load template content when type changes
  useEffect(() => {
    const existingTemplate = emailTemplatesData.find(
      (t) => t.type === selectedTemplateType
    )

    if (existingTemplate) {
      setTemplateValue('subject', existingTemplate.subject)
      setTemplateValue('body', existingTemplate.body)
    } else {
      const defaultTemplate = defaultEmailTemplates[selectedTemplateType]
      setTemplateValue('subject', defaultTemplate.subject)
      setTemplateValue('body', defaultTemplate.body)
    }
    setTemplateValue('type', selectedTemplateType)
  }, [selectedTemplateType, emailTemplatesData, setTemplateValue])

  // Save settings
  const onSaveSettings = async (data: PractitionerSettingsFormData) => {
    if (!practitioner) return

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('practitioners')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || null,
          practice_name: data.practice_name || null,
          specialty: data.specialty || null,
          address: data.address || null,
          city: data.city || null,
          postal_code: data.postal_code || null,
          siret: data.siret || null,
          rpps: data.rpps || null,
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

  // Save email template
  const onSaveTemplate = async (data: EmailTemplateFormData) => {
    if (!practitioner) return

    setIsSaving(true)

    try {
      const existingTemplate = emailTemplatesData.find(
        (t) => t.type === data.type
      )

      if (existingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            subject: data.subject,
            body: data.body,
          })
          .eq('id', existingTemplate.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('email_templates').insert({
          practitioner_id: practitioner.id,
          type: data.type,
          subject: data.subject,
          body: data.body,
        })

        if (error) throw error
      }

      // Refresh templates
      const { data: templates } = await supabase
        .from('email_templates')
        .select('*')
        .eq('practitioner_id', practitioner.id)

      if (templates) {
        setEmailTemplatesData(templates)
      }

      toast({
        variant: 'success',
        title: 'Template enregistré',
        description: 'Le template email a été sauvegardé',
      })
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder le template',
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
      const { data, error } = await supabase
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
      const { data: patient } = await supabase
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

  // Upload stamp image
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
      const fileExt = file.name.split('.').pop()
      const fileName = `${practitioner.id}/stamp.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('stamps')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('stamps')
        .getPublicUrl(fileName)

      // Update practitioner with stamp URL
      const { error: updateError } = await supabase
        .from('practitioners')
        .update({ stamp_url: publicUrl })
        .eq('id', practitioner.id)

      if (updateError) throw updateError

      setStampUrl(publicUrl)

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
      const { error } = await supabase
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
      const { error } = await supabase
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

      <Tabs defaultValue="profile" className="space-y-6">
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
          <TabsTrigger value="emails">
            <Mail className="mr-2 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="gdpr">
            <Download className="mr-2 h-4 w-4" />
            RGPD
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

                <div className="grid gap-4 sm:grid-cols-2">
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
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <span className="text-sm font-medium">
                            {type.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {Number(type.price).toFixed(2)} €
                          </span>
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
                  Envoyez et recevez des emails directement depuis Osteoflow via votre adresse email personnelle
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
                      Les réponses de vos patients apparaissent automatiquement dans Osteoflow
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
          </div>
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle>Templates email</CardTitle>
              <CardDescription>
                Personnalisez vos emails automatiques
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Button
                  variant={selectedTemplateType === 'invoice' ? 'default' : 'outline'}
                  onClick={() => setSelectedTemplateType('invoice')}
                >
                  {emailTemplateTypeLabels.invoice}
                </Button>
                <Button
                  variant={selectedTemplateType === 'follow_up_7d' ? 'default' : 'outline'}
                  onClick={() => setSelectedTemplateType('follow_up_7d')}
                >
                  {emailTemplateTypeLabels.follow_up_7d}
                </Button>
              </div>

              <form onSubmit={handleSubmitTemplate(onSaveTemplate)}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Objet *</Label>
                    <Input
                      id="subject"
                      {...registerTemplate('subject')}
                    />
                    {templateErrors.subject && (
                      <p className="text-sm text-destructive">
                        {templateErrors.subject.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body">Contenu *</Label>
                    <Textarea
                      id="body"
                      {...registerTemplate('body')}
                      rows={10}
                    />
                    {templateErrors.body && (
                      <p className="text-sm text-destructive">
                        {templateErrors.body.message}
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Variables disponibles :</p>
                    <div className="flex flex-wrap gap-2">
                      {emailTemplateVariables[selectedTemplateType].map((variable) => (
                        <Badge
                          key={variable.key}
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => {
                            setTemplateValue('body', templateBody + variable.key)
                          }}
                        >
                          {variable.key}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enregistrer le template
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
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
                  <li>Les données sont stockées de manière sécurisée sur Supabase (PostgreSQL)</li>
                  <li>Chaque praticien n&apos;accède qu&apos;à ses propres données (RLS)</li>
                  <li>L&apos;export inclut toutes les données du patient, consultations et factures</li>
                  <li>La suppression est définitive et irréversible</li>
                  <li>Un journal d&apos;audit trace toutes les modifications</li>
                </ul>
              </div>
            </CardContent>
          </Card>
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
