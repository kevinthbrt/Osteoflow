import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDatabase } = await import('@/lib/database/connection')
    const { getDailySendStatus, isRetryableErrorMessage } = await import('@/lib/email/campaign-processor')
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

    const { data: activeCampaigns } = await db
      .from('email_campaigns')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)

    let campaign = activeCampaigns?.[0]

    // No campaign currently in flight — still surface the most recent one
    // from the last few days if it ended with failures, so a diffusion that
    // "finishes" with e.g. 200 failed emails doesn't just silently vanish
    // from the UI looking like nothing is wrong.
    if (!campaign) {
      const recentCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentCampaigns } = await db
        .from('email_campaigns')
        .select('*')
        .eq('practitioner_id', practitioner.id)
        .gt('failed_count', 0)
        .gte('created_at', recentCutoff)
        .order('created_at', { ascending: false })
        .limit(1)
      campaign = recentCampaigns?.[0]
    }

    if (!campaign) {
      return NextResponse.json({ campaign: null })
    }

    const dailyStatus = getDailySendStatus(practitioner.id)

    let retryableFailedCount = 0
    if (campaign.failed_count > 0) {
      const rawDb = getDatabase()
      const failedMessages = rawDb
        .prepare(`SELECT error_message FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'failed'`)
        .all(campaign.id) as Array<{ error_message: string | null }>
      retryableFailedCount = failedMessages.filter((r) => isRetryableErrorMessage(r.error_message)).length
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        type: campaign.type,
        status: campaign.status,
        total: campaign.total_recipients,
        sent: campaign.sent_count,
        failed: campaign.failed_count,
        retryableFailedCount,
        dailyLimitReached: campaign.sent_count + campaign.failed_count < campaign.total_recipients && dailyStatus.limitReached,
      },
    })
  } catch (error) {
    console.error('Error fetching active campaign:', error)
    return NextResponse.json({ campaign: null })
  }
}
