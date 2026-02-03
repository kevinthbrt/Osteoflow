import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient, createServiceClient } from '@/lib/db/server'
import { sendEmail, createHtmlEmail } from '@/lib/email/smtp-service'
import { formatCurrency, formatDate } from '@/lib/utils'
import { generateAccountingPdf } from '@/lib/pdf/accounting-pdfkit'

const getResend = () => new Resend(process.env.RESEND_API_KEY)

const paymentMethodLabels: Record<string, string> = {
  card: 'Carte',
  cash: 'Espèces',
  check: 'Chèque',
  transfer: 'Virement',
  other: 'Autre',
}

export async function POST(request: Request) {
  try {
    const { startDate, endDate } = await request.json()

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
    }

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: practitioner, error: practitionerError } = await db
      .from('practitioners')
      .select('id, first_name, last_name, practice_name, accountant_email, email')
      .eq('user_id', user.id)
      .single()

    if (practitionerError || !practitioner) {
      return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })
    }

    if (!practitioner.accountant_email) {
      return NextResponse.json(
        { error: 'Adresse comptable manquante dans les paramètres' },
        { status: 400 }
      )
    }

    const { data: invoices, error: invoiceError } = await db
      .from('invoices')
      .select(`
        *,
        consultation:consultations (*),
        payments (*)
      `)
      .eq('status', 'paid')
      .gte('paid_at', `${startDate}T00:00:00`)
      .lte('paid_at', `${endDate}T23:59:59`)
      .order('paid_at', { ascending: false })

    if (invoiceError) {
      console.error('Error fetching invoices for accounting report:', invoiceError)
      return NextResponse.json({ error: 'Impossible de générer le récapitulatif' }, { status: 500 })
    }

    const safeInvoices = invoices || []
    const totalRevenue = safeInvoices.reduce((sum, inv) => sum + inv.amount, 0)

    const revenueByMethod: Record<string, number> = {}
    const allCheckNumbers: string[] = []
    const dailyRecaps: Record<string, {
      date: string
      count: number
      total: number
      byMethod: Record<string, { count: number; amount: number }>
    }> = {}

    for (const inv of safeInvoices) {
      const recapDate = inv.paid_at ? formatDate(inv.paid_at) : formatDate(inv.issued_at || '')

      if (!dailyRecaps[recapDate]) {
        dailyRecaps[recapDate] = {
          date: recapDate,
          count: 0,
          total: 0,
          byMethod: {},
        }
      }

      dailyRecaps[recapDate].count += 1
      dailyRecaps[recapDate].total += inv.amount

      for (const payment of inv.payments || []) {
        revenueByMethod[payment.method] = (revenueByMethod[payment.method] || 0) + payment.amount
        if (!dailyRecaps[recapDate].byMethod[payment.method]) {
          dailyRecaps[recapDate].byMethod[payment.method] = { count: 0, amount: 0 }
        }
        dailyRecaps[recapDate].byMethod[payment.method].count += 1
        dailyRecaps[recapDate].byMethod[payment.method].amount += payment.amount

        // Collect check numbers
        if (payment.method === 'check' && payment.check_number) {
          allCheckNumbers.push(`N° ${payment.check_number} (${recapDate} - ${formatCurrency(payment.amount)})`)
        }
      }
    }

    const periodLabel = `Période : ${formatDate(startDate)} - ${formatDate(endDate)}`
    const practitionerName = practitioner.practice_name
      || `${practitioner.first_name} ${practitioner.last_name}`

    const pdfData = {
      practitionerName,
      periodLabel,
      generatedAt: formatDate(new Date()),
      totalRevenue: formatCurrency(totalRevenue),
      totalConsultations: safeInvoices.length,
      revenueByMethod: Object.fromEntries(
        Object.entries(paymentMethodLabels).map(([method, label]) => [
          label,
          formatCurrency(revenueByMethod[method] || 0),
        ])
      ),
      dailyRecaps: Object.values(dailyRecaps).map((recap) => ({
        date: recap.date,
        count: recap.count,
        total: formatCurrency(recap.total),
        byMethod: Object.fromEntries(
          Object.entries(recap.byMethod).map(([method, info]) => [
            paymentMethodLabels[method] || method,
            { count: info.count, amount: formatCurrency(info.amount) },
          ])
        ),
      })),
      checkNumbers: allCheckNumbers.length > 0 ? allCheckNumbers : undefined,
    }

    const pdfBytes = await generateAccountingPdf(pdfData)

    const subject = `Récapitulatif comptable ${formatDate(startDate)} - ${formatDate(endDate)}`
    const emailContent = `Bonjour,\n\nVeuillez trouver en pièce jointe le récapitulatif comptable pour la période du ${formatDate(startDate)} au ${formatDate(endDate)}.\n\nCordialement,`
    const htmlEmail = createHtmlEmail(emailContent, practitioner)

    const serviceClient = await createServiceClient()
    const { data: emailSettings } = await serviceClient
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
        {
          to: practitioner.accountant_email,
          subject,
          html: htmlEmail,
          attachments: [
            {
              filename: `recap_comptable_${startDate}_${endDate}.pdf`,
              content: Buffer.from(pdfBytes),
              contentType: 'application/pdf',
            },
          ],
        }
      )

      if (!result.success) {
        console.error('SMTP error:', result.error)
        return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'email' }, { status: 500 })
      }
    } else {
      const resend = getResend()
      const { error: emailError } = await resend.emails.send({
        from: `${practitioner.first_name} ${practitioner.last_name} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: practitioner.accountant_email,
        subject,
        html: htmlEmail,
        attachments: [
          {
            filename: `recap_comptable_${startDate}_${endDate}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      })

      if (emailError) {
        console.error('Resend error:', emailError)
        return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'email' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending accounting report:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi du rapport' }, { status: 500 })
  }
}
