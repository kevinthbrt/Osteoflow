'use client'

import { useState } from 'react'
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
import { FileText, Eye, Download } from 'lucide-react'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { invoiceStatusLabels } from '@/lib/validations/invoice'
import { InvoiceModal } from '@/components/invoices/invoice-modal'

interface InvoiceRow {
  id: string
  invoice_number: string
  amount: number
  status: string
  consultation_date: string
  consultation_id: string
  created_at: string
}

interface Props {
  invoices: InvoiceRow[]
}

export function PatientInvoicesTab({ invoices }: Props) {
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null)

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/50">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm">Aucune facture pour ce patient</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Consultation</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDateTime(invoice.consultation_date)}
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(invoice.amount)}</TableCell>
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
                    {invoiceStatusLabels[invoice.status as keyof typeof invoiceStatusLabels]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setOpenInvoiceId(invoice.id)}
                      title="Voir la facture"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`/api/invoices/${invoice.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Télécharger le PDF"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InvoiceModal invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />
    </>
  )
}
