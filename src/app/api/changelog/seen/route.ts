import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

/**
 * Tracks the last changelog version the user has acknowledged.
 *
 * GET  -> { lastSeenVersion: string | null }
 * POST { version } -> persists the latest acknowledged version in app_config.
 *
 * Used by the NotificationBell "Nouveautés" section to surface unread
 * release notes (entries newer than lastSeenVersion).
 */

export async function GET() {
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'changelog_last_seen'")
      .get() as { value: string } | undefined
    return NextResponse.json({ lastSeenVersion: row?.value ?? null })
  } catch {
    return NextResponse.json({ lastSeenVersion: null })
  }
}

export async function POST(request: Request) {
  try {
    const { version } = await request.json()
    if (typeof version !== 'string' || version.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const db = getDatabase()
    db.prepare(
      "INSERT INTO app_config (key, value) VALUES ('changelog_last_seen', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(version)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
