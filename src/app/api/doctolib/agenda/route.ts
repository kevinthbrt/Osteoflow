import { NextResponse } from 'next/server'
import { isDay, markHandled, readAgendaRange } from '@/lib/doctolib/agenda'
import { isAppRequest } from '@/lib/doctolib/server'

export const dynamic = 'force-dynamic'

/** GET ?start=&end= : agenda Doctolib gardé sur le poste. Réservé à l'interface. */
export async function GET(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  const params = new URL(request.url).searchParams
  const start = params.get('start')
  const end = params.get('end') ?? start
  if (!isDay(start) || !isDay(end)) return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
  return NextResponse.json(readAgendaRange(start, end))
}

/** POST { handled: [...] } : rendez-vous ajoutés à la main ou ignorés dans Ma journée. */
export async function POST(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { handled?: unknown } | null
  if (!body || !Array.isArray(body.handled)) return NextResponse.json({ error: 'Données illisibles' }, { status: 400 })
  markHandled(body.handled.slice(0, 500))
  return NextResponse.json({ ok: true })
}
