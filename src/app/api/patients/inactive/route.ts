import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { createLocalClient } = await import('@/lib/database/query-builder')
    const client = createLocalClient()

    const { data: practitioner } = await client.from('app_config').select('value').eq('key', 'current_practitioner_id').single()
    if (!practitioner) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const monthsStr = searchParams.get('months') || '3'
    const months = parseInt(monthsStr, 10)
    const limitStr = searchParams.get('limit') || '20'
    const limit = parseInt(limitStr, 10)

    // Get cutoff date
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - months)
    const cutoffISO = cutoffDate.toISOString()

    // Get all active patients
    const { data: patients, error: pError } = await client
      .from('patients')
      .select('id, first_name, last_name, phone, email, created_at')
      .eq('practitioner_id', practitioner.value)
      .is('archived_at', null)
      .order('last_name')

    if (pError) {
      return NextResponse.json({ data: null, error: pError }, { status: 500 })
    }

    if (!patients || patients.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // For each patient, get their most recent consultation
    const inactivePatients: Array<{
      id: string
      first_name: string
      last_name: string
      phone: string
      email: string | null
      last_consultation_date: string | null
      days_since_last: number
    }> = []

    for (const patient of patients) {
      const { data: lastConsult } = await client
        .from('consultations')
        .select('date_time')
        .eq('patient_id', patient.id)
        .is('archived_at', null)
        .order('date_time', { ascending: false })
        .limit(1)

      const lastDate = lastConsult?.[0]?.date_time || null

      // Patient is inactive if their last consultation is before cutoff, or if they have no consultation at all
      if (!lastDate || lastDate < cutoffISO) {
        const daysSince = lastDate
          ? Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - new Date(patient.created_at).getTime()) / (1000 * 60 * 60 * 24))

        inactivePatients.push({
          id: patient.id,
          first_name: patient.first_name,
          last_name: patient.last_name,
          phone: patient.phone,
          email: patient.email,
          last_consultation_date: lastDate,
          days_since_last: daysSince,
        })
      }
    }

    // Sort by days_since_last descending (most inactive first) and limit
    inactivePatients.sort((a, b) => b.days_since_last - a.days_since_last)
    const limited = inactivePatients.slice(0, limit)

    return NextResponse.json({ data: limited, total: inactivePatients.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inactive patients'
    return NextResponse.json({ data: null, error: { message } }, { status: 500 })
  }
}
