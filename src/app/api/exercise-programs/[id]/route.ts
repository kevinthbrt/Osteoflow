import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function owned(db: any, id: string) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const { data: practitioner } = await db.from('practitioners').select('id').eq('user_id', user.id).single()
  const { data: program } = await db.from('exercise_programs').select('*').eq('id', id).single()
  if (!program) return { error: NextResponse.json({ error: 'Programme introuvable' }, { status: 404 }) }
  const { data: patient } = await db.from('patients').select('practitioner_id').eq('id', program.patient_id).single()
  if (!practitioner || !patient || patient.practitioner_id !== practitioner.id) {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) }
  }
  return { program }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { loadPrograms } = await import('@/lib/exercises/programs')
    const db = await createClient()
    const { id } = await params
    const check = await owned(db, id)
    if (check.error) return check.error
    const [program] = await loadPrograms(db, { programId: id })
    return NextResponse.json({ program })
  } catch (error) {
    console.error('Error loading exercise program:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * Arrêter ou reprendre un programme, le renommer, déplacer le début de ses
 * étapes. Chaque changement visible par le patient entre dans le journal.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { loadPrograms, logProgramChange } = await import('@/lib/exercises/programs')
    const db = await createClient()
    const { id } = await params
    const check = await owned(db, id)
    if (check.error) return check.error

    const body = (await request.json()) as {
      status?: 'active' | 'ended'
      title?: string
      start_date?: string
      phases?: Array<{ id: string; starts_after_days: number }>
    }

    if (body.status && body.status !== check.program.status) {
      await db.from('exercise_programs').update({
        status: body.status,
        ended_at: body.status === 'ended' ? new Date().toISOString() : null,
      }).eq('id', id)
      await db.from('exercise_program_changes').insert({ program_id: id, note: body.status === 'ended' ? 'Programme arrêté' : 'Programme repris' })
    }
    if (body.title?.trim() && body.title.trim() !== check.program.title) {
      await db.from('exercise_programs').update({ title: body.title.trim() }).eq('id', id)
    }
    if (body.start_date && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date) && body.start_date !== check.program.start_date) {
      await db.from('exercise_programs').update({ start_date: body.start_date }).eq('id', id)
      await logProgramChange(db, id, `Début du programme fixé au ${new Date(`${body.start_date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`)
    }
    if (body.phases?.length) {
      const { data: phases } = await db.from('exercise_prescriptions').select('id, title, starts_after_days').eq('program_id', id)
      const moved: string[] = []
      for (const ph of body.phases) {
        const cur = (phases || []).find((p: { id: string }) => p.id === ph.id)
        const next = Math.max(0, Math.round(ph.starts_after_days))
        if (!cur || cur.starts_after_days === next) continue
        await db.from('exercise_prescriptions').update({ starts_after_days: next }).eq('id', ph.id)
        moved.push(`${cur.title} dès la semaine ${Math.floor(next / 7) + 1}`)
      }
      if (moved.length) await logProgramChange(db, id, `Calendrier modifié : ${moved.join(', ')}`)
    }

    const [program] = await loadPrograms(db, { programId: id })
    return NextResponse.json({ program })
  } catch (error) {
    console.error('Error updating exercise program:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
