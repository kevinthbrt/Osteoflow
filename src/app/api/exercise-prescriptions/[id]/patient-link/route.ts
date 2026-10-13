import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Lien vers l'appli patient, pour le copier dans un SMS ou un message. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getProfessionLabel } = await import('@/lib/practitioner/profession')
    const { buildPatientLink } = await import('@/lib/exercises/patient-link')

    const { id } = await params
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: practitioner } = await db.from('practitioners').select('*').eq('user_id', user.id).single()
    if (!practitioner) return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })

    const { data: prescription } = await db.from('exercise_prescriptions').select('*').eq('id', id).single()
    if (!prescription) return NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 })

    const { data: patient } = await db.from('patients').select('practitioner_id').eq('id', prescription.patient_id).single()
    if (!patient || patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { data: items } = await db
      .from('exercise_prescription_items')
      .select('*')
      .eq('prescription_id', id)
      .order('position', { ascending: true })

    const label = `${practitioner.first_name} ${practitioner.last_name}, ${getProfessionLabel(practitioner.profession, practitioner.specialty)}`
    const url = await buildPatientLink(prescription, items || [], label)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error building patient link:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du lien' }, { status: 500 })
  }
}
