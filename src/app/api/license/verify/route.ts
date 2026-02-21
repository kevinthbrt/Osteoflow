import { NextRequest, NextResponse } from 'next/server'
import { verifyLicense, storeLicense } from '@/lib/license'

export async function POST(request: NextRequest) {
  try {
    const { licenseKey } = await request.json()

    if (!licenseKey || typeof licenseKey !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Clé de licence manquante' },
        { status: 400 }
      )
    }

    const result = verifyLicense(licenseKey)

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 422 }
      )
    }

    // Persist the license to disk (only available in Electron context)
    if (process.env.ELECTRON_USERDATA) {
      storeLicense(licenseKey)
    }

    return NextResponse.json({
      valid: true,
      customer: result.payload?.customer,
      email: result.payload?.email,
      expiresAt: result.payload?.expiresAt,
    })
  } catch (error) {
    console.error('[License] Verify error:', error)
    return NextResponse.json(
      { valid: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
