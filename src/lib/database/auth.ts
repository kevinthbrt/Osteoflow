/**
 * Local authentication system for Osteoflow desktop.
 * Replaces Supabase Auth with a simple practitioner selection mechanism.
 *
 * In desktop mode:
 * - No email/password authentication (data is local)
 * - Users select their practitioner profile at startup
 * - Multiple practitioners supported (for remplacants)
 * - Session persisted in SQLite app_config table
 */

import { getDatabase, generateUUID } from './connection'

export interface LocalUser {
  id: string
  email: string
  user_metadata: {
    first_name?: string
    last_name?: string
  }
}

/**
 * Get the currently logged-in user (practitioner).
 * Returns null if no practitioner is selected.
 */
export function getCurrentUser(): LocalUser | null {
  try {
    const db = getDatabase()
    const config = db
      .prepare("SELECT value FROM app_config WHERE key = 'current_user_id'")
      .get() as { value: string } | undefined

    if (!config) return null

    const practitioner = db
      .prepare('SELECT * FROM practitioners WHERE user_id = ?')
      .get(config.value) as any

    if (!practitioner) return null

    return {
      id: practitioner.user_id,
      email: practitioner.email,
      user_metadata: {
        first_name: practitioner.first_name,
        last_name: practitioner.last_name,
      },
    }
  } catch {
    return null
  }
}

/**
 * Set the current practitioner by user_id.
 */
export function setCurrentUser(userId: string): void {
  const db = getDatabase()
  db.prepare(
    "INSERT OR REPLACE INTO app_config (key, value) VALUES ('current_user_id', ?)"
  ).run(userId)
}

/**
 * Clear the current session (sign out).
 */
export function clearCurrentUser(): void {
  const db = getDatabase()
  db.prepare("DELETE FROM app_config WHERE key = 'current_user_id'").run()
}

/**
 * List all practitioner profiles.
 */
export function listPractitioners(): Array<{
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  practice_name: string | null
}> {
  const db = getDatabase()
  return db
    .prepare('SELECT id, user_id, first_name, last_name, email, practice_name FROM practitioners ORDER BY last_name, first_name')
    .all() as any[]
}

/**
 * Create a new practitioner profile.
 * Returns the user_id of the created practitioner.
 */
export function createPractitioner(data: {
  first_name: string
  last_name: string
  email: string
  practice_name?: string
}): string {
  const db = getDatabase()
  const userId = generateUUID()
  const practitionerId = generateUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO practitioners (id, user_id, first_name, last_name, email, practice_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    practitionerId,
    userId,
    data.first_name,
    data.last_name,
    data.email,
    data.practice_name || null,
    now,
    now
  )

  return userId
}
