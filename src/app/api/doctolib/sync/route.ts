import { NextResponse } from 'next/server'
import { isDay, syncAgenda } from '@/lib/doctolib/agenda'
import { isValidPairingCode, recordExtensionSeen, recordImport } from '@/lib/doctolib/server'

export const dynamic = 'force-dynamic'

/**
 * Envoi de l'extension (code d'appairage dans `x-osteoflow-token`) : les
 * rendez-vous des jours `start` à `end`. Voir lib/doctolib/agenda.ts.
 */
export async function POST(request: Request) {
  if (!isValidPairingCode(request.headers.get('x-osteoflow-token'))) {
    return NextResponse.json({ error: 'Code d’appairage incorrect' }, { status: 401 })
  }
  let body: { start?: unknown; end?: unknown; appointments?: unknown; version?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Données illisibles' }, { status: 400 })
  }
  if (!isDay(body.start) || !isDay(body.end)) {
    return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
  }
  const summary = syncAgenda({ start: body.start, end: body.end, appointments: body.appointments })
  recordExtensionSeen(body.version)
  recordImport(summary.received)
  return NextResponse.json({ ok: true, ...summary, count: summary.received })
}
