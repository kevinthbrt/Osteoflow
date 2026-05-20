import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

// GET /api/messages/attachments/[id] — stream the attachment binary
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const rawDb = getDatabase()
    const row = rawDb.prepare(`
      SELECT filename, mime_type, data FROM message_attachments WHERE id = ?
    `).get(id) as { filename: string; mime_type: string; data: Buffer } | undefined

    if (!row) return NextResponse.json({ error: 'Pièce jointe introuvable' }, { status: 404 })

    const encoded = encodeURIComponent(row.filename)
    return new NextResponse(row.data as unknown as BodyInit, {
      headers: {
        'Content-Type': row.mime_type,
        'Content-Disposition': `inline; filename*=UTF-8''${encoded}`,
        'Content-Length': String(row.data.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[attachments/[id] GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/messages/attachments/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const rawDb = getDatabase()
    rawDb.prepare('DELETE FROM message_attachments WHERE id = ?').run(id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[attachments/[id] DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
