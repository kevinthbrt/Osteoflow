import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get practitioner profile
  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // If no practitioner profile exists, create one
  if (!practitioner) {
    const { error } = await supabase.from('practitioners').insert({
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
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Header user={user} practitioner={practitioner} />
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
