import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const OSTEOUPGRADE_URL =
  process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`${OSTEOUPGRADE_URL}/api/myosteoflow/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('[license/auth] fetch error:', err)
    return NextResponse.json(
      { error: 'Impossible de contacter le serveur Osteoupgrade. Vérifiez votre connexion internet.' },
      { status: 503 }
    )
  }

  // osteoupgrade may return non-JSON on errors (HTML error page)
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    console.error('[license/auth] non-JSON response:', res.status, text.slice(0, 200))
    return NextResponse.json(
      { error: `Réponse inattendue du serveur (${res.status})` },
      { status: 502 }
    )
  }

  return NextResponse.json(data, { status: res.status })
}
