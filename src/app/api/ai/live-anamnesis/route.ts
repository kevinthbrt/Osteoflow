import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { remapAddedIds } from '@/lib/anamnesis-live'

export const dynamic = 'force-dynamic'
// Appelée à chaque passage pendant la dictée : la latence prime.
export const maxDuration = 45

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/live-anamnesis'

interface RawOp {
  op?: unknown
  id?: unknown
  axis?: unknown
  text?: unknown
  confidence?: unknown
  verbatim?: unknown
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { passage?: string; lines?: unknown; context?: string }
    const passage = typeof body.passage === 'string' ? body.passage.trim() : ''
    if (!passage) return NextResponse.json({ ops: [] })

    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
    }

    let proxyRes: Response
    try {
      proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-osteoflow-secret': secret },
        body: JSON.stringify({ passage, lines: body.lines ?? [], context: body.context }),
        signal: AbortSignal.timeout(35000),
      })
    } catch {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 502 })
    }

    if (!proxyRes.ok) {
      const err = await proxyRes.text()
      console.error('[live proxy]', proxyRes.status, err)
      return NextResponse.json({ error: `Erreur service (${proxyRes.status})` }, { status: 502 })
    }

    const data = await proxyRes.json()
    const ops = Array.isArray(data.ops) ? remapAddedIds(data.ops as RawOp[], randomUUID) : []
    return NextResponse.json({ ops })
  } catch (err) {
    console.error('[live proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de l\'extraction.' }, { status: 500 })
  }
}
