import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/broadcasts'

// Returns all active osteoflow/both broadcasts.
// Seen state is tracked locally in SQLite — not from OsteoUpgrade's admin_broadcast_views.
export async function GET() {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    let proxyRes: Response
    try {
      proxyRes = await fetch(PROXY_URL, {
        headers: { 'x-osteoflow-secret': secret },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      return NextResponse.json({ broadcasts: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (!proxyRes.ok) {
      console.error('[broadcasts] proxy non-ok:', proxyRes.status)
      return NextResponse.json({ broadcasts: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const data = await proxyRes.json()

    // Read locally-seen IDs from SQLite and compute unseen list here on the server
    try {
      const db = getDatabase()
      const row = db
        .prepare("SELECT value FROM app_config WHERE key = 'broadcast_seen_ids'")
        .get() as { value: string } | undefined
      const seenIds: string[] = row?.value ? JSON.parse(row.value) : []
      const seenSet = new Set(seenIds)
      const broadcasts = data.broadcasts ?? []
      const unseen = broadcasts.filter((b: { id: string }) => !seenSet.has(b.id))
      return NextResponse.json({ broadcasts, unseen }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (e) {
      console.error('[broadcasts] SQLite error:', e)
      return NextResponse.json({ broadcasts: data.broadcasts ?? [], unseen: data.broadcasts ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
  } catch {
    return NextResponse.json({ broadcasts: [], unseen: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
