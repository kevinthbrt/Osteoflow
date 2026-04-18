import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

const DRAFT_KEY = 'consultation_draft'

export async function GET() {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(DRAFT_KEY) as any
  if (!row) return NextResponse.json({ draft: null })
  try {
    return NextResponse.json({ draft: JSON.parse(row.value) })
  } catch {
    return NextResponse.json({ draft: null })
  }
}

export async function POST(request: Request) {
  const draft = await request.json()
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(
    DRAFT_KEY,
    JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
  )
  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const db = getDatabase()
  db.prepare('DELETE FROM app_config WHERE key = ?').run(DRAFT_KEY)
  return NextResponse.json({ success: true })
}
