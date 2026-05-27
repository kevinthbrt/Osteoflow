import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

const PROXY_BASE = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'
const PROXY_SECRET_DEFAULT = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function GET() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = process.env.OSTEOFLOW_PROXY_SECRET || PROXY_SECRET_DEFAULT

    const res = await fetch(`${PROXY_BASE}/api/osteoflow/practice-video`, {
      headers: { 'x-osteoflow-secret': secret },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json({ video: null })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ video: null })
  }
}
