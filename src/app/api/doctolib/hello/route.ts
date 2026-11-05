import { NextResponse } from 'next/server'
import { isValidPairingCode, recordExtensionSeen } from '@/lib/doctolib/server'

export const dynamic = 'force-dynamic'

/**
 * Signe de vie de l'extension (code d'appairage dans `x-osteoflow-token`),
 * envoyé à l'installation et à chaque ouverture : l'interface peut alors
 * afficher « Extension connectée ».
 */
export async function POST(request: Request) {
  if (!isValidPairingCode(request.headers.get('x-osteoflow-token'))) {
    return NextResponse.json({ error: 'Code d’appairage incorrect' }, { status: 401 })
  }
  let version: unknown = null
  try {
    version = ((await request.json()) as { version?: unknown }).version
  } catch {
    // Corps facultatif
  }
  recordExtensionSeen(version)
  return NextResponse.json({ ok: true, app: 'myosteoflow' })
}
