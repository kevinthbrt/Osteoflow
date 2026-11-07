import { NextResponse } from 'next/server'
import { getDoctolibAvailability } from '@/lib/doctolib/availability'

export const dynamic = 'force-dynamic'

/** L'extension est-elle publiée, et à quelle adresse l'installer ? */
export async function GET() {
  return NextResponse.json(await getDoctolibAvailability())
}
