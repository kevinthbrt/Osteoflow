import { NextResponse } from 'next/server'
import { fixedAssetSchema } from '@/lib/validations/expense'

/** Cabinet actif, en respectant le périmètre de partage « compta ». */
async function resolveScope() {
  const { createClient } = await import('@/lib/db/server')
  const { getDatabase } = await import('@/lib/database/connection')
  const { getScopeCabinetIds } = await import('@/lib/database/cabinet-scope')

  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: practitioner } = await db
    .from('practitioners')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) {
    return { error: NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 }) }
  }

  const rawDb = getDatabase()
  const scopeIds = getScopeCabinetIds('compta', rawDb)

  return {
    rawDb,
    practitionerId: practitioner.id as string,
    cabinetIds: scopeIds.length ? scopeIds : [practitioner.id as string],
  }
}

export async function GET() {
  try {
    const scope = await resolveScope()
    if ('error' in scope) return scope.error

    const placeholders = scope.cabinetIds.map(() => '?').join(', ')
    const assets = scope.rawDb
      .prepare(
        `SELECT * FROM fixed_assets WHERE cabinet_id IN (${placeholders})
         ORDER BY service_date DESC, created_at DESC`,
      )
      .all(...scope.cabinetIds)

    return NextResponse.json({ assets })
  } catch (error) {
    console.error('[fixed-assets GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveScope()
    if ('error' in scope) return scope.error

    const parsed = fixedAssetSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Immobilisation invalide' },
        { status: 400 },
      )
    }

    const asset = parsed.data
    const vatAmount = asset.amount_ht * asset.vat_rate

    scope.rawDb
      .prepare(
        `INSERT INTO fixed_assets (
           cabinet_id, label, category, service_date, amount_ht, vat_rate,
           vat_amount, duration_years, notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        scope.practitionerId,
        asset.label,
        asset.category,
        asset.service_date,
        asset.amount_ht,
        asset.vat_rate,
        vatAmount,
        asset.duration_years,
        asset.notes ?? null,
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[fixed-assets POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
