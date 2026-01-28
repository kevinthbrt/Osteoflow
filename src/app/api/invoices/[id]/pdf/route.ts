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
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    // Get practitioner
    const { data: practitioner, error: practitionerError } = await supabase
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (practitionerError || !practitioner) {
      return NextResponse.json({ error: 'Praticien non trouve' }, { status: 404 })
    }

    // Get invoice with all relations
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        consultation:consultations (
          *,
          patient:patients (*),
          session_type:session_types (*)
        ),
        payments (*)
      `)
      .eq('id', id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvee' }, { status: 404 })
    }

    // Extract nested data safely
    const consultation = invoice.consultation as Record<string, unknown> | null
    const patient = consultation?.patient as Record<string, unknown> | null
    const payments = invoice.payments as Array<Record<string, unknown>> | null
    const payment = payments && payments.length > 0 ? payments[0] : null

    // Verify the invoice belongs to this practitioner
    const patientPractitionerId = patient?.practitioner_id
    if (patientPractitionerId !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    // Build PDF data with only primitive values
    const pdfData: InvoicePDFData = {
      invoiceNumber: safeStr(invoice.invoice_number),
      invoiceAmount: typeof invoice.amount === 'number' ? invoice.amount : 0,
      invoiceDate: formatDateForPDF(safeStr(invoice.issued_at)),
      patientFirstName: safeStr(patient?.first_name),
      patientLastName: safeStr(patient?.last_name),
      patientEmail: safeStr(patient?.email),
      practitionerFirstName: safeStr(practitioner.first_name),
      practitionerLastName: safeStr(practitioner.last_name),
      practitionerSpecialty: safeStr(practitioner.specialty),
      practitionerAddress: safeStr(practitioner.address),
      practitionerCity: safeStr(practitioner.city),
      practitionerPostalCode: safeStr(practitioner.postal_code),
      practitionerSiret: safeStr(practitioner.siret),
      practitionerRpps: safeStr(practitioner.rpps),
      practitionerStampUrl: safeStr(practitioner.stamp_url),
      consultationReason: safeStr(consultation?.reason),
      paymentMethod: payment ? (paymentMethodLabels[safeStr(payment.method)] || 'Comptant') : 'Comptant',
      paymentDate: payment ? formatDateForPDF(safeStr(payment.payment_date)) : formatDateForPDF(safeStr(invoice.issued_at)),
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

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfData.invoiceNumber || 'facture'}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Erreur lors de la generation du PDF', details: errorMessage },
      { status: 500 }
    )
  }
}
