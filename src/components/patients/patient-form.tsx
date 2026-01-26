'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import type { Patient } from '@/types/database'

interface PatientFormProps {
  patient?: Patient
  mode: 'create' | 'edit'
}

export function PatientForm({ patient, mode }: PatientFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

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
      trauma_history: patient?.trauma_history || '',
      medical_history: patient?.medical_history || '',
      surgical_history: patient?.surgical_history || '',
      family_history: patient?.family_history || '',
      notes: patient?.notes || '',
    },
  })

  const gender = watch('gender')

  const onSubmit = async (data: PatientFormData) => {
    setIsLoading(true)

    try {
      // Get current practitioner
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Vous devez être connecté',
        })
        return
      }

      const { data: practitioner } = await supabase
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
        trauma_history: data.trauma_history || null,
        medical_history: data.medical_history || null,
        surgical_history: data.surgical_history || null,
        family_history: data.family_history || null,
        notes: data.notes || null,
      }

      if (mode === 'create') {
        const { data: newPatient, error } = await supabase
          .from('patients')
          .insert({
            ...cleanedData,
            practitioner_id: practitioner.id,
          })
          .select()
          .single()

        if (error) throw error

        toast({
          variant: 'success',
          title: 'Patient créé',
          description: `${data.first_name} ${data.last_name} a été ajouté`,
        })

        router.push(`/patients/${newPatient.id}`)
      } else if (patient) {
        const { error } = await supabase
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
        </CardContent>
      </Card>

      {/* Medical History */}
      <Card>
        <CardHeader>
          <CardTitle>Antécédents</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="trauma_history">Antécédents traumatiques</Label>
            <Textarea
              id="trauma_history"
              {...register('trauma_history')}
              disabled={isLoading}
              placeholder="Fractures, entorses, accidents..."
              rows={3}
            />
            {errors.trauma_history && (
              <p className="text-sm text-destructive">{errors.trauma_history.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical_history">Antécédents médicaux</Label>
            <Textarea
              id="medical_history"
              {...register('medical_history')}
              disabled={isLoading}
              placeholder="Maladies, traitements en cours..."
              rows={3}
            />
            {errors.medical_history && (
              <p className="text-sm text-destructive">{errors.medical_history.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="surgical_history">Antécédents chirurgicaux</Label>
            <Textarea
              id="surgical_history"
              {...register('surgical_history')}
              disabled={isLoading}
              placeholder="Opérations, interventions..."
              rows={3}
            />
            {errors.surgical_history && (
              <p className="text-sm text-destructive">{errors.surgical_history.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="family_history">Antécédents familiaux</Label>
            <Textarea
              id="family_history"
              {...register('family_history')}
              disabled={isLoading}
              placeholder="Maladies héréditaires, pathologies familiales..."
              rows={3}
            />
            {errors.family_history && (
              <p className="text-sm text-destructive">{errors.family_history.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

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
    </form>
  )
}
