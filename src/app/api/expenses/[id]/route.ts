import { NextResponse } from 'next/server'
import { expenseSchema } from '@/lib/validations/expense'

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
    const parsed = expenseSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Charge invalide' },
        { status: 400 },
      )
    }

    const expense = parsed.data
    const vatAmount = expense.amount_ht * expense.vat_rate
    const placeholders = scope.cabinetIds.map(() => '?').join(', ')

    const result = scope.rawDb
      .prepare(
        `UPDATE expenses SET
           expense_date = ?, label = ?, category = ?, amount_ht = ?, vat_rate = ?,
           vat_amount = ?, amount_ttc = ?, deductible_share = ?, recurrence = ?,
           payment_method = ?, notes = ?, updated_at = datetime('now')
         WHERE id = ? AND cabinet_id IN (${placeholders})`,
      )
      .run(
        expense.expense_date,
        expense.label,
        expense.category,
        expense.amount_ht,
        expense.vat_rate,
        vatAmount,
        expense.amount_ht + vatAmount,
        expense.deductible_share,
        expense.recurrence,
        expense.payment_method ?? null,
        expense.notes ?? null,
        id,
        ...scope.cabinetIds,
      )

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[expenses PUT]', error)
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
      .prepare(`DELETE FROM expenses WHERE id = ? AND cabinet_id IN (${placeholders})`)
      .run(id, ...scope.cabinetIds)

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[expenses DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
