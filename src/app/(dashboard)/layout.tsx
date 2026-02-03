import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

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
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      <div className="lg:pl-64">
        <Header user={user} practitioner={practitioner} />
        <main className="p-4 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
