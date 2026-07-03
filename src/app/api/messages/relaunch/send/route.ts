import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDecryptedEmailSettings } = await import('@/lib/email/get-email-settings')
    const { sendEmail } = await import('@/lib/email/smtp-service')
    const { createPatientRelaunchHtmlEmail, defaultEmailTemplates, replaceTemplateVariables } = await import('@/lib/email/templates')
    const { getProfessionLabel } = await import('@/lib/practitioner/profession')

    const { patientId } = await request.json()
    if (!patientId) {
      return NextResponse.json({ error: 'ID du patient requis' }, { status: 400 })
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

    const { data: patient } = await db
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()

    if (!patient || patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Patient non trouvé' }, { status: 404 })
    }

    if (!patient.email) {
      return NextResponse.json({ error: "Le patient n'a pas d'adresse email" }, { status: 400 })
    }

    const emailSettings = await getDecryptedEmailSettings(practitioner.id)
    if (!emailSettings || !emailSettings.is_verified) {
      return NextResponse.json(
        { error: 'Aucun paramètre email configuré. Configurez vos emails dans les paramètres.' },
        { status: 400 }
      )
    }

    const template = defaultEmailTemplates.patient_relaunch
    const subject = replaceTemplateVariables(template.subject, {
      practice_name: practitioner.practice_name || `${practitioner.first_name} ${practitioner.last_name}`,
    })
    const bodyText = replaceTemplateVariables(template.body, {
      patient_first_name: patient.first_name,
    })

    const html = createPatientRelaunchHtmlEmail({
      bodyText,
      practitionerName: `${practitioner.first_name} ${practitioner.last_name}`,
      practiceName: practitioner.practice_name,
      specialty: getProfessionLabel(practitioner.profession, practitioner.specialty),
      primaryColor: practitioner.primary_color || '#2563eb',
      bookingUrl: practitioner.booking_url,
      contactEmail: practitioner.email,
      contactPhone: practitioner.phone,
    })

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
      { to: patient.email, subject, html }
    )

    if (!result.success) {
      return NextResponse.json({ error: `Erreur SMTP: ${result.error || "Échec de l'envoi"}` }, { status: 500 })
    }

    const nowIso = new Date().toISOString()

    let conversationId: string
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
        .insert({ practitioner_id: practitioner.id, patient_id: patient.id, subject: 'Relance patient' })
        .select('id')
        .single()
      conversationId = newConv.id
    }

    await db.from('messages').insert({
      conversation_id: conversationId,
      content: bodyText,
      direction: 'outgoing',
      channel: 'email',
      status: 'sent',
      sent_at: nowIso,
      email_subject: subject,
      email_message_id: result.messageId,
      to_email: patient.email,
      from_email: emailSettings.from_email,
    })

    await db.from('conversations').update({ last_message_at: nowIso }).eq('id', conversationId)

    await db
      .from('patients')
      .update({ last_relaunch_sent_at: nowIso, relaunch_count: (patient.relaunch_count || 0) + 1 })
      .eq('id', patient.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending relaunch email:', error)
    return NextResponse.json({ error: "Erreur lors de l'envoi de la relance" }, { status: 500 })
  }
}
