import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID = ['patients', 'consultations', 'compta', 'objectifs', 'stats'] as const
type Cat = typeof VALID[number]

// Dépendances : consultations ⇒ patients, compta ⇒ consultations,
// objectifs ⇒ compta, stats ⇒ consultations. On normalise la sélection pour
// garantir la cohérence quel que soit l'ordre des cases cochées.
function normalize(cats: Cat[]): Cat[] {
  const set = new Set(cats.filter((c) => VALID.includes(c)))
  if (set.has('stats')) set.add('consultations')
  if (set.has('objectifs')) set.add('compta')
  if (set.has('compta')) set.add('consultations')
  if (set.has('consultations')) set.add('patients')
  return VALID.filter((c) => set.has(c))
}

export async function GET() {
  try {
    const { getCurrentUser } = await import('@/lib/database/auth')
    const { getDatabase } = await import('@/lib/database/connection')
    if (!getCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const db = getDatabase()
    const row = db.prepare("SELECT value FROM app_config WHERE key = 'cabinet_shared_categories'").get() as { value?: string } | undefined
    let shared: string[] = []
    try { shared = row?.value ? JSON.parse(row.value) : [] } catch { shared = [] }
    return NextResponse.json({ shared })
  } catch (error) {
    console.error('[cabinets sharing GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { getCurrentUser } = await import('@/lib/database/auth')
    const { getDatabase } = await import('@/lib/database/connection')
    if (!getCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { shared } = await request.json() as { shared?: Cat[] }
    const normalized = normalize(Array.isArray(shared) ? shared : [])
    const db = getDatabase()
    db.prepare(
      "INSERT INTO app_config (key, value) VALUES ('cabinet_shared_categories', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(JSON.stringify(normalized))
    return NextResponse.json({ success: true, shared: normalized })
  } catch (error) {
    console.error('[cabinets sharing POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
