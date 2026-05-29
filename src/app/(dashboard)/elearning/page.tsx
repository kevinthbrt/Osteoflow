import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { FormationsGrid } from './formations-grid'

export default async function ElearningPage() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) redirect('/login')

  const { data: practitioner } = await db
    .from('practitioners')
    .select('email')
    .eq('user_id', user.id)
    .single()

  const practitionerEmail = practitioner?.email || user.email
  if (!practitionerEmail) redirect('/dashboard')

  return <FormationsGrid practitionerEmail={practitionerEmail} />
}
