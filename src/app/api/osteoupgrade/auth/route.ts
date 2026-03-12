/**
 * Osteoupgrade authentication API route.
 *
 * POST: Sign in with Osteoupgrade credentials, store tokens in local DB.
 * DELETE: Sign out, clear stored tokens.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

const OSTEOUPGRADE_URL = 'https://chttutptqainrnrbrljf.supabase.co'
const OSTEOUPGRADE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodHR1dHB0cWFpbnJucmJybGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NjAzNjksImV4cCI6MjA3ODQzNjM2OX0.QzZ_AHBchcjEnQ5LHPEVgeGrc_AiFDOeNKA8h-AT2u0'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    // Sign in to Osteoupgrade's Supabase
    const authResponse = await fetch(
      `${OSTEOUPGRADE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: OSTEOUPGRADE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      }
    )

    if (!authResponse.ok) {
      const errorData = await authResponse.json().catch(() => ({}))
      const message =
        errorData?.error_description ||
        errorData?.message ||
        'Identifiants incorrects'
      return NextResponse.json({ error: message }, { status: 401 })
    }

    const authData = await authResponse.json()
    const { access_token, refresh_token, expires_at } = authData

    // Fetch the user profile to check subscription
    const profileResponse = await fetch(
      `${OSTEOUPGRADE_URL}/rest/v1/profiles?select=role,subscription_status,subscription_end_date&limit=1`,
      {
        headers: {
          apikey: OSTEOUPGRADE_ANON_KEY,
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    let role = 'free'
    let subscriptionStatus = null
    if (profileResponse.ok) {
      const profiles = await profileResponse.json()
      if (profiles?.[0]) {
        role = profiles[0].role
        subscriptionStatus = profiles[0].subscription_status
      }
    }

    // Store tokens in local DB
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié dans Osteoflow' }, { status: 401 })
    }

    const expiresAt = expires_at
      ? new Date(expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    const { error: updateError } = await db
      .from('practitioners')
      .update({
        osteoupgrade_email: email,
        osteoupgrade_token: access_token,
        osteoupgrade_refresh_token: refresh_token,
        osteoupgrade_token_expires_at: expiresAt,
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error storing Osteoupgrade token:', updateError)
      return NextResponse.json(
        { error: 'Erreur lors de la sauvegarde du token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      email,
      role,
      subscriptionStatus,
      isPremium: role !== 'free',
    })
  } catch (error) {
    console.error('Osteoupgrade auth error:', error)
    return NextResponse.json({ error: 'Erreur de connexion' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { error } = await db
      .from('practitioners')
      .update({
        osteoupgrade_email: null,
        osteoupgrade_token: null,
        osteoupgrade_refresh_token: null,
        osteoupgrade_token_expires_at: null,
      })
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Erreur lors de la déconnexion' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Osteoupgrade signout error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
