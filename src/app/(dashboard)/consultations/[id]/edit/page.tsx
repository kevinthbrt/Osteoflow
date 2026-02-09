import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { ConsultationForm } from '@/components/consultations/consultation-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'

interface EditConsultationPageProps {
  params: Promise<{ id: string }>
}

export default async function EditConsultationPage({ params }: EditConsultationPageProps) {
  const { id } = await params
  const db = await createClient()

  // Get consultation with patient
  const { data: consultation, error: consultationError } = await db
    .from('consultations')
    .select(`
      *,
      patient:patients (*)
    `)
    .eq('id', id)
    .single()

  if (consultationError || !consultation) {
    notFound()
  }

  const patient = consultation.patient

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
    .eq('patient_id', patient.id)
    .order('display_order', { ascending: true })

  // Fetch past consultations for this patient (excluding the current one)
  const { data: pastConsultations } = await db
    .from('consultations')
    .select('*')
    .eq('patient_id', patient.id)
    .neq('id', id)
    .is('archived_at', null)
    .order('date_time', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/consultations/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Modifier la consultation
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
        consultation={consultation}
        mode="edit"
        medicalHistoryEntries={medicalHistoryEntries || []}
        pastConsultations={pastConsultations || []}
      />
    </div>
  )
}
