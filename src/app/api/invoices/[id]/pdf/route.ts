import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoicePDF } from '@/lib/pdf/invoice-template'
import { getStampDataUrl } from '@/lib/pdf/stamp'

export const runtime = 'nodejs'

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

    let stampImage: string | null = null
    const debugMode = request.nextUrl.searchParams.get('debug') === '1'

    if (!debugMode) {
      stampImage = await getStampDataUrl(practitioner.stamp_url)
    }

    let pdfBuffer: Uint8Array

    try {
      pdfBuffer = await renderToBuffer(
        InvoicePDF({
          invoice,
          consultation: invoice.consultation,
          patient: invoice.consultation.patient,
          practitioner,
          payments: invoice.payments || [],
          stampImage,
        })
      )
    } catch (error) {
      console.error('Error generating PDF with stamp, retrying without:', {
        invoiceId: invoice.id,
        issuedAt: invoice.issued_at,
        createdAt: invoice.created_at,
        consultationDate: invoice.consultation?.date_time,
        paymentDates: (invoice.payments || []).map((payment) => payment.payment_date),
        primaryColor: practitioner.primary_color,
        stampUrl: practitioner.stamp_url,
        error,
      })
      pdfBuffer = await renderToBuffer(
        InvoicePDF({
          invoice,
          consultation: invoice.consultation,
          patient: invoice.consultation.patient,
          practitioner,
          payments: invoice.payments || [],
          stampImage: null,
        })
      )
    }

    // Return PDF - convert Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF' },
      { status: 500 }
    )
  }
}
