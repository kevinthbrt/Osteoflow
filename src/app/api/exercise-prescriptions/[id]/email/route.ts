import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { generateExercisePdf } = await import('@/lib/pdf/exercise-pdfkit')
    const { createExerciseProgramHtmlEmail } = await import('@/lib/email/templates')
    const { sendEmail } = await import('@/lib/email/smtp-service')

    const { id } = await params
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: practitioner } = await db
      .from('practitioners').select('*').eq('user_id', user.id).single()
    if (!practitioner) return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })

    const { data: prescription } = await db
      .from('exercise_prescriptions').select('*').eq('id', id).single()
    if (!prescription) return NextResponse.json({ error: 'Prescription non trouvée' }, { status: 404 })

    const { data: patient } = await db
      .from('patients').select('*').eq('id', prescription.patient_id).single()
    if (!patient) return NextResponse.json({ error: 'Patient non trouvé' }, { status: 404 })

    if (patient.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    if (!patient.email) {
      return NextResponse.json(
        { error: "Ce patient n'a pas d'adresse email enregistrée" },
        { status: 400 }
      )
    }

    const { data: items } = await db
      .from('exercise_prescription_items')
      .select('*')
      .eq('prescription_id', id)
      .order('position', { ascending: true })

    const cityLine = [practitioner.postal_code, practitioner.city].filter(Boolean).join(' ')
    const prescriptionDate = new Date(prescription.created_at).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    // Generate PDF
    const pdfBuffer = await generateExercisePdf({
      practitionerName: `${practitioner.first_name} ${practitioner.last_name}`,
      practitionerSpecialty: practitioner.specialty || undefined,
      practitionerAddress: practitioner.address || undefined,
      practitionerCityLine: cityLine || undefined,
      patientName: `${patient.first_name} ${patient.last_name}`,
      prescriptionTitle: prescription.title,
      prescriptionDate,
      notes: prescription.notes || undefined,
      items: items || [],
    })

    const practitionerName = `${practitioner.first_name} ${practitioner.last_name}`

    const htmlContent = createExerciseProgramHtmlEmail({
      patientFirstName: patient.first_name,
      prescriptionTitle: prescription.title,
      exerciseNames: (items || []).map((it: { exercise_name: string; exercise_region: string }) => ({
        name: it.exercise_name,
        region: it.exercise_region,
      })),
      practitionerName,
      practiceName: practitioner.practice_name,
      specialty: practitioner.specialty,
      primaryColor: practitioner.primary_color || '#0F766E',
    })

    const subject = `Votre programme d'exercices — ${practitioner.practice_name || practitionerName}`
    const dateStr = new Date(prescription.created_at).toISOString().slice(0, 10)

    const { data: emailSettings } = await db
      .from('email_settings')
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .eq('is_verified', true)
      .single()

    if (emailSettings) {
      const { decryptValue, getOrCreateEncryptionKey } = await import('@/lib/utils/encryption')
      const encKey = getOrCreateEncryptionKey()
      const result = await sendEmail(
        {
          smtp_host: emailSettings.smtp_host,
          smtp_port: emailSettings.smtp_port,
          smtp_secure: emailSettings.smtp_secure,
          smtp_user: emailSettings.smtp_user,
          smtp_password: decryptValue(emailSettings.smtp_password, encKey),
          from_name: emailSettings.from_name,
          from_email: emailSettings.from_email,
        },
        {
          to: patient.email,
          subject,
          html: htmlContent,
          attachments: [{
            filename: `programme-exercices-${dateStr}.pdf`,
            content: Buffer.from(pdfBuffer),
            contentType: 'application/pdf',
          }],
        }
      )
      if (!result.success) {
        return NextResponse.json({ error: `Erreur SMTP : ${result.error}` }, { status: 500 })
      }
    } else if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: emailError } = await resend.emails.send({
        from: `${practitioner.practice_name || practitioner.first_name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: patient.email,
        subject,
        html: htmlContent,
        attachments: [{
          filename: `programme-exercices-${dateStr}.pdf`,
          content: Buffer.from(pdfBuffer).toString('base64'),
        }],
      })
      if (emailError) {
        return NextResponse.json({ error: `Erreur Resend : ${emailError.message}` }, { status: 500 })
      }
    } else {
      return NextResponse.json(
        { error: 'Aucun service email configuré (SMTP ou Resend)' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending exercise prescription email:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi' }, { status: 500 })
  }
}
