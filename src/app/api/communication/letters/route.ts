import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await createClient()
    const { data: letters, error } = await db
      .from('generated_letters')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ letters: letters ?? [] })
  } catch (err) {
    console.error('[letters GET]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const db = await createClient()
    const body = await req.json()

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: letter, error } = await db
      .from('generated_letters')
      .insert({
        practitioner_id: practitioner.id,
        consultation_id: body.consultation_id ?? null,
        patient_id: body.patient_id ?? null,
        template_id: body.template_id,
        template_name: body.template_name,
        header: body.header,
        body: body.body,
        recipient_name: body.recipient_name ?? null,
        recipient_title: body.recipient_title ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ letter })
  } catch (err) {
    console.error('[letters POST]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
