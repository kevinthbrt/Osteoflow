import { NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/ortho-tests'

export async function GET() {
  try {
    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
    }

    // Le jeton de session identifie l'utilisateur : la bibliothèque de tests
    // relève d'OsteoUpgrade, le serveur doit pouvoir vérifier que l'offre
    // l'inclut. Sans ces en-têtes il servait le contenu à tout le monde.
    const res = await fetch(PROXY_URL, {
      headers: { 'x-osteoflow-secret': secret, ...getOsteoflowAuthHeaders() },
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
