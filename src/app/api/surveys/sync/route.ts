import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/surveys/sync
 *
 * Called by the Electron cron job to sync survey responses from the
 * Cloudflare Worker back to local SQLite.
 *
 * Flow:
 * 1. Get all pending survey tokens from local DB
 * 2. Call the Worker to fetch completed responses
 * 3. Update local survey_responses with the data
 * 4. Delete synced data from the Worker
 */
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { syncSurveyResponses, deleteSyncedSurveys } = await import('@/lib/survey/service')

    // Auth: accept local cron or authenticated user
    const authHeader = request.headers.get('authorization')
    const isLocalCron = authHeader === 'Bearer local-desktop-cron'

    if (!isLocalCron) {
      const db = await createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
    }

    const db = await createClient()

    // Get all pending survey tokens
    const { data: pendingSurveys, error: fetchError } = await db
      .from('survey_responses')
      .select('token')
      .eq('status', 'pending')
      .limit(50)

    if (fetchError) {
      console.error('[SurveySync] Error fetching pending surveys:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!pendingSurveys || pendingSurveys.length === 0) {
      return NextResponse.json({ message: 'No pending surveys', synced: 0 })
    }

    const tokens = pendingSurveys.map((s: { token: string }) => s.token)
    console.log(`[SurveySync] Checking ${tokens.length} pending survey(s)...`)

    // Fetch completed responses from the Worker
    const { results, error: syncError } = await syncSurveyResponses(tokens)

    if (syncError) {
      console.error('[SurveySync] Worker sync error:', syncError)
      return NextResponse.json({ error: `Sync error: ${syncError}` }, { status: 502 })
    }

    if (results.length === 0) {
      console.log('[SurveySync] No completed surveys to sync')
      return NextResponse.json({ message: 'No completed surveys', synced: 0 })
    }

    // Update local database with responses
    let synced = 0
    const syncedTokens: string[] = []

    for (const result of results) {
      try {
        await db
          .from('survey_responses')
          .update({
            status: 'completed',
            overall_rating: result.response.overall_rating,
            pain_evolution: result.response.pain_evolution,
            comment: result.response.comment || null,
            would_recommend: result.response.would_recommend,
            responded_at: result.responded_at,
            synced_at: new Date().toISOString(),
          })
          .eq('token', result.token)

        syncedTokens.push(result.token)
        synced++
        console.log(`[SurveySync] Synced survey ${result.token}`)
      } catch (error) {
        console.error(`[SurveySync] Failed to update survey ${result.token}:`, error)
      }
    }

    // Clean up Worker KV
    if (syncedTokens.length > 0) {
      await deleteSyncedSurveys(syncedTokens)
    }

    console.log(`[SurveySync] Done: ${synced} survey(s) synced`)
    return NextResponse.json({ message: `${synced} survey(s) synced`, synced })
  } catch (error) {
    console.error('[SurveySync] Fatal error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la synchronisation des sondages' },
      { status: 500 }
    )
  }
}
