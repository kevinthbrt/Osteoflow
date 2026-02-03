/**
 * Sign out (clear current practitioner) API route.
 */

import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const { clearCurrentUser } = await import('@/lib/database/auth')
    clearCurrentUser()
    return NextResponse.json({ error: null })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Logout failed'
    console.error('[API/auth/logout] Error:', message)
    return NextResponse.json({ error: { message } }, { status: 500 })
  }
}
