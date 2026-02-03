/**
 * Get the currently authenticated user.
 * Used by client components to check auth state.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { getCurrentUser } = await import('@/lib/database/auth')
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })
    }

    return NextResponse.json({
      data: { user },
      error: null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Auth error'
    console.error('[API/auth/user] Error:', message)
    return NextResponse.json({
      data: { user: null },
      error: { message },
    })
  }
}
