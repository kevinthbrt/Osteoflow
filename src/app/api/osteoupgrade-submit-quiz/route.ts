import { NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/submit-quiz'

export async function POST(req: Request) {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
    }
    const body = await req.json()

    let proxyRes: Response
    try {
      proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-osteoflow-secret': secret,
          ...getOsteoflowAuthHeaders(),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      return NextResponse.json({ error: 'Timeout' }, { status: 503 })
    }

    const data = await proxyRes.json().catch(() => ({}))
    return NextResponse.json(data, { status: proxyRes.status })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
