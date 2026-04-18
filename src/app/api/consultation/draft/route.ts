import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'consultation_draft'")
      .get() as { value: string } | undefined
    if (!row) return NextResponse.json({ draft: null })
    return NextResponse.json({ draft: JSON.parse(row.value) })
  } catch {
    return NextResponse.json({ draft: null })
  }
}

export async function POST(request: Request) {
  try {
    const draft = await request.json()
    const db = getDatabase()
    db.prepare(
      "INSERT OR REPLACE INTO app_config (key, value) VALUES ('consultation_draft', ?)"
    ).run(JSON.stringify({ ...draft, savedAt: new Date().toISOString() }))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const db = getDatabase()
    db.prepare("DELETE FROM app_config WHERE key = 'consultation_draft'").run()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
