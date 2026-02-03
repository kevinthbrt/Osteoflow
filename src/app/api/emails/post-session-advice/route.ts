import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
import { createPostSessionAdviceHtmlEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/smtp-service'
import { formatDate } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { consultationId } = await request.json()

    if (!consultationId) {
      return NextResponse.json(
        { error: 'ID de consultation requis' },
        { status: 400 }
      )
    }

    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Get consultation with patient
    const { data: consultation, error: consultationError } = await db
      .from('consultations')
      .select(`*, patient:patients (*)`)
      .eq('id', consultationId)
      .single()

    if (consultationError || !consultation) {
      return NextResponse.json(
        { error: 'Consultation non trouvée' },
        { status: 404 }
      )
    }

    const patient = consultation.patient
    if (!patient?.email) {
      return NextResponse.json(
        { error: "Le patient n'a pas d'adresse email" },
        { status: 400 }
      )
    }

    // Get practitioner
    const { data: practitioner } = await db
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    const practitionerName = `${practitioner.first_name} ${practitioner.last_name}`
    const bodyText = `Bonjour ${patient.first_name},\n\nMerci pour votre confiance lors de votre séance du ${formatDate(consultation.date_time)}.\n\nVoici quelques conseils pour optimiser les bienfaits de votre consultation :`

    const htmlContent = createPostSessionAdviceHtmlEmail({
      bodyText,
      practitionerName,
      practiceName: practitioner.practice_name,
      specialty: practitioner.specialty,
      primaryColor: practitioner.primary_color || '#2563eb',
      googleReviewUrl: practitioner.google_review_url,
    })

    const subject = `Conseils post-séance - ${practitioner.practice_name || practitionerName}`

    // Send via SMTP
    const { data: emailSettings } = await db
      .from('email_settings')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .eq('is_verified', true)
      .single()

    if (emailSettings) {
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
        { to: patient.email, subject, html: htmlContent }
      )
      if (!result.success) {
        return NextResponse.json(
          { error: `Erreur SMTP: ${result.error}` },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Aucun paramètre email configuré. Configurez vos emails dans les paramètres.' },
        { status: 400 }
      )
    }

    // Mark consultation as advice sent
    await db
      .from('consultations')
      .update({ post_session_advice_sent_at: new Date().toISOString() })
      .eq('id', consultationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending post-session advice email:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de l'email" },
      { status: 500 }
    )
  }
}
