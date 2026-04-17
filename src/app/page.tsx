import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { getDatabase } from '@/lib/database/connection'
import { isSessionVerified } from '@/lib/license-session'

export const dynamic = 'force-dynamic'

function getConfigSync(key: string): string | null {
  try {
    const db = getDatabase()
    const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(key) as any
    return row?.value ?? null
  } catch {
    return null
  }
}

export default async function Home() {
  // If session explicitly locked → PIN unlock screen
  if (getConfigSync('session_locked') === '1') {
    redirect('/pin?mode=unlock')
  }

  if (!isSessionVerified()) {
    const token = getConfigSync('license_token')
    const expiresAt = getConfigSync('license_expires_at')
    const pinHash = getConfigSync('license_pin_hash')
    const pinLastUsed = getConfigSync('license_pin_last_used_at')

    if (!token || !expiresAt || new Date(expiresAt).getTime() < Date.now()) {
      redirect('/osteoupgrade')
    }

    const pinAge = pinLastUsed ? Date.now() - new Date(pinLastUsed).getTime() : Infinity
    const pinActive = !!pinHash && pinAge < 30 * 24 * 60 * 60 * 1000

    if (pinActive) {
      redirect('/pin')
    }

    redirect('/osteoupgrade')
  }

  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) redirect('/login')

  redirect('/dashboard')
}
