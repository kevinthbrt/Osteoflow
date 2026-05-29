import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/widgets'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function GET() {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET

    const noStore = { 'Cache-Control': 'no-store' }

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
