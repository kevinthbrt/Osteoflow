import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Permet à l'extension de trouver le port d'Osteoflow sur le poste. Aucune donnée. */
export async function GET() {
  return NextResponse.json({ app: 'myosteoflow' })
}
