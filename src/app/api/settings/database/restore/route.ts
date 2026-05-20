import { NextResponse } from 'next/server'
import { getDatabase, closeDatabase } from '@/lib/database/connection'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate SQLite magic bytes
    const magic = buffer.slice(0, 16).toString('utf8')
    if (!magic.startsWith('SQLite format 3')) {
      return NextResponse.json({ error: 'Fichier invalide (ce n\'est pas une base SQLite)' }, { status: 400 })
    }

    const db = getDatabase()
    const dbPath = db.name
    const backupPath = dbPath + '.pre-restore-' + Date.now()

    // Backup current DB before overwriting
    fs.copyFileSync(dbPath, backupPath)

    // Close connection BEFORE writing — writing to an open SQLite file corrupts it
    closeDatabase()

    // Delete WAL and SHM files — if left from the old DB, SQLite tries to apply
    // them to the restored file and reports "database disk image is malformed"
    for (const ext of ['-wal', '-shm']) {
      const f = dbPath + ext
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }

    // Write the uploaded file
    fs.writeFileSync(dbPath, buffer)

    return NextResponse.json({
      success: true,
      message: 'Base de données restaurée. Redémarrez l\'application pour appliquer.',
      backup_created: path.basename(backupPath),
    })
  } catch (error) {
    console.error('[restore]', error)
    return NextResponse.json({ error: 'Erreur lors de la restauration' }, { status: 500 })
  }
}
