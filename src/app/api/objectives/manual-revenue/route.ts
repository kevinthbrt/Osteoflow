import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDatabase } = await import('@/lib/database/connection')

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { year, month, amount } = body

    if (!year || !month || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'Mois invalide' }, { status: 400 })
    }

    const rawDb = getDatabase()

    // Upsert: insert or replace
    rawDb.prepare(`
      INSERT INTO manual_revenue_entries (practitioner_id, year, month, amount, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(practitioner_id, year, month)
      DO UPDATE SET amount = excluded.amount, updated_at = datetime('now')
    `).run(practitioner.id, year, month, amount)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[manual-revenue POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDatabase } = await import('@/lib/database/connection')

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const year = Number(searchParams.get('year'))
    const month = Number(searchParams.get('month'))

    if (!year || !month) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    const rawDb = getDatabase()
    rawDb.prepare(`
      DELETE FROM manual_revenue_entries
      WHERE practitioner_id = ? AND year = ? AND month = ?
    `).run(practitioner.id, year, month)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[manual-revenue DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
