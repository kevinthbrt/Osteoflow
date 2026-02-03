import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { invoiceStatusLabels } from '@/lib/validations/invoice'
import { Eye, FileText, Calendar } from 'lucide-react'

interface ConsultationsPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function ConsultationsPage({ searchParams }: ConsultationsPageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consultations</h1>
          <p className="text-muted-foreground">
            Historique de toutes vos consultations
          </p>
        </div>
      </div>

      <Suspense fallback={<ConsultationsTableSkeleton />}>
        <ConsultationsTableLoader page={page} />
      </Suspense>
    </div>
  )
}

async function ConsultationsTableLoader({ page }: { page: number }) {
  const db = await createClient()
  const limit = 20
  const offset = (page - 1) * limit

  const { data: consultations, error } = await db
    .from('consultations')
    .select(`
      *,
      patient:patients (id, first_name, last_name),
      invoices (id, invoice_number, amount, status)
    `)
    .is('archived_at', null)
    .order('date_time', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching consultations:', error)
    return (
      <div className="text-center py-10">
        <p className="text-destructive">Erreur lors du chargement des consultations</p>
      </div>
    )
  }

  if (!consultations || consultations.length === 0) {
    return (
      <div className="text-center py-10 border rounded-lg bg-muted/50">
        <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Aucune consultation trouvée</p>
        <p className="text-sm text-muted-foreground">
          Les consultations apparaîtront ici une fois créées depuis la fiche patient
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead>Facture</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consultations.map((consultation: any) => {
            const invoice = consultation.invoices?.[0]
            const patient = consultation.patient as { id: string; first_name: string; last_name: string } | null

            return (
              <TableRow key={consultation.id}>
                <TableCell className="font-medium">
                  {formatDateTime(consultation.date_time)}
                </TableCell>
                <TableCell>
                  {patient ? (
                    <Link
                      href={`/patients/${patient.id}`}
                      className="hover:underline"
                    >
                      {patient.last_name} {patient.first_name}
                    </Link>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {consultation.reason}
                </TableCell>
                <TableCell>
                  {invoice ? (
                    <Link href={`/invoices/${invoice.id}`}>
                      <Badge
                        variant={
                          invoice.status === 'paid'
                            ? 'success'
                            : invoice.status === 'cancelled'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="cursor-pointer"
                      >
                        {invoiceStatusLabels[invoice.status]} -{' '}
                        {formatCurrency(invoice.amount)}
                      </Badge>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/consultations/${consultation.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {invoice && (
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/invoices/${invoice.id}`}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function ConsultationsTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
