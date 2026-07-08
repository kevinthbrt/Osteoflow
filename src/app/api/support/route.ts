import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'

const OSTEOUPGRADE_URL = 'https://osteoupgrade.vercel.app'
const OSTEOFLOW_SECRET = process.env.OSTEOFLOW_PROXY_SECRET

function getLicenseEmail(): string | null {
  try {
    const db = getDatabase()
    const row = db.prepare("SELECT value FROM app_config WHERE key = 'license_email'").get() as { value?: string } | undefined
    return row?.value?.trim() || null
  } catch { return null }
}

export async function GET() {
  if (!OSTEOFLOW_SECRET) {
    return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
  }

  const licenseEmail = getLicenseEmail()
  if (!licenseEmail) return NextResponse.json({ tickets: [] })

  try {
    const res = await fetch(
      `${OSTEOUPGRADE_URL}/api/osteoflow/support?license_email=${encodeURIComponent(licenseEmail)}`,
      { headers: { 'x-osteoflow-secret': OSTEOFLOW_SECRET, ...getOsteoflowAuthHeaders() }, next: { revalidate: 0 } }
    )
    if (!res.ok) return NextResponse.json({ tickets: [] })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ tickets: [] })
  }
}

export async function POST(req: NextRequest) {
  if (!OSTEOFLOW_SECRET) {
    return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
  }

  const licenseEmail = getLicenseEmail()

  try {
    const body = await req.json()
    const payload = {
      ...body,
      license_email: licenseEmail,
      user_email: body.user_email || licenseEmail || 'inconnu@osteoflow.local',
    }

    const res = await fetch(`${OSTEOUPGRADE_URL}/api/osteoflow/support`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-osteoflow-secret': OSTEOFLOW_SECRET,
        ...getOsteoflowAuthHeaders(),
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json(data, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
