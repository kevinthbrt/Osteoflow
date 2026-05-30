import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

// GET  -> { seenIds: string[] }
// POST { ids: string[] } -> persists seen broadcast IDs in SQLite
export async function GET() {
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'broadcast_seen_ids'")
      .get() as { value: string } | undefined
    const seenIds: string[] = row?.value ? JSON.parse(row.value) : []
    return NextResponse.json({ seenIds })
  } catch {
    return NextResponse.json({ seenIds: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids)) return NextResponse.json({ ok: false }, { status: 400 })

    const db = getDatabase()
    // Read existing, merge, deduplicate
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'broadcast_seen_ids'")
      .get() as { value: string } | undefined
    const existing: string[] = row?.value ? JSON.parse(row.value) : []
    const merged = [...new Set([...existing, ...ids])]

    db.prepare(
      "INSERT INTO app_config (key, value) VALUES ('broadcast_seen_ids', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(JSON.stringify(merged))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
