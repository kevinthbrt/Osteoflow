import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Db = Awaited<ReturnType<typeof import('@/lib/db/server').createClient>>

async function loadOwned(db: Db, id: string) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const { data: practitioner } = await db.from('practitioners').select('id').eq('user_id', user.id).single()
  if (!practitioner) return { error: NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 }) }
  const { data: prescription } = await db.from('exercise_prescriptions').select('*').eq('id', id).single()
  if (!prescription) return { error: NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 }) }
  const { data: patient } = await db.from('patients').select('practitioner_id').eq('id', prescription.patient_id).single()
  if (!patient || patient.practitioner_id !== practitioner.id) {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) }
  }
  return { prescription }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()
    const { id } = await params
    const owned = await loadOwned(db, id)
    if (owned.error) return owned.error
    const { data: rows } = await db
      .from('exercise_adherence_reports')
      .select('*')
      .eq('prescription_id', id)
      .order('created_at', { ascending: false })
    const reports = (rows || []).map((r: { id: string; source: string; kind: string; payload: string; created_at: string }) => ({
      id: r.id, source: r.source, kind: r.kind, created_at: r.created_at, ...JSON.parse(r.payload),
    }))
    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error listing adherence reports:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** Enregistre un bilan scanné, tapé ou collé par le praticien. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { parseReportInput, matchesPrescription } = await import('@/lib/exercises/adherence')
    const db = await createClient()
    const { id } = await params
    const owned = await loadOwned(db, id)
    if (owned.error) return owned.error

    const { input, source } = (await request.json()) as { input?: string; source?: string }
    if (!input || !['qr', 'code', 'texte'].includes(source ?? '')) {
      return NextResponse.json({ error: 'Bilan manquant' }, { status: 400 })
    }
    const parsed = parseReportInput(input)
    if (!parsed) {
      return NextResponse.json({ error: 'Bilan illisible : vérifiez le code ou recommencez le scan.' }, { status: 400 })
    }
    const programId: string = owned.prescription.program_id ?? id
    if (!matchesPrescription(parsed, programId)) {
      return NextResponse.json({ error: 'Ce bilan correspond à un autre programme de ce patient ou d’un autre patient.' }, { status: 409 })
    }

    const payload = parsed.kind === 'full'
      ? { weeks: parsed.weeks, report: parsed.report }
      : { weeks: parsed.weeks }
    const { data, error } = await db
      .from('exercise_adherence_reports')
      .insert({
        prescription_id: id,
        program_id: programId,
        patient_id: owned.prescription.patient_id,
        source,
        kind: parsed.kind,
        payload: JSON.stringify(payload),
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ report: { id: data.id, source, kind: parsed.kind, created_at: data.created_at, ...payload } })
  } catch (error) {
    console.error('Error saving adherence report:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
