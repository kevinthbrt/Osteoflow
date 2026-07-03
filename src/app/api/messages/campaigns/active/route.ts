import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDailySendStatus } = await import('@/lib/email/campaign-processor')
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

    const { data: campaigns } = await db
      .from('email_campaigns')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)

    const campaign = campaigns?.[0]

    if (!campaign) {
      return NextResponse.json({ campaign: null })
    }

    const dailyStatus = getDailySendStatus(practitioner.id)

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        type: campaign.type,
        status: campaign.status,
        total: campaign.total_recipients,
        sent: campaign.sent_count,
        failed: campaign.failed_count,
        dailyLimitReached: campaign.sent_count + campaign.failed_count < campaign.total_recipients && dailyStatus.limitReached,
      },
    })
  } catch (error) {
    console.error('Error fetching active campaign:', error)
    return NextResponse.json({ campaign: null })
  }
}
