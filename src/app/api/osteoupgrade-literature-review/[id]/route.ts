import { NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/literature-review'
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500, headers: noStore })
    }

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
