/**
 * Get the currently authenticated user.
 * Used by client components to check auth state.
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/database/auth'

export async function GET() {
  try {
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
    return NextResponse.json({
      data: { user: null },
      error: { message },
    })
  }
}
