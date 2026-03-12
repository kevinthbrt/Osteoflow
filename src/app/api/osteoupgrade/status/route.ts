/**
 * Returns the current Osteoupgrade connection status for the logged-in practitioner.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

const OSTEOUPGRADE_URL = 'https://chttutptqainrnrbrljf.supabase.co'
const OSTEOUPGRADE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodHR1dHB0cWFpbnJucmJybGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NjAzNjksImV4cCI6MjA3ODQzNjM2OX0.QzZ_AHBchcjEnQ5LHPEVgeGrc_AiFDOeNKA8h-AT2u0'

async function refreshTokenIfNeeded(
  db: ReturnType<Awaited<typeof import('@/lib/db/server').createClient>>,
  practitioner: {
    id: string
    osteoupgrade_token: string | null
    osteoupgrade_refresh_token: string | null
    osteoupgrade_token_expires_at: string | null
  }
): Promise<string | null> {
  if (!practitioner.osteoupgrade_token) return null

  // Check if token is still valid (with 5 min buffer)
  if (practitioner.osteoupgrade_token_expires_at) {
    const expiresAt = new Date(practitioner.osteoupgrade_token_expires_at).getTime()
    if (expiresAt > Date.now() + 5 * 60 * 1000) {
      return practitioner.osteoupgrade_token
    }
  }

  // Try to refresh the token
  if (!practitioner.osteoupgrade_refresh_token) return null

  try {
    const refreshResponse = await fetch(
      `${OSTEOUPGRADE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          apikey: OSTEOUPGRADE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: practitioner.osteoupgrade_refresh_token }),
      }
    )

    if (!refreshResponse.ok) return null

    const refreshData = await refreshResponse.json()
    const { access_token, refresh_token, expires_at } = refreshData

    const expiresAt = expires_at
      ? new Date(expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    await db
      .from('practitioners')
      .update({
        osteoupgrade_token: access_token,
        osteoupgrade_refresh_token: refresh_token,
        osteoupgrade_token_expires_at: expiresAt,
      })
      .eq('id', practitioner.id)

    return access_token
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ connected: false })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id, osteoupgrade_email, osteoupgrade_token, osteoupgrade_refresh_token, osteoupgrade_token_expires_at')
      .eq('user_id', user.id)
      .single()

    if (!practitioner?.osteoupgrade_token) {
      return NextResponse.json({ connected: false })
    }

    // Refresh token if needed
    const token = await refreshTokenIfNeeded(db, practitioner as Parameters<typeof refreshTokenIfNeeded>[1])
    if (!token) {
      return NextResponse.json({ connected: false })
    }

    // Fetch the profile to get subscription status
    const profileResponse = await fetch(
      `${OSTEOUPGRADE_URL}/rest/v1/profiles?select=role,subscription_status,subscription_end_date,full_name&limit=1`,
      {
        headers: {
          apikey: OSTEOUPGRADE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!profileResponse.ok) {
      return NextResponse.json({ connected: false })
    }

    const profiles = await profileResponse.json()
    const profile = profiles?.[0]

    if (!profile) {
      return NextResponse.json({ connected: false })
    }

    const isPremium =
      profile.role !== 'free' &&
      (profile.subscription_status === 'active' || profile.role === 'admin')

    return NextResponse.json({
      connected: true,
      email: practitioner.osteoupgrade_email,
      role: profile.role,
      subscriptionStatus: profile.subscription_status,
      isPremium,
      fullName: profile.full_name,
      token,
    })
  } catch (error) {
    console.error('Osteoupgrade status error:', error)
    return NextResponse.json({ connected: false })
  }
}
