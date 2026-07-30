import { NextResponse } from 'next/server'
import { financeSettingsSchema } from '@/lib/validations/expense'

async function resolvePractitioner() {
  const { createClient } = await import('@/lib/db/server')
  const { getDatabase } = await import('@/lib/database/connection')

  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: practitioner } = await db
    .from('practitioners')
    .select('id, vat_regime, country, profession')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) {
    return { error: NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 }) }
  }

  return { rawDb: getDatabase(), practitioner }
}

export async function GET() {
  try {
    const scope = await resolvePractitioner()
    if ('error' in scope) return scope.error

    const row = scope.rawDb
      .prepare('SELECT * FROM finance_settings WHERE practitioner_id = ?')
      .get(scope.practitioner.id)

    return NextResponse.json({
      settings: row ?? null,
      // Le régime de TVA reste piloté depuis les paramètres de facturation.
      vatRegime: scope.practitioner.vat_regime ?? 'exempt_261',
      country: scope.practitioner.country ?? 'FR',
      profession: scope.practitioner.profession ?? 'osteopathe',
    })
  } catch (error) {
    console.error('[finance settings GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const scope = await resolvePractitioner()
    if ('error' in scope) return scope.error

    const parsed = financeSettingsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Paramètres invalides' },
        { status: 400 },
      )
    }

    const settings = parsed.data

    scope.rawDb
      .prepare(
        `INSERT INTO finance_settings (
           practitioner_id, regime, retirement_fund, versement_liberatoire, acre,
           marital_status, dependents, other_household_income, safety_margin_rate,
           target_monthly_draw, vehicle_mode, vehicle_kind, vehicle_horsepower,
           vehicle_annual_km, vehicle_electric, optional_retirement,
           optional_prevoyance, input_mode, simple_annual_expenses,
           simple_annual_expenses_vat, simple_flat_allowances,
           simple_depreciation, prior_year_social_settlement, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(practitioner_id) DO UPDATE SET
           regime = excluded.regime,
           retirement_fund = excluded.retirement_fund,
           versement_liberatoire = excluded.versement_liberatoire,
           acre = excluded.acre,
           marital_status = excluded.marital_status,
           dependents = excluded.dependents,
           other_household_income = excluded.other_household_income,
           safety_margin_rate = excluded.safety_margin_rate,
           target_monthly_draw = excluded.target_monthly_draw,
           vehicle_mode = excluded.vehicle_mode,
           vehicle_kind = excluded.vehicle_kind,
           vehicle_horsepower = excluded.vehicle_horsepower,
           vehicle_annual_km = excluded.vehicle_annual_km,
           vehicle_electric = excluded.vehicle_electric,
           optional_retirement = excluded.optional_retirement,
           optional_prevoyance = excluded.optional_prevoyance,
           input_mode = excluded.input_mode,
           simple_annual_expenses = excluded.simple_annual_expenses,
           simple_annual_expenses_vat = excluded.simple_annual_expenses_vat,
           simple_flat_allowances = excluded.simple_flat_allowances,
           simple_depreciation = excluded.simple_depreciation,
           prior_year_social_settlement = excluded.prior_year_social_settlement,
           updated_at = datetime('now')`,
      )
      .run(
        scope.practitioner.id,
        settings.regime,
        settings.retirement_fund,
        settings.versement_liberatoire ? 1 : 0,
        settings.acre ? 1 : 0,
        settings.marital_status,
        settings.dependents,
        settings.other_household_income,
        settings.safety_margin_rate,
        settings.target_monthly_draw ?? null,
        settings.vehicle_mode,
        settings.vehicle_kind,
        settings.vehicle_horsepower,
        settings.vehicle_annual_km,
        settings.vehicle_electric ? 1 : 0,
        settings.optional_retirement,
        settings.optional_prevoyance,
        settings.input_mode,
        settings.simple_annual_expenses,
        settings.simple_annual_expenses_vat,
        settings.simple_flat_allowances,
        settings.simple_depreciation,
        settings.prior_year_social_settlement,
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[finance settings PUT]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
