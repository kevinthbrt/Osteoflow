'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/db/client'
import { patientSchema, type PatientFormData } from '@/lib/validations/patient'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import type { MedicalHistoryType, OnsetDurationUnit, Patient } from '@/types/database'

interface PatientFormProps {
  patient?: Patient
  mode: 'create' | 'edit'
}

export function PatientForm({ patient, mode }: PatientFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [draftEntries, setDraftEntries] = useState<DraftMedicalHistoryEntry[]>([])
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [historyFormData, setHistoryFormData] = useState<HistoryFormData>(initialHistoryFormData)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const db = createClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      gender: patient?.gender || undefined,
      first_name: patient?.first_name || '',
      last_name: patient?.last_name || '',
      birth_date: patient?.birth_date || '',
      phone: patient?.phone || '',
      email: patient?.email || '',
      profession: patient?.profession || '',
      sport_activity: patient?.sport_activity || '',
      primary_physician: patient?.primary_physician || '',
      notes: patient?.notes || '',
    },
  })

  const gender = watch('gender')

  // Pre-fill from Doctolib import (URL params or localStorage)
  useEffect(() => {
    if (mode !== 'create') return

    // From URL query params (from dashboard Doctolib widget)
    const urlLastName = searchParams.get('lastName')
    const urlFirstName = searchParams.get('firstName')
    if (urlLastName) setValue('last_name', urlLastName)
    if (urlFirstName) setValue('first_name', urlFirstName)

    // From localStorage (from Doctolib "Importer patient" button)
    try {
      const imported = localStorage.getItem('doctolib_patient_import')
      if (imported) {
        const data = JSON.parse(imported)
        if (data.lastName) setValue('last_name', data.lastName)
        if (data.firstName) setValue('first_name', data.firstName)
        if (data.phone) setValue('phone', data.phone)
        if (data.email) setValue('email', data.email)
        if (data.gender) setValue('gender', data.gender === 'F' ? 'F' : 'M')
        if (data.primaryPhysician) setValue('primary_physician', data.primaryPhysician)
        if (data.birthDate) {
          // Convert DD/MM/YYYY to YYYY-MM-DD
          const parts = data.birthDate.split('/')
          if (parts.length === 3) {
            setValue('birth_date', `${parts[2]}-${parts[1]}-${parts[0]}`)
          }
        }
        // Clear after use
        localStorage.removeItem('doctolib_patient_import')
      }
    } catch { /* ignore */ }
  }, [mode, searchParams, setValue])

  const groupedDraftEntries = useMemo(() => {
    const grouped = draftEntries.reduce((acc, entry) => {
      if (!acc[entry.history_type]) acc[entry.history_type] = []
      acc[entry.history_type].push(entry)
      return acc
    }, {} as Record<MedicalHistoryType, DraftMedicalHistoryEntry[]>)

    return Object.entries(grouped) as [MedicalHistoryType, DraftMedicalHistoryEntry[]][]
  }, [draftEntries])

  const openHistoryDialog = (entry?: DraftMedicalHistoryEntry) => {
    if (entry) {
      setEditingEntryId(entry.id)
      let onset_mode: OnsetMode = 'none'
      if (entry.onset_date) onset_mode = 'date'
      else if (entry.onset_age !== null) onset_mode = 'age'
      else if (entry.onset_duration_value) onset_mode = 'duration'

      setHistoryFormData({
        history_type: entry.history_type,
        description: entry.description,
        onset_mode,
        onset_date: entry.onset_date || '',
        onset_age: entry.onset_age?.toString() || '',
        onset_duration_value: entry.onset_duration_value?.toString() || '',
        onset_duration_unit: entry.onset_duration_unit || 'years',
        is_vigilance: entry.is_vigilance,
        note: entry.note || '',
      })
    } else {
      setEditingEntryId(null)
      setHistoryFormData(initialHistoryFormData)
    }
    setIsHistoryDialogOpen(true)
  }

  const handleHistorySubmit = () => {
    if (!historyFormData.description.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'La description est requise',
      })
      return
    }

    const nextEntry: DraftMedicalHistoryEntry = {
      id: editingEntryId ?? crypto.randomUUID(),
      history_type: historyFormData.history_type,
      description: historyFormData.description.trim(),
      onset_date: historyFormData.onset_mode === 'date' ? historyFormData.onset_date || null : null,
      onset_age: historyFormData.onset_mode === 'age'
        ? (historyFormData.onset_age ? parseInt(historyFormData.onset_age) : null)
        : null,
      onset_duration_value: historyFormData.onset_mode === 'duration'
        ? (historyFormData.onset_duration_value ? parseInt(historyFormData.onset_duration_value) : null)
        : null,
      onset_duration_unit: historyFormData.onset_mode === 'duration'
        ? historyFormData.onset_duration_unit
        : null,
      is_vigilance: historyFormData.is_vigilance,
      note: historyFormData.note.trim() || null,
    }

    setDraftEntries((prev) => {
      if (editingEntryId) {
        return prev.map((entry) => (entry.id === editingEntryId ? nextEntry : entry))
      }
      return [...prev, nextEntry]
    })

    setIsHistoryDialogOpen(false)
    setEditingEntryId(null)
    setHistoryFormData(initialHistoryFormData)
  }

  const handleDeleteDraftEntry = (entryId: string) => {
    setDraftEntries((prev) => prev.filter((entry) => entry.id !== entryId))
  }

  const onSubmit = async (data: PatientFormData) => {
    setIsLoading(true)

    try {
      // Get current practitioner
      const { data: { user } } = await db.auth.getUser()
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Vous devez être connecté',
        })
        return
      }

      const { data: practitioner } = await db
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Profil praticien non trouvé',
        })
        return
      }

      // Clean empty strings to null
      const cleanedData = {
        ...data,
        email: data.email || null,
        profession: data.profession || null,
        sport_activity: data.sport_activity || null,
        primary_physician: data.primary_physician || null,
        notes: data.notes || null,
      }

      if (mode === 'create') {
        const { data: newPatient, error } = await db
          .from('patients')
          .insert({
            ...cleanedData,
            practitioner_id: practitioner.id,
          })
          .select()
          .single()

        if (error) throw error

        if (draftEntries.length > 0) {
          const historyPayload = draftEntries.map((entry, index) => ({
            patient_id: newPatient.id,
            history_type: entry.history_type,
            description: entry.description,
            onset_date: entry.onset_date || null,
            onset_age: entry.onset_age,
            onset_duration_value: entry.onset_duration_value,
            onset_duration_unit: entry.onset_duration_unit,
            is_vigilance: entry.is_vigilance,
            note: entry.note || null,
            display_order: index,
          }))

          const { error: historyError } = await db
            .from('medical_history_entries')
            .insert(historyPayload)

          if (historyError) throw historyError
        }

        toast({
          variant: 'success',
          title: 'Patient créé',
          description: `${data.first_name} ${data.last_name} a été ajouté`,
        })

        router.push(`/patients/${newPatient.id}`)
      } else if (patient) {
        const { error } = await db
          .from('patients')
          .update(cleanedData)
          .eq('id', patient.id)

        if (error) throw error

        toast({
          variant: 'success',
          title: 'Patient mis à jour',
          description: 'Les modifications ont été enregistrées',
        })

        router.push(`/patients/${patient.id}`)
      }

      router.refresh()
    } catch (error) {
      console.error('Error saving patient:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder le patient',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Identification */}
      <Card>
        <CardHeader>
          <CardTitle>Identification</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gender">Sexe *</Label>
            <Select
              value={gender}
              onValueChange={(value) => setValue('gender', value as 'M' | 'F')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Homme</SelectItem>
                <SelectItem value="F">Femme</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && (
              <p className="text-sm text-destructive">{errors.gender.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_date">Date de naissance *</Label>
            <Input
              id="birth_date"
              type="date"
              {...register('birth_date')}
              disabled={isLoading}
            />
            {errors.birth_date && (
              <p className="text-sm text-destructive">{errors.birth_date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">Nom *</Label>
            <Input
              id="last_name"
              {...register('last_name')}
              disabled={isLoading}
              placeholder="Dupont"
            />
            {errors.last_name && (
              <p className="text-sm text-destructive">{errors.last_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="first_name">Prénom *</Label>
            <Input
              id="first_name"
              {...register('first_name')}
              disabled={isLoading}
              placeholder="Jean"
            />
            {errors.first_name && (
              <p className="text-sm text-destructive">{errors.first_name.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone *</Label>
            <Input
              id="phone"
              {...register('phone')}
              disabled={isLoading}
              placeholder="06 12 34 56 78"
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              disabled={isLoading}
              placeholder="jean.dupont@email.fr"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profession">Profession</Label>
            <Input
              id="profession"
              {...register('profession')}
              disabled={isLoading}
              placeholder="Ingénieur informatique"
            />
            {errors.profession && (
              <p className="text-sm text-destructive">{errors.profession.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sport_activity">Activité sportive</Label>
            <Input
              id="sport_activity"
              {...register('sport_activity')}
              disabled={isLoading}
              placeholder="Course à pied, yoga, natation..."
            />
            {errors.sport_activity && (
              <p className="text-sm text-destructive">{errors.sport_activity.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="primary_physician">Médecin traitant</Label>
            <Input
              id="primary_physician"
              {...register('primary_physician')}
              disabled={isLoading}
              placeholder="Dr. Martin"
            />
            {errors.primary_physician && (
              <p className="text-sm text-destructive">{errors.primary_physician.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {mode === 'create' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Antécédents</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openHistoryDialog()}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ajoutez les antécédents structurés dès la création du patient.
              </p>
            ) : (
              <div className="space-y-3">
                {groupedDraftEntries.map(([type, entries]) => (
                  <div key={type}>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      {historyTypeLabels[type]}
                    </p>
                    <div className="space-y-2">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg border p-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{historyTypeLabels[entry.history_type]}</Badge>
                              {entry.is_vigilance && (
                                <Badge variant="destructive">Vigilance</Badge>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-medium">{entry.description}</p>
                            {formatDraftOnset(entry) && (
                              <p className="text-xs text-muted-foreground">
                                {formatDraftOnset(entry)}
                              </p>
                            )}
                            {entry.note && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {entry.note}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openHistoryDialog(entry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDraftEntry(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Textarea
              id="notes"
              {...register('notes')}
              disabled={isLoading}
              placeholder="Notes complémentaires..."
              rows={4}
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

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
          {mode === 'create' ? 'Créer le patient' : 'Enregistrer'}
        </Button>
      </div>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntryId ? 'Modifier un antécédent' : 'Ajouter un antécédent'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={historyFormData.history_type}
                onValueChange={(value) =>
                  setHistoryFormData((prev) => ({
                    ...prev,
                    history_type: value as MedicalHistoryType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(historyTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={historyFormData.description}
                onChange={(e) =>
                  setHistoryFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Début</Label>
              <Select
                value={historyFormData.onset_mode}
                onValueChange={(value) =>
                  setHistoryFormData((prev) => ({
                    ...prev,
                    onset_mode: value as OnsetMode,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non précisé</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="age">Âge</SelectItem>
                  <SelectItem value="duration">Durée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {historyFormData.onset_mode === 'date' && (
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={historyFormData.onset_date}
                  onChange={(e) =>
                    setHistoryFormData((prev) => ({
                      ...prev,
                      onset_date: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            {historyFormData.onset_mode === 'age' && (
              <div className="space-y-2">
                <Label>Âge</Label>
                <Input
                  type="number"
                  min="0"
                  value={historyFormData.onset_age}
                  onChange={(e) =>
                    setHistoryFormData((prev) => ({
                      ...prev,
                      onset_age: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            {historyFormData.onset_mode === 'duration' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Durée</Label>
                  <Input
                    type="number"
                    min="1"
                    value={historyFormData.onset_duration_value}
                    onChange={(e) =>
                      setHistoryFormData((prev) => ({
                        ...prev,
                        onset_duration_value: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unité</Label>
                  <Select
                    value={historyFormData.onset_duration_unit}
                    onValueChange={(value) =>
                      setHistoryFormData((prev) => ({
                        ...prev,
                        onset_duration_unit: value as OnsetDurationUnit,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(durationUnitLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                checked={historyFormData.is_vigilance}
                onCheckedChange={(value) =>
                  setHistoryFormData((prev) => ({
                    ...prev,
                    is_vigilance: Boolean(value),
                  }))
                }
              />
              <Label>Vigilance</Label>
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={historyFormData.note}
                onChange={(e) =>
                  setHistoryFormData((prev) => ({
                    ...prev,
                    note: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsHistoryDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" onClick={handleHistorySubmit}>
              {editingEntryId ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

type OnsetMode = 'none' | 'date' | 'age' | 'duration'

interface HistoryFormData {
  history_type: MedicalHistoryType
  description: string
  onset_mode: OnsetMode
  onset_date: string
  onset_age: string
  onset_duration_value: string
  onset_duration_unit: OnsetDurationUnit
  is_vigilance: boolean
  note: string
}

interface DraftMedicalHistoryEntry {
  id: string
  history_type: MedicalHistoryType
  description: string
  onset_date: string | null
  onset_age: number | null
  onset_duration_value: number | null
  onset_duration_unit: OnsetDurationUnit | null
  is_vigilance: boolean
  note: string | null
}

const initialHistoryFormData: HistoryFormData = {
  history_type: 'medical',
  description: '',
  onset_mode: 'none',
  onset_date: '',
  onset_age: '',
  onset_duration_value: '',
  onset_duration_unit: 'years',
  is_vigilance: false,
  note: '',
}

const historyTypeLabels: Record<MedicalHistoryType, string> = {
  traumatic: 'Traumatiques',
  medical: 'Médicaux',
  surgical: 'Chirurgicaux',
  family: 'Familiaux',
}

const durationUnitLabels: Record<OnsetDurationUnit, string> = {
  days: 'jours',
  weeks: 'semaines',
  months: 'mois',
  years: 'ans',
}

function formatDraftOnset(entry: DraftMedicalHistoryEntry): string | null {
  if (entry.onset_date) {
    return `Depuis le ${new Date(entry.onset_date).toLocaleDateString('fr-FR')}`
  }
  if (entry.onset_age !== null) {
    return `Depuis l'âge de ${entry.onset_age} ans`
  }
  if (entry.onset_duration_value && entry.onset_duration_unit) {
    return `Depuis ${entry.onset_duration_value} ${durationUnitLabels[entry.onset_duration_unit]}`
  }
  return null
}
