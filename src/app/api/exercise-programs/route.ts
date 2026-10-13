import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Programmes d'exercices d'un patient : étapes, bilans, journal, indicateur. */
export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { loadPrograms } = await import('@/lib/exercises/programs')
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const patientId = request.nextUrl.searchParams.get('patient_id')
    if (!patientId) return NextResponse.json({ error: 'patient_id requis' }, { status: 400 })

    const { data: practitioner } = await db.from('practitioners').select('id').eq('user_id', user.id).single()
    const { data: patient } = await db.from('patients').select('practitioner_id').eq('id', patientId).single()
    if (!practitioner || !patient || patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const programs = await loadPrograms(db, { patientId })
    programs.sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1))
    return NextResponse.json({ programs })
  } catch (error) {
    console.error('Error listing exercise programs:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
