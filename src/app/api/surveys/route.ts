import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/surveys?practitioner_id=xxx
 * GET /api/surveys?consultation_id=xxx
 * GET /api/surveys?patient_id=xxx
 *
 * Returns survey responses for the authenticated practitioner.
 */
export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Get practitioner
    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const consultationId = searchParams.get('consultation_id')
    const patientId = searchParams.get('patient_id')
    const limitParam = searchParams.get('limit')
    const queryLimit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 100

    let query = db
      .from('survey_responses')
      .select('*, patient:patients (id, first_name, last_name)')
      .eq('practitioner_id', practitioner.id)
      .order('created_at', { ascending: false })

    if (consultationId) {
      query = query.eq('consultation_id', consultationId)
    }

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    const { data: surveys, error } = await query.limit(queryLimit)

    if (error) {
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    // Compute stats for completed surveys
    const completed = (surveys || []).filter((s: { status: string }) => s.status === 'completed')
    const evaScores = completed.filter((s: { eva_score: number | null }) => s.eva_score !== null && s.eva_score !== undefined)
    const stats = {
      total: surveys?.length || 0,
      completed: completed.length,
      pending: (surveys || []).filter((s: { status: string }) => s.status === 'pending').length,
      avg_rating: completed.length > 0
        ? Math.round((completed.reduce((sum: number, s: { overall_rating: number | null }) => sum + (s.overall_rating || 0), 0) / completed.length) * 10) / 10
        : null,
      avg_eva: evaScores.length > 0
        ? Math.round((evaScores.reduce((sum: number, s: { eva_score: number | null }) => sum + (s.eva_score || 0), 0) / evaScores.length) * 10) / 10
        : null,
      pain_reduction: completed.filter((s: { pain_reduction: boolean | number | null }) => s.pain_reduction === true || s.pain_reduction === 1).length,
      better_mobility: completed.filter((s: { better_mobility: boolean | number | null }) => s.better_mobility === true || s.better_mobility === 1).length,
      // Legacy fields
      pain_better: completed.filter((s: { pain_evolution: string | null }) => s.pain_evolution === 'better').length,
      pain_same: completed.filter((s: { pain_evolution: string | null }) => s.pain_evolution === 'same').length,
      pain_worse: completed.filter((s: { pain_evolution: string | null }) => s.pain_evolution === 'worse').length,
      would_recommend: completed.filter((s: { would_recommend: boolean | null }) => s.would_recommend === true).length,
    }

    return NextResponse.json({ surveys, stats })
  } catch (error) {
    console.error('[Surveys] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des sondages' },
      { status: 500 }
    )
  }
}
