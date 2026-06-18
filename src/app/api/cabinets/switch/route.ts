import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Bascule le cabinet actif (uniquement vers un cabinet du même propriétaire). */
export async function POST(request: Request) {
  try {
    const { getCurrentUser, setCurrentUser, listCabinets } = await import('@/lib/database/auth')
    if (!getCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { user_id } = await request.json() as { user_id?: string }
    if (!user_id) return NextResponse.json({ error: 'Cabinet requis' }, { status: 400 })

    // Sécurité : on ne peut basculer que vers un cabinet du propriétaire courant.
    const allowed = listCabinets().some((c) => c.user_id === user_id)
    if (!allowed) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 404 })

    setCurrentUser(user_id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[cabinets switch]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
