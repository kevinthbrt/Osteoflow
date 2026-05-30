import { getDatabase } from '@/lib/database/connection'

/**
 * Returns the OsteoUpgrade account email for the current device.
 *
 * Progress, quizzes and formations on OsteoUpgrade are keyed by the email of
 * the OsteoUpgrade account that activated the license. This is stored locally
 * as `license_email` in app_config at activation time.
 *
 * The local `practitioners.email` is NOT authoritative — it can be empty or
 * different from the OsteoUpgrade account — so we always prefer the license
 * email and only fall back to the practitioner email if the license email is
 * somehow missing.
 */
export function getOsteoUpgradeEmail(): string | null {
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'license_email'")
      .get() as { value?: string } | undefined
    const licenseEmail = row?.value?.trim()
    if (licenseEmail) return licenseEmail

    // Fallback: first practitioner with a non-empty email
    const practitioner = db
      .prepare("SELECT email FROM practitioners WHERE email IS NOT NULL AND email != '' LIMIT 1")
      .get() as { email?: string } | undefined
    return practitioner?.email?.trim() || null
  } catch {
    return null
  }
}
