import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { sendEmail, createHtmlEmail } = await import('@/lib/email/smtp-service')

    const { content } = await request.json()

    if (!content) {
      return NextResponse.json(
        { error: 'Le contenu du message est requis' },
        { status: 400 }
      )
    }

    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    // Get email settings
    const { data: emailSettings } = await db
      .from('email_settings')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .eq('is_verified', true)
      .single()

    if (!emailSettings) {
      return NextResponse.json(
        { error: 'Aucun paramètre email configuré. Configurez vos emails dans les paramètres.' },
        { status: 400 }
      )
    }

    // Get all active patients with email
    const { data: patients, error: patientsError } = await db
      .from('patients')
      .select('id, first_name, last_name, email')
      .eq('practitioner_id', practitioner.id)
      .is('archived_at', null)

    if (patientsError) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des patients' },
        { status: 500 }
      )
    }

    const patientsWithEmail = (patients || []).filter((p: any) => p.email)

    if (patientsWithEmail.length === 0) {
      return NextResponse.json(
        { error: 'Aucun patient avec une adresse email trouvé' },
        { status: 400 }
      )
    }

    const subject = `Message de ${practitioner.practice_name || `${practitioner.first_name} ${practitioner.last_name}`}`
    let sentCount = 0
    const errors: string[] = []

    for (const patient of patientsWithEmail) {
      try {
        const emailContent = `Bonjour ${patient.first_name},\n\n${content}`
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
          { to: patient.email, subject, html: htmlEmail }
        )

        if (!result.success) {
          errors.push(`${patient.first_name} ${patient.last_name}: ${result.error}`)
          continue
        }

        // Get or create conversation
        let conversationId: string | null = null
        const { data: existingConv } = await db
          .from('conversations')
          .select('id')
          .eq('practitioner_id', practitioner.id)
          .eq('patient_id', patient.id)
          .limit(1)
          .single()

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const { data: newConv } = await db
            .from('conversations')
            .insert({
              practitioner_id: practitioner.id,
              patient_id: patient.id,
              subject: 'Diffusion',
            })
            .select('id')
            .single()
          conversationId = newConv?.id || null
        }

        if (conversationId) {
          await db.from('messages').insert({
            conversation_id: conversationId,
            content,
            direction: 'outgoing',
            channel: 'email',
            status: 'sent',
            sent_at: new Date().toISOString(),
            email_subject: subject,
            email_message_id: result.messageId,
            to_email: patient.email,
            from_email: emailSettings.from_email,
          })

          await db
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId)
        }

        sentCount++
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue'
        errors.push(`${patient.first_name} ${patient.last_name}: ${msg}`)
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total: patientsWithEmail.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error in broadcast:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de la diffusion" },
      { status: 500 }
    )
  }
}
