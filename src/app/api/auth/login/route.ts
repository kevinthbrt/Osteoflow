/**
 * Sign in (select practitioner) API route.
 * In desktop mode, "sign in" means selecting a practitioner and verifying password.
 */

import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import { verifyPassword, hashPassword } from '@/lib/database/auth'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    const db = getDatabase()

    const practitioner = db
      .prepare('SELECT * FROM practitioners WHERE email = ?')
      .get(email) as {
        user_id: string
        email: string
        first_name: string
        last_name: string
        password_hash: string | null
      } | undefined

    if (!practitioner) {
      return NextResponse.json({
        data: { user: null },
        error: { message: 'Identifiants incorrects' },
      })
    }

    // Verify password if practitioner has one set
    if (practitioner.password_hash) {
      if (!password || !verifyPassword(password, practitioner.password_hash)) {
        return NextResponse.json({
          data: { user: null },
          error: { message: 'Mot de passe incorrect' },
        })
      }
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

/**
 * Set password for a practitioner.
 */
export async function PUT(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password || password.length < 4) {
      return NextResponse.json(
        { error: 'Mot de passe requis (4 caractères minimum)' },
        { status: 400 }
      )
    }

    const db = getDatabase()
    const hash = hashPassword(password)
    db.prepare('UPDATE practitioners SET password_hash = ? WHERE email = ?').run(hash, email)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to set password'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
