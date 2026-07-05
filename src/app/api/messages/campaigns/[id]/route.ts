import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const { data: campaign } = await db
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (!campaign || campaign.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Diffusion non trouvée' }, { status: 404 })
    }

    const rawDb = getDatabase()

    let dailyLimitReached = false
    if (campaign.status === 'pending' || campaign.status === 'processing') {
      const hasPending = rawDb
        .prepare(`SELECT 1 FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'pending' LIMIT 1`)
        .get(campaign.id)
      dailyLimitReached = Boolean(hasPending) && getDailySendStatus(practitioner.id).limitReached
    }

    let retryableFailedCount = 0
    if (campaign.failed_count > 0) {
      const failedMessages = rawDb
        .prepare(`SELECT error_message FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'failed'`)
        .all(campaign.id) as Array<{ error_message: string | null }>
      retryableFailedCount = failedMessages.filter((r) => isRetryableErrorMessage(r.error_message)).length
    }

    return NextResponse.json({
      id: campaign.id,
      type: campaign.type,
      status: campaign.status,
      total: campaign.total_recipients,
      sent: campaign.sent_count,
      failed: campaign.failed_count,
      retryableFailedCount,
      errorMessage: campaign.error_message,
      createdAt: campaign.created_at,
      completedAt: campaign.completed_at,
      dailyLimitReached,
    })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération de la diffusion' }, { status: 500 })
  }
}
