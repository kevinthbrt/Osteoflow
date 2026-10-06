import { NextRequest, NextResponse } from 'next/server'
import { checkLocalApiToken } from '@/lib/local-api-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: patient, error } = await db
      .from('patients')
      .select('id, first_name, last_name, birth_date, gender, profession, sport_activity, notes')
      .eq('id', id)
      .single()

    if (error || !patient) return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 })

    // Antécédents : la base vide les colonnes plates de `patients` au profit de
    // `medical_history_entries`. On reconstruit donc les champs depuis cette table.
    const { data: historyEntries } = await db
      .from('medical_history_entries')
      .select('history_type, description, onset_age, note')
      .eq('patient_id', id)
      .order('display_order', { ascending: true })

    const byType: Record<string, string[]> = { traumatic: [], medical: [], surgical: [], family: [] }
    for (const e of historyEntries || []) {
      if (!e.description) continue
      const extra = e.onset_age != null ? ` (à ${e.onset_age} ans)` : ''
      const note = e.note ? ` — ${e.note}` : ''
      if (byType[e.history_type]) byType[e.history_type].push(`${e.description}${extra}${note}`)
    }
    const join = (arr: string[]) => (arr.length ? arr.join(' ; ') : null)

    return NextResponse.json({
      patient: {
        ...patient,
        trauma_history: join(byType.traumatic),
        medical_history: join(byType.medical),
        surgical_history: join(byType.surgical),
        family_history: join(byType.family),
      },
    })
  } catch (err) {
    console.error('Error fetching patient:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkLocalApiToken(req)
  if (authError) return authError

  try {
    const { id } = await params
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Lecture via le query-builder : elle applique le périmètre du cabinet actif.
    const { data: patient } = await db
      .from('patients')
      .select('id')
      .eq('id', id)
      .single()

    if (!patient) return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 })

    const { getDatabase, getAppDataDir } = await import('@/lib/database/connection')
    const { deletePatientCascade, removeAttachmentFiles } = await import('@/lib/database/delete-cascade')
    const path = await import('path')

    const { attachmentFiles } = deletePatientCascade(getDatabase(), id)
    removeAttachmentFiles(path.join(getAppDataDir(), 'attachments'), attachmentFiles)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting patient:', err)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
