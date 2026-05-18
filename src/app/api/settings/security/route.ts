import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

const KEY = 'inactivity_timeout_minutes'
const DEFAULT = 30

function getConfig(): number {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(KEY) as { value: string } | undefined
  return row ? parseInt(row.value) : DEFAULT
}

export async function GET() {
  try {
    return NextResponse.json({ inactivity_timeout_minutes: getConfig() })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { inactivity_timeout_minutes } = await request.json()
    const minutes = parseInt(inactivity_timeout_minutes)
    if (isNaN(minutes) || minutes < 1 || minutes > 480) {
      return NextResponse.json({ error: 'Valeur invalide (1-480 minutes)' }, { status: 400 })
    }
    const db = getDatabase()
    db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(KEY, String(minutes))
    return NextResponse.json({ success: true, inactivity_timeout_minutes: minutes })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
