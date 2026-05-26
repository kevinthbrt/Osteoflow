import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: practitioner } = await db
      .from('practitioners').select('id').eq('user_id', user.id).single()
    if (!practitioner) return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })

    const { id } = await params

    const { data: template } = await db
      .from('exercise_prescription_templates')
      .select('id, practitioner_id')
      .eq('id', id)
      .single()

    if (!template) return NextResponse.json({ error: 'Modèle non trouvé' }, { status: 404 })
    if (template.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    await db.from('exercise_prescription_template_items').delete().eq('template_id', id)
    await db.from('exercise_prescription_templates').delete().eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
