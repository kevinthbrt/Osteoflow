import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function hashPin(pin: string, deviceId: string): string {
  return crypto.createHash('sha256').update(pin + deviceId).digest('hex')
}

async function upsertConfig(db: any, key: string, value: string) {
  await db.from('app_config').delete().eq('key', key)
  await db.from('app_config').insert({ key, value })
}

export async function POST(request: Request) {
  const db = await createClient()
  const { action, pin } = await request.json()

  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: 'Le code PIN doit être composé de 4 chiffres' },
      { status: 400 }
    )
  }

  const { data: deviceRow } = await db
    .from('app_config')
    .select('value')
    .eq('key', 'license_device_id')
    .single()

  const deviceId = deviceRow?.value
  if (!deviceId) {
    return NextResponse.json({ error: 'Appareil non identifié' }, { status: 400 })
  }

  if (action === 'set') {
    const hash = hashPin(pin, deviceId)
    await upsertConfig(db, 'license_pin_hash', hash)
    await upsertConfig(db, 'license_pin_last_used_at', new Date().toISOString())
    return NextResponse.json({ success: true })
  }

  if (action === 'verify') {
    const { data: hashRow } = await db
      .from('app_config')
      .select('value')
      .eq('key', 'license_pin_hash')
      .single()

    if (!hashRow?.value) {
      return NextResponse.json({ valid: false, error: 'Aucun PIN configuré' })
    }

    const expected = hashPin(pin, deviceId)
    if (hashRow.value !== expected) {
      return NextResponse.json({ valid: false, error: 'Code PIN incorrect' })
    }

    await upsertConfig(db, 'license_pin_last_used_at', new Date().toISOString())
    return NextResponse.json({ valid: true })
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
}
