import { NextResponse } from 'next/server'
import { fixedAssetSchema } from '@/lib/validations/expense'

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
    cabinetIds: scopeIds.length ? scopeIds : [practitioner.id as string],
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await resolveScope()
    if ('error' in scope) return scope.error

    const { id } = await params
    const parsed = fixedAssetSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Immobilisation invalide' },
        { status: 400 },
      )
    }

    const asset = parsed.data
    const vatAmount = asset.amount_ht * asset.vat_rate
    const placeholders = scope.cabinetIds.map(() => '?').join(', ')

    const result = scope.rawDb
      .prepare(
        `UPDATE fixed_assets SET
           label = ?, category = ?, service_date = ?, amount_ht = ?, vat_rate = ?,
           vat_amount = ?, duration_years = ?, notes = ?, updated_at = datetime('now')
         WHERE id = ? AND cabinet_id IN (${placeholders})`,
      )
      .run(
        asset.label,
        asset.category,
        asset.service_date,
        asset.amount_ht,
        asset.vat_rate,
        vatAmount,
        asset.duration_years,
        asset.notes ?? null,
        id,
        ...scope.cabinetIds,
      )

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Immobilisation introuvable' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[fixed-assets PUT]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await resolveScope()
    if ('error' in scope) return scope.error

    const { id } = await params
    const placeholders = scope.cabinetIds.map(() => '?').join(', ')

    const result = scope.rawDb
      .prepare(`DELETE FROM fixed_assets WHERE id = ? AND cabinet_id IN (${placeholders})`)
      .run(id, ...scope.cabinetIds)

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Immobilisation introuvable' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[fixed-assets DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
