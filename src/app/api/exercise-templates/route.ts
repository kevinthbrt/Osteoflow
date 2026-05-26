import { NextRequest, NextResponse } from 'next/server'
import type { ExercisePrescriptionItemDraft } from '@/types/exercise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: practitioner } = await db
      .from('practitioners').select('id').eq('user_id', user.id).single()
    if (!practitioner) return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })

    const { data: templates, error } = await db
      .from('exercise_prescription_templates')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: allItems } = await db
      .from('exercise_prescription_template_items')
      .select('*')
      .in('template_id', (templates || []).map((t: { id: string }) => t.id))
      .order('position', { ascending: true })

    const itemsByTemplate = new Map<string, typeof allItems>()
    for (const item of allItems || []) {
      if (!itemsByTemplate.has(item.template_id)) itemsByTemplate.set(item.template_id, [])
      itemsByTemplate.get(item.template_id)!.push(item)
    }

    const result = (templates || []).map((t: { id: string }) => ({
      ...t,
      items: itemsByTemplate.get(t.id) || [],
    }))

    return NextResponse.json({ templates: result })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: practitioner } = await db
      .from('practitioners').select('id').eq('user_id', user.id).single()
    if (!practitioner) return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })

    const body = await request.json()
    const { name, notes, items } = body as {
      name: string
      notes?: string
      items: ExercisePrescriptionItemDraft[]
    }

    if (!name?.trim()) return NextResponse.json({ error: 'name requis' }, { status: 400 })

    const { data: template, error: templateError } = await db
      .from('exercise_prescription_templates')
      .insert({ practitioner_id: practitioner.id, name: name.trim(), notes: notes || null })
      .select()
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: templateError?.message || 'Erreur création' }, { status: 500 })
    }

    const itemRows = (items || []).map((draft: ExercisePrescriptionItemDraft, index: number) => ({
      template_id: template.id,
      exercise_id: draft.exercise.id,
      exercise_name: draft.exercise.name,
      exercise_description: draft.exercise.description,
      exercise_region: draft.exercise.region,
      exercise_type: draft.exercise.type,
      exercise_level: draft.exercise.level,
      illustration_url: draft.exercise.illustration_url || null,
      sets: draft.sets,
      reps: draft.reps || null,
      hold_time: draft.hold_time,
      rest_time: draft.rest_time,
      frequency: draft.frequency || null,
      notes: draft.notes || null,
      position: index,
    }))

    if (itemRows.length > 0) {
      await db.from('exercise_prescription_template_items').insert(itemRows)
    }

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
