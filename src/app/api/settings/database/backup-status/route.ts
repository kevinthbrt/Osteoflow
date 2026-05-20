import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'last_backup_date'")
      .get() as { value: string } | undefined
    const snoozeRow = db
      .prepare("SELECT value FROM app_config WHERE key = 'backup_reminder_snoozed_until'")
      .get() as { value: string } | undefined

    return NextResponse.json({
      lastBackupDate: row?.value ?? null,
      snoozedUntil: snoozeRow?.value ?? null,
    })
  } catch {
    return NextResponse.json({ lastBackupDate: null, snoozedUntil: null })
  }
}

export async function POST(request: Request) {
  try {
    const { action, date } = await request.json() as { action: string; date?: string }
    const db = getDatabase()

    if (action === 'record') {
      const value = date ?? new Date().toISOString()
      db.prepare(
        "INSERT INTO app_config (key, value) VALUES ('last_backup_date', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(value)
      // Clear any snooze when a backup is actually made
      db.prepare(
        "DELETE FROM app_config WHERE key = 'backup_reminder_snoozed_until'"
      ).run()
      return NextResponse.json({ success: true })
    }

    if (action === 'snooze') {
      // Snooze for 3 days
      const until = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare(
        "INSERT INTO app_config (key, value) VALUES ('backup_reminder_snoozed_until', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(until)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
