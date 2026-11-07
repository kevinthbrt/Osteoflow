import { NextResponse } from 'next/server'
import { isDay, syncAgenda, todayLocal } from '@/lib/doctolib/agenda'
import { isValidPairingCode, recordExtensionSeen, recordImport } from '@/lib/doctolib/server'

export const dynamic = 'force-dynamic'

/**
 * Envoi d'un seul jour par l'extension 1.0 (avant la synchronisation
 * automatique). Gardé pour les postes pas encore mis à jour.
 */
export async function POST(request: Request) {
  if (!isValidPairingCode(request.headers.get('x-osteoflow-token'))) {
    return NextResponse.json({ error: 'Code d’appairage incorrect' }, { status: 401 })
  }
  let body: { appointments?: unknown; date?: unknown; version?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Données illisibles' }, { status: 400 })
  }
  const date = isDay(body.date) ? body.date : todayLocal()
  const summary = syncAgenda({ start: date, end: date, appointments: body.appointments })
  recordExtensionSeen(body.version)
  recordImport(summary.received)
  return NextResponse.json({ ok: true, count: summary.received })
}
