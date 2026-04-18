import { NextResponse } from 'next/server'
import { markSessionVerified } from '@/lib/license-session'

export const dynamic = 'force-dynamic'

/**
 * POST /api/license/mark-verified
 * Sets the in-memory session flag so the root page skips the
 * license check for the rest of this app session.
 * Called after successful PIN entry or Osteoupgrade login.
 */
export async function POST() {
  markSessionVerified()
  return NextResponse.json({ ok: true })
}
