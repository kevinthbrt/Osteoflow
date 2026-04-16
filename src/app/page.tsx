import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { isSessionVerified } from '@/lib/license-session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const db = await createClient()

  // ------------------------------------------------------------------
  // Step 1: License check (Osteoupgrade subscription)
  // Skipped if the user already went through PIN/login this session.
  // ------------------------------------------------------------------
  if (!isSessionVerified()) {
    const getConfig = async (key: string): Promise<string | null> => {
      const { data } = await db
        .from('app_config')
        .select('value')
        .eq('key', key)
        .single()
      return (data as any)?.value ?? null
    }

    const token = await getConfig('license_token')
    const expiresAt = await getConfig('license_expires_at')
    const pinHash = await getConfig('license_pin_hash')
    const pinLastUsed = await getConfig('license_pin_last_used_at')

    // No token or token expired → require full Osteoupgrade login
    if (
      !token ||
      !expiresAt ||
      new Date(expiresAt).getTime() < Date.now()
    ) {
      redirect('/auth/osteoupgrade')
    }

    // Check PIN persistence (30 days from last use)
    const pinAge = pinLastUsed
      ? Date.now() - new Date(pinLastUsed).getTime()
      : Infinity
    const pinActive = !!pinHash && pinAge < 30 * 24 * 60 * 60 * 1000

    if (pinActive) {
      redirect('/auth/pin')
    }

    // Token valid but PIN expired or never set → require full login again
    redirect('/auth/osteoupgrade')
  }

  // ------------------------------------------------------------------
  // Step 2: Local practitioner auth (unchanged)
  // ------------------------------------------------------------------
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) redirect('/login')

  redirect('/dashboard')
}
