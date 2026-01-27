import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { paymentMethodLabels } from '@/lib/validations/invoice'
import type { Invoice, Payment } from '@/types/database'

const getResend = () => new Resend(process.env.RESEND_API_KEY)

interface InvoiceWithPayments extends Invoice {
  payments: Payment[]
}

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, paymentMethod } = await request.json()

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Plage de dates requise' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: practitioner, error: practitionerError } = await supabase
      .from('practitioners')
      .select('id, first_name, last_name, practice_name, accountant_email')
      .eq('user_id', user.id)
      .single()

    if (practitionerError || !practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    if (!practitioner.accountant_email) {
      return NextResponse.json(
        { error: 'Email comptable manquant' },
        { status: 400 }
      )
    }

    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*, payments (*)')
      .eq('status', 'paid')
      .gte('paid_at', `${startDate}T00:00:00`)
      .lte('paid_at', `${endDate}T23:59:59`)
      .order('paid_at', { ascending: false })

    if (invoicesError) {
      return NextResponse.json(
        { error: 'Erreur lors du chargement des factures' },
        { status: 500 }
      )
    }

    let filteredInvoices = (invoices as InvoiceWithPayments[]) || []

    if (paymentMethod && paymentMethod !== 'all') {
      filteredInvoices = filteredInvoices.filter((inv) =>
        inv.payments.some((p) => p.method === paymentMethod)
      )
    }

    const recaps: Record<string, {
      date: string
      count: number
      total: number
      byMethod: Record<string, { count: number; amount: number }>
    }> = {}

    for (const inv of filteredInvoices) {
      const recapDate = inv.paid_at
        ? formatDate(inv.paid_at)
        : formatDate(inv.issued_at || '')

      if (!recaps[recapDate]) {
        recaps[recapDate] = { date: recapDate, count: 0, total: 0, byMethod: {} }
      }

      recaps[recapDate].count++
      recaps[recapDate].total += inv.amount

      for (const payment of inv.payments) {
        if (!recaps[recapDate].byMethod[payment.method]) {
          recaps[recapDate].byMethod[payment.method] = { count: 0, amount: 0 }
        }
        recaps[recapDate].byMethod[payment.method].count++
        recaps[recapDate].byMethod[payment.method].amount += payment.amount
      }
    }

    const dailyRecaps = Object.values(recaps).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const totalConsultations = filteredInvoices.length
    const revenueByMethod: Record<string, number> = {}
    for (const inv of filteredInvoices) {
      for (const payment of inv.payments) {
        revenueByMethod[payment.method] =
          (revenueByMethod[payment.method] || 0) + payment.amount
      }
    }

    const headers = [
      'Date',
      'Nombre de consultations',
      'Chiffre d\'affaires',
      'CB',
      'Espèces',
      'Chèque',
      'Virement',
      'Autre',
    ]

    const rows = dailyRecaps.map((recap) => [
      recap.date,
      recap.count.toString(),
      recap.total.toFixed(2),
      (recap.byMethod['card']?.amount || 0).toFixed(2),
      (recap.byMethod['cash']?.amount || 0).toFixed(2),
      (recap.byMethod['check']?.amount || 0).toFixed(2),
      (recap.byMethod['transfer']?.amount || 0).toFixed(2),
      (recap.byMethod['other']?.amount || 0).toFixed(2),
    ])

    const totalRow = [
      'TOTAL',
      totalConsultations.toString(),
      totalRevenue.toFixed(2),
      (revenueByMethod['card'] || 0).toFixed(2),
      (revenueByMethod['cash'] || 0).toFixed(2),
      (revenueByMethod['check'] || 0).toFixed(2),
      (revenueByMethod['transfer'] || 0).toFixed(2),
      (revenueByMethod['other'] || 0).toFixed(2),
    ]

    const csvContent = [
      `Récapitulatif comptable du ${formatDate(startDate)} au ${formatDate(endDate)}`,
      paymentMethod && paymentMethod !== 'all'
        ? `Mode de paiement: ${paymentMethodLabels[paymentMethod]}`
        : 'Mode de paiement: Tous',
      '',
      headers.join(';'),
      ...rows.map((row) => row.join(';')),
      '',
      totalRow.join(';'),
    ].join('\n')

    const fileContent = `\ufeff${csvContent}`

    const { error: emailError } = await getResend().emails.send({
      from: `${practitioner.practice_name || practitioner.first_name} ` +
        `<${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: practitioner.accountant_email,
      subject: `Récapitulatif comptable ${formatDate(startDate)} - ${formatDate(endDate)}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .summary { background: #f8fafc; padding: 12px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <p>Bonjour,</p>
              <p>Veuillez trouver en pièce jointe le récapitulatif comptable demandé.</p>
              <div class="summary">
                <p><strong>Période :</strong> ${formatDate(startDate)} - ${formatDate(endDate)}</p>
                <p><strong>Consultations :</strong> ${totalConsultations}</p>
                <p><strong>Total :</strong> ${totalRevenue.toFixed(2)} €</p>
              </div>
              <p>Bonne journée,</p>
              <p>${practitioner.practice_name || `${practitioner.first_name} ${practitioner.last_name}`}</p>
            </div>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: `recap_comptable_${startDate}_${endDate}.csv`,
          content: Buffer.from(fileContent),
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
    console.error('Error sending accounting recap:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi du récapitulatif' },
      { status: 500 }
    )
  }
}
