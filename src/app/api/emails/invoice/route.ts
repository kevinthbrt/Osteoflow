import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createInvoicePDF, InvoicePDFData } from '@/lib/pdf/invoice-template'
import {
  defaultEmailTemplates,
  replaceTemplateVariables,
  textToHtml,
} from '@/lib/email/templates'
import { formatDate, formatCurrency } from '@/lib/utils'

// Lazy initialization to avoid build-time errors
const getResend = () => new Resend(process.env.RESEND_API_KEY)

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

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json()

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'ID de facture requis' },
        { status: 400 }
      )
    }

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
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvee' }, { status: 404 })
    }

    // Extract nested data safely
    const consultation = invoice.consultation as Record<string, unknown> | null
    const patient = consultation?.patient as Record<string, unknown> | null
    const payments = invoice.payments as Array<Record<string, unknown>> | null
    const payment = payments && payments.length > 0 ? payments[0] : null

    const patientEmail = safeStr(patient?.email)
    const patientFirstName = safeStr(patient?.first_name)
    const patientLastName = safeStr(patient?.last_name)

    // Check patient has email
    if (!patientEmail) {
      return NextResponse.json(
        { error: 'Le patient n\'a pas d\'adresse email' },
        { status: 400 }
      )
    }

    // Verify the invoice belongs to this practitioner
    const patientPractitionerId = patient?.practitioner_id
    if (patientPractitionerId !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    // Get email template (custom or default)
    const { data: customTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .eq('type', 'invoice')
      .single()

    const template = customTemplate || defaultEmailTemplates.invoice

    // Prepare variables
    const variables = {
      patient_name: patientFirstName + ' ' + patientLastName,
      patient_first_name: patientFirstName,
      invoice_number: safeStr(invoice.invoice_number),
      invoice_amount: formatCurrency(invoice.amount),
      invoice_date: formatDate(invoice.issued_at || invoice.created_at),
      practitioner_name: safeStr(practitioner.first_name) + ' ' + safeStr(practitioner.last_name),
      practice_name:
        safeStr(practitioner.practice_name) ||
        (safeStr(practitioner.first_name) + ' ' + safeStr(practitioner.last_name)),
    }

    // Replace variables in template
    const subject = replaceTemplateVariables(template.subject, variables)
    const bodyText = replaceTemplateVariables(template.body, variables)
    const bodyHtml = textToHtml(bodyText)

    // Build PDF data with only primitive values
    const pdfData: InvoicePDFData = {
      // Invoice
      invoiceNumber: safeStr(invoice.invoice_number),
      invoiceAmount: typeof invoice.amount === 'number' ? invoice.amount : 0,
      invoiceDate: formatDateForPDF(safeStr(invoice.issued_at)),
      // Patient
      patientFirstName: patientFirstName,
      patientLastName: patientLastName,
      patientEmail: patientEmail,
      // Practitioner
      practitionerFirstName: safeStr(practitioner.first_name),
      practitionerLastName: safeStr(practitioner.last_name),
      practitionerSpecialty: safeStr(practitioner.specialty),
      practitionerAddress: safeStr(practitioner.address),
      practitionerCity: safeStr(practitioner.city),
      practitionerPostalCode: safeStr(practitioner.postal_code),
      practitionerSiret: safeStr(practitioner.siret),
      practitionerRpps: safeStr(practitioner.rpps),
      practitionerStampUrl: safeStr(practitioner.stamp_url),
      // Consultation
      consultationReason: safeStr(consultation?.reason),
      // Payment
      paymentMethod: payment ? (paymentMethodLabels[safeStr(payment.method)] || 'Comptant') : 'Comptant',
      paymentDate: payment ? formatDateForPDF(safeStr(payment.payment_date)) : formatDateForPDF(safeStr(invoice.issued_at)),
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(createInvoicePDF(pdfData))

    // Send email
    const { error: emailError } = await getResend().emails.send({
      from: `${safeStr(practitioner.practice_name) || safeStr(practitioner.first_name)} <onboarding@resend.dev>`,
      to: patientEmail,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              p { margin: 0 0 10px; }
            </style>
          </head>
          <body>${bodyHtml}</body>
        </html>
      `,
      attachments: [
        {
          filename: `${pdfData.invoiceNumber || 'facture'}.pdf`,
          content: Buffer.from(pdfBuffer),
        },
      ],
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return NextResponse.json(
        { error: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending invoice email:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi de l\'email' },
      { status: 500 }
    )
  }
}
