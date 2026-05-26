import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    const { data: prescription, error } = await db
      .from('exercise_prescriptions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !prescription) {
      return NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 })
    }

    const { data: items } = await db
      .from('exercise_prescription_items')
      .select('*')
      .eq('prescription_id', id)
      .order('position', { ascending: true })

    return NextResponse.json({ prescription: { ...prescription, items: items || [] } })
  } catch (error) {
    console.error('Error fetching prescription:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    const { data: prescription } = await db
      .from('exercise_prescriptions')
      .select('id')
      .eq('id', id)
      .single()

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 })
    }

    await db.from('exercise_prescription_items').delete().eq('prescription_id', id)
    await db.from('exercise_prescriptions').delete().eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting prescription:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
