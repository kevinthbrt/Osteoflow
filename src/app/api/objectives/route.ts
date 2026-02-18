import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDatabase } = await import('@/lib/database/connection')

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id, annual_revenue_objective, vacation_weeks_per_year, working_days_per_week, average_consultation_price')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })
    }

    const settings = {
      annual_revenue_objective: practitioner.annual_revenue_objective ?? null,
      vacation_weeks_per_year: practitioner.vacation_weeks_per_year ?? 5,
      working_days_per_week: practitioner.working_days_per_week ?? 4,
      average_consultation_price: practitioner.average_consultation_price ?? null,
    }

    // Computed objectives
    const workingWeeks = 52 - (settings.vacation_weeks_per_year ?? 5)
    const workingDays = workingWeeks * (settings.working_days_per_week ?? 4)
    const annualObjective = settings.annual_revenue_objective ?? 0
    const computed = {
      working_weeks: workingWeeks,
      working_days: workingDays,
      daily_objective: workingDays > 0 ? annualObjective / workingDays : 0,
      weekly_objective: workingWeeks > 0 ? annualObjective / workingWeeks : 0,
      monthly_objective: annualObjective / 12,
    }

    // Revenue queries using raw SQLite for aggregations
    const rawDb = getDatabase()
    const now = new Date()
    const year = now.getFullYear()
    const todayStr = now.toISOString().split('T')[0]

    // Compute current week Monday
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...6=Sat
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - daysFromMonday)
    const mondayStr = monday.toISOString().split('T')[0]

    // First day of current month
    const firstOfMonth = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    // First day of current year
    const firstOfYear = `${year}-01-01`

    const practitionerId = practitioner.id

    // Revenue today
    const todayRow = rawDb.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN consultations c ON i.consultation_id = c.id
      JOIN patients pat ON c.patient_id = pat.id
      WHERE pat.practitioner_id = ?
        AND p.payment_date = ?
    `).get(practitionerId, todayStr) as { total: number }

    // Revenue this week
    const weekRow = rawDb.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN consultations c ON i.consultation_id = c.id
      JOIN patients pat ON c.patient_id = pat.id
      WHERE pat.practitioner_id = ?
        AND p.payment_date >= ?
        AND p.payment_date <= ?
    `).get(practitionerId, mondayStr, todayStr) as { total: number }

    // Revenue this month (from payments)
    const monthRow = rawDb.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN consultations c ON i.consultation_id = c.id
      JOIN patients pat ON c.patient_id = pat.id
      WHERE pat.practitioner_id = ?
        AND p.payment_date >= ?
        AND p.payment_date <= ?
    `).get(practitionerId, firstOfMonth, todayStr) as { total: number }

    // Revenue this year (from payments)
    const yearRow = rawDb.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN consultations c ON i.consultation_id = c.id
      JOIN patients pat ON c.patient_id = pat.id
      WHERE pat.practitioner_id = ?
        AND p.payment_date >= ?
        AND p.payment_date <= ?
    `).get(practitionerId, firstOfYear, todayStr) as { total: number }

    // Monthly breakdown for current year (from payments)
    const monthlyRows = rawDb.prepare(`
      SELECT
        CAST(strftime('%m', p.payment_date) AS INTEGER) as month,
        COALESCE(SUM(p.amount), 0) as actual
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN consultations c ON i.consultation_id = c.id
      JOIN patients pat ON c.patient_id = pat.id
      WHERE pat.practitioner_id = ?
        AND p.payment_date >= ?
        AND p.payment_date <= ?
      GROUP BY month
    `).all(practitionerId, firstOfYear, todayStr) as Array<{ month: number; actual: number }>

    // Manual revenue entries for current year
    const manualRows = rawDb.prepare(`
      SELECT month, amount
      FROM manual_revenue_entries
      WHERE practitioner_id = ? AND year = ?
    `).all(practitionerId, year) as Array<{ month: number; amount: number }>

    // Build monthly breakdown (12 months)
    const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const actualRow = monthlyRows.find((r) => r.month === m)
      const manualRow = manualRows.find((r) => r.month === m)
      const actual = actualRow?.actual ?? 0
      const manual = manualRow?.amount ?? 0
      return { month: m, actual, manual, total: actual + manual }
    })

    // Total manual for the year
    const totalManual = manualRows.reduce((sum, r) => sum + r.amount, 0)

    const revenue = {
      today: todayRow.total,
      this_week: weekRow.total,
      this_month: monthRow.total + (manualRows.find((r) => r.month === now.getMonth() + 1)?.amount ?? 0),
      this_year: yearRow.total + totalManual,
      monthly_breakdown: monthlyBreakdown,
    }

    return NextResponse.json({ settings, computed, revenue })
  } catch (error) {
    console.error('[objectives GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { annual_revenue_objective, vacation_weeks_per_year, working_days_per_week, average_consultation_price } = body

    const { error } = await db
      .from('practitioners')
      .update({
        annual_revenue_objective: annual_revenue_objective ?? null,
        vacation_weeks_per_year: vacation_weeks_per_year ?? 5,
        working_days_per_week: working_days_per_week ?? 4,
        average_consultation_price: average_consultation_price ?? null,
      })
      .eq('id', practitioner.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[objectives PUT]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
