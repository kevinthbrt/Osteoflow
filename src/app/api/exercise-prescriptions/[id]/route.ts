import { NextRequest, NextResponse } from 'next/server'
import type { ExercisePrescriptionItemDraft } from '@/types/exercise'

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

export async function PUT(
  request: NextRequest,
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

    const { data: existing } = await db
      .from('exercise_prescriptions')
      .select('id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 })
    }

    const body = await request.json()
    const { title, notes, items } = body as {
      title: string
      notes?: string
      items: ExercisePrescriptionItemDraft[]
    }

    if (!title) {
      return NextResponse.json({ error: 'title requis' }, { status: 400 })
    }

    const { data: prescription, error: updateError } = await db
      .from('exercise_prescriptions')
      .update({
        title,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError || !prescription) {
      return NextResponse.json({ error: updateError?.message || 'Erreur mise à jour' }, { status: 500 })
    }

    await db.from('exercise_prescription_items').delete().eq('prescription_id', id)

    const itemRows = (items || []).map((draft: ExercisePrescriptionItemDraft, index: number) => ({
      prescription_id: id,
      exercise_id: draft.exercise.id,
      exercise_name: draft.exercise.name,
      exercise_description: draft.exercise.description,
      exercise_region: draft.exercise.region,
      exercise_type: draft.exercise.type,
      exercise_level: draft.exercise.level,
      illustration_url: draft.exercise.illustration_url || null,
      nerve_target: draft.nerve_target || null,
      progression_regression: draft.progression_regression || null,
      sets: draft.sets,
      reps: draft.reps || null,
      hold_time: draft.hold_time,
      rest_time: draft.rest_time,
      frequency: draft.frequency || null,
      notes: draft.notes || null,
      position: index,
    }))

    if (itemRows.length > 0) {
      await db.from('exercise_prescription_items').insert(itemRows)
    }

    const { data: savedItems } = await db
      .from('exercise_prescription_items')
      .select('*')
      .eq('prescription_id', id)
      .order('position', { ascending: true })

    return NextResponse.json({ prescription: { ...prescription, items: savedItems || [] } })
  } catch (error) {
    console.error('Error updating prescription:', error)
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
