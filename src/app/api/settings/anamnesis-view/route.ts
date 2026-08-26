import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

/**
 * Mode d'affichage de l'anamnèse.
 *
 * Le réglage ne change que le rendu : les données enregistrées sont les mêmes
 * dans les deux cas (colonne `anamnesis_sections`). Une consultation dictée en
 * mode cartes se relit donc en mode résumé, et réciproquement — y compris pour
 * les consultations déjà en base avant l'ajout du réglage.
 */
const KEY = 'anamnesis_view'
const MODES = ['cards', 'summary'] as const
export type AnamnesisView = (typeof MODES)[number]
const DEFAULT: AnamnesisView = 'cards'

function read(): AnamnesisView {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(KEY) as
    | { value: string }
    | undefined
  const value = row?.value as AnamnesisView | undefined
  return value && MODES.includes(value) ? value : DEFAULT
}

export async function GET() {
  try {
    return NextResponse.json({ anamnesis_view: read() })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { anamnesis_view } = await request.json()
    if (!MODES.includes(anamnesis_view)) {
      return NextResponse.json({ error: 'Mode inconnu' }, { status: 400 })
    }
    getDatabase()
      .prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)')
      .run(KEY, anamnesis_view)
    return NextResponse.json({ success: true, anamnesis_view })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
