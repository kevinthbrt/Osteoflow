import { NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/literature-review'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET

    let proxyRes: Response
    try {
      proxyRes = await fetch(`${PROXY_URL}/${encodeURIComponent(id)}`, {
        headers: { 'x-osteoflow-secret': secret, ...getOsteoflowAuthHeaders() },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 502, headers: noStore })
    }

    if (!proxyRes.ok) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: proxyRes.status, headers: noStore })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500, headers: noStore })
  }
}
