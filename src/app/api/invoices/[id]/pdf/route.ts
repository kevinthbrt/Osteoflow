import { NextRequest, NextResponse } from 'next/server'
import { generateInvoicePdf } from '@/lib/pdf/invoice-pdfkit'
import { createClient } from '@/lib/supabase/server'
import { buildInvoicePDFData } from '@/lib/pdf/invoice-template'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Get practitioner
    const { data: practitioner, error: practitionerError } = await supabase
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (practitionerError || !practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    // Get invoice with all relations
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        consultation:consultations (
          *,
          patient:patients (*)
        ),
        payments (*)
      `)
      .eq('id', id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    // Verify the invoice belongs to this practitioner
    const consultation = invoice.consultation as typeof invoice.consultation & {
      patient: { practitioner_id: string }
    }

    if (consultation.patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Generate PDF
    const pdfData = buildInvoicePDFData({
      invoice,
      consultation: invoice.consultation,
      patient: invoice.consultation.patient,
      practitioner,
      payments: invoice.payments || [],
    })
    console.debug('Invoice PDF data (api/pdf):', {
      invoiceId: invoice.id,
      invoiceNumber: pdfData.invoiceNumber,
      amount: pdfData.amount,
      practitionerName: pdfData.practitionerName,
      patientName: pdfData.patientName,
      hasStamp: Boolean(pdfData.stampUrl),
    })
    const pdfBuffer = await generateInvoicePdf(pdfData)

    // Return PDF - convert Buffer to Uint8Array for NextResponse
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF', details: errorMessage },
      { status: 500 }
    )
  }
}
