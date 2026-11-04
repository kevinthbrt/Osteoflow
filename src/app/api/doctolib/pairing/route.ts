import { NextResponse } from 'next/server'
import { getPairingCode, isAppRequest } from '@/lib/doctolib/server'

export const dynamic = 'force-dynamic'

/** Code à saisir dans l'extension. Réservé à l'interface d'Osteoflow. */
export async function GET(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  return NextResponse.json({ code: getPairingCode() })
}

/** Nouveau code : l'ancien cesse de fonctionner. */
export async function POST(request: Request) {
  if (!isAppRequest(request)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  return NextResponse.json({ code: getPairingCode(true) })
}
