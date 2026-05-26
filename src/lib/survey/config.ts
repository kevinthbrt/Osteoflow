/**
 * Survey worker configuration.
 *
 * The survey worker URL points to the Cloudflare Worker that hosts
 * patient-facing survey forms. Set via environment variable or defaults
 * to the production URL.
 */

export const SURVEY_WORKER_URL =
  process.env.SURVEY_WORKER_URL ||
  process.env.NEXT_PUBLIC_SURVEY_WORKER_URL ||
  'https://osteoflow-survey.osteoflow.workers.dev'

/**
 * Generate a unique survey token (URL-safe, 32 chars).
 */
export function generateSurveyToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

/**
 * Build the patient-facing survey URL for a given token.
 */
export function getSurveyUrl(token: string): string {
  return `${SURVEY_WORKER_URL}/survey/${token}`
}
