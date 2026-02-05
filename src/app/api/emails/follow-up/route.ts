import { NextRequest, NextResponse } from 'next/server'

// This endpoint can be called by a cron job to process pending follow-up tasks
export async function POST(request: NextRequest) {
  try {
    const { Resend } = await import('resend')
    const { createClient } = await import('@/lib/db/server')
    const { defaultEmailTemplates, replaceTemplateVariables, createFollowUpHtmlEmail } = await import('@/lib/email/templates')
    const { sendEmail } = await import('@/lib/email/smtp-service')
    const { formatDate } = await import('@/lib/utils')
    const getResend = () => new Resend(process.env.RESEND_API_KEY)
    // Verify cron secret or admin auth
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // If called from cron, verify secret (accept local desktop cron too)
    const isLocalCron = authHeader === 'Bearer local-desktop-cron'
    if (!isLocalCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Try regular auth
      const db = await createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
    }

    const db = await createClient()
    const now = new Date().toISOString()

    console.log(`[FollowUp] Checking for pending tasks... (now=${now})`)

    // Step 1: Get pending tasks with a simple query (no nested relations)
    const { data: tasks, error: tasksError } = await db
      .from('scheduled_tasks')
      .select('*')
      .eq('type', 'follow_up_email')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(10)

    if (tasksError) {
      console.error('[FollowUp] Error fetching tasks:', tasksError)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des tâches' },
        { status: 500 }
      )
    }

    console.log(`[FollowUp] Found ${tasks?.length || 0} pending task(s)`)

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ message: 'Aucune tâche à traiter', processed: 0 })
    }

    let processed = 0
    const errors: string[] = []

    for (const task of tasks) {
      try {
        console.log(`[FollowUp] Processing task ${task.id} (consultation_id=${task.consultation_id})`)

        // Step 2: Get consultation separately
        const { data: consultation } = await db
          .from('consultations')
          .select('*')
          .eq('id', task.consultation_id)
          .single()

        if (!consultation) {
          console.error(`[FollowUp] Consultation ${task.consultation_id} not found`)
          await db
            .from('scheduled_tasks')
            .update({
              status: 'failed',
              error_message: 'Consultation non trouvée',
              executed_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          continue
        }

        // Guard against sending the same follow-up twice (duplicate tasks)
        if (consultation.follow_up_sent_at) {
          console.log(`[FollowUp] Consultation ${consultation.id} already sent, skipping task ${task.id}`)
          await db
            .from('scheduled_tasks')
            .update({
              status: 'completed',
              executed_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          continue
        }

        // Step 3: Get patient separately
        const { data: patient } = await db
          .from('patients')
          .select('*')
          .eq('id', consultation.patient_id)
          .single()

        if (!patient) {
          console.error(`[FollowUp] Patient not found for consultation ${consultation.id}`)
          await db
            .from('scheduled_tasks')
            .update({
              status: 'failed',
              error_message: 'Patient non trouvé',
              executed_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          continue
        }

        if (!patient.email) {
          console.error(`[FollowUp] Patient ${patient.id} has no email`)
          await db
            .from('scheduled_tasks')
            .update({
              status: 'failed',
              error_message: 'Patient sans email',
              executed_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          continue
        }

        // Step 4: Get practitioner
        const { data: practitioner } = await db
          .from('practitioners')
          .select('*')
          .eq('id', task.practitioner_id)
          .single()

        if (!practitioner) {
          console.error(`[FollowUp] Practitioner ${task.practitioner_id} not found`)
          await db
            .from('scheduled_tasks')
            .update({
              status: 'failed',
              error_message: 'Praticien non trouvé',
              executed_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          continue
        }

        // Step 5: Get email template (custom or default)
        const { data: customTemplate } = await db
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

        console.log(`[FollowUp] Sending email to ${patient.email} for task ${task.id}`)

        // Try SMTP first (desktop mode), then fallback to Resend
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
            throw new Error(`SMTP error: ${result.error}`)
          }
          console.log(`[FollowUp] Email sent via SMTP to ${patient.email}`)
        } else if (process.env.RESEND_API_KEY) {
          const { error: emailError } = await getResend().emails.send({
            from: `${practitioner.practice_name || practitioner.first_name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
            to: patient.email,
            subject,
            html: htmlContent,
          })

          if (emailError) {
            throw new Error(`Resend error: ${emailError.message}`)
          }
          console.log(`[FollowUp] Email sent via Resend to ${patient.email}`)
        } else {
          throw new Error('Aucun service email configuré (SMTP ou Resend)')
        }

        // Mark task as completed
        await db
          .from('scheduled_tasks')
          .update({
            status: 'completed',
            executed_at: new Date().toISOString(),
          })
          .eq('id', task.id)

        // Update consultation follow_up_sent_at
        await db
          .from('consultations')
          .update({ follow_up_sent_at: new Date().toISOString() })
          .eq('id', consultation.id)

        processed++
        console.log(`[FollowUp] Task ${task.id} completed successfully`)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur inconnue'
        errors.push(`Task ${task.id}: ${errorMessage}`)
        console.error(`[FollowUp] Task ${task.id} failed:`, errorMessage)

        await db
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
      sent: processed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[FollowUp] Fatal error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du traitement des emails de suivi' },
      { status: 500 }
    )
  }
}

// Manual trigger for a specific consultation
export async function PUT(request: NextRequest) {
  try {
    const { Resend } = await import('resend')
    const { createClient } = await import('@/lib/db/server')
    const { defaultEmailTemplates, replaceTemplateVariables, createFollowUpHtmlEmail } = await import('@/lib/email/templates')
    const { sendEmail } = await import('@/lib/email/smtp-service')
    const { formatDate } = await import('@/lib/utils')
    const getResend = () => new Resend(process.env.RESEND_API_KEY)

    const { consultationId } = await request.json()

    if (!consultationId) {
      return NextResponse.json(
        { error: 'ID de consultation requis' },
        { status: 400 }
      )
    }

    const db = await createClient()

    // Check authentication
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Get consultation
    const { data: consultation, error: consultationError } = await db
      .from('consultations')
      .select('*')
      .eq('id', consultationId)
      .single()

    if (consultationError || !consultation) {
      return NextResponse.json(
        { error: 'Consultation non trouvée' },
        { status: 404 }
      )
    }

    // Get patient separately
    const { data: patient } = await db
      .from('patients')
      .select('*')
      .eq('id', consultation.patient_id)
      .single()

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

    if (!practitioner || patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Get email template
    const { data: customTemplate } = await db
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
      specialty: practitioner.specialty,
      primaryColor: practitioner.primary_color || '#2563eb',
      googleReviewUrl: practitioner.google_review_url,
    })

    // Try SMTP first (desktop mode), then fallback to Resend
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
          { error: `Erreur SMTP: ${result.error || 'Échec de l\'envoi'}` },
          { status: 500 }
        )
      }
    } else if (process.env.RESEND_API_KEY) {
      const { error: emailError } = await getResend().emails.send({
        from: `${practitioner.practice_name || practitioner.first_name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: patient.email,
        subject,
        html: htmlContent,
      })

      if (emailError) {
        return NextResponse.json(
          { error: 'Erreur lors de l\'envoi de l\'email via Resend' },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Aucun service email configuré. Veuillez configurer vos paramètres SMTP dans les réglages.' },
        { status: 400 }
      )
    }

    // Update consultation
    await db
      .from('consultations')
      .update({ follow_up_sent_at: new Date().toISOString() })
      .eq('id', consultationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending follow-up email:', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: `Erreur lors de l'envoi de l'email: ${message}` },
      { status: 500 }
    )
  }
}
