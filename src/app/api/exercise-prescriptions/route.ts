import { NextRequest, NextResponse } from 'next/server'
import type { ExercisePrescriptionItemDraft } from '@/types/exercise'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const patientId = request.nextUrl.searchParams.get('patient_id')
    if (!patientId) {
      return NextResponse.json({ error: 'patient_id requis' }, { status: 400 })
    }

    const { data: prescriptions, error } = await db
      .from('exercise_prescriptions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: allItems } = await db
      .from('exercise_prescription_items')
      .select('*')
      .in('prescription_id', (prescriptions || []).map((p: { id: string }) => p.id))
      .order('position', { ascending: true })

    const itemsByPrescription = new Map<string, typeof allItems>()
    for (const item of allItems || []) {
      if (!itemsByPrescription.has(item.prescription_id)) {
        itemsByPrescription.set(item.prescription_id, [])
      }
      itemsByPrescription.get(item.prescription_id)!.push(item)
    }

    // Dernier bilan rapporté par le patient, pour l'afficher sous le programme.
    const { data: reportRows } = await db
      .from('exercise_adherence_reports')
      .select('prescription_id, kind, payload, created_at')
      .in('prescription_id', (prescriptions || []).map((p: { id: string }) => p.id))
      .order('created_at', { ascending: false })
    const latestReport = new Map<string, { kind: string; created_at: string; weeks: unknown }>()
    for (const r of reportRows || []) {
      if (latestReport.has(r.prescription_id)) continue
      try {
        latestReport.set(r.prescription_id, { kind: r.kind, created_at: r.created_at, weeks: JSON.parse(r.payload).weeks ?? [] })
      } catch { /* bilan illisible : ignoré */ }
    }

    const result = (prescriptions || []).map((p: { id: string }) => ({
      ...p,
      items: itemsByPrescription.get(p.id) || [],
      latest_report: latestReport.get(p.id) ?? null,
    }))

    return NextResponse.json({ prescriptions: result })
  } catch (error) {
    console.error('Error fetching prescriptions:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { patient_id, consultation_id, title, notes, patient_intro, vigilance_points, weekly_routine, clinical_notes, items, program_id, starts_after_days, change_source } = body as {
      patient_id: string
      /** étape ajoutée à un programme existant ; sinon un programme est créé */
      program_id?: string | null
      /** début de l'étape, en jours après le début du programme */
      starts_after_days?: number | null
      change_source?: 'ia'
      consultation_id?: string
      title: string
      notes?: string
      patient_intro?: string
      vigilance_points?: string
      weekly_routine?: string
      clinical_notes?: string
      items: ExercisePrescriptionItemDraft[]
    }

    if (!patient_id || !title) {
      return NextResponse.json({ error: 'patient_id et title requis' }, { status: 400 })
    }

    const { logProgramChange, phaseLabel, localToday } = await import('@/lib/exercises/programs')

    // Programme : celui demandé (nouvelle étape) ou un nouveau programme.
    let programId = program_id || null
    let phaseIndex = 0
    if (programId) {
      const { data: program } = await db.from('exercise_programs').select('id, patient_id').eq('id', programId).single()
      if (!program || program.patient_id !== patient_id) {
        return NextResponse.json({ error: 'Programme introuvable pour ce patient' }, { status: 404 })
      }
      const { data: phases } = await db.from('exercise_prescriptions').select('id, starts_after_days').eq('program_id', programId)
      phaseIndex = (phases || []).filter((ph: { starts_after_days: number }) => ph.starts_after_days <= (starts_after_days ?? 0)).length
    } else {
      const { data: program, error: programError } = await db
        .from('exercise_programs')
        .insert({ patient_id, title, start_date: localToday() })
        .select()
        .single()
      if (programError || !program) {
        return NextResponse.json({ error: programError?.message || 'Erreur création du programme' }, { status: 500 })
      }
      programId = program.id
    }

    const { data: prescription, error: prescriptionError } = await db
      .from('exercise_prescriptions')
      .insert({
        program_id: programId,
        starts_after_days: program_id ? Math.max(0, Math.round(starts_after_days ?? 0)) : 0,
        patient_id,
        consultation_id: consultation_id || null,
        title,
        notes: notes || null,
        patient_intro: patient_intro || null,
        vigilance_points: vigilance_points || null,
        weekly_routine: weekly_routine || null,
        clinical_notes: clinical_notes || null,
      })
      .select()
      .single()

    if (prescriptionError || !prescription) {
      return NextResponse.json({ error: prescriptionError?.message || 'Erreur création' }, { status: 500 })
    }

    const itemRows = (items || []).map((draft: ExercisePrescriptionItemDraft, index: number) => ({
      prescription_id: prescription.id,
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

    await logProgramChange(db, programId!, program_id
      ? `${change_source === 'ia' ? 'Assistant IA, ' : ''}${phaseLabel(phaseIndex, prescription.starts_after_days)} ajoutée : ${title}`
      : `Programme créé : ${title}`)

    const { data: savedItems } = await db
      .from('exercise_prescription_items')
      .select('*')
      .eq('prescription_id', prescription.id)
      .order('position', { ascending: true })

    return NextResponse.json({ prescription: { ...prescription, items: savedItems || [] } }, { status: 201 })
  } catch (error) {
    console.error('Error creating prescription:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
