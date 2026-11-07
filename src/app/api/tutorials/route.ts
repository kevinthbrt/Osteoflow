import { NextResponse } from 'next/server'
import { getTutorialCatalog } from '@/lib/tutorials/catalog'

export const dynamic = 'force-dynamic'

/** Le catalogue des tutoriels (site OsteoUpgrade, cache local ou copie livrée). */
export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get('refresh') === '1'
  return NextResponse.json(await getTutorialCatalog({ refresh }))
}
