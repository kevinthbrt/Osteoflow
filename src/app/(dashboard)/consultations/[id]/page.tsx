import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, User, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { invoiceStatusLabels } from '@/lib/validations/invoice'
import { ConsultationPaymentEditor } from '@/components/consultations/consultation-payment-editor'

interface ConsultationPageProps {
  params: Promise<{ id: string }>
}

export default async function ConsultationPage({ params }: ConsultationPageProps) {
  const { id } = await params
  const db = await createClient()

  const { data: consultation, error } = await db
    .from('consultations')
    .select(`
      *,
      patient:patients (*),
      invoices (
        *,
        payments (*)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !consultation) {
    notFound()
  }

  const patient = consultation.patient as typeof consultation.patient & { id: string; first_name: string; last_name: string; gender: string }
  const invoice = consultation.invoices?.[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={patient ? `/patients/${patient.id}` : '/consultations'}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Consultation du {formatDateTime(consultation.date_time)}
            </h1>
            {patient && (
              <p className="text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                <Link
                  href={`/patients/${patient.id}`}
                  className="hover:underline"
                >
                  {patient.last_name} {patient.first_name}
                </Link>
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/consultations/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
          {invoice && (
            <Button asChild>
              <Link href={`/invoices/${invoice.id}`}>
                <FileText className="mr-2 h-4 w-4" />
                Voir la facture
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date et heure</p>
                  <p className="font-medium">{formatDateTime(consultation.date_time)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Motif</p>
                  <p className="font-medium">{consultation.reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Content */}
          <Card>
            <CardHeader>
              <CardTitle>Contenu clinique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {consultation.anamnesis && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Anamnèse
                  </h4>
                  <p className="text-sm whitespace-pre-wrap">{consultation.anamnesis}</p>
                </div>
              )}
              {consultation.examination && (
                <div>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Examen clinique et manipulations
                  </h4>
                  <p className="text-sm whitespace-pre-wrap">{consultation.examination}</p>
                </div>
              )}
              {consultation.advice && (
                <div>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Conseils donnés
                  </h4>
                  <p className="text-sm whitespace-pre-wrap">{consultation.advice}</p>
                </div>
              )}
              {!consultation.anamnesis && !consultation.examination && !consultation.advice && (
                <p className="text-sm text-muted-foreground italic">
                  Aucun contenu clinique renseigné
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Follow-up Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Suivi</CardTitle>
            </CardHeader>
            <CardContent>
              {consultation.follow_up_7d ? (
                <div className="flex items-center gap-2">
                  {consultation.follow_up_sent_at ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-600">Email envoyé</p>
                        <p className="text-sm text-muted-foreground">
                          Le {formatDateTime(consultation.follow_up_sent_at)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-yellow-600">En attente</p>
                        <p className="text-sm text-muted-foreground">
                          Email prévu J+7
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pas de suivi J+7 prévu
                </p>
              )}
            </CardContent>
          </Card>

          {/* Invoice */}
          {invoice && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Facture
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Numéro</span>
                    <span className="font-mono">{invoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Montant</span>
                    <span className="font-bold">{formatCurrency(invoice.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Statut</span>
                    <Badge
                      variant={
                        invoice.status === 'paid'
                          ? 'success'
                          : invoice.status === 'cancelled'
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {invoiceStatusLabels[invoice.status]}
                    </Badge>
                  </div>
                  <Separator />
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/invoices/${invoice.id}`}>
                      Voir la facture
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <ConsultationPaymentEditor payments={invoice.payments || []} />
            </>
          )}

          {/* Patient Quick Info */}
          {patient && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={patient.gender === 'M' ? 'default' : 'secondary'}>
                    {patient.gender === 'M' ? 'H' : 'F'}
                  </Badge>
                  <span className="font-medium">
                    {patient.last_name} {patient.first_name}
                  </span>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/patients/${patient.id}`}>
                    Voir le dossier
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
