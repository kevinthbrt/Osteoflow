import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { id } = await params
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

    // Get consultation and verify it belongs to this practitioner's patient
    const { data: consultation } = await db
      .from('consultations')
      .select('id, patient_id')
      .eq('id', id)
      .single()

    if (!consultation) {
      return NextResponse.json({ error: 'Consultation non trouvée' }, { status: 404 })
    }

    const { data: patient } = await db
      .from('patients')
      .select('id, practitioner_id')
      .eq('id', consultation.patient_id)
      .single()

    if (!patient || patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Cascade delete: payments → invoices → consultation
    const { data: invoices } = await db
      .from('invoices')
      .select('id')
      .eq('consultation_id', id)

    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map((inv: { id: string }) => inv.id)
      for (const invoiceId of invoiceIds) {
        await db.from('payments').delete().eq('invoice_id', invoiceId)
      }
      await db.from('invoices').delete().eq('consultation_id', id)
    }

    await db.from('consultations').delete().eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting consultation:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
