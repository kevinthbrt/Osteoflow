import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const LICENSE_KEYS = [
  'license_token',
  'license_email',
  'license_role',
  'license_expires_at',
  'license_last_verified_at',
  'license_device_id',
  'license_pin_hash',
  'license_pin_last_used_at',
] as const

// Clés purgées à la déconnexion / expiration de licence. `license_device_id`
// en est volontairement EXCLU : ce n'est pas un identifiant de session mais
// l'identifiant du poste, qui doit survivre à une déconnexion.
//   1. Anti-abus : l'essai gratuit sans carte est verrouillé par poste
//      (table trial_device_claims côté Osteoupgrade). Régénérer le device_id
//      à chaque déconnexion offrirait un essai neuf à chaque nouveau compte,
//      ce qui viderait le verrou de toute substance.
//   2. Sessions concurrentes : un device_id stable permet à osteoflow_sessions
//      de réutiliser la même ligne d'une session à l'autre, au lieu
//      d'accumuler des lignes orphelines qui peuvent déclencher à tort une
//      alerte CONCURRENT_SESSION.
const LICENSE_SESSION_KEYS = LICENSE_KEYS.filter((key) => key !== 'license_device_id')

function getConfigs(): Record<string, string> {
  const db = getDatabase()
  const rows = db
    .prepare(`SELECT key, value FROM app_config WHERE key IN (${LICENSE_KEYS.map(() => '?').join(',')})`)
    .all(...LICENSE_KEYS) as Array<{ key: string; value: string }>
  const map: Record<string, string> = {}
  rows.forEach((row) => { map[row.key] = row.value })
  return map
}

function upsertConfig(key: string, value: string) {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(key, value)
}

function deleteConfig(key: string) {
  const db = getDatabase()
  db.prepare('DELETE FROM app_config WHERE key = ?').run(key)
}

export async function GET() {
  const config = getConfigs()

  if (!config.license_device_id) {
    const deviceId = crypto.randomUUID()
    upsertConfig('license_device_id', deviceId)
    config.license_device_id = deviceId
  }

  const now = Date.now()
  const hasToken = !!config.license_token
  const isExpired = config.license_expires_at
    ? new Date(config.license_expires_at).getTime() < now
    : true

  const lastVerified = config.license_last_verified_at
    ? new Date(config.license_last_verified_at).getTime()
    : null
  const gracePeriodExpired =
    lastVerified === null || now - lastVerified > 7 * 24 * 60 * 60 * 1000

  const pinLastUsed = config.license_pin_last_used_at
    ? new Date(config.license_pin_last_used_at).getTime()
    : null
  const pinActive =
    !!config.license_pin_hash &&
    pinLastUsed !== null &&
    now - pinLastUsed < 30 * 24 * 60 * 60 * 1000

  return NextResponse.json({
    device_id: config.license_device_id,
    has_token: hasToken,
    is_expired: isExpired,
    grace_period_expired: gracePeriodExpired,
    email: config.license_email || null,
    role: config.license_role || null,
    pin_active: pinActive,
    has_pin: !!config.license_pin_hash,
  })
}

export async function POST(request: Request) {
  const { token, email, role, expires_at } = await request.json()

  if (!token || !email || !role || !expires_at) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  upsertConfig('license_token', token)
  upsertConfig('license_email', email)
  upsertConfig('license_role', role)
  upsertConfig('license_expires_at', expires_at)
  upsertConfig('license_last_verified_at', new Date().toISOString())

  deleteConfig('license_pin_hash')
  deleteConfig('license_pin_last_used_at')

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  LICENSE_SESSION_KEYS.forEach(deleteConfig)
  return NextResponse.json({ success: true })
}
