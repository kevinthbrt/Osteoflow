import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/generate-letter'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
    }

    let proxyRes: Response
    try {
      proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-osteoflow-secret': secret,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(35000),
      })
    } catch {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 500 })
    }

    if (!proxyRes.ok) {
      const err = await proxyRes.text()
      console.error('[generate-letter proxy]', proxyRes.status, err)
      return NextResponse.json({ error: `Erreur service (${proxyRes.status})` }, { status: 502 })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[generate-letter proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la génération.' }, { status: 500 })
  }
}
