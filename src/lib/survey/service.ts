/**
 * Survey service - handles communication with the Cloudflare Worker
 * for registering surveys and syncing responses.
 */

import { SURVEY_WORKER_URL } from './config'

interface RegisterSurveyParams {
  token: string
  practitioner_name: string
  practice_name: string
  patient_first_name: string
  primary_color: string
  specialty?: string
  consultation_id: string
}

interface SyncResult {
  token: string
  consultation_id: string
  response: {
    overall_rating: number
    eva_score?: number
    pain_reduction?: boolean
    better_mobility?: boolean
    pain_evolution?: 'better' | 'same' | 'worse'
    comment?: string
    would_recommend?: boolean
  }
  responded_at: string
}

/**
 * Register a survey on the Cloudflare Worker.
 * Called when the J+7 follow-up email is sent.
 */
export async function registerSurvey(params: RegisterSurveyParams): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SURVEY_WORKER_URL}/api/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: (data as { error?: string }).error || `HTTP ${res.status}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Sync completed survey responses from the Cloudflare Worker.
 * Returns only surveys that have been filled by patients.
 */
export async function syncSurveyResponses(tokens: string[]): Promise<{ results: SyncResult[]; error?: string }> {
  if (tokens.length === 0) return { results: [] }

  try {
    const res = await fetch(`${SURVEY_WORKER_URL}/api/surveys/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return { results: [], error: `HTTP ${res.status}` }
    }

    const data = await res.json() as { results: SyncResult[] }
    return { results: data.results }
  } catch (error) {
    return {
      results: [],
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Delete synced survey data from the Cloudflare Worker KV.
 * Called after responses have been safely stored locally.
 */
export async function deleteSyncedSurveys(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return

  try {
    await fetch(`${SURVEY_WORKER_URL}/api/surveys/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens }),
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    // Non-critical: KV entries have TTL anyway
    console.error('[Survey] Failed to delete synced surveys from worker')
  }
}
