import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Vercel Hobby caps function duration at 60s (raise once on Pro). Keep this
// >= the outer fetch timeout below so the function isn't killed mid-wait.
export const maxDuration = 60

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/generate-hypotheses'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { anamnesis: string; reason?: string; patientContext?: unknown }
    const { anamnesis, reason, patientContext } = body

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
        body: JSON.stringify({ anamnesis, reason, patientContext }),
        // Under our own 60s cap, with headroom for the proxy (which times out
        // its Anthropic call at 45s) to return its real error before we abort.
        signal: AbortSignal.timeout(55000),
      })
    } catch {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 500 })
    }

    if (!proxyRes.ok) {
      const err = await proxyRes.text()
      console.error('[hypotheses proxy]', proxyRes.status, err)
      return NextResponse.json({ error: `Erreur service (${proxyRes.status})` }, { status: 502 })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[hypotheses proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la génération des hypothèses.' }, { status: 500 })
  }
}
