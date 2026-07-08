import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/ai/generate-exercise-prescription'

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
        // Must exceed the upstream's own ceiling (maxDuration 60s) so the proxy
        // waits for osteoupgrade's response/error instead of aborting first and
        // masking it as a generic failure.
        signal: AbortSignal.timeout(65000),
      })
    } catch {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 500 })
    }

    if (!proxyRes.ok) {
      const err = await proxyRes.text()
      console.error('[generate-exercise-prescription proxy]', proxyRes.status, err)
      return NextResponse.json({ error: `Erreur service (${proxyRes.status})` }, { status: 502 })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[generate-exercise-prescription proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la génération.' }, { status: 500 })
  }
}
