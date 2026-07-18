import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { UpdateBanner } from '@/components/layout/update-banner'
import { WhatsNewDialog } from '@/components/layout/whats-new-dialog'
import { LicenseGuard } from '@/components/layout/license-guard'
import { InactivityTimer } from '@/components/InactivityTimer'
import { BackupReminderDialog } from '@/components/layout/backup-reminder-dialog'
import { ChangeCabinetDialog } from '@/components/layout/change-cabinet-dialog'
import { CguModal } from '@/components/legal/cgu-modal'
import { TourWrapper } from '@/components/layout/tour-wrapper'
import { SupportWidget } from '@/components/support/support-widget'
import { BroadcastModal } from '@/components/layout/broadcast-modal'
import { CurrencySync } from '@/components/providers/currency-sync'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check session lock and read configurable timeout
  let inactivityTimeoutMs = 30 * 60 * 1000 // default 30 min
  let licenseEmail = ''
  try {
    const { getDatabase } = await import('@/lib/database/connection')
    const sqliteDb = getDatabase()
    const lockRow = sqliteDb
      .prepare("SELECT value FROM app_config WHERE key = 'session_locked'")
      .get() as { value: string } | undefined
    if (lockRow?.value === '1') {
      redirect('/login?mode=lock')
    }
    const timeoutRow = sqliteDb
      .prepare("SELECT value FROM app_config WHERE key = 'inactivity_timeout_minutes'")
      .get() as { value: string } | undefined
    if (timeoutRow?.value) {
      inactivityTimeoutMs = parseInt(timeoutRow.value) * 60 * 1000
    }
    const emailRow = sqliteDb
      .prepare("SELECT value FROM app_config WHERE key = 'license_email'")
      .get() as { value: string } | undefined
    licenseEmail = emailRow?.value?.trim() || ''
  } catch {
    // ignore if db not available
  }

  // Get practitioner profile
  const { data: practitioner } = await db
    .from('practitioners')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // If no practitioner profile exists, create one
  if (!practitioner) {
    const { error } = await db.from('practitioners').insert({
      user_id: user.id,
      first_name: user.user_metadata.first_name || 'Praticien',
      last_name: user.user_metadata.last_name || '',
      email: user.email!,
    })

    if (error) {
      console.error('Error creating practitioner:', error)
    }
  }

  return (
    <TourWrapper>
      <CurrencySync country={practitioner?.country} />
      <div className="min-h-screen">
        <Sidebar />
        <div className="lg:pl-64">
          <UpdateBanner />
          <Header user={user} practitioner={practitioner} />
          <main className="p-4 lg:px-8 lg:py-6">
            {children}
          </main>
        </div>
        <WhatsNewDialog />
        <BackupReminderDialog />
        <ChangeCabinetDialog />
        <CguModal />
        <BroadcastModal />
        <LicenseGuard />
        <InactivityTimer timeoutMs={inactivityTimeoutMs} />
        <SupportWidget userEmail={licenseEmail} />
      </div>
    </TourWrapper>
  )
}
