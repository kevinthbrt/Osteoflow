/**
 * Sign in (select practitioner) API route.
 * In desktop mode, "sign in" means selecting a practitioner profile.
 */

import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    const db = getDatabase()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const practitioner = db
      .prepare('SELECT * FROM practitioners WHERE email = ?')
      .get(email) as { user_id: string; email: string; first_name: string; last_name: string } | undefined

    if (!practitioner) {
      return NextResponse.json({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })
    }

    // Store current user
    db.prepare(
      "INSERT OR REPLACE INTO app_config (key, value) VALUES ('current_user_id', ?)"
    ).run(practitioner.user_id)

    return NextResponse.json({
      data: {
        user: {
          id: practitioner.user_id,
          email: practitioner.email,
          user_metadata: {
            first_name: practitioner.first_name,
            last_name: practitioner.last_name,
          },
        },
      },
      error: null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed'
    return NextResponse.json({
      data: { user: null },
      error: { message },
    }, { status: 500 })
  }
}
