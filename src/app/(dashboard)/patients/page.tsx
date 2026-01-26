import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PatientsTable } from '@/components/patients/patients-table'
import { PatientSearch } from '@/components/patients/patient-search'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

interface PatientsPageProps {
  searchParams: Promise<{ q?: string; archived?: string }>
}

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const params = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">
            Gérez vos patients et leurs informations
          </p>
        </div>
        <Button asChild>
          <Link href="/patients/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau patient
          </Link>
        </Button>
      </div>

      <PatientSearch />

      <Suspense fallback={<PatientsTableSkeleton />}>
        <PatientsTableLoader searchParams={params} />
      </Suspense>
    </div>
  )
}

async function PatientsTableLoader({
  searchParams,
}: {
  searchParams: { q?: string; archived?: string }
}) {
  const supabase = await createClient()
  const query = searchParams.q || ''
  const includeArchived = searchParams.archived === 'true'

  let dbQuery = supabase
    .from('patients')
    .select('*')
    .order('updated_at', { ascending: false })

  if (!includeArchived) {
    dbQuery = dbQuery.is('archived_at', null)
  }

  if (query) {
    dbQuery = dbQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`
    )
  }

  const { data: patients, error } = await dbQuery

  if (error) {
    console.error('Error fetching patients:', error)
    return (
      <div className="text-center py-10">
        <p className="text-destructive">Erreur lors du chargement des patients</p>
      </div>
    )
  }

  return <PatientsTable patients={patients || []} />
}

function PatientsTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
