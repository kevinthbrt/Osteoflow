import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'

export const dynamic = 'force-dynamic'

const PROXY_BASE = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'

export async function GET() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
    }

    const res = await fetch(`${PROXY_BASE}/api/osteoflow/practice-video`, {
      headers: { 'x-osteoflow-secret': secret, ...getOsteoflowAuthHeaders() },
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
