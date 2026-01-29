import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ConsultationForm } from '@/components/consultations/consultation-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'

interface NewConsultationPageProps {
  params: Promise<{ id: string }>
}

export default async function NewConsultationPage({ params }: NewConsultationPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get patient
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()

  if (patientError || !patient) {
    notFound()
  }

  // Get practitioner
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: practitioner, error: practitionerError } = await supabase
    .from('practitioners')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (practitionerError || !practitioner) {
    redirect('/login')
  }

  const { data: medicalHistoryEntries } = await supabase
    .from('medical_history_entries')
    .select('*')
    .eq('patient_id', id)
    .order('display_order', { ascending: true })

  return (
    <div className="space-y-6">
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
      />
    </div>
  )
}
