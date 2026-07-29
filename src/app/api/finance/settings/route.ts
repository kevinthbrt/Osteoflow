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
           target_monthly_draw, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[finance settings PUT]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
