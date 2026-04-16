import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { isSessionVerified } from '@/lib/license-session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const db = await createClient()

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

    if (
      !token ||
      !expiresAt ||
      new Date(expiresAt).getTime() < Date.now()
    ) {
      redirect('/osteoupgrade')
    }

    const pinAge = pinLastUsed
      ? Date.now() - new Date(pinLastUsed).getTime()
      : Infinity
    const pinActive = !!pinHash && pinAge < 30 * 24 * 60 * 60 * 1000

    if (pinActive) {
      redirect('/pin')
    }

    redirect('/osteoupgrade')
  }

  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) redirect('/login')

  redirect('/dashboard')
}
