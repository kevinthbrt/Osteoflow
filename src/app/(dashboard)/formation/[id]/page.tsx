import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { getOsteoUpgradeEmail } from '@/lib/osteoupgrade/email'
import { CoursePlayer } from './course-player'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function FormationPage({ params }: PageProps) {
  const { id } = await params
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) redirect('/login')

  const practitionerEmail = getOsteoUpgradeEmail()
  if (!practitionerEmail) redirect('/dashboard')

  return <CoursePlayer formationId={id} practitionerEmail={practitionerEmail} />
}
