import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import fs from 'fs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDatabase()

    // Use SQLite's built-in backup API for a consistent snapshot
    const dbPath = db.name
    const backupPath = dbPath + '.backup-' + Date.now()

    await new Promise<void>((resolve, reject) => {
      db.backup(backupPath)
        .then(() => resolve())
        .catch(reject)
    })

    const buffer = fs.readFileSync(backupPath)
    fs.unlinkSync(backupPath)

    // Record backup date
    const now = new Date().toISOString()
    db.prepare(
      "INSERT INTO app_config (key, value) VALUES ('last_backup_date', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(now)
    db.prepare("DELETE FROM app_config WHERE key = 'backup_reminder_snoozed_until'").run()

    const filename = `myosteoflow-backup-${new Date().toISOString().split('T')[0]}.db`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error) {
    console.error('[backup]', error)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }
}
