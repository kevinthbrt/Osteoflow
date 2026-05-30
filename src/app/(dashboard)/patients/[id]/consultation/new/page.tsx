import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { ConsultationForm } from '@/components/consultations/consultation-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Cake } from 'lucide-react'
import { calculateAge } from '@/lib/utils'

interface NewConsultationPageProps {
  params: Promise<{ id: string }>
}

export default async function NewConsultationPage({ params }: NewConsultationPageProps) {
  const { id } = await params
  const db = await createClient()

  // Get patient
  const { data: patient, error: patientError } = await db
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()

  if (patientError || !patient) {
    notFound()
  }

  // Get practitioner
  const { data: { user } } = await db.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: practitioner, error: practitionerError } = await db
    .from('practitioners')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (practitionerError || !practitioner) {
    redirect('/login')
  }

  const { data: medicalHistoryEntries } = await db
    .from('medical_history_entries')
    .select('*')
    .eq('patient_id', id)
    .order('display_order', { ascending: true })

  // Fetch recent past consultations for this patient (last 20)
  const { data: pastConsultations } = await db
    .from('consultations')
    .select('*')
    .eq('patient_id', id)
    .is('archived_at', null)
    .order('date_time', { ascending: false })
    .limit(20)

  const today = new Date()
  const birthDate = new Date(patient.birth_date)
  const isBirthday = today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate()

  return (
    <div className="space-y-6">
      {isBirthday && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/40">
          <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-800/40 flex items-center justify-center shrink-0">
            <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          </div>
          <p className="text-sm font-medium text-pink-800 dark:text-pink-300">
            🎂 C'est l'anniversaire de {patient.first_name} aujourd'hui ! {calculateAge(patient.birth_date)} ans.
          </p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/patients/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Nouvelle consultation
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Patient:{' '}
            <Badge variant="outline">
              {patient.last_name} {patient.first_name}
            </Badge>
          </p>
        </div>
      </div>

      <ConsultationForm
        patient={patient}
        practitioner={practitioner}
        mode="create"
        medicalHistoryEntries={medicalHistoryEntries || []}
        pastConsultations={pastConsultations || []}
      />
    </div>
  )
}
