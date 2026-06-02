import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Secret non configuré' }, { status: 500 })
    }

    const res = await fetch('https://osteoupgrade.vercel.app/api/osteoflow/ortho-tests', {
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
