import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { calculateAge } from '@/lib/utils'
import { LiveConsultationScreen } from '@/components/consultations/live/live-consultation-screen'

interface LiveConsultationPageProps {
  params: Promise<{ id: string }>
}

/**
 * Contexte transmis à l'extraction. Volontairement court : il sert à pondérer la
 * vigilance sur les drapeaux rouges (âge extrême, antécédent néoplasique,
 * grossesse), pas à enrichir l'anamnèse. Rien n'en est déduit.
 */
function buildContext(patient: Record<string, unknown>): string {
  const lines: string[] = []
  const birthDate = patient.birth_date as string | null
  if (birthDate) lines.push(`Âge : ${calculateAge(birthDate)} ans`)
  if (patient.gender) lines.push(`Sexe : ${patient.gender}`)
  if (patient.profession) lines.push(`Profession : ${patient.profession}`)
  if (patient.sport_activity) lines.push(`Sport : ${patient.sport_activity}`)
  if (patient.medical_history) lines.push(`ATCD médicaux : ${patient.medical_history}`)
  if (patient.surgical_history) lines.push(`ATCD chirurgicaux : ${patient.surgical_history}`)
  if (patient.pregnancy_due_date) lines.push(`Grossesse en cours, terme : ${patient.pregnancy_due_date}`)
  return lines.join('\n')
}

export default async function LiveConsultationPage({ params }: LiveConsultationPageProps) {
  const { id } = await params
  const db = await createClient()

  const { data: patient, error } = await db.from('patients').select('*').eq('id', id).single()
  if (error || !patient) notFound()

  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  return (
    <LiveConsultationScreen
      patientId={id}
      patientName={`${patient.first_name} ${patient.last_name}`}
      patientContext={buildContext(patient)}
    />
  )
}
