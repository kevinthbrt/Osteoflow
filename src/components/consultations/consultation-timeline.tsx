'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { invoiceStatusLabels } from '@/lib/validations/invoice'
import { FileText, Edit, Eye, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import type { Consultation, Invoice } from '@/types/database'

interface ConsultationWithInvoice extends Consultation {
  invoices: Invoice[] | null
}

interface ConsultationTimelineProps {
  consultations: ConsultationWithInvoice[]
  patientId: string
}

export function ConsultationTimeline({
  consultations,
  patientId,
}: ConsultationTimelineProps) {
  if (consultations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Aucune consultation enregistrée
        </p>
        <Button asChild>
          <Link href={`/patients/${patientId}/consultation/new`}>
            Ajouter la première consultation
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {consultations.map((consultation, index) => {
        const invoice = consultation.invoices?.[0]

        return (
          <div key={consultation.id} className="relative">
            {/* Timeline line */}
            {index < consultations.length - 1 && (
              <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-border" />
            )}

            <div className="flex gap-4">
              {/* Timeline dot */}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Clock className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">{formatDateTime(consultation.date_time)}</p>
                    <p className="text-sm text-muted-foreground">
                      {consultation.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {consultation.follow_up_7d && (
                      <Badge variant={consultation.follow_up_sent_at ? 'success' : 'warning'}>
                        {consultation.follow_up_sent_at ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Suivi envoyé
                          </>
                        ) : (
                          <>
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Suivi J+7
                          </>
                        )}
                      </Badge>
                    )}
                    {invoice && (
                      <Badge
                        variant={
                          invoice.status === 'paid'
                            ? 'success'
                            : invoice.status === 'cancelled'
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        {invoiceStatusLabels[invoice.status]} -{' '}
                        {formatCurrency(invoice.amount)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  {consultation.anamnesis && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Anamnèse
                      </p>
                      <p className="text-sm whitespace-pre-wrap line-clamp-3">
                        {consultation.anamnesis}
                      </p>
                    </div>
                  )}
                  {consultation.examination && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Examen / Manipulations
                      </p>
                      <p className="text-sm whitespace-pre-wrap line-clamp-3">
                        {consultation.examination}
                      </p>
                    </div>
                  )}
                  {consultation.advice && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Conseils
                      </p>
                      <p className="text-sm whitespace-pre-wrap line-clamp-3">
                        {consultation.advice}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/consultations/${consultation.id}`}>
                      <Eye className="mr-1 h-3 w-3" />
                      Voir
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/consultations/${consultation.id}/edit`}>
                      <Edit className="mr-1 h-3 w-3" />
                      Modifier
                    </Link>
                  </Button>
                  {invoice && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/invoices/${invoice.id}`}>
                        <FileText className="mr-1 h-3 w-3" />
                        Facture
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
