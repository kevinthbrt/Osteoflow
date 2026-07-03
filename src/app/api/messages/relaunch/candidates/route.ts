import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getRelaunchCandidates, getRelaunchedPatients } = await import('@/lib/patients/relaunch')

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    const months = Math.max(1, Number(request.nextUrl.searchParams.get('months')) || 3)

    const notSeen = getRelaunchCandidates(practitioner.id, months)
    const relaunched = getRelaunchedPatients(practitioner.id)

    return NextResponse.json({ notSeen, relaunched, months })
  } catch (error) {
    console.error('Error fetching relaunch candidates:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des patients' }, { status: 500 })
  }
}
