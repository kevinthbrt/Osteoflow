import { Suspense } from 'react'
import { createClient } from '@/lib/db/server'
import { PatientsTable } from '@/components/patients/patients-table'
import { PatientSearch } from '@/components/patients/patient-search'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { buildSearchOrFilters } from '@/lib/utils/search'

const PAGE_SIZE = 50

interface PatientsPageProps {
  searchParams: Promise<{ q?: string; archived?: string; page?: string }>
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
  searchParams: { q?: string; archived?: string; page?: string }
}) {
  const db = await createClient()
  const query = searchParams.q || ''
  const includeArchived = searchParams.archived === 'true'
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  // Build base conditions for both count and data queries
  let countQuery = db
    .from('patients')
    .select('*', { count: 'exact', head: true })

  let dbQuery = db
    .from('patients')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(PAGE_SIZE)
    .range(offset, offset + PAGE_SIZE - 1)

  if (!includeArchived) {
    countQuery = countQuery.is('archived_at', null)
    dbQuery = dbQuery.is('archived_at', null)
  }

  if (query) {
    for (const filter of buildSearchOrFilters(query, ['first_name', 'last_name', 'phone', 'email'])) {
      countQuery = countQuery.or(filter)
      dbQuery = dbQuery.or(filter)
    }
  }

  const [{ count }, { data: patients, error }] = await Promise.all([
    countQuery,
    dbQuery,
  ])

  if (error) {
    console.error('Error fetching patients:', error)
    return (
      <div className="text-center py-10">
        <p className="text-destructive">Erreur lors du chargement des patients</p>
      </div>
    )
  }

  const totalCount = count || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <PatientsTable
      patients={patients || []}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  )
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
