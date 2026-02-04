import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { Resend } = await import('resend')
    const { createClient, createServiceClient } = await import('@/lib/db/server')
    const { sendEmail, createHtmlEmail } = await import('@/lib/email/smtp-service')
    const getResend = () => new Resend(process.env.RESEND_API_KEY)

    const { conversationId, patientEmail, patientName, content } = await request.json()

    if (!conversationId || !patientEmail || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const db = await createClient()

    // Get practitioner info
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
    }

    const subject = `Message de ${practitioner.practice_name || `${practitioner.first_name} ${practitioner.last_name}`}`
    let emailMessageId: string | undefined

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
      const emailContent = `Bonjour ${patientName},\n\n${content}`
      const htmlEmail = createHtmlEmail(emailContent, practitioner)

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
          to: patientEmail,
          subject,
          html: htmlEmail,
        }
      )

      if (!result.success) {
        console.error('SMTP error:', result.error)
        return NextResponse.json(
          { error: `Erreur SMTP: ${result.error || 'Échec de l\'envoi'}` },
          { status: 500 }
        )
      }

      emailMessageId = result.messageId
    } else if (process.env.RESEND_API_KEY) {
      // Fallback to Resend only if API key is configured
      const resend = getResend()
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: `${practitioner.first_name} ${practitioner.last_name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: patientEmail,
        subject,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { border-bottom: 2px solid #14b8a6; padding-bottom: 20px; margin-bottom: 20px; }
                .content { background: #f9fafb; padding: 20px; border-radius: 8px; white-space: pre-wrap; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2 style="margin: 0; color: #14b8a6;">
                    ${practitioner.practice_name || `Cabinet ${practitioner.last_name}`}
                  </h2>
                </div>
                <p>Bonjour ${patientName},</p>
                <div class="content">${content}</div>
                <div class="footer">
                  <p>
                    <strong>${practitioner.first_name} ${practitioner.last_name}</strong><br>
                    ${practitioner.practice_name ? `${practitioner.practice_name}<br>` : ''}
                    ${practitioner.address ? `${practitioner.address}<br>` : ''}
                    ${practitioner.postal_code ? `${practitioner.postal_code} ` : ''}${practitioner.city || ''}
                  </p>
                  ${practitioner.phone ? `<p>Tél: ${practitioner.phone}</p>` : ''}
                </div>
              </div>
            </body>
          </html>
        `,
      })

      if (emailError) {
        console.error('Error sending email:', emailError)
        throw emailError
      }

      emailMessageId = emailData?.id
    } else {
      return NextResponse.json(
        { error: 'Aucun service email configuré. Veuillez configurer vos paramètres SMTP dans les réglages.' },
        { status: 400 }
      )
    }

    // Save message to database
    const { error: messageError } = await db.from('messages').insert({
      conversation_id: conversationId,
      content,
      direction: 'outgoing',
      channel: 'email',
      status: 'sent',
      sent_at: new Date().toISOString(),
      email_subject: subject,
      email_message_id: emailMessageId,
      to_email: patientEmail,
      from_email: emailSettings?.from_email || practitioner.email,
    })

    if (messageError) {
      console.error('Error saving message:', messageError)
    }

    return NextResponse.json({ success: true, messageId: emailMessageId })
  } catch (error) {
    console.error('Error in send-email:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
