import { NextRequest, NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'
import { getOsteoUpgradeEmail } from '@/lib/osteoupgrade/email'

export const dynamic = 'force-dynamic'

const OSTEOUPGRADE_BASE = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'

export async function GET() {
  try {
    const email = getOsteoUpgradeEmail()
    if (!email) return NextResponse.json({ decks: [] })

    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const url = `${OSTEOUPGRADE_BASE}/api/osteoflow/flashcards/decks?email=${encodeURIComponent(email)}`

    let res: Response
    try {
      res = await fetch(url, {
        headers: { authorization: `Bearer ${secret}`, ...getOsteoflowAuthHeaders() },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      return NextResponse.json({ decks: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (!res.ok) return NextResponse.json({ decks: [] }, { headers: { 'Cache-Control': 'no-store' } })

    const data = await res.json()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ decks: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
