'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Plus, AlertTriangle, Calendar, User, Clock, Pencil, Trash2, Loader2 } from 'lucide-react'
import type { MedicalHistoryEntry, MedicalHistoryType, OnsetDurationUnit } from '@/types/database'

interface MedicalHistorySectionProps {
  patientId: string
  entries: MedicalHistoryEntry[]
  onEntriesChange?: () => void
}

type OnsetMode = 'none' | 'date' | 'age' | 'duration'

interface FormData {
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

const initialFormData: FormData = {
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

const historyTypeColors: Record<MedicalHistoryType, string> = {
  traumatic: 'bg-orange-100 text-orange-800 border-orange-200',
  medical: 'bg-blue-100 text-blue-800 border-blue-200',
  surgical: 'bg-purple-100 text-purple-800 border-purple-200',
  family: 'bg-green-100 text-green-800 border-green-200',
}

const durationUnitLabels: Record<OnsetDurationUnit, string> = {
  days: 'jours',
  weeks: 'semaines',
  months: 'mois',
  years: 'ans',
}

function formatOnset(entry: MedicalHistoryEntry): string | null {
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

export function MedicalHistorySection({ patientId, entries, onEntriesChange }: MedicalHistorySectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editingEntry, setEditingEntry] = useState<MedicalHistoryEntry | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const { toast } = useToast()
  const supabase = createClient()

  // Group entries by type
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.history_type]) {
      acc[entry.history_type] = []
    }
    acc[entry.history_type].push(entry)
    return acc
  }, {} as Record<MedicalHistoryType, MedicalHistoryEntry[]>)

  const openAddDialog = (type?: MedicalHistoryType) => {
    setEditingEntry(null)
    setFormData({
      ...initialFormData,
      history_type: type || 'medical',
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (entry: MedicalHistoryEntry) => {
    setEditingEntry(entry)

    // Determine onset mode
    let onset_mode: OnsetMode = 'none'
    if (entry.onset_date) onset_mode = 'date'
    else if (entry.onset_age !== null) onset_mode = 'age'
    else if (entry.onset_duration_value) onset_mode = 'duration'

    setFormData({
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
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Build the data object based on onset mode
      const data: {
        patient_id: string
        history_type: MedicalHistoryType
        description: string
        onset_date: string | null
        onset_age: number | null
        onset_duration_value: number | null
        onset_duration_unit: OnsetDurationUnit | null
        is_vigilance: boolean
        note: string | null
      } = {
        patient_id: patientId,
        history_type: formData.history_type,
        description: formData.description,
        onset_date: null,
        onset_age: null,
        onset_duration_value: null,
        onset_duration_unit: null,
        is_vigilance: formData.is_vigilance,
        note: formData.note || null,
      }

      // Set onset based on mode
      switch (formData.onset_mode) {
        case 'date':
          data.onset_date = formData.onset_date || null
          break
        case 'age':
          data.onset_age = formData.onset_age ? parseInt(formData.onset_age) : null
          break
        case 'duration':
          data.onset_duration_value = formData.onset_duration_value
            ? parseInt(formData.onset_duration_value)
            : null
          data.onset_duration_unit = formData.onset_duration_value
            ? formData.onset_duration_unit
            : null
          break
      }

      if (editingEntry) {
        // Update existing entry
        const { error } = await supabase
          .from('medical_history_entries')
          .update(data)
          .eq('id', editingEntry.id)

        if (error) throw error

        toast({
          variant: 'success',
          title: 'Antécédent modifié',
          description: 'L\'antécédent a été mis à jour',
        })
      } else {
        // Insert new entry
        const { error } = await supabase
          .from('medical_history_entries')
          .insert(data)

        if (error) throw error

        toast({
          variant: 'success',
          title: 'Antécédent ajouté',
          description: 'Le nouvel antécédent a été enregistré',
        })
      }

      setIsDialogOpen(false)
      setFormData(initialFormData)
      setEditingEntry(null)
      onEntriesChange?.()
    } catch (error) {
      console.error('Error saving medical history:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder l\'antécédent',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (entry: MedicalHistoryEntry) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet antécédent ?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('medical_history_entries')
        .delete()
        .eq('id', entry.id)

      if (error) throw error

      toast({
        variant: 'success',
        title: 'Antécédent supprimé',
        description: 'L\'antécédent a été supprimé',
      })
      onEntriesChange?.()
    } catch (error) {
      console.error('Error deleting medical history:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer l\'antécédent',
      })
    }
  }

  const types: MedicalHistoryType[] = ['traumatic', 'medical', 'surgical', 'family']

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Antécédents</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => openAddDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Modifier l\'antécédent' : 'Nouvel antécédent'}
                </DialogTitle>
                <DialogDescription>
                  Renseignez les informations de l&apos;antécédent médical
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Type */}
                <div className="space-y-2">
                  <Label htmlFor="history_type">Type *</Label>
                  <Select
                    value={formData.history_type}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      history_type: value as MedicalHistoryType
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type} value={type}>
                          {historyTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Décrivez l'antécédent..."
                    rows={2}
                    required
                  />
                </div>

                {/* Onset Mode Selection */}
                <div className="space-y-3">
                  <Label>Ancienneté (optionnel)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={formData.onset_mode === 'none' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, onset_mode: 'none' }))}
                    >
                      Non précisé
                    </Button>
                    <Button
                      type="button"
                      variant={formData.onset_mode === 'date' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, onset_mode: 'date' }))}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Date
                    </Button>
                    <Button
                      type="button"
                      variant={formData.onset_mode === 'age' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, onset_mode: 'age' }))}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Âge
                    </Button>
                    <Button
                      type="button"
                      variant={formData.onset_mode === 'duration' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, onset_mode: 'duration' }))}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Durée
                    </Button>
                  </div>

                  {/* Onset fields based on mode */}
                  {formData.onset_mode === 'date' && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="onset_date" className="sr-only">Date de début</Label>
                      <Input
                        id="onset_date"
                        type="date"
                        value={formData.onset_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, onset_date: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  )}

                  {formData.onset_mode === 'age' && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="onset_age" className="sr-only">Âge de début</Label>
                      <Input
                        id="onset_age"
                        type="number"
                        min="0"
                        max="150"
                        value={formData.onset_age}
                        onChange={(e) => setFormData(prev => ({ ...prev, onset_age: e.target.value }))}
                        placeholder="Âge"
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">ans</span>
                    </div>
                  )}

                  {formData.onset_mode === 'duration' && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="onset_duration" className="sr-only">Durée</Label>
                      <Input
                        id="onset_duration"
                        type="number"
                        min="1"
                        value={formData.onset_duration_value}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          onset_duration_value: e.target.value
                        }))}
                        placeholder="Valeur"
                        className="w-24"
                      />
                      <Select
                        value={formData.onset_duration_unit}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          onset_duration_unit: value as OnsetDurationUnit
                        }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">jours</SelectItem>
                          <SelectItem value="weeks">semaines</SelectItem>
                          <SelectItem value="months">mois</SelectItem>
                          <SelectItem value="years">ans</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Vigilance */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_vigilance"
                    checked={formData.is_vigilance}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      is_vigilance: checked === true
                    }))}
                  />
                  <Label
                    htmlFor="is_vigilance"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Point de vigilance
                  </Label>
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <Label htmlFor="note">Note (optionnel)</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Notes complémentaires..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingEntry ? 'Modifier' : 'Ajouter'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aucun antécédent structuré renseigné
          </p>
        ) : (
          types.map((type) => {
            const typeEntries = groupedEntries[type]
            if (!typeEntries || typeEntries.length === 0) return null

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {historyTypeLabels[type]}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => openAddDialog(type)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {typeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'group relative rounded-lg border p-3 text-sm',
                        entry.is_vigilance && 'border-amber-300 bg-amber-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            {entry.is_vigilance && (
                              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            )}
                            <span className="font-medium">{entry.description}</span>
                          </div>
                          {formatOnset(entry) && (
                            <p className="text-xs text-muted-foreground">
                              {formatOnset(entry)}
                            </p>
                          )}
                          {entry.note && (
                            <p className="text-xs text-muted-foreground italic">
                              {entry.note}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEditDialog(entry)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(entry)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}

        {/* Quick add buttons */}
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {types.map((type) => (
              <Badge
                key={type}
                variant="outline"
                className={cn(
                  'cursor-pointer hover:opacity-80 transition-opacity',
                  historyTypeColors[type]
                )}
                onClick={() => openAddDialog(type)}
              >
                <Plus className="mr-1 h-3 w-3" />
                {historyTypeLabels[type]}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
