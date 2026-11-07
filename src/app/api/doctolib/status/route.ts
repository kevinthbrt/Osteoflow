import { NextResponse } from 'next/server'
import { isAutoAddEnabled, readLastSync, setAutoAdd } from '@/lib/doctolib/agenda'
import { isAppRequest, readExtensionStatus } from '@/lib/doctolib/server'

export const dynamic = 'force-dynamic'

/** État de l'extension et de la synchronisation. Réservé à l'interface. */
export async function GET(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  return NextResponse.json({ ...readExtensionStatus(), lastSync: readLastSync(), autoAdd: isAutoAddEnabled() })
}

/** POST { autoAdd } : ajout automatique des patients reconnus à Ma journée. */
export async function POST(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { autoAdd?: unknown } | null
  if (typeof body?.autoAdd !== 'boolean') return NextResponse.json({ error: 'Données illisibles' }, { status: 400 })
  setAutoAdd(body.autoAdd)
  return NextResponse.json({ ok: true, autoAdd: body.autoAdd })
}
