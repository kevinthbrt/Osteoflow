import { NextRequest, NextResponse } from 'next/server'
import { pdf } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createInvoicePDF, InvoicePDFData } from '@/lib/pdf/invoice-template'

const paymentMethodLabels: Record<string, string> = {
  card: 'Carte bancaire',
  cash: 'Especes',
  check: 'Cheque',
  transfer: 'Virement',
  other: 'Autre',
}

function formatDateForPDF(dateInput: string | null | undefined): string {
  if (!dateInput) return ''
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return ''
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear()
    return day + '/' + month + '/' + year
  } catch {
    return ''
  }
}

function safeStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

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
          patient:patients (*)
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

    // Log data for debugging
    console.log('PDF Data:', JSON.stringify(pdfData, null, 2))

    // Generate PDF using pdf().toBuffer()
    const pdfDoc = createInvoicePDF(pdfData)
    console.log('PDF Doc created')
    const pdfInstance = pdf(pdfDoc)
    console.log('PDF Instance created')
    const pdfStream = await pdfInstance.toBuffer()
    console.log('PDF Stream created')

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of pdfStream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    const pdfBuffer = Buffer.concat(chunks)

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
