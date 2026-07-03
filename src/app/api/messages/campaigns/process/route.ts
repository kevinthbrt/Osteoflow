import { NextRequest, NextResponse } from 'next/server'

// In-process lock, mirrors the one in /api/emails/follow-up: prevents the
// cron and a manual/immediate kick from processing the same batch twice.
let isProcessing = false

// Cron endpoint: drains pending campaign recipients in batches. Called
// repeatedly (every ~20s) by the app's local cron until all campaigns are
// caught up; also triggered immediately when a campaign is created so
// sending starts right away instead of waiting for the next tick.
export async function POST(request: NextRequest) {
  if (isProcessing) {
    return NextResponse.json({ message: 'Déjà en cours de traitement', processed: 0 })
  }

  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isLocalCron = authHeader === 'Bearer local-desktop-cron'

  if (!isLocalCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
  }

  isProcessing = true
  try {
    const { processCampaignBatch } = await import('@/lib/email/campaign-processor')

    // Drain a few batches per call (bounded by wall time) so a burst of
    // pending recipients doesn't have to wait for several cron ticks in a row.
    let totalProcessed = 0
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const { processed } = await processCampaignBatch()
      totalProcessed += processed
      if (processed === 0) break
    }

    return NextResponse.json({ processed: totalProcessed })
  } catch (error) {
    console.error('[Campaigns] Processing error:', error)
    return NextResponse.json({ error: 'Erreur lors du traitement des diffusions' }, { status: 500 })
  } finally {
    isProcessing = false
  }
}
