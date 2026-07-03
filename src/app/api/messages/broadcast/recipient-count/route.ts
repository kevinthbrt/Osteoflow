import { NextRequest, NextResponse } from 'next/server'

// Preview endpoint: how many patients (and how many physical emails, after
// dedup) a broadcast would currently reach, given the optional "active
// since" filter — used by the compose UI before the practitioner sends.
export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getBroadcastRecipients } = await import('@/lib/patients/broadcast-recipients')
    const { groupPatientsByEmail } = await import('@/lib/email/recipient-grouping')
    const { DAILY_SEND_LIMIT } = await import('@/lib/email/campaign-processor')

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

    const activeSinceDate = request.nextUrl.searchParams.get('activeSinceDate') || null

    if (activeSinceDate && Number.isNaN(new Date(activeSinceDate).getTime())) {
      return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    }

    const patients = getBroadcastRecipients(practitioner.id, activeSinceDate)
    const groups = groupPatientsByEmail(patients)

    return NextResponse.json({
      totalPatients: patients.length,
      totalEmails: groups.length,
      deduplicated: patients.length - groups.length,
      dailyLimit: DAILY_SEND_LIMIT,
    })
  } catch (error) {
    console.error('Error computing broadcast recipient count:', error)
    return NextResponse.json({ error: 'Erreur lors du calcul des destinataires' }, { status: 500 })
  }
}
