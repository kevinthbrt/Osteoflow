'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ClipboardList,
  Star,
  TrendingDown,
  RefreshCw,
  MessageSquare,
  Clock,
  CheckCircle2,
  Activity,
  Gauge,
  ExternalLink,
  Mail,
  Send,
  Loader2,
  CheckCheck,
  Archive,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/db/client'

interface SurveyResponse {
  id: string
  consultation_id: string
  patient_id: string
  practitioner_id: string
  token: string
  status: 'pending' | 'completed' | 'expired'
  overall_rating: number | null
  eva_score: number | null
  pain_reduction: boolean | number | null
  better_mobility: boolean | number | null
  pain_evolution: 'better' | 'same' | 'worse' | null
  comment: string | null
  would_recommend: boolean | null
  responded_at: string | null
  created_at: string
  synced_at: string | null
  acknowledged_at: string | null
  patient?: {
    id: string
    first_name: string
    last_name: string
    email?: string | null
  } | null
}

interface SurveyStats {
  total: number
  completed: number
  pending: number
  avg_rating: number | null
  avg_eva: number | null
  pain_reduction: number
  better_mobility: number
  pain_better: number
  pain_same: number
  pain_worse: number
  would_recommend: number
}

const ratingEmojis = ['', '\u{1F622}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F601}']
const ratingLabels = ['', 'Très mal', 'Mal', 'Moyen', 'Bien', 'Très bien']

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<SurveyResponse[]>([])
  const [stats, setStats] = useState<SurveyStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const { toast } = useToast()
  const db = createClient()

  // Email dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailTarget, setEmailTarget] = useState<SurveyResponse | null>(null)
  const [emailContent, setEmailContent] = useState('')
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  const openEmailDialog = (survey: SurveyResponse) => {
    setEmailTarget(survey)
    setEmailContent('')
    setEmailDialogOpen(true)
  }

  const handleSendEmail = async () => {
    if (!emailTarget?.patient || !emailContent.trim()) return

    const patientEmail = emailTarget.patient.email
    if (!patientEmail) {
      toast({
        variant: 'destructive',
        title: 'Pas d\'email',
        description: 'Ce patient n\'a pas d\'adresse email enregistrée.',
      })
      return
    }

    setIsSendingEmail(true)
    try {
      // Find or create conversation for this patient
      const patientName = `${emailTarget.patient.first_name} ${emailTarget.patient.last_name}`

      let conversationId: string | null = null

      // Look for existing conversation
      const { data: existingConv } = await db
        .from('conversations')
        .select('id')
        .eq('patient_id', emailTarget.patient.id)
        .limit(1)

      if (existingConv && existingConv.length > 0) {
        conversationId = existingConv[0].id
      } else {
        // Create conversation (use practitioner_id from the survey)
        const { data: newConv, error: convError } = await db
          .from('conversations')
          .insert({
            practitioner_id: emailTarget.practitioner_id,
            patient_id: emailTarget.patient.id,
            subject: `Suite sondage J+7`,
            last_message_at: new Date().toISOString(),
            unread_count: 0,
          })
          .select('id')

        if (convError || !newConv || newConv.length === 0) {
          throw new Error('Impossible de créer la conversation')
        }
        conversationId = newConv[0].id
      }

      // Send email via API
      const response = await fetch('/api/messages/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          patientEmail,
          patientName,
          content: emailContent.trim(),
        }),
      })

      if (!response.ok) throw new Error('Échec envoi email')

      toast({
        variant: 'success',
        title: 'Email envoyé',
        description: `Email envoyé à ${patientName} (${patientEmail})`,
      })
      setEmailDialogOpen(false)
      setEmailTarget(null)
      setEmailContent('')
    } catch (error) {
      console.error('Error sending email:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'envoyer l'email. Vérifiez vos paramètres SMTP.",
      })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleAcknowledge = async (surveyIds: string[]) => {
    try {
      const res = await fetch('/api/surveys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survey_ids: surveyIds }),
      })
      if (res.ok) {
        setSurveys(prev =>
          prev.map(s =>
            surveyIds.includes(s.id)
              ? { ...s, acknowledged_at: new Date().toISOString() }
              : s
          )
        )
        toast({
          variant: 'success',
          title: 'Sondage traité',
          description: surveyIds.length > 1
            ? `${surveyIds.length} sondages marqués comme traités`
            : 'Sondage marqué comme traité',
        })
      }
    } catch (error) {
      console.error('Error acknowledging surveys:', error)
    }
  }

  const handleAcknowledgeAll = async () => {
    try {
      const res = await fetch('/api/surveys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledge_all: true }),
      })
      if (res.ok) {
        setSurveys(prev =>
          prev.map(s =>
            s.status === 'completed' && !s.acknowledged_at
              ? { ...s, acknowledged_at: new Date().toISOString() }
              : s
          )
        )
        toast({
          variant: 'success',
          title: 'Tous traités',
          description: 'Tous les sondages ont été marqués comme traités',
        })
      }
    } catch (error) {
      console.error('Error acknowledging all surveys:', error)
    }
  }

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await fetch('/api/surveys?limit=30')
      if (res.ok) {
        const data = await res.json()
        setSurveys(data.surveys || [])
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Error fetching surveys:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await fetch('/api/surveys/sync', { method: 'POST' })
      await fetchSurveys()
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    fetchSurveys()
  }, [fetchSurveys])

  const completedSurveys = surveys.filter(s => s.status === 'completed')
  const newSurveys = completedSurveys.filter(s => !s.acknowledged_at)
  const acknowledgedSurveys = completedSurveys.filter(s => !!s.acknowledged_at)
  const pendingSurveys = surveys.filter(s => s.status === 'pending')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sondages J+7</h1>
          <p className="text-muted-foreground">
            Retours de vos patients 7 jours après leur consultation
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Synchroniser
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Réponses</p>
                  <p className="text-3xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    sur {stats.total} envoyé(s)
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Note moyenne</p>
                  <p className="text-3xl font-bold">
                    {stats.avg_rating ? `${stats.avg_rating}/5` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.avg_rating ? ratingEmojis[Math.round(stats.avg_rating)] : 'Pas encore de données'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Star className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">EVA moyenne</p>
                  <p className="text-3xl font-bold">
                    {stats.avg_eva !== null ? `${stats.avg_eva}/10` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Échelle de douleur
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Gauge className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Diminution douleur</p>
                  <p className="text-3xl font-bold">
                    {stats.completed > 0
                      ? `${Math.round((stats.pain_reduction / stats.completed) * 100)}%`
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.pain_reduction} patient(s)
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Meilleure mobilité</p>
                  <p className="text-3xl font-bold">
                    {stats.completed > 0
                      ? `${Math.round((stats.better_mobility / stats.completed) * 100)}%`
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.better_mobility} patient(s)
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {surveys.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun sondage pour le moment</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Les sondages sont envoyés automatiquement avec les emails de suivi J+7.
              Activez le suivi J+7 lors de vos consultations pour commencer à recevoir des retours.
            </p>
          </CardContent>
        </Card>
      )}

      {/* New (unacknowledged) survey responses — shown first */}
      {newSurveys.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                Nouvelles réponses ({newSurveys.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcknowledgeAll}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Tout marquer comme traité
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {newSurveys.slice(0, 10).map(survey => {
                const hasPainReduction = survey.pain_reduction === true || survey.pain_reduction === 1
                const hasMobility = survey.better_mobility === true || survey.better_mobility === 1

                return (
                  <div
                    key={survey.id}
                    className="border border-primary/20 rounded-xl p-4 space-y-3 bg-primary/[0.02]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">
                          {survey.overall_rating ? ratingEmojis[survey.overall_rating] : ''}
                        </div>
                        <div>
                          {survey.patient && (
                            <p className="font-semibold text-sm">
                              {survey.patient.first_name} {survey.patient.last_name}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {survey.overall_rating ? ratingLabels[survey.overall_rating] : 'N/A'}
                            {' '}({survey.overall_rating}/5)
                            {' '}&middot;{' '}
                            {survey.responded_at
                              ? new Date(survey.responded_at).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                })
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {survey.eva_score !== null && survey.eva_score !== undefined && (
                          <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                            EVA {survey.eva_score}/10
                          </Badge>
                        )}

                        {survey.pain_reduction !== null && survey.pain_reduction !== undefined && (
                          <Badge
                            variant="outline"
                            className={hasPainReduction
                              ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                              : 'text-red-600 bg-red-50 border-red-200'
                            }
                          >
                            {hasPainReduction ? 'Douleur \u2193' : 'Douleur ='}
                          </Badge>
                        )}

                        {survey.better_mobility !== null && survey.better_mobility !== undefined && (
                          <Badge
                            variant="outline"
                            className={hasMobility
                              ? 'text-violet-600 bg-violet-50 border-violet-200'
                              : 'text-amber-600 bg-amber-50 border-amber-200'
                            }
                          >
                            {hasMobility ? 'Mobilité \u2191' : 'Mobilité ='}
                          </Badge>
                        )}

                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAcknowledge([survey.id])}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Traité
                        </Button>

                        {survey.patient?.email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEmailDialog(survey)}
                          >
                            <Mail className="h-3.5 w-3.5 mr-1" />
                            Email
                          </Button>
                        )}

                        <Link href={`/consultations/${survey.consultation_id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {survey.comment && (
                      <p className="text-sm text-muted-foreground italic pl-11">
                        &laquo; {survey.comment} &raquo;
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acknowledged (archived) — compact table */}
      {acknowledgedSurveys.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Archive className="h-3.5 w-3.5" />
              Réponses traitées ({acknowledgedSurveys.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/50">
              {acknowledgedSurveys.slice(0, 10).map(survey => (
                <div
                  key={survey.id}
                  className="flex items-center justify-between py-2 text-sm text-muted-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <span>{survey.overall_rating ? ratingEmojis[survey.overall_rating] : ''}</span>
                    <span className="font-medium text-foreground/70">
                      {survey.patient ? `${survey.patient.first_name} ${survey.patient.last_name}` : 'Patient'}
                    </span>
                    <span>&middot; {survey.overall_rating}/5</span>
                    {survey.eva_score !== null && survey.eva_score !== undefined && (
                      <span>&middot; EVA {survey.eva_score}/10</span>
                    )}
                    {survey.comment && (
                      <span className="italic truncate max-w-[200px]">&laquo; {survey.comment} &raquo;</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">
                      {survey.responded_at
                        ? new Date(survey.responded_at).toLocaleDateString('fr-FR')
                        : ''}
                    </span>
                    {survey.patient?.email && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEmailDialog(survey)}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    )}
                    <Link href={`/consultations/${survey.consultation_id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {acknowledgedSurveys.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  + {acknowledgedSurveys.length - 10} autre(s)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending surveys — compact table */}
      {pendingSurveys.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              En attente de réponse ({pendingSurveys.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/50">
              {pendingSurveys.slice(0, 10).map(survey => (
                <div
                  key={survey.id}
                  className="flex items-center justify-between py-2 text-sm text-muted-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-foreground/70">
                      {survey.patient ? `${survey.patient.first_name} ${survey.patient.last_name}` : 'Patient'}
                    </span>
                    <span>&middot; envoyé le {new Date(survey.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <Link href={`/consultations/${survey.consultation_id}`}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
              {pendingSurveys.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  + {pendingSurveys.length - 10} autre(s)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Envoyer un email
            </DialogTitle>
            <DialogDescription>
              {emailTarget?.patient && (
                <>
                  Envoyer un email à <strong>{emailTarget.patient.first_name} {emailTarget.patient.last_name}</strong>
                  {emailTarget.patient.email && (
                    <span className="text-muted-foreground"> ({emailTarget.patient.email})</span>
                  )}
                  {' '}suite à sa réponse au sondage J+7
                  {emailTarget.overall_rating && (
                    <span> (note : {emailTarget.overall_rating}/5 {ratingEmojis[emailTarget.overall_rating]})</span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Survey summary */}
          {emailTarget && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Résumé du sondage</p>
              {emailTarget.overall_rating && (
                <p>Note globale : {emailTarget.overall_rating}/5 {ratingEmojis[emailTarget.overall_rating]}</p>
              )}
              {emailTarget.eva_score !== null && emailTarget.eva_score !== undefined && (
                <p>Score EVA : {emailTarget.eva_score}/10</p>
              )}
              {emailTarget.comment && (
                <p className="italic text-muted-foreground">&laquo; {emailTarget.comment} &raquo;</p>
              )}
            </div>
          )}

          <div>
            <Textarea
              placeholder="Écrivez votre message au patient..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={isSendingEmail}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={!emailContent.trim() || isSendingEmail}
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
