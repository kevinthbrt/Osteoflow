/**
 * In-memory flag tracking whether the Osteoupgrade license has been
 * verified this session. Resets automatically when the Electron process
 * exits (i.e. when the app is closed and reopened).
 *
 * This is intentionally NOT persisted — the user must re-verify (PIN or
 * full login) on every app launch.
 */

let _verifiedAt: number | null = null

export function markSessionVerified(): void {
  _verifiedAt = Date.now()
}

export function clearSessionVerified(): void {
  _verifiedAt = null
}

/**
 * Returns true if the license was verified this session
 * (within the last 24 hours as a safety ceiling).
 */
export function isSessionVerified(): boolean {
  if (_verifiedAt === null) return false
  return Date.now() - _verifiedAt < 24 * 60 * 60 * 1000
}
