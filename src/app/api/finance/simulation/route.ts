import { NextResponse } from 'next/server'
import { simulate } from '@/lib/finance/simulator'
import { toFinanceSettings } from '@/lib/finance/persistence'
import { getTaxConfig } from '@/lib/finance/tax-config'
import type { ExpenseTotals } from '@/lib/finance/types'

/**
 * Simulation de l'année en cours (ou d'une année passée).
 *
 * Les recettes viennent des paiements encaissés, pas des factures émises : la
 * question « combien puis-je me prendre » se pose sur de la trésorerie réelle.
 */
export async function GET(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDatabase } = await import('@/lib/database/connection')
    const { getScopeCabinetIds } = await import('@/lib/database/cabinet-scope')

    const db = await createClient()
    const {
      data: { user },
    } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id, vat_regime, country')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })
    }

    // Le moteur applique les barèmes français : hors France, on ne simule pas.
    if ((practitioner.country ?? 'FR') !== 'FR') {
      return NextResponse.json(
        { error: 'La simulation n’est disponible que pour la France' },
        { status: 400 },
      )
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const year = Number(searchParams.get('year')) || now.getFullYear()

    const rawDb = getDatabase()
    const scopeIds = getScopeCabinetIds('compta', rawDb)
    const cabinetIds = scopeIds.length ? scopeIds : [practitioner.id]
    const ph = cabinetIds.map(() => '?').join(', ')

    const firstOfYear = `${year}-01-01`
    const lastOfYear = `${year}-12-31`

    // Recettes encaissées sur l'année.
    const revenueRow = rawDb
      .prepare(
        `SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.cabinet_id IN (${ph})
           AND p.payment_date >= ? AND p.payment_date <= ?`,
      )
      .get(...cabinetIds, firstOfYear, lastOfYear) as { total: number }

    // Corrections manuelles de CA (mois antérieurs à l'usage du logiciel).
    const manualRow = rawDb
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM manual_revenue_entries
         WHERE practitioner_id IN (${ph}) AND year = ?`,
      )
      .get(...cabinetIds, year) as { total: number }

    const revenue = revenueRow.total + manualRow.total

    // Charges de l'année, avec la quote-part professionnelle appliquée.
    const expenseRows = rawDb
      .prepare(
        `SELECT category, amount_ht, vat_amount, amount_ttc, deductible_share
         FROM expenses
         WHERE cabinet_id IN (${ph})
           AND expense_date >= ? AND expense_date <= ?`,
      )
      .all(...cabinetIds, firstOfYear, lastOfYear) as Array<{
      category: string
      amount_ht: number
      vat_amount: number
      amount_ttc: number
      deductible_share: number
    }>

    const expenses: ExpenseTotals = {
      deductibleHt: 0,
      deductibleVat: 0,
      paidTtc: 0,
      byCategory: {},
    }

    for (const row of expenseRows) {
      const share = Math.min(1, Math.max(0, (row.deductible_share ?? 100) / 100))
      expenses.deductibleHt += row.amount_ht * share
      expenses.deductibleVat += row.vat_amount * share
      // Le décaissement est intégral, même quand une partie n'est pas déductible.
      expenses.paidTtc += row.amount_ttc
      expenses.byCategory[row.category] =
        (expenses.byCategory[row.category] ?? 0) + row.amount_ttc
    }

    const settingsRow = rawDb
      .prepare('SELECT * FROM finance_settings WHERE practitioner_id = ?')
      .get(practitioner.id) as Record<string, unknown> | undefined

    const settings = toFinanceSettings(settingsRow, practitioner.vat_regime)

    // Sur l'année en cours, on ne compte que les mois écoulés pour ne pas
    // diluer les provisions mensuelles sur des mois qui n'ont pas eu lieu.
    const monthsElapsed =
      year === now.getFullYear() ? now.getMonth() + 1 : 12

    const simulation = simulate({
      year,
      settings,
      revenue,
      expenses,
      monthsElapsed,
    })

    const config = getTaxConfig(year)

    return NextResponse.json({
      simulation,
      settings,
      context: {
        year,
        monthsElapsed,
        revenue,
        manualRevenue: manualRow.total,
        expenseCount: expenseRows.length,
        pass: config.pass,
        scalesVerifiedOn: config.verifiedOn,
        sources: config.sources,
      },
    })
  } catch (error) {
    console.error('[finance simulation GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
