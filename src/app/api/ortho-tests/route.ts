import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/ortho-tests'
const FALLBACK_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function GET() {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET || FALLBACK_SECRET

    const res = await fetch(PROXY_URL, {
      headers: { 'x-osteoflow-secret': secret },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[ortho-tests proxy]', res.status, err.substring(0, 200))
      return NextResponse.json({ error: `Erreur proxy (${res.status})` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[ortho-tests proxy] unhandled:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
