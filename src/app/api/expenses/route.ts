import { NextResponse } from 'next/server'
import { expenseSchema } from '@/lib/validations/expense'

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

export async function GET(request: Request) {
  try {
    const scope = await resolveScope()
    if ('error' in scope) return scope.error

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const placeholders = scope.cabinetIds.map(() => '?').join(', ')
    const filters: string[] = [`cabinet_id IN (${placeholders})`]
    const params: unknown[] = [...scope.cabinetIds]

    if (startDate) {
      filters.push('expense_date >= ?')
      params.push(startDate)
    }
    if (endDate) {
      filters.push('expense_date <= ?')
      params.push(endDate)
    }

    const expenses = scope.rawDb
      .prepare(
        `SELECT * FROM expenses WHERE ${filters.join(' AND ')} ORDER BY expense_date DESC, created_at DESC`,
      )
      .all(...params)

    return NextResponse.json({ expenses })
  } catch (error) {
    console.error('[expenses GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveScope()
    if ('error' in scope) return scope.error

    const parsed = expenseSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Charge invalide' },
        { status: 400 },
      )
    }

    const expense = parsed.data
    const vatAmount = expense.amount_ht * expense.vat_rate

    scope.rawDb
      .prepare(
        `INSERT INTO expenses (
          cabinet_id, expense_date, label, category, amount_ht, vat_rate,
          vat_amount, amount_ttc, deductible_share, recurrence, payment_method, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        scope.practitionerId,
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
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[expenses POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
