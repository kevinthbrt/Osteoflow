import { NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/formations'
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500, headers: noStore })
    }
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
