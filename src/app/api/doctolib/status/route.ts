import { NextResponse } from 'next/server'
import { isAppRequest, readExtensionStatus } from '@/lib/doctolib/server'

export const dynamic = 'force-dynamic'

/** État de l'extension (connectée, dernier envoi). Réservé à l'interface. */
export async function GET(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  return NextResponse.json(readExtensionStatus())
}
