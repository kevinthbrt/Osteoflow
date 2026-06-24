import { NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/formations'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json([], { status: 400, headers: noStore })
    }

    let proxyRes: Response
    try {
      proxyRes = await fetch(
        `${PROXY_URL}?email=${encodeURIComponent(email)}`,
        {
          headers: { 'x-osteoflow-secret': secret, ...getOsteoflowAuthHeaders() },
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        },
      )
    } catch {
      return NextResponse.json([], { status: 503, headers: noStore })
    }

    if (!proxyRes.ok) {
      return NextResponse.json([], { status: proxyRes.status, headers: noStore })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data, { headers: noStore })
  } catch {
    return NextResponse.json([], { status: 500, headers: noStore })
  }
}
