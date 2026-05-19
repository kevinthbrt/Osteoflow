import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const OSTEOUPGRADE_URL =
  process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const res = await fetch(`${OSTEOUPGRADE_URL}/api/myosteoflow/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })

    const data = await res.json()

    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { error: 'Impossible de contacter le serveur. Vérifiez votre connexion internet.' },
      { status: 503 }
    )
  }
}
