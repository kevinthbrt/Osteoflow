import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import { CGU_VERSION } from '@/lib/legal/documents'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDatabase()
    const versionRow = db
      .prepare("SELECT value FROM app_config WHERE key = 'cgu_accepted_version'")
      .get() as { value: string } | undefined
    const dateRow = db
      .prepare("SELECT value FROM app_config WHERE key = 'cgu_accepted_at'")
      .get() as { value: string } | undefined

    const acceptedVersion = versionRow?.value ?? null
    const accepted = acceptedVersion === CGU_VERSION

    return NextResponse.json({
      accepted,
      acceptedVersion,
      acceptedAt: dateRow?.value ?? null,
      currentVersion: CGU_VERSION,
    })
  } catch {
    return NextResponse.json({ accepted: false, acceptedVersion: null, acceptedAt: null, currentVersion: CGU_VERSION })
  }
}
