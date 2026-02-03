/**
 * Sign in (select practitioner) API route.
 * In desktop mode, "sign in" means selecting a practitioner and verifying password.
 */

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { getDatabase } = await import('@/lib/database/connection')
    const { verifyPassword } = await import('@/lib/database/auth')

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
    console.error('[API/auth/login] Error:', message)
    return NextResponse.json({
      data: { user: null },
      error: { message },
    }, { status: 500 })
  }
}

/**
 * Set or change password for a practitioner.
 * If the practitioner already has a password, oldPassword must be provided.
 */
export async function PUT(request: Request) {
  try {
    const { getDatabase } = await import('@/lib/database/connection')
    const { verifyPassword, hashPassword } = await import('@/lib/database/auth')

    const { email, password, oldPassword } = await request.json()

    if (!email || !password || password.length < 4) {
      return NextResponse.json(
        { error: 'Mot de passe requis (4 caractères minimum)' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    // Check if practitioner has an existing password
    const practitioner = db
      .prepare('SELECT password_hash FROM practitioners WHERE email = ?')
      .get(email) as { password_hash: string | null } | undefined

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    // If already has a password, verify old password
    if (practitioner.password_hash) {
      if (!oldPassword || !verifyPassword(oldPassword, practitioner.password_hash)) {
        return NextResponse.json(
          { error: 'Ancien mot de passe incorrect' },
          { status: 403 }
        )
      }
    }

    const hash = hashPassword(password)
    db.prepare('UPDATE practitioners SET password_hash = ? WHERE email = ?').run(hash, email)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to set password'
    console.error('[API/auth/login PUT] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
