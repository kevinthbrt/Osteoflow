import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import { clearSessionVerified } from '@/lib/license-session'

export const dynamic = 'force-dynamic'

export async function POST() {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run('session_locked', '1')
  clearSessionVerified()
  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const db = getDatabase()
  db.prepare("DELETE FROM app_config WHERE key = 'session_locked'").run()
  return NextResponse.json({ success: true })
}
