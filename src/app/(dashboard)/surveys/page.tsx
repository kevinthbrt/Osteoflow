'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  ClipboardList,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  ThumbsUp,
  RefreshCw,
  MessageSquare,
  Clock,
  CheckCircle2,
} from 'lucide-react'

interface SurveyResponse {
  id: string
  consultation_id: string
  patient_id: string
  practitioner_id: string
  token: string
  status: 'pending' | 'completed' | 'expired'
  overall_rating: number | null
  pain_evolution: 'better' | 'same' | 'worse' | null
  comment: string | null
  would_recommend: boolean | null
  responded_at: string | null
  created_at: string
  synced_at: string | null
}

interface SurveyStats {
  total: number
  completed: number
  pending: number
  avg_rating: number | null
  pain_better: number
  pain_same: number
  pain_worse: number
  would_recommend: number
}

const ratingEmojis = ['', '\u{1F622}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F601}']
const ratingLabels = ['', 'Tr\u00e8s mal', 'Mal', 'Moyen', 'Bien', 'Tr\u00e8s bien']
const painLabels: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  better: { label: 'Am\u00e9lioration', color: 'text-emerald-600 bg-emerald-50', icon: TrendingUp },
  same: { label: 'Pas de changement', color: 'text-amber-600 bg-amber-50', icon: Minus },
  worse: { label: 'D\u00e9t\u00e9rioration', color: 'text-red-600 bg-red-50', icon: TrendingDown },
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<SurveyResponse[]>([])
  const [stats, setStats] = useState<SurveyStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await fetch('/api/surveys')
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
            Retours de vos patients 7 jours apr\u00e8s leur consultation
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">R\u00e9ponses</p>
                  <p className="text-3xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    sur {stats.total} envoy\u00e9(s)
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
                    {stats.avg_rating ? ratingEmojis[Math.round(stats.avg_rating)] : 'Pas encore de donn\u00e9es'}
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
                  <p className="text-sm font-medium text-muted-foreground">Am\u00e9lioration</p>
                  <p className="text-3xl font-bold">
                    {stats.completed > 0
                      ? `${Math.round((stats.pain_better / stats.completed) * 100)}%`
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.pain_better} patient(s) am\u00e9lior\u00e9(s)
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recommandation</p>
                  <p className="text-3xl font-bold">
                    {stats.completed > 0
                      ? `${Math.round((stats.would_recommend / stats.completed) * 100)}%`
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.would_recommend} recommandation(s)
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-violet-50 flex items-center justify-center">
                  <ThumbsUp className="h-6 w-6 text-violet-600" />
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
              Les sondages sont envoy\u00e9s automatiquement avec les emails de suivi J+7.
              Activez le suivi J+7 lors de vos consultations pour commencer \u00e0 recevoir des retours.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending surveys */}
      {pendingSurveys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              En attente de r\u00e9ponse ({pendingSurveys.length})
            </CardTitle>
            <CardDescription>
              Sondages envoy\u00e9s mais pas encore remplis par les patients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingSurveys.slice(0, 10).map(survey => (
                <div
                  key={survey.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                      En attente
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Envoy\u00e9 le {new Date(survey.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              ))}
              {pendingSurveys.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  + {pendingSurveys.length - 10} autre(s)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed survey responses */}
      {completedSurveys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              R\u00e9ponses re\u00e7ues ({completedSurveys.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {completedSurveys.map(survey => {
                const painInfo = survey.pain_evolution ? painLabels[survey.pain_evolution] : null
                const PainIcon = painInfo?.icon || Minus

                return (
                  <div
                    key={survey.id}
                    className="border rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Rating */}
                        <div className="text-2xl">
                          {survey.overall_rating ? ratingEmojis[survey.overall_rating] : ''}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {survey.overall_rating ? ratingLabels[survey.overall_rating] : 'N/A'}
                            <span className="text-muted-foreground font-normal ml-1">
                              ({survey.overall_rating}/5)
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {survey.responded_at
                              ? new Date(survey.responded_at).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Pain evolution badge */}
                        {painInfo && (
                          <Badge variant="outline" className={painInfo.color}>
                            <PainIcon className="h-3 w-3 mr-1" />
                            {painInfo.label}
                          </Badge>
                        )}

                        {/* Recommend badge */}
                        {survey.would_recommend !== null && (
                          <Badge
                            variant="outline"
                            className={
                              survey.would_recommend
                                ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                                : 'text-red-600 bg-red-50 border-red-200'
                            }
                          >
                            <ThumbsUp className={`h-3 w-3 mr-1 ${!survey.would_recommend ? 'rotate-180' : ''}`} />
                            {survey.would_recommend ? 'Recommande' : 'Ne recommande pas'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Comment */}
                    {survey.comment && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm text-muted-foreground italic">
                          &laquo; {survey.comment} &raquo;
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
