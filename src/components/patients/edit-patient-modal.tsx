'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/db/client'
import { patientSchema, type PatientFormData } from '@/lib/validations/patient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import type { Patient } from '@/types/database'

interface EditPatientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: Patient
  onUpdated: (patient: Patient) => void
}

export function EditPatientModal({
  open,
  onOpenChange,
  patient,
  onUpdated,
}: EditPatientModalProps) {
  const [isLoading, setIsLoading] = useState(false)
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
      gender: patient.gender,
      first_name: patient.first_name,
      last_name: patient.last_name,
      birth_date: patient.birth_date,
      phone: patient.phone,
      email: patient.email || '',
      profession: patient.profession || '',
      sport_activity: patient.sport_activity || '',
      primary_physician: patient.primary_physician || '',
      notes: patient.notes || '',
    },
  })

  const gender = watch('gender')

  const onSubmit = async (data: PatientFormData) => {
    setIsLoading(true)
    try {
      const cleanedData = {
        ...data,
        email: data.email || null,
        profession: data.profession || null,
        sport_activity: data.sport_activity || null,
        primary_physician: data.primary_physician || null,
        notes: data.notes || null,
      }

      const { error } = await db
        .from('patients')
        .update(cleanedData)
        .eq('id', patient.id)

      if (error) throw error

      const updatedPatient: Patient = {
        ...patient,
        ...cleanedData,
      }

      toast({
        variant: 'success',
        title: 'Patient mis à jour',
        description: 'Les informations du patient ont été enregistrées',
      })

      onUpdated(updatedPatient)
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating patient:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre à jour le patient',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier les informations du patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-gender">Sexe *</Label>
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
              <Label htmlFor="edit-birth_date">Date de naissance *</Label>
              <Input
                id="edit-birth_date"
                type="date"
                {...register('birth_date')}
                disabled={isLoading}
              />
              {errors.birth_date && (
                <p className="text-sm text-destructive">{errors.birth_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-last_name">Nom *</Label>
              <Input
                id="edit-last_name"
                {...register('last_name')}
                disabled={isLoading}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-first_name">Prénom *</Label>
              <Input
                id="edit-first_name"
                {...register('first_name')}
                disabled={isLoading}
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Téléphone *</Label>
              <Input
                id="edit-phone"
                {...register('phone')}
                disabled={isLoading}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-profession">Profession</Label>
            <Input
              id="edit-profession"
              {...register('profession')}
              disabled={isLoading}
            />
            {errors.profession && (
              <p className="text-sm text-destructive">{errors.profession.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-sport_activity">Activité sportive</Label>
            <Input
              id="edit-sport_activity"
              {...register('sport_activity')}
              disabled={isLoading}
            />
            {errors.sport_activity && (
              <p className="text-sm text-destructive">{errors.sport_activity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-primary_physician">Médecin traitant</Label>
            <Input
              id="edit-primary_physician"
              {...register('primary_physician')}
              disabled={isLoading}
            />
            {errors.primary_physician && (
              <p className="text-sm text-destructive">{errors.primary_physician.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              {...register('notes')}
              disabled={isLoading}
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
