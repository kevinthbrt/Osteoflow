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
import { Loader2, Building, Mail, FileText, Download, Trash2 } from 'lucide-react'
import type { Practitioner, EmailTemplate, Patient } from '@/types/database'
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
  const [patients, setPatients] = useState<Patient[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
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
          setSettingsValue('address', practitionerData.address || '')
          setSettingsValue('city', practitionerData.city || '')
          setSettingsValue('postal_code', practitionerData.postal_code || '')
          setSettingsValue('siret', practitionerData.siret || '')
          setSettingsValue('default_rate', practitionerData.default_rate)
          setSettingsValue('invoice_prefix', practitionerData.invoice_prefix)
          setSettingsValue('primary_color', practitionerData.primary_color)

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
  }, [supabase, setSettingsValue, toast])

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
          address: data.address || null,
          city: data.city || null,
          postal_code: data.postal_code || null,
          siret: data.siret || null,
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
        <TabsList>
          <TabsTrigger value="profile">
            <Building className="mr-2 h-4 w-4" />
            Cabinet
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="mr-2 h-4 w-4" />
            Facturation
          </TabsTrigger>
          <TabsTrigger value="emails">
            <Mail className="mr-2 h-4 w-4" />
            Emails
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

                <div className="space-y-2">
                  <Label htmlFor="practice_name">Nom du cabinet</Label>
                  <Input
                    id="practice_name"
                    {...registerSettings('practice_name')}
                    placeholder="Cabinet d'ostéopathie"
                  />
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

                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input
                    id="siret"
                    {...registerSettings('siret')}
                    placeholder="12345678901234"
                  />
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
