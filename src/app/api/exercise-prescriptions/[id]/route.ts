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
      .select('id, title, program_id, starts_after_days')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 })
    }

    const body = await request.json()
    const { title, notes, items, starts_after_days, patient_intro, weekly_routine, clinical_notes, change_source } = body as {
      title: string
      notes?: string
      items: ExercisePrescriptionItemDraft[]
      starts_after_days?: number | null
      patient_intro?: string | null
      weekly_routine?: string | null
      clinical_notes?: string | null
      /** « ia » : modification proposée par l'assistant et validée par le praticien */
      change_source?: 'ia'
    }

    if (!title) {
      return NextResponse.json({ error: 'title requis' }, { status: 400 })
    }

    const { data: prescription, error: updateError } = await db
      .from('exercise_prescriptions')
      .update({
        title,
        notes: notes || null,
        ...(starts_after_days != null ? { starts_after_days: Math.max(0, Math.round(starts_after_days)) } : {}),
        ...(patient_intro !== undefined ? { patient_intro } : {}),
        ...(weekly_routine !== undefined ? { weekly_routine } : {}),
        ...(clinical_notes !== undefined ? { clinical_notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError || !prescription) {
      return NextResponse.json({ error: updateError?.message || 'Erreur mise à jour' }, { status: 500 })
    }

    // Journal du programme : ce qui change pour le patient.
    const { data: previousItems } = await db.from('exercise_prescription_items').select('*').eq('prescription_id', id)
    if (existing.program_id) {
      const { logProgramChange, describeItemChanges } = await import('@/lib/exercises/programs')
      const notes: string[] = []
      const itemNote = describeItemChanges(previousItems || [], items || [])
      if (itemNote) notes.push(itemNote)
      if (starts_after_days != null && Math.round(starts_after_days) !== existing.starts_after_days) {
        notes.push(`début déplacé à la semaine ${Math.floor(Math.max(0, starts_after_days) / 7) + 1}`)
      }
      if (title !== existing.title) notes.push(`renommée « ${title} »`)
      if (notes.length) {
        await logProgramChange(db, existing.program_id, `${change_source === 'ia' ? 'Assistant IA, ' : ''}${existing.title} : ${notes.join(' ; ')}`)
      }
      // Programme d'une seule étape : son titre suit celui de la fiche.
      const { data: siblings } = await db.from('exercise_prescriptions').select('id').eq('program_id', existing.program_id)
      if ((siblings || []).length === 1) await db.from('exercise_programs').update({ title }).eq('id', existing.program_id)
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
      .select('id, title, program_id')
      .eq('id', id)
      .single()

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 })
    }

    const programId: string | null = prescription.program_id
    const { data: siblings } = programId
      ? await db.from('exercise_prescriptions').select('id').eq('program_id', programId).neq('id', id).order('starts_after_days', { ascending: true })
      : { data: [] }

    if (programId && siblings?.length) {
      // Les bilans appartiennent au programme : ils passent sur une autre étape.
      await db.from('exercise_adherence_reports').update({ prescription_id: siblings[0].id }).eq('prescription_id', id)
    } else {
      await db.from('exercise_adherence_reports').delete().eq('prescription_id', id)
    }
    await db.from('exercise_prescription_items').delete().eq('prescription_id', id)
    await db.from('exercise_prescriptions').delete().eq('id', id)

    if (programId) {
      if (siblings?.length) {
        const { logProgramChange } = await import('@/lib/exercises/programs')
        await logProgramChange(db, programId, `Étape supprimée : ${prescription.title}`)
      } else {
        await db.from('exercise_program_changes').delete().eq('program_id', programId)
        await db.from('exercise_programs').delete().eq('id', programId)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting prescription:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
