import { NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'
import { hasFeature } from '@/lib/features-server'

export const dynamic = 'force-dynamic'

const PROXY_URL = `${process.env.OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'}/api/osteoflow/ai/adjust-exercise-program`

/**
 * Assistant de programme : envoie à osteoupgrade le programme (étapes,
 * exercices, suivi, journal), sans l'identité du patient, et renvoie des
 * propositions de modification. Rien n'est appliqué ici.
 */
export async function POST(req: Request) {
  try {
    const { program_id, mode, instruction, history } = (await req.json()) as {
      program_id: string
      mode: 'next' | 'instruction'
      instruction?: string
      history?: Array<{ request: string; summary: string }>
    }
    if (!hasFeature('programmes')) {
      return NextResponse.json({ error: 'L’assistant de programme n’est pas encore disponible sur votre compte.' }, { status: 403 })
    }
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })

    const { createClient } = await import('@/lib/db/server')
    const { loadPrograms } = await import('@/lib/exercises/programs')
    const { programAiPayload } = await import('@/lib/exercises/program-ai')
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { data: practitioner } = await db.from('practitioners').select('id').eq('user_id', user.id).single()
    const [program] = await loadPrograms(db, { programId: program_id })
    if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
    const { data: patient } = await db.from('patients').select('practitioner_id').eq('id', program.patient_id).single()
    if (!practitioner || !patient || patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    let res: Response
    try {
      res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-osteoflow-secret': secret, ...getOsteoflowAuthHeaders() },
        body: JSON.stringify({ program: programAiPayload(program), mode, instruction, history: (history ?? []).slice(-2) }),
        signal: AbortSignal.timeout(130000),
      })
    } catch {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 500 })
    }
    const data = await res.json().catch(() => ({ error: `Erreur service (${res.status})` }))
    return NextResponse.json(data, { status: res.ok ? 200 : 502 })
  } catch (error) {
    console.error('[adjust-exercise-program proxy]', error)
    return NextResponse.json({ error: 'Erreur lors de la demande à l’assistant.' }, { status: 500 })
  }
}
