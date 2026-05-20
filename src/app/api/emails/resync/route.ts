import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

// POST /api/emails/resync
// Resets last_sync_uid to 0 and deletes all incoming messages so they
// are re-fetched from IMAP with the corrected encoding on the next sync.
export async function POST() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!practitioner) return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })

    const serviceClient = await createServiceClient()

    // Delete all incoming messages for this practitioner's conversations
    const { data: conversations } = await serviceClient
      .from('conversations')
      .select('id')
      .eq('practitioner_id', practitioner.id)

    if (conversations && conversations.length > 0) {
      const ids = conversations.map((c) => c.id)
      await serviceClient
        .from('messages')
        .delete()
        .in('conversation_id', ids)
        .eq('direction', 'incoming')
    }

    // Reset last_sync_uid so all emails are re-fetched
    await serviceClient
      .from('email_settings')
      .update({ last_sync_uid: 0 })
      .eq('practitioner_id', practitioner.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[emails/resync]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
