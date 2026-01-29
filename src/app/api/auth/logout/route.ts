/**
 * Sign out (clear current practitioner) API route.
 */

import { NextResponse } from 'next/server'
import { clearCurrentUser } from '@/lib/database/auth'

export async function POST() {
  try {
    clearCurrentUser()
    return NextResponse.json({ error: null })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Logout failed'
    return NextResponse.json({ error: { message } }, { status: 500 })
  }
}
