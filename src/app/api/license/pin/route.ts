import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function hashPin(pin: string, deviceId: string): string {
  return crypto.createHash('sha256').update(pin + deviceId).digest('hex')
}

function getAppConfig(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(key) as any
  return row?.value ?? null
}

function upsertConfig(key: string, value: string) {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(key, value)
}

export async function POST(request: Request) {
  const { action, pin } = await request.json()

  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: 'Le code PIN doit être composé de 4 chiffres' },
      { status: 400 }
    )
  }

  const deviceId = getAppConfig('license_device_id')
  if (!deviceId) {
    return NextResponse.json({ error: 'Appareil non identifié' }, { status: 400 })
  }

  if (action === 'set') {
    const hash = hashPin(pin, deviceId)
    upsertConfig('license_pin_hash', hash)
    upsertConfig('license_pin_last_used_at', new Date().toISOString())
    return NextResponse.json({ success: true })
  }

  if (action === 'verify') {
    const pinHash = getAppConfig('license_pin_hash')
    if (!pinHash) {
      return NextResponse.json({ valid: false, error: 'Aucun PIN configuré' })
    }

    const expected = hashPin(pin, deviceId)
    if (pinHash !== expected) {
      return NextResponse.json({ valid: false, error: 'Code PIN incorrect' })
    }

    upsertConfig('license_pin_last_used_at', new Date().toISOString())
    return NextResponse.json({ valid: true })
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
}
