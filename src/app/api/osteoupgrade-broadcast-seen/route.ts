import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

const PROXY_BASE = 'https://osteoupgrade.vercel.app/api/osteoflow/broadcasts'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ ok: false }, { status: 400 })

    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET

    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'license_email'")
      .get() as { value: string } | undefined
    const email = row?.value

    if (!email) return NextResponse.json({ ok: false }, { status: 400 })

    try {
      await fetch(`${PROXY_BASE}/${id}/seen`, {
        method: 'POST',
        headers: {
          'x-osteoflow-secret': secret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(10000),
      })
    } catch { /* silent — don't block UI */ }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
