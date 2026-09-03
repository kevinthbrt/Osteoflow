import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { calculateAge } from '@/lib/utils'
import { LiveConsultationScreen } from '@/components/consultations/live/live-consultation-screen'
import type { HistoryEntry, PastConsultation } from '@/components/consultations/live/live-patient-panel'

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

  // Le dossier affiché à gauche. Les consultations sont limitées aux plus
  // récentes : au-delà, la colonne devient une archive qu'on ne lit pas.
  const [{ data: history }, { data: past }] = await Promise.all([
    db
      .from('medical_history_entries')
      .select('*')
      .eq('patient_id', id)
      .order('display_order', { ascending: true }),
    db
      .from('consultations')
      .select('id, date_time, reason, anamnesis_summary')
      .eq('patient_id', id)
      .is('archived_at', null)
      .order('date_time', { ascending: false })
      .limit(8),
  ])

  return (
    <LiveConsultationScreen
      patientId={id}
      patientName={`${patient.first_name} ${patient.last_name}`}
      patientContext={buildContext(patient)}
      patient={{
        fullName: `${patient.first_name} ${patient.last_name}`,
        age: patient.birth_date ? calculateAge(patient.birth_date) : null,
        gender: patient.gender ?? null,
        profession: patient.profession,
        sportActivity: patient.sport_activity,
      }}
      history={(history ?? []) as HistoryEntry[]}
      pastConsultations={(past ?? []) as PastConsultation[]}
    />
  )
}
