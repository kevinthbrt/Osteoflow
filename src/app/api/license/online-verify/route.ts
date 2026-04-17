import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

const OSTEOUPGRADE_URL =
  process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'

function getAppConfig(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(key) as any
  return row?.value ?? null
}

function upsertConfig(key: string, value: string) {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(key, value)
}

export async function POST() {
  const token = getAppConfig('license_token')
  const deviceId = getAppConfig('license_device_id')

  if (!token || !deviceId) {
    return NextResponse.json({ valid: false, error: 'Aucune session active' })
  }

  try {
    const res = await fetch(
      `${OSTEOUPGRADE_URL}/api/osteoflow/verify?token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(deviceId)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()

    if (data.valid) {
      upsertConfig('license_last_verified_at', new Date().toISOString())
      if (data.role) {
        upsertConfig('license_role', data.role)
      }
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ valid: null, error: 'offline' })
  }
}
