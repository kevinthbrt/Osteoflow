import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Liste les cabinets du propriétaire courant. */
export async function GET() {
  try {
    const { listCabinets, getCurrentUser } = await import('@/lib/database/auth')
    if (!getCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ cabinets: listCabinets() })
  } catch (error) {
    console.error('[cabinets GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** Crée un nouveau cabinet (rattaché au propriétaire courant). */
export async function POST(request: Request) {
  try {
    const { createCabinet, getCurrentUser, listCabinets } = await import('@/lib/database/auth')
    if (!getCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { name } = await request.json() as { name?: string }
    if (!name?.trim()) return NextResponse.json({ error: 'Nom du cabinet requis' }, { status: 400 })
    const userId = createCabinet(name.trim())
    return NextResponse.json({ success: true, user_id: userId, cabinets: listCabinets() })
  } catch (error) {
    console.error('[cabinets POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
