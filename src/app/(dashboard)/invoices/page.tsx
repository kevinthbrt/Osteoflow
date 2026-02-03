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
import { formatDate, formatCurrency } from '@/lib/utils'
import { invoiceStatusLabels } from '@/lib/validations/invoice'
import { Eye, Download, FileText } from 'lucide-react'

interface InvoicesPageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Factures</h1>
          <p className="text-muted-foreground">
            Gérez vos factures et paiements
          </p>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!params.status ? 'default' : 'outline'}
          size="sm"
          asChild
        >
          <Link href="/invoices">Toutes</Link>
        </Button>
        <Button
          variant={params.status === 'paid' ? 'default' : 'outline'}
          size="sm"
          asChild
        >
          <Link href="/invoices?status=paid">Payées</Link>
        </Button>
        <Button
          variant={params.status === 'issued' ? 'default' : 'outline'}
          size="sm"
          asChild
        >
          <Link href="/invoices?status=issued">Émises</Link>
        </Button>
        <Button
          variant={params.status === 'draft' ? 'default' : 'outline'}
          size="sm"
          asChild
        >
          <Link href="/invoices?status=draft">Brouillons</Link>
        </Button>
        <Button
          variant={params.status === 'cancelled' ? 'default' : 'outline'}
          size="sm"
          asChild
        >
          <Link href="/invoices?status=cancelled">Annulées</Link>
        </Button>
      </div>

      <Suspense fallback={<InvoicesTableSkeleton />}>
        <InvoicesTableLoader status={params.status} />
      </Suspense>
    </div>
  )
}

async function InvoicesTableLoader({ status }: { status?: string }) {
  const db = await createClient()

  let query = db
    .from('invoices')
    .select(`
      *,
      consultation:consultations (
        id,
        date_time,
        patient:patients (id, first_name, last_name)
      ),
      payments (*)
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data: invoices, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    return (
      <div className="text-center py-10">
        <p className="text-destructive">Erreur lors du chargement des factures</p>
      </div>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="text-center py-10 border rounded-lg bg-muted/50">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Aucune facture trouvée</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numéro</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice: any) => {
            const consultation = invoice.consultation as {
              id: string
              date_time: string
              patient: { id: string; first_name: string; last_name: string } | null
            } | null
            const patient = consultation?.patient

            return (
              <TableRow key={invoice.id}>
                <TableCell className="font-mono font-medium">
                  {invoice.invoice_number}
                </TableCell>
                <TableCell>
                  {invoice.issued_at ? formatDate(invoice.issued_at) : '-'}
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
                <TableCell className="font-medium">
                  {formatCurrency(invoice.amount)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      invoice.status === 'paid'
                        ? 'success'
                        : invoice.status === 'cancelled'
                        ? 'destructive'
                        : invoice.status === 'issued'
                        ? 'default'
                        : 'outline'
                    }
                  >
                    {invoiceStatusLabels[invoice.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/invoices/${invoice.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`/api/invoices/${invoice.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
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

function InvoicesTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
