import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { CoursePlayer } from './course-player'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function FormationPage({ params }: PageProps) {
  const { id } = await params
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) redirect('/login')

  const { data: practitioner } = await db
    .from('practitioners')
    .select('email')
    .eq('user_id', user.id)
    .single()

  if (!practitioner?.email) redirect('/dashboard')

  return <CoursePlayer formationId={id} practitionerEmail={practitioner.email} />
}
