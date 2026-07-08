import { NextRequest, NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'
import { getOsteoUpgradeEmail } from '@/lib/osteoupgrade/email'

export const dynamic = 'force-dynamic'

const OSTEOUPGRADE_BASE = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'

export async function GET(request: NextRequest) {
  try {
    const deckId = request.nextUrl.searchParams.get('deck_id')
    if (!deckId) return NextResponse.json({ cards: [] }, { status: 400 })

    const email = getOsteoUpgradeEmail()
    if (!email) return NextResponse.json({ cards: [] })

    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const url = `${OSTEOUPGRADE_BASE}/api/osteoflow/flashcards/cards?email=${encodeURIComponent(email)}&deck_id=${deckId}`

    let res: Response
    try {
      res = await fetch(url, {
        headers: { authorization: `Bearer ${secret}`, ...getOsteoflowAuthHeaders() },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      return NextResponse.json({ cards: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (!res.ok) return NextResponse.json({ cards: [] }, { headers: { 'Cache-Control': 'no-store' } })

    const data = await res.json()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ cards: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
