import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { Resend } = await import('resend')
    const { generateInvoicePdf } = await import('@/lib/pdf/invoice-pdfkit')
    const { createClient, createServiceClient } = await import('@/lib/db/server')
    const { buildInvoicePDFData } = await import('@/lib/pdf/invoice-template')
    const { defaultEmailTemplates, createInvoiceHtmlEmail, replaceTemplateVariables } = await import('@/lib/email/templates')
    const { formatDate, formatCurrency } = await import('@/lib/utils')
    const { sendEmail } = await import('@/lib/email/smtp-service')
    const getResend = () => new Resend(process.env.RESEND_API_KEY)

    const { invoiceId } = await request.json()

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'ID de facture requis' },
        { status: 400 }
      )
    }

    const db = await createClient()

    // Check authentication
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Get practitioner
    const { data: practitioner, error: practitionerError } = await db
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (practitionerError || !practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    // Get invoice with all relations
    const { data: invoice, error: invoiceError } = await db
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
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    // Safely access nested relations
    const consultation = invoice.consultation
    if (!consultation) {
      return NextResponse.json(
        { error: 'Consultation associée non trouvée' },
        { status: 404 }
      )
    }

    const patient = consultation.patient
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient associé non trouvé' },
        { status: 404 }
      )
    }

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
    const { data: customTemplate } = await db
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
      practitioner_specialty: practitioner.specialty || 'Ostéopathe D.O',
      google_review_url: practitioner.google_review_url || '',
    }

    // Replace variables in template
    const subject = replaceTemplateVariables(template.subject, variables)
    const bodyText = replaceTemplateVariables(template.body, variables)
    const invoiceHtml = createInvoiceHtmlEmail({
      bodyText,
      practitionerName: variables.practitioner_name,
      practiceName: practitioner.practice_name,
      primaryColor: practitioner.primary_color,
      googleReviewUrl: practitioner.google_review_url,
    })

    // Generate PDF
    let pdfBuffer: Uint8Array
    try {
      const pdfData = buildInvoicePDFData({
        invoice,
        consultation,
        patient,
        practitioner,
        payments: invoice.payments || [],
      })
      console.debug('Invoice PDF data (api/email):', {
        invoiceId: invoice.id,
        invoiceNumber: pdfData.invoiceNumber,
        amount: pdfData.amount,
        practitionerName: pdfData.practitionerName,
        patientName: pdfData.patientName,
        hasStamp: Boolean(pdfData.stampUrl),
      })
      pdfBuffer = await generateInvoicePdf(pdfData)
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError)
      return NextResponse.json(
        { error: 'Erreur lors de la génération du PDF' },
        { status: 500 }
      )
    }

    // Check if practitioner has custom email settings
    const serviceClient = await createServiceClient()
    const { data: emailSettings } = await serviceClient
      .from('email_settings')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .eq('is_verified', true)
      .single()

    if (emailSettings) {
      // Use practitioner's SMTP settings
      const result = await sendEmail(
        {
          smtp_host: emailSettings.smtp_host,
          smtp_port: emailSettings.smtp_port,
          smtp_secure: emailSettings.smtp_secure,
          smtp_user: emailSettings.smtp_user,
          smtp_password: emailSettings.smtp_password,
          from_name: emailSettings.from_name,
          from_email: emailSettings.from_email,
        },
        {
          to: patient.email,
          subject,
          html: invoiceHtml,
          attachments: [
            {
              filename: `${invoice.invoice_number}.pdf`,
              content: Buffer.from(pdfBuffer),
              contentType: 'application/pdf',
            },
          ],
        }
      )

      if (!result.success) {
        console.error('SMTP error:', result.error)
        return NextResponse.json(
          { error: `Erreur SMTP: ${result.error || 'Échec de l\'envoi'}` },
          { status: 500 }
        )
      }
    } else if (process.env.RESEND_API_KEY) {
      // Fallback to Resend only if API key is configured
      const { error: emailError } = await getResend().emails.send({
        from: `${practitioner.practice_name || practitioner.first_name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: patient.email,
        subject,
        html: invoiceHtml,
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
          { error: 'Erreur lors de l\'envoi de l\'email via Resend' },
          { status: 500 }
        )
      }
    } else {
      // No email sending method available
      return NextResponse.json(
        { error: 'Aucun service email configuré. Veuillez configurer vos paramètres SMTP dans les réglages.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending invoice email:', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: `Erreur lors de l'envoi de l'email: ${message}` },
      { status: 500 }
    )
  }
}
