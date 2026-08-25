'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Cake, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConsultationForm } from '@/components/consultations/consultation-form'
import { ConsultationCockpit } from './consultation-cockpit'
import { calculateAge } from '@/lib/utils'
import type {
  Consultation,
  MedicalHistoryEntry,
  Patient,
  Practitioner,
} from '@/types/database'

interface NewConsultationScreenProps {
  patient: Patient
  practitioner: Practitioner
  medicalHistoryEntries: MedicalHistoryEntry[]
  pastConsultations: Consultation[]
  isBirthday: boolean
}

const PREFERENCE_KEY = 'osteoflow:consultation-screen'

/**
 * Choisit l'écran de consultation. Le cockpit est la valeur par défaut ; le
 * formulaire complet reste accessible d'un clic tant qu'il porte seul la
 * facturation, les pièces jointes et les envois d'e-mails.
 *
 * Le choix est mémorisé : un praticien qui préfère l'ancien écran ne doit pas
 * avoir à le redemander à chaque patient.
 */
export function NewConsultationScreen({
  patient,
  practitioner,
  medicalHistoryEntries,
  pastConsultations,
  isBirthday,
}: NewConsultationScreenProps) {
  const [classic, setClassic] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setClassic(localStorage.getItem(PREFERENCE_KEY) === 'classic')
    } catch {
      setClassic(false)
    }
  }, [])

  function choose(next: boolean) {
    setClassic(next)
    try {
      localStorage.setItem(PREFERENCE_KEY, next ? 'classic' : 'cockpit')
    } catch {
      /* préférence non mémorisée : sans conséquence sur la consultation */
    }
  }

  // Tant que la préférence n'est pas lue, on n'affiche rien : un aller-retour
  // entre les deux écrans au chargement serait pire qu'un instant de blanc.
  if (classic === null) return null

  if (!classic) {
    return <ConsultationCockpit patient={patient} onUseClassicForm={() => choose(true)} />
  }

  return (
    <div className="space-y-6">
      {isBirthday && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/40">
          <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-800/40 flex items-center justify-center shrink-0">
            <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          </div>
          <p className="text-sm font-medium text-pink-800 dark:text-pink-300">
            🎂 C&apos;est l&apos;anniversaire de {patient.first_name} aujourd&apos;hui ! {calculateAge(patient.birth_date)} ans.
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/patients/${patient.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Nouvelle consultation</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Patient :{' '}
            <Badge variant="outline">
              {patient.last_name} {patient.first_name}
            </Badge>
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => choose(false)}>
          <Sparkles className="h-4 w-4" />
          Nouvel écran
        </Button>
      </div>

      <ConsultationForm
        patient={patient}
        practitioner={practitioner}
        mode="create"
        medicalHistoryEntries={medicalHistoryEntries}
        pastConsultations={pastConsultations}
      />
    </div>
  )
}
