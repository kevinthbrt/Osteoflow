import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'tour_completed'")
      .get() as { value: string } | undefined
    return NextResponse.json({ seen: row?.value === '1' })
  } catch {
    return NextResponse.json({ seen: false })
  }
}

export async function POST() {
  try {
    const db = getDatabase()
    db.prepare(
      "INSERT INTO app_config (key, value) VALUES ('tour_completed', '1') ON CONFLICT(key) DO UPDATE SET value = '1'"
    ).run()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
