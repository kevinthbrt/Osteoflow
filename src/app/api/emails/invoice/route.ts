import { createElement } from 'react'
import type { ReactElement } from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoicePDF } from '@/lib/pdf/invoice-template'
import {
  defaultEmailTemplates,
  replaceTemplateVariables,
  textToHtml,
} from '@/lib/email/templates'
import { formatDate, formatCurrency } from '@/lib/utils'

// Lazy initialization to avoid build-time errors
const getResend = () => new Resend(process.env.RESEND_API_KEY)

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
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    const patient = invoice.consultation.patient

    // Check patient has email
    if (!patient.email) {
      return NextResponse.json(
        { error: 'Le patient n\'a pas d\'adresse email' },
        { status: 400 }
      )
    }

    // Verify the invoice belongs to this practitioner
    if (patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
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
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_first_name: patient.first_name,
      invoice_number: invoice.invoice_number,
      invoice_amount: formatCurrency(invoice.amount),
      invoice_date: formatDate(invoice.issued_at || invoice.created_at),
      practitioner_name: `${practitioner.first_name} ${practitioner.last_name}`,
      practice_name:
        practitioner.practice_name ||
        `${practitioner.first_name} ${practitioner.last_name}`,
    }

    // Replace variables in template
    const subject = replaceTemplateVariables(template.subject, variables)
    const bodyText = replaceTemplateVariables(template.body, variables)
    const bodyHtml = textToHtml(bodyText)

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      createElement(InvoicePDF, {
        invoice,
        consultation: invoice.consultation,
        patient,
        practitioner,
        payments: invoice.payments || [],
      }) as ReactElement<DocumentProps>
    )

    // Send email
    const { error: emailError } = await getResend().emails.send({
      from: `${practitioner.practice_name || practitioner.first_name} <onboarding@resend.dev>`,
      to: patient.email,
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
          filename: `${invoice.invoice_number}.pdf`,
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
