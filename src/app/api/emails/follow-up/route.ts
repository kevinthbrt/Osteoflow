import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import {
  defaultEmailTemplates,
  replaceTemplateVariables,
  createFollowUpHtmlEmail,
} from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/smtp-service'
import { formatDate } from '@/lib/utils'

// Lazy initialization to avoid build-time errors
const getResend = () => new Resend(process.env.RESEND_API_KEY)

// This endpoint can be called by a cron job to process pending follow-up tasks
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret or admin auth
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // If called from cron, verify secret (accept local desktop cron too)
    const isLocalCron = authHeader === 'Bearer local-desktop-cron'
    if (!isLocalCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Try regular auth
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
    }

    const supabase = await createClient()

    // Get pending follow-up tasks that are due
    const { data: tasks, error: tasksError } = await supabase
      .from('scheduled_tasks')
      .select(`
        *,
        consultation:consultations (
          *,
          patient:patients (*)
        )
      `)
      .eq('type', 'follow_up_email')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(10)

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des tâches' },
        { status: 500 }
      )
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ message: 'Aucune tâche à traiter', processed: 0 })
    }

    let processed = 0
    const errors: string[] = []

    for (const task of tasks) {
      try {
        const consultation = task.consultation
        const patient = consultation?.patient

        if (!consultation || !patient) {
          await supabase
            .from('scheduled_tasks')
            .update({
              status: 'failed',
              error_message: 'Consultation ou patient non trouvé',
              executed_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          continue
        }

        if (!patient.email) {
          await supabase
            .from('scheduled_tasks')
            .update({
              status: 'failed',
              error_message: 'Patient sans email',
              executed_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          continue
        }

        // Get practitioner
        const { data: practitioner } = await supabase
          .from('practitioners')
          .select('*')
          .eq('id', task.practitioner_id)
          .single()

        if (!practitioner) {
          await supabase
            .from('scheduled_tasks')
            .update({
              status: 'failed',
              error_message: 'Praticien non trouvé',
              executed_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          continue
        }

        // Get email template (custom or default)
        const { data: customTemplate } = await supabase
          .from('email_templates')
          .select('*')
          .eq('practitioner_id', practitioner.id)
          .eq('type', 'follow_up_7d')
          .single()

        const template = customTemplate || defaultEmailTemplates.follow_up_7d

        // Prepare variables
        const variables = {
          patient_name: `${patient.first_name} ${patient.last_name}`,
          patient_first_name: patient.first_name,
          consultation_date: formatDate(consultation.date_time),
          consultation_reason: consultation.reason,
          practitioner_name: `${practitioner.first_name} ${practitioner.last_name}`,
          practice_name:
            practitioner.practice_name ||
            `${practitioner.first_name} ${practitioner.last_name}`,
        }

        // Replace variables in template
        const subject = replaceTemplateVariables(template.subject, variables)
        const bodyText = replaceTemplateVariables(template.body, variables)

        const practitionerName = `${practitioner.first_name} ${practitioner.last_name}`
        const htmlContent = createFollowUpHtmlEmail({
          bodyText,
          practitionerName,
          practiceName: practitioner.practice_name,
          specialty: practitioner.specialty,
          primaryColor: practitioner.primary_color || '#2563eb',
          googleReviewUrl: practitioner.google_review_url,
        })

        // Try SMTP first (desktop mode), then fallback to Resend
        const { data: emailSettings } = await supabase
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
            throw new Error(`SMTP error: ${result.error}`)
          }
        } else {
          const { error: emailError } = await getResend().emails.send({
            from: `${practitioner.practice_name || practitioner.first_name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
            to: patient.email,
            subject,
            html: htmlContent,
          })

          if (emailError) {
            throw new Error(`Resend error: ${emailError.message}`)
          }
        }

        // Mark task as completed
        await supabase
          .from('scheduled_tasks')
          .update({
            status: 'completed',
            executed_at: new Date().toISOString(),
          })
          .eq('id', task.id)

        // Update consultation follow_up_sent_at
        await supabase
          .from('consultations')
          .update({ follow_up_sent_at: new Date().toISOString() })
          .eq('id', consultation.id)

        processed++
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur inconnue'
        errors.push(`Task ${task.id}: ${errorMessage}`)

        await supabase
          .from('scheduled_tasks')
          .update({
            status: 'failed',
            error_message: errorMessage,
            executed_at: new Date().toISOString(),
          })
          .eq('id', task.id)
      }
    }

    return NextResponse.json({
      message: `${processed} tâche(s) traitée(s)`,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error processing follow-up emails:', error)
    return NextResponse.json(
      { error: 'Erreur lors du traitement des emails de suivi' },
      { status: 500 }
    )
  }
}

// Manual trigger for a specific consultation
export async function PUT(request: NextRequest) {
  try {
    const { consultationId } = await request.json()

    if (!consultationId) {
      return NextResponse.json(
        { error: 'ID de consultation requis' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Get consultation with patient
    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .select(`
        *,
        patient:patients (*)
      `)
      .eq('id', consultationId)
      .single()

    if (consultationError || !consultation) {
      return NextResponse.json(
        { error: 'Consultation non trouvée' },
        { status: 404 }
      )
    }

    const patient = consultation.patient

    if (!patient.email) {
      return NextResponse.json(
        { error: 'Le patient n\'a pas d\'adresse email' },
        { status: 400 }
      )
    }

    // Get practitioner
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!practitioner || patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Get email template
    const { data: customTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .eq('type', 'follow_up_7d')
      .single()

    const template = customTemplate || defaultEmailTemplates.follow_up_7d

    // Prepare variables
    const variables = {
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_first_name: patient.first_name,
      consultation_date: formatDate(consultation.date_time),
      consultation_reason: consultation.reason,
      practitioner_name: `${practitioner.first_name} ${practitioner.last_name}`,
      practice_name:
        practitioner.practice_name ||
        `${practitioner.first_name} ${practitioner.last_name}`,
    }

    // Replace variables
    const subject = replaceTemplateVariables(template.subject, variables)
    const bodyText = replaceTemplateVariables(template.body, variables)

    const practitionerFullName = `${practitioner.first_name} ${practitioner.last_name}`
    const htmlContent = createFollowUpHtmlEmail({
      bodyText,
      practitionerName: practitionerFullName,
      practiceName: practitioner.practice_name,
      primaryColor: practitioner.primary_color || '#2563eb',
      googleReviewUrl: practitioner.google_review_url,
    })

    // Try SMTP first (desktop mode), then fallback to Resend
    const { data: emailSettings } = await supabase
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
          { error: 'Erreur lors de l\'envoi de l\'email' },
          { status: 500 }
        )
      }
    } else {
      const { error: emailError } = await getResend().emails.send({
        from: `${practitioner.practice_name || practitioner.first_name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: patient.email,
        subject,
        html: htmlContent,
      })

      if (emailError) {
        return NextResponse.json(
          { error: 'Erreur lors de l\'envoi de l\'email' },
          { status: 500 }
        )
      }
    }

    // Update consultation
    await supabase
      .from('consultations')
      .update({ follow_up_sent_at: new Date().toISOString() })
      .eq('id', consultationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending follow-up email:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi de l\'email' },
      { status: 500 }
    )
  }
}
