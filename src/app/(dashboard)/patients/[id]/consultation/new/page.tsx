import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { NewConsultationScreen } from '@/components/consultations/cockpit/new-consultation-screen'

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
    <NewConsultationScreen
      patient={patient}
      practitioner={practitioner}
      medicalHistoryEntries={medicalHistoryEntries || []}
      pastConsultations={pastConsultations || []}
      isBirthday={isBirthday}
    />
  )
}
