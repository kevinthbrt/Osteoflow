import { NextResponse } from 'next/server'
import { parseDoctolibAppointments } from '@/lib/doctolib/import'
import {
  clearPendingImport,
  isAppRequest,
  isValidPairingCode,
  readPendingImport,
  recordExtensionSeen,
  recordImport,
  savePendingImport,
} from '@/lib/doctolib/server'

export const dynamic = 'force-dynamic'

const MAX_APPOINTMENTS = 300

/**
 * POST : envoi de l'extension (code d'appairage dans `x-osteoflow-token`).
 * Les rendez-vous sont gardés sur le poste en attente de validation dans
 * « Ma journée » : rien n'est ajouté sans l'accord du praticien.
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
  const appointments = parseDoctolibAppointments(body.appointments).slice(0, MAX_APPOINTMENTS)
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null
  savePendingImport({ receivedAt: new Date().toISOString(), date, appointments })
  recordExtensionSeen(body.version)
  recordImport(appointments.length)
  return NextResponse.json({ ok: true, count: appointments.length })
}

/** GET : rendez-vous reçus, pour l'écran de validation. */
export async function GET(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  return NextResponse.json({ pending: readPendingImport() })
}

/** DELETE : import traité ou abandonné. */
export async function DELETE(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  clearPendingImport()
  return NextResponse.json({ ok: true })
}
