import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

const OSTEOUPGRADE_URL =
  process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'

/**
 * POST /api/license/online-verify
 * Calls the Osteoupgrade API to verify the stored token.
 * Updates last_verified_at on success.
 * Returns { valid: true|false|null } — null means offline (grace period applies).
 */
export async function POST() {
  const db = await createClient()

  const getConfig = async (key: string): Promise<string | null> => {
    const { data } = await db
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single()
    return (data as any)?.value || null
  }

  const token = await getConfig('license_token')
  const deviceId = await getConfig('license_device_id')

  if (!token || !deviceId) {
    return NextResponse.json({ valid: false, error: 'Aucune session active' })
  }

  try {
    const res = await fetch(
      `${OSTEOUPGRADE_URL}/api/osteoflow/verify?token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(deviceId)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()

    if (data.valid) {
      await db.from('app_config').upsert({
        key: 'license_last_verified_at',
        value: new Date().toISOString(),
      })
      if (data.role) {
        await db.from('app_config').upsert({ key: 'license_role', value: data.role })
      }
    }

    return NextResponse.json(data)
  } catch {
    // Network unavailable — caller applies grace period logic
    return NextResponse.json({ valid: null, error: 'offline' })
  }
}
