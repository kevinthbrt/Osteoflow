import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, User, FileText, Clock, CheckCircle, AlertCircle, Paperclip, Image as ImageIcon, ClipboardList, Gauge, TrendingDown, Activity } from 'lucide-react'
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

  // Fetch attachments
  const { data: attachments } = await db
    .from('consultation_attachments')
    .select('*')
    .eq('consultation_id', id)
    .order('created_at')

  // Fetch survey response for this consultation
  const { data: surveyResponses } = await db
    .from('survey_responses')
    .select('*')
    .eq('consultation_id', id)
    .limit(1)

  const survey = surveyResponses?.[0] || null

  const ratingEmojis = ['', '\u{1F622}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F601}']
  const ratingLabels = ['', 'Tr\u00e8s mal', 'Mal', 'Moyen', 'Bien', 'Tr\u00e8s bien']

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

          {/* Attachments */}
          {attachments && attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Pièces jointes ({attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attachments.map((att: { id: string; original_name: string; mime_type: string | null; file_size: number | null }) => {
                    const ext = att.original_name.split('.').pop()?.toLowerCase() || ''
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
                    const Icon = isImage ? ImageIcon : FileText
                    const sizeStr = att.file_size
                      ? att.file_size < 1024 * 1024
                        ? `${(att.file_size / 1024).toFixed(1)} Ko`
                        : `${(att.file_size / (1024 * 1024)).toFixed(1)} Mo`
                      : ''
                    return (
                      <a
                        key={att.id}
                        href={`/api/attachments/${att.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate flex-1">{att.original_name}</span>
                        {sizeStr && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">{sizeStr}</span>
                        )}
                      </a>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
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

          {/* Survey Response */}
          {survey && survey.status === 'completed' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  R{'\u00e9'}ponse questionnaire J+7
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Overall rating */}
                {survey.overall_rating && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{'\u00c9'}tat g{'\u00e9'}n{'\u00e9'}ral</span>
                    <span className="font-medium">
                      {ratingEmojis[survey.overall_rating]} {ratingLabels[survey.overall_rating]} ({survey.overall_rating}/5)
                    </span>
                  </div>
                )}

                {/* EVA Score */}
                {survey.eva_score !== null && survey.eva_score !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" /> EVA douleur
                    </span>
                    <span className="font-medium">{survey.eva_score}/10</span>
                  </div>
                )}

                {/* Pain reduction */}
                {survey.pain_reduction !== null && survey.pain_reduction !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="h-3.5 w-3.5" /> Diminution douleur
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        (survey.pain_reduction === true || survey.pain_reduction === 1)
                          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-red-600 bg-red-50 border-red-200'
                      }
                    >
                      {(survey.pain_reduction === true || survey.pain_reduction === 1) ? 'Oui' : 'Non'}
                    </Badge>
                  </div>
                )}

                {/* Better mobility */}
                {survey.better_mobility !== null && survey.better_mobility !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" /> Meilleure mobilit{'\u00e9'}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        (survey.better_mobility === true || survey.better_mobility === 1)
                          ? 'text-violet-600 bg-violet-50 border-violet-200'
                          : 'text-amber-600 bg-amber-50 border-amber-200'
                      }
                    >
                      {(survey.better_mobility === true || survey.better_mobility === 1) ? 'Oui' : 'Non'}
                    </Badge>
                  </div>
                )}

                {/* Comment */}
                {survey.comment && (
                  <>
                    <Separator />
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground italic">
                        &laquo; {survey.comment} &raquo;
                      </p>
                    </div>
                  </>
                )}

                {/* Response date */}
                {survey.responded_at && (
                  <p className="text-xs text-muted-foreground">
                    R{'\u00e9'}pondu le {new Date(survey.responded_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Survey pending */}
          {survey && survey.status === 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Questionnaire J+7
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <p className="text-sm text-muted-foreground">En attente de r{'\u00e9'}ponse du patient</p>
                </div>
              </CardContent>
            </Card>
          )}

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
