import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Vercel Hobby caps function duration at 60s (raise once on Pro). Keep this
// >= the outer fetch timeout below so the function isn't killed mid-wait.
export const maxDuration = 60

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/generate-hypotheses'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { anamnesis: string; reason?: string; patientContext?: unknown }
    const { anamnesis, reason, patientContext } = body

    if (!anamnesis?.trim()) {
      return NextResponse.json({ error: 'Anamnèse vide' }, { status: 400 })
    }

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
      // Remonte le message précis du proxy quand il est disponible (diagnostic).
      let message = `Erreur service (${proxyRes.status})`
      try {
        const parsed = JSON.parse(err)
        if (parsed?.error) message = parsed.error
      } catch { /* corps non-JSON : on garde le message générique */ }
      return NextResponse.json({ error: message }, { status: 502 })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[hypotheses proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la génération des hypothèses.' }, { status: 500 })
  }
}
