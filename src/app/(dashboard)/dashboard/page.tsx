import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { getOsteoUpgradeEmail } from '@/lib/osteoupgrade/email'
import { Dashboard } from '@/components/dashboard/dashboard'

export default async function DashboardPage() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get practitioner
  const { data: practitioner } = await db
    .from('practitioners')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) {
    redirect('/login')
  }

  // Get today's date range
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString()
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  // Fetch dashboard data in parallel
  const [
    { count: totalPatients },
    { count: todayConsultations },
    { data: monthRevenue },
    { data: recentConsultations },
    { count: unreadMessages },
    { data: unpaidInvoices },
    { count: surveysToRead },
    { count: followUpsDue },
  ] = await Promise.all([
    // Total active patients
    db
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null),

    // Today's consultations
    db
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .gte('date_time', startOfDay)
      .lte('date_time', endOfDay),

    // This month's revenue
    db
      .from('invoices')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', startOfMonth),

    // Recent consultations
    db
      .from('consultations')
      .select(`
        id,
        date_time,
        reason,
        patient:patients (id, first_name, last_name)
      `)
      .is('archived_at', null)
      .order('date_time', { ascending: false })
      .limit(5),

    // Unread messages (only from patient conversations, matching the messages page filter)
    db
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .isNot('patient_id', null)
      .gt('unread_count', 0),

    // Factures émises non encore réglées
    db
      .from('invoices')
      .select(`
        id,
        invoice_number,
        amount,
        issued_at,
        consultation:consultations (
          patient:patients (first_name, last_name)
        )
      `)
      .eq('status', 'issued')
      .order('issued_at', { ascending: true }),

    // Questionnaires de suivi reçus et pas encore lus
    db
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .is('acknowledged_at', null),

    // Emails de suivi J+7 prévus d'ici ce soir
    db
      .from('scheduled_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_for', endOfDay),
  ])

  // Calculate month revenue
  const monthlyRevenue = monthRevenue?.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) || 0

  // Transform recent consultations to fix patient type
  const formattedConsultations = (recentConsultations || []).map((c: any) => ({
    id: c.id as string,
    date_time: c.date_time as string,
    reason: c.reason as string,
    patient: Array.isArray(c.patient) ? c.patient[0] as { id: string; first_name: string; last_name: string } || null : c.patient as { id: string; first_name: string; last_name: string } | null,
  }))

  const pickOne = <T,>(value: T | T[] | null | undefined): T | null =>
    Array.isArray(value) ? value[0] ?? null : value ?? null

  const formattedUnpaid = (unpaidInvoices || []).map((invoice: any) => {
    const consultation = pickOne<any>(invoice.consultation)
    const patient = pickOne<{ first_name: string; last_name: string }>(consultation?.patient)
    return {
      id: invoice.id as string,
      invoice_number: invoice.invoice_number as string,
      amount: (invoice.amount as number) || 0,
      issued_at: (invoice.issued_at as string | null) ?? null,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : null,
    }
  })

  const practitionerEmail = getOsteoUpgradeEmail() || ''

  return (
    <Dashboard
      practitioner={practitioner}
      practitionerEmail={practitionerEmail}
      stats={{
        totalPatients: totalPatients || 0,
        todayConsultations: todayConsultations || 0,
        monthlyRevenue,
        unreadMessages: unreadMessages || 0,
        surveysToRead: surveysToRead || 0,
        followUpsDue: followUpsDue || 0,
      }}
      recentConsultations={formattedConsultations}
      unpaidInvoices={formattedUnpaid}
    />
  )
}
