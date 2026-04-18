import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const db = getDatabase()
    db.prepare(
      "INSERT OR REPLACE INTO app_config (key, value) VALUES ('session_locked', '1')"
    ).run()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const db = getDatabase()
    db.prepare("DELETE FROM app_config WHERE key = 'session_locked'").run()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
