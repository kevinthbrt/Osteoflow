import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/import-csv'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET
    const formData = await req.formData()

    let proxyRes: Response
    try {
      proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'x-osteoflow-secret': secret },
        body: formData,
        signal: AbortSignal.timeout(30000),
      })
    } catch {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data, { status: proxyRes.status })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
