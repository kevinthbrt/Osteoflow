'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { patientSchema } from '@/lib/validations/patient'
import { createClient } from '@/lib/db/client'
import { getPhonePlaceholder } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ClipboardPaste } from 'lucide-react'
import { DoctolibPasteDialog } from '@/components/patients/doctolib-paste-dialog'
import type { PatientFormData } from '@/lib/validations/patient'

const quickAddPatientSchema = patientSchema.pick({
  gender: true,
  first_name: true,
  last_name: true,
  birth_date: true,
  phone: true,
  email: true,
})

type QuickAddPatientFormData = z.infer<typeof quickAddPatientSchema>

export interface QuickAddedPatient {
  id: string
  first_name: string
  last_name: string
}

interface QuickAddPatientDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (patient: QuickAddedPatient) => void
}

export function QuickAddPatientDialog({ open, onClose, onCreated }: QuickAddPatientDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [doctolibOpen, setDoctolibOpen] = useState(false)
  // Champs importés de Doctolib mais sans input dans ce formulaire rapide
  // (profession, médecin traitant). On les conserve pour ne rien perdre à la
  // création — l'email, lui, a désormais son propre champ ci-dessous.
  const [importedExtras, setImportedExtras] = useState<Partial<PatientFormData>>({})
  const db = createClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuickAddPatientFormData>({
    resolver: zodResolver(quickAddPatientSchema),
    defaultValues: { gender: undefined, first_name: '', last_name: '', birth_date: '', phone: '', email: '' },
  })

  const gender = watch('gender')

  const handleDoctolibImport = (data: Partial<PatientFormData>) => {
    if (data.gender) setValue('gender', data.gender)
    if (data.first_name) setValue('first_name', data.first_name)
    if (data.last_name) setValue('last_name', data.last_name)
    if (data.birth_date) setValue('birth_date', data.birth_date)
    if (data.phone) setValue('phone', data.phone)
    if (data.email) setValue('email', data.email)
    // Conserve les champs supplémentaires détectés (non affichés) pour l'insert.
    setImportedExtras({
      ...(data.profession ? { profession: data.profession } : {}),
      ...(data.primary_physician ? { primary_physician: data.primary_physician } : {}),
    })
  }

  const handleClose = () => {
    reset()
    setImportedExtras({})
    onClose()
  }

  const onSubmit = async (data: QuickAddPatientFormData) => {
    setIsLoading(true)
    try {
      const { data: practitioner } = await db.from('practitioners').select('id').single()
      if (!practitioner) throw new Error('Praticien introuvable')

      const { data: patient, error } = await db
        .from('patients')
        .insert({
          practitioner_id: practitioner.id,
          gender: data.gender,
          first_name: data.first_name,
          last_name: data.last_name,
          birth_date: data.birth_date,
          phone: data.phone,
          // Email + champs importés de Doctolib : n'insérer que s'ils ont une
          // valeur, pour ne pas écraser avec des chaînes vides.
          ...(data.email ? { email: data.email } : {}),
          ...(importedExtras.profession ? { profession: importedExtras.profession } : {}),
          ...(importedExtras.primary_physician ? { primary_physician: importedExtras.primary_physician } : {}),
        })
        .select('id, first_name, last_name')
        .single()

      if (error) throw error

      toast({ title: 'Patient créé' })
      reset()
      setImportedExtras({})
      onCreated(patient as QuickAddedPatient)
    } catch {
      toast({ title: 'Erreur lors de la création du patient', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau patient</DialogTitle>
            <DialogDescription>
              Créez rapidement une fiche patient. Vous pourrez compléter les informations plus tard depuis sa fiche.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setDoctolibOpen(true)} disabled={isLoading}>
              <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
              Coller depuis Doctolib
            </Button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prénom</Label>
                <Input {...register('first_name')} disabled={isLoading} />
                {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input {...register('last_name')} disabled={isLoading} />
                {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sexe</Label>
                <Select value={gender} onValueChange={(value) => setValue('gender', value as 'M' | 'F')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Homme</SelectItem>
                    <SelectItem value="F">Femme</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date de naissance</Label>
                <Input type="date" {...register('birth_date')} disabled={isLoading} />
                {errors.birth_date && <p className="text-xs text-destructive">{errors.birth_date.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input placeholder={getPhonePlaceholder()} {...register('phone')} disabled={isLoading} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="patient@email.fr" {...register('email')} disabled={isLoading} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer et ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DoctolibPasteDialog
        open={doctolibOpen}
        onOpenChange={setDoctolibOpen}
        onImport={handleDoctolibImport}
      />
    </>
  )
}
