import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!practitioner) return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const action = searchParams.get('action') || ''
    const table = searchParams.get('table') || ''
    const offset = (page - 1) * limit

    const rawDb = getDatabase()

    let where = 'WHERE (practitioner_id = ? OR practitioner_id IS NULL)'
    const params: (string | number)[] = [practitioner.id]

    if (action) { where += ' AND action = ?'; params.push(action) }
    if (table) { where += ' AND table_name = ?'; params.push(table) }

    const total = (rawDb.prepare(`SELECT COUNT(*) as count FROM audit_logs ${where}`).get(...params) as { count: number }).count

    params.push(limit, offset)
    const rows = rawDb.prepare(`
      SELECT id, table_name, record_id, action, old_data, new_data, created_at
      FROM audit_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params) as Array<{
      id: string
      table_name: string
      record_id: string
      action: string
      old_data: string | null
      new_data: string | null
      created_at: string
    }>

    return NextResponse.json({ logs: rows, total, page, limit })
  } catch (error) {
    console.error('[audit-logs GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
