import { NextResponse } from 'next/server'

// Cancels a relaunch scheduled from the end-of-consultation wizard
// ("relancer dans 3/6/12 mois") before it becomes due.
export async function POST(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    const { patientId } = await request.json()
    if (!patientId) {
      return NextResponse.json({ error: 'ID du patient requis' }, { status: 400 })
    }

    const { data: patient } = await db
      .from('patients')
      .select('id, practitioner_id')
      .eq('id', patientId)
      .single()

    if (!patient || patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Patient non trouvé' }, { status: 404 })
    }

    await db
      .from('patients')
      .update({ next_relaunch_due_at: null, next_relaunch_months: null })
      .eq('id', patientId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling scheduled relaunch:', error)
    return NextResponse.json({ error: "Erreur lors de l'annulation" }, { status: 500 })
  }
}
