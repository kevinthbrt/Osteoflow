import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
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

async function getConfigs(db: any): Promise<Record<string, string>> {
  const { data } = await db
    .from('app_config')
    .select('key, value')
    .in('key', [...LICENSE_KEYS])
  const map: Record<string, string> = {}
  ;(data || []).forEach((row: { key: string; value: string }) => {
    map[row.key] = row.value
  })
  return map
}

async function upsertConfig(db: any, key: string, value: string) {
  await db.from('app_config').delete().eq('key', key)
  await db.from('app_config').insert({ key, value })
}

export async function GET() {
  const db = await createClient()
  const config = await getConfigs(db)

  if (!config.license_device_id) {
    const deviceId = crypto.randomUUID()
    await upsertConfig(db, 'license_device_id', deviceId)
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
  const db = await createClient()
  const { token, email, role, expires_at } = await request.json()

  if (!token || !email || !role || !expires_at) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  await upsertConfig(db, 'license_token', token)
  await upsertConfig(db, 'license_email', email)
  await upsertConfig(db, 'license_role', role)
  await upsertConfig(db, 'license_expires_at', expires_at)
  await upsertConfig(db, 'license_last_verified_at', new Date().toISOString())

  await db.from('app_config').delete().eq('key', 'license_pin_hash')
  await db.from('app_config').delete().eq('key', 'license_pin_last_used_at')

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const db = await createClient()
  for (const key of LICENSE_KEYS) {
    await db.from('app_config').delete().eq('key', key)
  }
  return NextResponse.json({ success: true })
}
