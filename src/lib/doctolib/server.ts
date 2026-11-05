import crypto from 'crypto'
import { getDatabase } from '@/lib/database/connection'

/**
 * Stockage local de l'import Doctolib (table app_config du poste) et contrôle
 * des appels.
 *
 * - L'extension s'authentifie avec un code d'appairage, saisi une fois.
 * - L'interface d'Osteoflow envoie l'en-tête `x-osteoflow-app` : un site
 *   tiers ouvert dans le navigateur ne peut pas l'ajouter sans autorisation
 *   CORS, qu'Osteoflow ne donne jamais. Il ne peut donc ni lire les
 *   rendez-vous reçus ni changer le code.
 */
const TOKEN_KEY = 'doctolib_extension_token'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(): string {
  const bytes = crypto.randomBytes(8)
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
  return `${chars.slice(0, 4)}-${chars.slice(4)}`
}

export function getPairingCode(regenerate = false): string {
  const db = getDatabase()
  if (!regenerate) {
    const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(TOKEN_KEY) as { value: string } | undefined
    if (row?.value) return row.value
  }
  const code = randomCode()
  db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(TOKEN_KEY, code)
  return code
}

export function isValidPairingCode(candidate: string | null): boolean {
  if (!candidate) return false
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(TOKEN_KEY) as { value: string } | undefined
  if (!row?.value) return false
  const expected = Buffer.from(row.value.toUpperCase())
  const given = Buffer.from(candidate.trim().toUpperCase())
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

export function isAppRequest(request: Request): boolean {
  return request.headers.get('x-osteoflow-app') === '1'
}

/**
 * Dernier signe de vie de l'extension et dernier envoi : permet à
 * l'interface d'afficher « Extension connectée » sans pouvoir interroger
 * Chrome (Osteoflow tourne dans sa propre fenêtre).
 */
const SEEN_KEY = 'doctolib_extension_seen'
const LAST_IMPORT_KEY = 'doctolib_last_import'

export interface DoctolibExtensionStatus {
  seen: { at: string; version: string | null } | null
  lastImport: { at: string; count: number } | null
}

function readJson<T>(key: string): T | null {
  const row = getDatabase().prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.value) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  getDatabase().prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
}

export function recordExtensionSeen(version: unknown) {
  const clean = typeof version === 'string' && /^[0-9.]{1,20}$/.test(version) ? version : null
  writeJson(SEEN_KEY, { at: new Date().toISOString(), version: clean })
}

export function recordImport(count: number) {
  writeJson(LAST_IMPORT_KEY, { at: new Date().toISOString(), count })
}

export function readExtensionStatus(): DoctolibExtensionStatus {
  return {
    seen: readJson(SEEN_KEY),
    lastImport: readJson(LAST_IMPORT_KEY),
  }
}
