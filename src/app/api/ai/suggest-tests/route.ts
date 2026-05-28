import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/suggest-tests'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { anamnesis: string; reason?: string }
    const { anamnesis, reason } = body

    if (!anamnesis?.trim()) {
      return NextResponse.json({ error: 'Anamnèse vide' }, { status: 400 })
    }

    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET

    let proxyRes: Response
    try {
      proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-osteoflow-secret': secret,
        },
        body: JSON.stringify({ anamnesis, reason }),
        signal: AbortSignal.timeout(30000),
      })
    } catch {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 500 })
    }

    if (!proxyRes.ok) {
      const err = await proxyRes.text()
      console.error('[suggest-tests proxy]', proxyRes.status, err)
      return NextResponse.json({ error: `Erreur service (${proxyRes.status})` }, { status: 502 })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[suggest-tests proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la suggestion de tests.' }, { status: 500 })
  }
}
