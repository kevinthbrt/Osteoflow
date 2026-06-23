import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Relais serveur→serveur (évite CORS) vers le hub cloud osteoupgrade, qui héberge
// le store éphémère de synchronisation ordinateur<->téléphone. Accès par jeton.
const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/hypotheses-sync'

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  try {
    const r = await fetch(`${PROXY_URL}?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const body = await req.text()
  try {
    const r = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10000),
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 502 })
  }
}
