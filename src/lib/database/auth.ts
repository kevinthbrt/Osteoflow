/**
 * Local authentication system for MyOsteoFlow desktop.
 * Replaces Supabase Auth with practitioner selection + password.
 *
 * In desktop mode:
 * - Users select their practitioner profile and enter their password
 * - Multiple practitioners supported (for remplacants)
 * - Session persisted in SQLite app_config table
 * - Passwords are hashed with scrypt
 */

import { getDatabase, generateUUID } from './connection'
import crypto from 'crypto'

export interface LocalUser {
  id: string
  email: string
  user_metadata: {
    first_name?: string
    last_name?: string
  }
}

/**
 * Hash a password using scrypt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verify a password against a stored hash.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const computedHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return hash === computedHash
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
  has_password: boolean
}> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT id, user_id, first_name, last_name, email, practice_name, password_hash FROM practitioners ORDER BY last_name, first_name')
    .all() as any[]
  return rows.map((r) => ({
    ...r,
    has_password: !!r.password_hash,
    password_hash: undefined,
  }))
}

/**
 * Get (or lazily create) the owner id shared by all cabinets of this install.
 * Tous les cabinets créés sur ce poste appartiennent au même propriétaire.
 */
export function getCabinetOwnerId(): string {
  const db = getDatabase()
  const row = db
    .prepare("SELECT value FROM app_config WHERE key = 'cabinet_owner_id'")
    .get() as { value?: string } | undefined
  if (row?.value) return row.value
  // Aligne sur un cabinet existant si présent, sinon en génère un nouveau.
  const existing = db
    .prepare('SELECT owner_id FROM practitioners WHERE owner_id IS NOT NULL LIMIT 1')
    .get() as { owner_id?: string } | undefined
  const ownerId = existing?.owner_id || generateUUID()
  db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('cabinet_owner_id', ?)").run(ownerId)
  return ownerId
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
  password?: string
  owner_id?: string
}): string {
  const db = getDatabase()
  const userId = generateUUID()
  const practitionerId = generateUUID()
  const now = new Date().toISOString()
  const passwordHash = data.password ? hashPassword(data.password) : null
  const ownerId = data.owner_id || getCabinetOwnerId()

  db.prepare(`
    INSERT INTO practitioners (id, user_id, first_name, last_name, email, practice_name, password_hash, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    practitionerId,
    userId,
    data.first_name,
    data.last_name,
    data.email,
    data.practice_name || null,
    passwordHash,
    ownerId,
    now,
    now
  )

  return userId
}

/**
 * Crée un nouveau cabinet pour le propriétaire courant en clonant l'identité
 * de connexion (nom/email/mot de passe) du cabinet actif, afin qu'il soit
 * sélectionnable au prochain login. Renvoie le user_id du nouveau cabinet.
 */
export function createCabinet(practiceName: string): string {
  const db = getDatabase()
  const cfg = db
    .prepare("SELECT value FROM app_config WHERE key = 'current_user_id'")
    .get() as { value?: string } | undefined
  const current = cfg?.value
    ? (db.prepare('SELECT * FROM practitioners WHERE user_id = ?').get(cfg.value) as any)
    : null

  const userId = generateUUID()
  const practitionerId = generateUUID()
  const now = new Date().toISOString()
  const ownerId = current?.owner_id || getCabinetOwnerId()

  db.prepare(`
    INSERT INTO practitioners (id, user_id, first_name, last_name, email, practice_name, password_hash, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    practitionerId,
    userId,
    current?.first_name || 'Praticien',
    current?.last_name || '',
    current?.email || `cabinet-${practitionerId.slice(0, 8)}@local`,
    practiceName.trim() || 'Nouveau cabinet',
    current?.password_hash || null,
    ownerId,
    now,
    now,
  )

  return userId
}

export interface CabinetInfo {
  id: string
  user_id: string
  first_name: string
  last_name: string
  practice_name: string | null
  is_active: boolean
}

/**
 * Liste les cabinets du propriétaire courant (multi-cabinet).
 */
export function listCabinets(): CabinetInfo[] {
  const db = getDatabase()
  const ownerId = getCabinetOwnerId()
  const currentUserRow = db
    .prepare("SELECT value FROM app_config WHERE key = 'current_user_id'")
    .get() as { value?: string } | undefined
  const rows = db
    .prepare('SELECT id, user_id, first_name, last_name, practice_name FROM practitioners WHERE owner_id = ? ORDER BY practice_name, last_name')
    .all(ownerId) as Array<Omit<CabinetInfo, 'is_active'>>
  return rows.map((r) => ({ ...r, is_active: r.user_id === currentUserRow?.value }))
}
