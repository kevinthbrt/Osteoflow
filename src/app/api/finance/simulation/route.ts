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

    const settingsRow = rawDb
      .prepare('SELECT * FROM finance_settings WHERE practitioner_id = ?')
      .get(practitioner.id) as Record<string, unknown> | undefined

    const settings = toFinanceSettings(settingsRow, practitioner.vat_regime)

    const { isFlatAllowance, reducesSocialBase } = await import('@/lib/finance/categories')

    const expenses: ExpenseTotals = {
      deductibleHt: 0,
      deductibleVat: 0,
      paidTtc: 0,
      flatAllowances: 0,
      byCategory: {},
    }

    // Les cotisations sociales saisies en charge sont routées vers la
    // régularisation : elles réduisent le résultat fiscal, jamais l'assiette
    // sociale. Les traiter comme une charge ordinaire minorerait l'Urssaf.
    let socialContributionsRecorded = 0

    if (settings.inputMode === 'simple') {
      expenses.deductibleHt = settings.simple.annualExpenses
      expenses.deductibleVat = settings.simple.annualExpensesVat
      expenses.paidTtc =
        settings.simple.annualExpenses + settings.simple.annualExpensesVat
      expenses.flatAllowances = settings.simple.flatAllowances
    } else {
      for (const row of expenseRows) {
        const share = Math.min(1, Math.max(0, (row.deductible_share ?? 100) / 100))

        expenses.byCategory[row.category] =
          (expenses.byCategory[row.category] ?? 0) + row.amount_ttc

        if (!reducesSocialBase(row.category)) {
          // Le décaissement est porté par la régularisation, que le simulateur
          // sort déjà de la trésorerie : ne pas l'ajouter aussi à paidTtc.
          socialContributionsRecorded += row.amount_ttc
          continue
        }

        if (isFlatAllowance(row.category)) {
          // Forfait : déduit du bénéfice, mais aucun décaissement professionnel.
          expenses.flatAllowances += row.amount_ttc * share
          continue
        }

        expenses.deductibleHt += row.amount_ht * share
        expenses.deductibleVat += row.vat_amount * share
        // Le décaissement est intégral, même quand une partie n'est pas déductible.
        expenses.paidTtc += row.amount_ttc
      }
    }

    if (socialContributionsRecorded > 0) {
      settings.priorYearSocialSettlement += socialContributionsRecorded
    }

    // La simulation se fait toujours sur une année ENTIÈRE, puis se décline en
    // mensuel. Simuler la seule période écoulée mélangeait des recettes de
    // quelques mois avec des charges et des barèmes annuels : l'impôt en
    // ressortait dérisoire (le barème progressif appliqué à un revenu partiel)
    // et la provision mensuelle était fausse. C'est aussi ainsi que procède un
    // prévisionnel comptable.
    const monthsElapsed = year === now.getFullYear() ? now.getMonth() + 1 : 12
    const annualisationFactor = 12 / monthsElapsed

    const annualisedRevenue = revenue * annualisationFactor

    // Mode simplifié : les montants saisis sont déjà annuels. Mode détaillé :
    // les charges constatées sur la période sont projetées au même rythme que
    // les recettes.
    const expenseFactor = settings.inputMode === 'simple' ? 1 : annualisationFactor
    const annualisedExpenses: ExpenseTotals = {
      deductibleHt: expenses.deductibleHt * expenseFactor,
      deductibleVat: expenses.deductibleVat * expenseFactor,
      paidTtc: expenses.paidTtc * expenseFactor,
      flatAllowances: expenses.flatAllowances * expenseFactor,
      byCategory: Object.fromEntries(
        Object.entries(expenses.byCategory).map(([key, value]) => [
          key,
          value * expenseFactor,
        ]),
      ),
    }

    const simulation = simulate({
      year,
      settings,
      revenue: annualisedRevenue,
      expenses: annualisedExpenses,
      monthsElapsed: 12,
    })

    // Vue mensuelle : encaissements du mois demandé (mois courant par défaut).
    const requestedMonth = Number(searchParams.get('month'))
    const selectedMonth =
      requestedMonth >= 1 && requestedMonth <= 12
        ? requestedMonth
        : year === now.getFullYear()
          ? now.getMonth() + 1
          : 12

    const monthStr = String(selectedMonth).padStart(2, '0')
    const lastDayOfMonth = new Date(year, selectedMonth, 0).getDate()
    const monthRevenueRow = rawDb
      .prepare(
        `SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.cabinet_id IN (${ph})
           AND p.payment_date >= ? AND p.payment_date <= ?`,
      )
      .get(
        ...cabinetIds,
        `${year}-${monthStr}-01`,
        `${year}-${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`,
      ) as { total: number }
    const monthManualRow = rawDb
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM manual_revenue_entries
         WHERE practitioner_id IN (${ph}) AND year = ? AND month = ?`,
      )
      .get(...cabinetIds, year, selectedMonth) as { total: number }

    const config = getTaxConfig(year)

    return NextResponse.json({
      simulation,
      settings,
      context: {
        year,
        monthsElapsed,
        revenueToDate: revenue,
        annualisedRevenue,
        month: selectedMonth,
        monthRevenue: monthRevenueRow.total + monthManualRow.total,
        manualRevenue: manualRow.total,
        expenseCount: expenseRows.length,
        inputMode: settings.inputMode,
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
