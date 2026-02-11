import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
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
    { data: upcomingBirthdays },
    { data: recentConsultations },
    { count: unreadMessages },
    { data: patientsForConsultation },
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

    // Upcoming birthdays (next 7 days)
    db
      .from('patients')
      .select('id, first_name, last_name, birth_date')
      .is('archived_at', null)
      .order('birth_date'),

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
      .not('patient_id', 'is', null)
      .gt('unread_count', 0),

    // Patients for quick consultation creation
    db
      .from('patients')
      .select('id, first_name, last_name, email')
      .is('archived_at', null)
      .order('last_name')
      .order('first_name'),
  ])

  // Calculate month revenue
  const monthlyRevenue = monthRevenue?.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) || 0

  // Filter birthdays for next 7 days
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const birthdaysThisWeek = (upcomingBirthdays || []).filter((p: any) => {
    if (!p.birth_date) return false
    const bday = new Date(p.birth_date)
    const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
    if (thisYearBday < now) {
      thisYearBday.setFullYear(now.getFullYear() + 1)
    }
    return thisYearBday <= nextWeek
  }).slice(0, 3)

  // Transform recent consultations to fix patient type
  const formattedConsultations = (recentConsultations || []).map((c: any) => ({
    id: c.id as string,
    date_time: c.date_time as string,
    reason: c.reason as string,
    patient: Array.isArray(c.patient) ? c.patient[0] as { id: string; first_name: string; last_name: string } || null : c.patient as { id: string; first_name: string; last_name: string } | null,
  }))

  return (
    <Dashboard
      practitioner={practitioner}
      stats={{
        totalPatients: totalPatients || 0,
        todayConsultations: todayConsultations || 0,
        monthlyRevenue,
        unreadMessages: unreadMessages || 0,
      }}
      birthdaysThisWeek={birthdaysThisWeek}
      recentConsultations={formattedConsultations}
      patientsForConsultation={patientsForConsultation || []}
    />
  )
}
