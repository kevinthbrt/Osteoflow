import { NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/course-progress'
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500, headers: noStore })
    }
    const { searchParams } = new URL(req.url)
    const formationId = searchParams.get('formation_id')
    const email = searchParams.get('email')

    if (!formationId || !email) {
      return NextResponse.json({ total: 0, completed: 0, chapters: [] }, { headers: noStore })
    }

    let proxyRes: Response
    try {
      proxyRes = await fetch(
        `${PROXY_URL}?formation_id=${encodeURIComponent(formationId)}&email=${encodeURIComponent(email)}`,
        {
          headers: { 'x-osteoflow-secret': secret, ...getOsteoflowAuthHeaders() },
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        },
      )
    } catch {
      return NextResponse.json({ total: 0, completed: 0, chapters: [] }, { headers: noStore })
    }

    if (!proxyRes.ok) {
      return NextResponse.json({ total: 0, completed: 0, chapters: [] }, { headers: noStore })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data, { headers: noStore })
  } catch {
    return NextResponse.json({ total: 0, completed: 0, chapters: [] }, { headers: noStore })
  }
}
