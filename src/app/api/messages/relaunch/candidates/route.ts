import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getRelaunchCandidates, getRelaunchedPatients, getScheduledRelaunches } = await import('@/lib/patients/relaunch')
    const { DAILY_SEND_LIMIT } = await import('@/lib/email/campaign-processor')

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id, relaunch_since_date')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    const months = Math.max(1, Number(request.nextUrl.searchParams.get('months')) || 3)
    const sinceDate = practitioner.relaunch_since_date || null

    const notSeen = getRelaunchCandidates(practitioner.id, months, sinceDate)
    const relaunched = getRelaunchedPatients(practitioner.id, sinceDate)
    const scheduled = getScheduledRelaunches(practitioner.id)

    return NextResponse.json({ notSeen, relaunched, scheduled, months, sinceDate, dailyLimit: DAILY_SEND_LIMIT })
  } catch (error) {
    console.error('Error fetching relaunch candidates:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des patients' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
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

    const { sinceDate } = await request.json()

    if (sinceDate && Number.isNaN(new Date(sinceDate).getTime())) {
      return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    }

    await db
      .from('practitioners')
      .update({ relaunch_since_date: sinceDate || null })
      .eq('id', practitioner.id)

    return NextResponse.json({ success: true, sinceDate: sinceDate || null })
  } catch (error) {
    console.error('Error updating relaunch since-date:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}
