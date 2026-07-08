import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/widgets'

export async function GET() {
  try {
    const noStore = { 'Cache-Control': 'no-store' }

    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500, headers: noStore })
    }

    let proxyRes: Response
    try {
      proxyRes = await fetch(PROXY_URL, {
        headers: { 'x-osteoflow-secret': secret },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      return NextResponse.json({ review: null, featured_formation: null }, { headers: noStore })
    }

    if (!proxyRes.ok) {
      return NextResponse.json({ review: null, featured_formation: null }, { headers: noStore })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data, { headers: noStore })
  } catch {
    return NextResponse.json({ review: null, featured_formation: null }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
