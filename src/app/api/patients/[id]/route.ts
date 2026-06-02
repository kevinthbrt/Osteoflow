import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: patient, error } = await db
      .from('patients')
      .select('id, first_name, last_name, birth_date, gender, profession, sport_activity, trauma_history, medical_history, surgical_history, family_history, notes')
      .eq('id', params.id)
      .single()

    if (error || !patient) return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 })

    return NextResponse.json({ patient })
  } catch (err) {
    console.error('Error fetching patient:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
