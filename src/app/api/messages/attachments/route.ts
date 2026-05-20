import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// POST /api/messages/attachments — upload one or more files for a message
export async function POST(request: Request) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const messageId = formData.get('message_id') as string | null
    const files = formData.getAll('files') as File[]

    if (!messageId || files.length === 0) {
      return NextResponse.json({ error: 'message_id et fichiers requis' }, { status: 400 })
    }

    const rawDb = getDatabase()

    // Verify message exists
    const msg = rawDb.prepare('SELECT id FROM messages WHERE id = ?').get(messageId)
    if (!msg) return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })

    const inserted: Array<{ id: string; filename: string; mime_type: string; file_size: number }> = []

    const stmt = rawDb.prepare(`
      INSERT INTO message_attachments (message_id, filename, mime_type, file_size, data)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id, filename, mime_type, file_size
    `)

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Fichier "${file.name}" trop volumineux (max 10 Mo)` },
          { status: 413 }
        )
      }
      const bytes = await file.arrayBuffer()
      const row = stmt.get(messageId, file.name, file.type || 'application/octet-stream', file.size, Buffer.from(bytes)) as { id: string; filename: string; mime_type: string; file_size: number }
      inserted.push(row)
    }

    return NextResponse.json({ attachments: inserted })
  } catch (error) {
    console.error('[attachments POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET /api/messages/attachments?message_id=xxx — list attachments for a message (no binary)
export async function GET(request: Request) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id')
    if (!messageId) return NextResponse.json({ error: 'message_id requis' }, { status: 400 })

    const rawDb = getDatabase()
    const rows = rawDb.prepare(`
      SELECT id, filename, mime_type, file_size, created_at
      FROM message_attachments WHERE message_id = ?
      ORDER BY created_at ASC
    `).all(messageId) as Array<{ id: string; filename: string; mime_type: string; file_size: number; created_at: string }>

    return NextResponse.json({ attachments: rows })
  } catch (error) {
    console.error('[attachments GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
