import { NextRequest, NextResponse } from 'next/server'

// Re-queues recipients that failed for a reason worth retrying (network
// hiccup, Gmail's daily sending cap...) instead of leaving them stuck
// forever in a finished campaign. Recipients whose failure looks permanent
// (invalid address, rejected by the server for content reasons, etc.) are
// left untouched — retrying those would just fail again.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { createClient } = await import('@/lib/db/server')
    const { getDatabase } = await import('@/lib/database/connection')
    const { isRetryableErrorMessage } = await import('@/lib/email/campaign-processor')
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
    const failedRows = rawDb
      .prepare(`SELECT id, error_message FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'failed'`)
      .all(id) as Array<{ id: string; error_message: string | null }>

    const retryableIds = failedRows.filter((r) => isRetryableErrorMessage(r.error_message)).map((r) => r.id)

    if (retryableIds.length === 0) {
      return NextResponse.json({ success: true, retried: 0, remainingFailed: failedRows.length })
    }

    const resetToPending = rawDb.transaction((ids: string[]) => {
      const stmt = rawDb.prepare(
        `UPDATE email_campaign_recipients SET status = 'pending', error_message = NULL, retry_count = 0, next_retry_at = NULL WHERE id = ?`
      )
      for (const recipientId of ids) stmt.run(recipientId)
    })
    resetToPending(retryableIds)

    const remainingFailed = failedRows.length - retryableIds.length
    rawDb
      .prepare(`UPDATE email_campaigns SET failed_count = ?, status = 'processing', completed_at = NULL WHERE id = ?`)
      .run(remainingFailed, id)

    // Kick off processing immediately instead of waiting for the next cron tick.
    import('@/lib/email/campaign-processor')
      .then(({ processCampaignBatch }) => processCampaignBatch())
      .catch((e) => console.error('[Campaigns] Immediate retry kick failed:', e))

    return NextResponse.json({ success: true, retried: retryableIds.length, remainingFailed })
  } catch (error) {
    console.error('Error retrying failed campaign recipients:', error)
    return NextResponse.json({ error: 'Erreur lors de la relance des échecs' }, { status: 500 })
  }
}
