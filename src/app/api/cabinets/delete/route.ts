import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MESSAGES: Record<string, string> = {
  not_found: 'Cabinet introuvable.',
  active: 'Impossible de supprimer le cabinet actif. Basculez d\'abord sur un autre cabinet.',
  last: 'Impossible de supprimer votre dernier cabinet.',
  has_data: 'Ce cabinet contient des dossiers patients. Pour des raisons de sécurité, videz-le d\'abord.',
}

/** Supprime un cabinet du propriétaire courant. */
export async function POST(request: Request) {
  try {
    const { getCurrentUser, deleteCabinet, listCabinets } = await import('@/lib/database/auth')
    if (!getCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { user_id } = await request.json() as { user_id?: string }
    if (!user_id) return NextResponse.json({ error: 'Cabinet requis' }, { status: 400 })

    const result = deleteCabinet(user_id)
    if (!result.ok) {
      return NextResponse.json({ error: MESSAGES[result.reason] || 'Suppression impossible.' }, { status: 400 })
    }
    return NextResponse.json({ success: true, cabinets: listCabinets() })
  } catch (error) {
    console.error('[cabinets delete]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
