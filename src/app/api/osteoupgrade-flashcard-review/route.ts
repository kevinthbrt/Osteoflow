import { NextRequest, NextResponse } from 'next/server'
import { getOsteoUpgradeEmail } from '@/lib/osteoupgrade/email'

export const dynamic = 'force-dynamic'

const OSTEOUPGRADE_BASE = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function POST(request: NextRequest) {
  try {
    const email = getOsteoUpgradeEmail()
    if (!email) return NextResponse.json({ error: 'No email' }, { status: 401 })

    const body = await request.json()
    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET
    const url = `${OSTEOUPGRADE_BASE}/api/osteoflow/flashcards/review`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, email }),
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 })
    }

    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: res.status })

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
