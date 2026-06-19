'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/db/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Edit,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Paperclip,
  Image as ImageIcon,
  ClipboardList,
  Gauge,
  TrendingDown,
  Loader2,
  User,
} from 'lucide-react'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { invoiceStatusLabels } from '@/lib/validations/invoice'
import { MarkdownText } from '@/components/ui/markdown-text'
import { AnamnesisDisplay } from '@/components/consultations/anamnesis-display'
import { ConsultationPaymentEditor } from './consultation-payment-editor'
import { ExercisePrescriptionSection } from '@/components/exercises/exercise-prescription-section'

const RATING_EMOJIS = ['', '😢', '😕', '😐', '🙂', '😁']
const RATING_LABELS = ['', 'Très mal', 'Mal', 'Moyen', 'Bien', 'Très bien']

interface Props {
  consultationId: string | null
  onClose: () => void
  onOpenInvoice?: (invoiceId: string) => void
}

export function ConsultationModal({ consultationId, onClose, onOpenInvoice }: Props) {
  const [consultation, setConsultation] = useState<any>(null)
  const [attachments, setAttachments] = useState<any[]>([])
  const [survey, setSurvey] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!consultationId) {
      setConsultation(null)
      return
    }
    setLoading(true)
    const db = createClient()
    Promise.all([
      db.from('consultations')
        .select('*, patient:patients(*), invoices(*, payments(*))')
        .eq('id', consultationId)
        .single(),
      db.from('consultation_attachments')
        .select('*')
        .eq('consultation_id', consultationId)
        .order('created_at'),
      db.from('survey_responses')
        .select('*')
        .eq('consultation_id', consultationId)
        .limit(1),
    ]).then(([{ data: c }, { data: atts }, { data: surveys }]) => {
      setConsultation(c)
      setAttachments(atts || [])
      setSurvey(surveys?.[0] || null)
      setLoading(false)
    })
  }, [consultationId])

  const patient = consultation?.patient
  const invoice = consultation?.invoices?.[0]

  return (
    <Dialog open={!!consultationId} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {loading || !consultation ? (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Chargement de la consultation…</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4 pr-6">
                <div>
                  <DialogTitle className="text-xl">
                    Consultation du {formatDateTime(consultation.date_time)}
                  </DialogTitle>
                  {patient && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {patient.last_name} {patient.first_name}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/communication?consultationId=${consultationId}`}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      Courrier
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/consultations/${consultationId}/edit`}>
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      Modifier
                    </Link>
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-6 lg:grid-cols-3 mt-2">
              {/* Main content (2/3) */}
              <div className="lg:col-span-2 space-y-4">
                {/* General info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Informations générales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Date et heure</p>
                        <p className="font-medium text-sm">{formatDateTime(consultation.date_time)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Motif</p>
                        <p className="font-medium text-sm">{consultation.reason}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Clinical content */}
                {(consultation.anamnesis || consultation.examination || consultation.advice) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Contenu clinique</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(consultation.anamnesis || consultation.anamnesis_sections) && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Anamnèse</h4>
                          <AnamnesisDisplay
                            anamnesis={consultation.anamnesis}
                            anamnesisSections={consultation.anamnesis_sections}
                            reason={consultation.reason}
                          />
                        </div>
                      )}
                      {consultation.examination && (
                        <div>
                          {consultation.anamnesis && <Separator className="mb-4" />}
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Examen clinique et manipulations</h4>
                          <MarkdownText text={consultation.examination} />
                        </div>
                      )}
                      {consultation.advice && (
                        <div>
                          {(consultation.anamnesis || consultation.examination) && <Separator className="mb-4" />}
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Conseils donnés</h4>
                          <MarkdownText text={consultation.advice} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Exercises */}
                {patient && (
                  <ExercisePrescriptionSection
                    patientId={patient.id}
                    patientName={`${patient.first_name} ${patient.last_name}`}
                    consultationId={consultationId!}
                    consultationData={{
                      reason: consultation.reason,
                      anamnesis: consultation.anamnesis,
                      examination: consultation.examination,
                    }}
                  />
                )}

                {/* Attachments */}
                {attachments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Pièces jointes ({attachments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {attachments.map((att: any) => {
                        const ext = att.original_name.split('.').pop()?.toLowerCase() || ''
                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
                        const Icon = isImage ? ImageIcon : FileText
                        const size = att.file_size
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
                            className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm truncate flex-1">{att.original_name}</span>
                            {size && <span className="text-xs text-muted-foreground shrink-0">{size}</span>}
                          </a>
                        )
                      })}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar (1/3) */}
              <div className="space-y-4">
                {/* Follow-up */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Suivi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {consultation.follow_up_7d ? (
                      <div className="flex items-center gap-2">
                        {consultation.follow_up_sent_at ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-green-600">Email envoyé</p>
                              <p className="text-xs text-muted-foreground">Le {formatDateTime(consultation.follow_up_sent_at)}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-yellow-600">En attente</p>
                              <p className="text-xs text-muted-foreground">Email prévu J+7</p>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Pas de suivi J+7 prévu</p>
                    )}
                  </CardContent>
                </Card>

                {/* Survey */}
                {survey?.status === 'completed' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Questionnaire J+7
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                      {survey.overall_rating && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">État général</span>
                          <span className="font-medium">
                            {RATING_EMOJIS[survey.overall_rating]} {RATING_LABELS[survey.overall_rating]}
                          </span>
                        </div>
                      )}
                      {survey.eva_score != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Gauge className="h-3 w-3" /> EVA douleur
                          </span>
                          <span className="font-medium">{survey.eva_score}/10</span>
                        </div>
                      )}
                      {survey.pain_reduction != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> Douleur
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              survey.pain_reduction === true || survey.pain_reduction === 1
                                ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                                : 'text-red-600 border-red-200 bg-red-50'
                            }
                          >
                            {survey.pain_reduction === true || survey.pain_reduction === 1 ? 'Diminuée' : 'Inchangée'}
                          </Badge>
                        </div>
                      )}
                      {survey.comment && (
                        <>
                          <Separator />
                          <p className="text-xs text-muted-foreground italic">« {survey.comment} »</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Invoice */}
                {invoice && (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Facture
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Numéro</span>
                          <span className="font-mono">{invoice.invoice_number}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Montant</span>
                          <span className="font-bold">{formatCurrency(invoice.amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm items-center">
                          <span className="text-muted-foreground">Statut</span>
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
                        {onOpenInvoice && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-1"
                            onClick={() => { onClose(); onOpenInvoice(invoice.id) }}
                          >
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                            Voir la facture complète
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                    <ConsultationPaymentEditor
                      payments={invoice.payments || []}
                      invoiceId={invoice.id}
                      invoiceAmount={invoice.amount}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
