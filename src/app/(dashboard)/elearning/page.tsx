import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { getOsteoUpgradeEmail } from '@/lib/osteoupgrade/email'
import { FormationsGrid } from './formations-grid'

export default async function ElearningPage() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) redirect('/login')

  const practitionerEmail = getOsteoUpgradeEmail()
  if (!practitionerEmail) redirect('/dashboard')

  return <FormationsGrid practitionerEmail={practitionerEmail} />
}
