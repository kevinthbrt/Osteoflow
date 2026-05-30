import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/broadcasts'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function GET() {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET

    // Get license email from SQLite
    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'license_email'")
      .get() as { value: string } | undefined
    const email = row?.value

    if (!email) {
      return NextResponse.json({ broadcasts: [], unseen: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    let proxyRes: Response
    try {
      proxyRes = await fetch(`${PROXY_URL}?email=${encodeURIComponent(email)}`, {
        headers: { 'x-osteoflow-secret': secret },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      return NextResponse.json({ broadcasts: [], unseen: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (!proxyRes.ok) {
      return NextResponse.json({ broadcasts: [], unseen: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ broadcasts: [], unseen: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
