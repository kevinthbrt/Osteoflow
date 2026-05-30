import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { generateExercisePdf } = await import('@/lib/pdf/exercise-pdfkit')
    const { createClient } = await import('@/lib/db/server')
    const { getProfessionLabel } = await import('@/lib/practitioner/profession')

    const { id } = await params
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: practitioner, error: practitionerError } = await db
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (practitionerError || !practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    const { data: prescription, error: prescriptionError } = await db
      .from('exercise_prescriptions')
      .select('*')
      .eq('id', id)
      .single()

    if (prescriptionError || !prescription) {
      return NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 })
    }

    const { data: patient, error: patientError } = await db
      .from('patients')
      .select('*')
      .eq('id', prescription.patient_id)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient non trouvé' }, { status: 404 })
    }

    if (patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { data: items } = await db
      .from('exercise_prescription_items')
      .select('*')
      .eq('prescription_id', id)
      .order('position', { ascending: true })

    const cityLine = [practitioner.postal_code, practitioner.city].filter(Boolean).join(' ')

    const prescriptionDate = new Date(prescription.created_at).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    const pdfBuffer = await generateExercisePdf({
      practitionerName: `${practitioner.first_name} ${practitioner.last_name}`,
      practitionerSpecialty: getProfessionLabel(practitioner.profession, practitioner.specialty),
      practitionerAddress: practitioner.address || undefined,
      practitionerCityLine: cityLine || undefined,
      patientName: `${patient.first_name} ${patient.last_name}`,
      prescriptionTitle: prescription.title,
      prescriptionDate,
      notes: prescription.notes || undefined,
      items: items || [],
    })

    const dateStr = new Date(prescription.created_at).toISOString().slice(0, 10)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="programme-exercices-${dateStr}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating exercise PDF:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF', details: errorMessage },
      { status: 500 }
    )
  }
}
