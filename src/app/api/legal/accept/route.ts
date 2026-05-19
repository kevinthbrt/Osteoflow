import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import { CGU_VERSION } from '@/lib/legal/documents'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare(
      "INSERT INTO app_config (key, value) VALUES ('cgu_accepted_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(CGU_VERSION)
    db.prepare(
      "INSERT INTO app_config (key, value) VALUES ('cgu_accepted_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(now)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[legal/accept]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
