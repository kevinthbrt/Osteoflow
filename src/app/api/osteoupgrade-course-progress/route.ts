import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/course-progress'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET
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
          headers: { 'x-osteoflow-secret': secret },
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
