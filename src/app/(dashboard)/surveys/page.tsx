'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  XCircle,
  Activity,
  Gauge,
  ExternalLink,
  Mail,
  Send,
  Loader2,
  CheckCheck,
  Archive,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/db/client'

/* ── Types ─────────────────────────────────────────────────────────────── */

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

interface ScheduledTask {
  id: string
  type: string
  consultation_id: string | null
  scheduled_for: string
  executed_at: string | null
  status: string
  error_message: string | null
  created_at: string
  consultation?: {
    date_time: string
    reason: string
    patient?: {
      first_name: string
      last_name: string
      email: string | null
    }
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

const ratingEmojis = ['', '\u{1F622}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F601}']
const ratingLabels = ['', 'Très mal', 'Mal', 'Moyen', 'Bien', 'Très bien']

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Envoyé</Badge>
    case 'failed':
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Échoué</Badge>
    case 'cancelled':
      return <Badge variant="secondary">Annulé</Badge>
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />En attente</Badge>
  }
}

function typeLabel(type: string) {
  switch (type) {
    case 'follow_up_email': return 'Suivi J+7'
    case 'post_session_advice': return 'Conseils post-séance'
    default: return type
  }
}

/* ── Sondages tab ────────────────────────────────────────────────────────── */

function SurveysTab() {
  const [surveys, setSurveys] = useState<SurveyResponse[]>([])
  const [stats, setStats] = useState<SurveyStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [followUpDays, setFollowUpDays] = useState(7)
  const { toast } = useToast()
  const db = createClient()

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
      toast({ variant: 'destructive', title: 'Pas d\'email', description: 'Ce patient n\'a pas d\'adresse email enregistrée.' })
      return
    }
    setIsSendingEmail(true)
    try {
      const patientName = `${emailTarget.patient.first_name} ${emailTarget.patient.last_name}`
      let conversationId: string | null = null
      const { data: existingConv } = await db.from('conversations').select('id').eq('patient_id', emailTarget.patient.id).limit(1)
      if (existingConv && existingConv.length > 0) {
        conversationId = existingConv[0].id
      } else {
        const { data: newConv, error: convError } = await db
          .from('conversations')
          .insert({ practitioner_id: emailTarget.practitioner_id, patient_id: emailTarget.patient.id, subject: `Suite sondage J+${followUpDays}`, last_message_at: new Date().toISOString(), unread_count: 0 })
          .select('id')
        const convRow = Array.isArray(newConv) ? newConv[0] : newConv
        if (convError || !convRow?.id) throw new Error('Impossible de créer la conversation')
        conversationId = convRow.id
      }
      const response = await fetch('/api/messages/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, patientEmail, patientName, content: emailContent.trim() }),
      })
      if (!response.ok) throw new Error('Échec envoi email')
      toast({ variant: 'success', title: 'Email envoyé', description: `Email envoyé à ${patientName} (${patientEmail})` })
      setEmailDialogOpen(false)
      setEmailTarget(null)
      setEmailContent('')
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible d'envoyer l'email. Vérifiez vos paramètres SMTP." })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleAcknowledge = async (surveyIds: string[]) => {
    try {
      const res = await fetch('/api/surveys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ survey_ids: surveyIds }) })
      if (res.ok) {
        setSurveys(prev => prev.map(s => surveyIds.includes(s.id) ? { ...s, acknowledged_at: new Date().toISOString() } : s))
        toast({ variant: 'success', title: 'Sondage traité', description: surveyIds.length > 1 ? `${surveyIds.length} sondages marqués comme traités` : 'Sondage marqué comme traité' })
      }
    } catch { /* noop */ }
  }

  const handleAcknowledgeAll = async () => {
    try {
      const res = await fetch('/api/surveys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledge_all: true }) })
      if (res.ok) {
        setSurveys(prev => prev.map(s => s.status === 'completed' && !s.acknowledged_at ? { ...s, acknowledged_at: new Date().toISOString() } : s))
        toast({ variant: 'success', title: 'Tous traités', description: 'Tous les sondages ont été marqués comme traités' })
      }
    } catch { /* noop */ }
  }

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await fetch('/api/surveys?limit=30')
      if (res.ok) {
        const data = await res.json()
        setSurveys(data.surveys || [])
        setStats(data.stats || null)
      }
    } catch { /* noop */ } finally { setIsLoading(false) }
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await fetch('/api/surveys/sync', { method: 'POST' })
      await fetchSurveys()
    } catch { /* noop */ } finally { setIsSyncing(false) }
  }

  useEffect(() => { fetchSurveys() }, [fetchSurveys])

  useEffect(() => {
    const client = createClient()
    async function fetchFollowUpDays() {
      try {
        const { data: { user } } = await client.auth.getUser()
        if (!user) return
        const { data } = await client.from('practitioners').select('follow_up_delay_days').eq('user_id', user.id).single()
        if (data && (data as Record<string, unknown>).follow_up_delay_days) setFollowUpDays(Number((data as Record<string, unknown>).follow_up_delay_days))
      } catch { /* noop */ }
    }
    fetchFollowUpDays()
  }, [])

  const completedSurveys = surveys.filter(s => s.status === 'completed')
  const newSurveys = completedSurveys.filter(s => !s.acknowledged_at)
  const acknowledgedSurveys = completedSurveys.filter(s => !!s.acknowledged_at)
  const pendingSurveys = surveys.filter(s => s.status === 'pending')

  if (isLoading) {
    return (
      <div className="space-y-6 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Retours de vos patients {followUpDays} jours après leur consultation</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Synchroniser
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Réponses</p><p className="text-3xl font-bold">{stats.completed}</p><p className="text-xs text-muted-foreground mt-1">sur {stats.total} envoyé(s)</p></div><div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-blue-600" /></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Note moyenne</p><p className="text-3xl font-bold">{stats.avg_rating ? `${stats.avg_rating}/5` : '-'}</p><p className="text-xs text-muted-foreground mt-1">{stats.avg_rating ? ratingEmojis[Math.round(stats.avg_rating)] : 'Pas encore de données'}</p></div><div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center"><Star className="h-6 w-6 text-amber-500" /></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">EVA moyenne</p><p className="text-3xl font-bold">{stats.avg_eva !== null ? `${stats.avg_eva}/10` : '-'}</p><p className="text-xs text-muted-foreground mt-1">Échelle de douleur</p></div><div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center"><Gauge className="h-6 w-6 text-orange-500" /></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Diminution douleur</p><p className="text-3xl font-bold">{stats.completed > 0 ? `${Math.round((stats.pain_reduction / stats.completed) * 100)}%` : '-'}</p><p className="text-xs text-muted-foreground mt-1">{stats.pain_reduction} patient(s)</p></div><div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center"><TrendingDown className="h-6 w-6 text-emerald-600" /></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Meilleure mobilité</p><p className="text-3xl font-bold">{stats.completed > 0 ? `${Math.round((stats.better_mobility / stats.completed) * 100)}%` : '-'}</p><p className="text-xs text-muted-foreground mt-1">{stats.better_mobility} patient(s)</p></div><div className="h-12 w-12 rounded-xl bg-violet-50 flex items-center justify-center"><Activity className="h-6 w-6 text-violet-600" /></div></div></CardContent></Card>
        </div>
      )}

      {surveys.length === 0 && (
        <Card><CardContent className="py-16 text-center"><ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">Aucun sondage pour le moment</h3><p className="text-muted-foreground max-w-md mx-auto">Les sondages sont envoyés automatiquement avec les emails de suivi J+{followUpDays}.</p></CardContent></Card>
      )}

      {newSurveys.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                Nouvelles réponses ({newSurveys.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleAcknowledgeAll}>
                <CheckCheck className="h-4 w-4 mr-2" />Tout marquer comme traité
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {newSurveys.slice(0, 10).map(survey => {
                const hasPainReduction = survey.pain_reduction === true || survey.pain_reduction === 1
                const hasMobility = survey.better_mobility === true || survey.better_mobility === 1
                return (
                  <div key={survey.id} className="border border-primary/20 rounded-xl p-4 space-y-3 bg-primary/[0.02]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{survey.overall_rating ? ratingEmojis[survey.overall_rating] : ''}</div>
                        <div>
                          {survey.patient && <p className="font-semibold text-sm">{survey.patient.first_name} {survey.patient.last_name}</p>}
                          <p className="text-sm text-muted-foreground">
                            {survey.overall_rating ? ratingLabels[survey.overall_rating] : 'N/A'} ({survey.overall_rating}/5)
                            {' '}&middot;{' '}
                            {survey.responded_at ? new Date(survey.responded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {survey.eva_score !== null && survey.eva_score !== undefined && <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">EVA {survey.eva_score}/10</Badge>}
                        {survey.pain_reduction !== null && survey.pain_reduction !== undefined && <Badge variant="outline" className={hasPainReduction ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}>{hasPainReduction ? 'Douleur ↓' : 'Douleur ='}</Badge>}
                        {survey.better_mobility !== null && survey.better_mobility !== undefined && <Badge variant="outline" className={hasMobility ? 'text-violet-600 bg-violet-50 border-violet-200' : 'text-amber-600 bg-amber-50 border-amber-200'}>{hasMobility ? 'Mobilité ↑' : 'Mobilité ='}</Badge>}
                        <Button variant="default" size="sm" onClick={() => handleAcknowledge([survey.id])}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Traité</Button>
                        {survey.patient?.email && <Button variant="outline" size="sm" onClick={() => openEmailDialog(survey)}><Mail className="h-3.5 w-3.5 mr-1" />Email</Button>}
                        <Link href={`/consultations/${survey.consultation_id}`}><Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button></Link>
                      </div>
                    </div>
                    {survey.comment && <p className="text-sm text-muted-foreground italic pl-11">&laquo; {survey.comment} &raquo;</p>}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {acknowledgedSurveys.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Archive className="h-3.5 w-3.5" />Réponses traitées ({acknowledgedSurveys.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/50">
              {acknowledgedSurveys.slice(0, 10).map(survey => (
                <div key={survey.id} className="flex items-center justify-between py-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2.5">
                    <span>{survey.overall_rating ? ratingEmojis[survey.overall_rating] : ''}</span>
                    <span className="font-medium text-foreground/70">{survey.patient ? `${survey.patient.first_name} ${survey.patient.last_name}` : 'Patient'}</span>
                    <span>&middot; {survey.overall_rating}/5</span>
                    {survey.eva_score !== null && survey.eva_score !== undefined && <span>&middot; EVA {survey.eva_score}/10</span>}
                    {survey.comment && <span className="italic truncate max-w-[200px]">&laquo; {survey.comment} &raquo;</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{survey.responded_at ? new Date(survey.responded_at).toLocaleDateString('fr-FR') : ''}</span>
                    {survey.patient?.email && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEmailDialog(survey)}><Mail className="h-3 w-3" /></Button>}
                    <Link href={`/consultations/${survey.consultation_id}`}><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><ExternalLink className="h-3 w-3" /></Button></Link>
                  </div>
                </div>
              ))}
              {acknowledgedSurveys.length > 10 && <p className="text-xs text-muted-foreground text-center pt-2">+ {acknowledgedSurveys.length - 10} autre(s)</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingSurveys.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Clock className="h-3.5 w-3.5" />En attente de réponse ({pendingSurveys.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/50">
              {pendingSurveys.slice(0, 10).map(survey => (
                <div key={survey.id} className="flex items-center justify-between py-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-foreground/70">{survey.patient ? `${survey.patient.first_name} ${survey.patient.last_name}` : 'Patient'}</span>
                    <span>&middot; envoyé le {new Date(survey.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <Link href={`/consultations/${survey.consultation_id}`}><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><ExternalLink className="h-3 w-3" /></Button></Link>
                </div>
              ))}
              {pendingSurveys.length > 10 && <p className="text-xs text-muted-foreground text-center pt-2">+ {pendingSurveys.length - 10} autre(s)</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Envoyer un email</DialogTitle>
            <DialogDescription>
              {emailTarget?.patient && (
                <>Envoyer un email à <strong>{emailTarget.patient.first_name} {emailTarget.patient.last_name}</strong>{emailTarget.patient.email && <span className="text-muted-foreground"> ({emailTarget.patient.email})</span>}{' '}suite à sa réponse au sondage J+{followUpDays}{emailTarget.overall_rating && <span> (note : {emailTarget.overall_rating}/5 {ratingEmojis[emailTarget.overall_rating]})</span>}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {emailTarget && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Résumé du sondage</p>
              {emailTarget.overall_rating && <p>Note globale : {emailTarget.overall_rating}/5 {ratingEmojis[emailTarget.overall_rating]}</p>}
              {emailTarget.eva_score !== null && emailTarget.eva_score !== undefined && <p>Score EVA : {emailTarget.eva_score}/10</p>}
              {emailTarget.comment && <p className="italic text-muted-foreground">&laquo; {emailTarget.comment} &raquo;</p>}
            </div>
          )}
          <div>
            <Textarea placeholder="Écrivez votre message au patient..." value={emailContent} onChange={(e) => setEmailContent(e.target.value)} rows={5} className="resize-none" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={isSendingEmail}>Annuler</Button>
            <Button onClick={handleSendEmail} disabled={!emailContent.trim() || isSendingEmail}>
              {isSendingEmail ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi...</> : <><Send className="h-4 w-4 mr-2" />Envoyer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Emails programmés tab ──────────────────────────────────────────────── */

function ScheduledEmailsTab() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')
  const [search, setSearch] = useState('')
  const db = createClient()

  const loadTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await db.auth.getUser()
      if (!user) return
      const { data: practitioner } = await db.from('practitioners').select('id').eq('user_id', user.id).single()
      if (!practitioner) return
      let query = db
        .from('scheduled_tasks')
        .select(`*, consultation:consultations (date_time, reason, patient:patients (first_name, last_name, email))`)
        .eq('practitioner_id', practitioner.id)
        .order('scheduled_for', { ascending: false })
        .limit(100)
      if (filter !== 'all') query = query.eq('status', filter)
      const { data, error } = await query
      if (!error) setTasks(data || [])
    } catch { /* noop */ } finally { setIsLoading(false) }
  }, [db, filter])

  useEffect(() => { loadTasks() }, [loadTasks])

  const filteredTasks = tasks.filter((task) => {
    if (!search) return true
    const patient = task.consultation?.patient
    if (!patient) return false
    return `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(search.toLowerCase())
  })

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilter('all')}>
          <CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><Mail className="h-4 w-4 text-blue-600" /></div><div><p className="text-2xl font-bold">{counts.all}</p><p className="text-xs text-muted-foreground">Total</p></div></div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilter('pending')}>
          <CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center"><Clock className="h-4 w-4 text-yellow-600" /></div><div><p className="text-2xl font-bold">{counts.pending}</p><p className="text-xs text-muted-foreground">En attente</p></div></div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilter('completed')}>
          <CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-green-600" /></div><div><p className="text-2xl font-bold">{counts.completed}</p><p className="text-xs text-muted-foreground">Envoyés</p></div></div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilter('failed')}>
          <CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center"><XCircle className="h-4 w-4 text-red-600" /></div><div><p className="text-2xl font-bold">{counts.failed}</p><p className="text-xs text-muted-foreground">Échoués</p></div></div></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un patient..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={loadTasks} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filter === 'all' ? 'Tous les emails' : filter === 'pending' ? 'En attente' : filter === 'completed' ? 'Envoyés' : 'Échoués'}</CardTitle>
          <CardDescription>{filteredTasks.length} email(s) programmé(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Mail className="h-12 w-12 mx-auto mb-3 opacity-20" /><p>Aucun email programmé trouvé.</p></div>
          ) : (
            <div className="divide-y">
              {filteredTasks.map((task) => {
                const patient = task.consultation?.patient
                return (
                  <div key={task.id} className="py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{patient ? `${patient.first_name} ${patient.last_name}` : 'Patient inconnu'}</p>
                        {statusBadge(task.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{typeLabel(task.type)}</span>
                        <span>Programmé : {formatDateTime(task.scheduled_for)}</span>
                        {task.executed_at && <span>Exécuté : {formatDateTime(task.executed_at)}</span>}
                      </div>
                      {patient?.email && <p className="text-xs text-muted-foreground mt-0.5">{patient.email}</p>}
                      {task.error_message && <p className="text-xs text-red-500 mt-1">{task.error_message}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function SurveysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suivi patients</h1>
        <p className="text-muted-foreground">Sondages et emails automatiques</p>
      </div>
      <Tabs defaultValue="surveys">
        <TabsList>
          <TabsTrigger value="surveys" className="gap-2">
            <ClipboardList className="h-4 w-4" />Sondages
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />Emails programmés
          </TabsTrigger>
        </TabsList>
        <TabsContent value="surveys"><SurveysTab /></TabsContent>
        <TabsContent value="emails"><ScheduledEmailsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
