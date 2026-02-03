import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'

export default async function Home() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  redirect('/dashboard')
}
