'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Send, Loader2, Clock, History, UserX, Search, X, CalendarClock } from 'lucide-react'
import { getInitials, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface RelaunchPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NotSeenPatient {
  id: string
  first_name: string
  last_name: string
  email: string
  lastConsultationDate: string | null
  daysSinceLastConsultation: number | null
}

interface RelaunchedPatient {
  id: string
  first_name: string
  last_name: string
  email: string
  lastConsultationDate: string | null
  lastRelaunchSentAt: string
  relaunchCount: number
  daysSinceRelaunch: number
}

interface CampaignStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  total: number
  sent: number
  failed: number
  dailyLimitReached?: boolean
}

const PERIOD_OPTIONS = [
  { value: '1', label: '1 mois' },
  { value: '2', label: '2 mois' },
  { value: '3', label: '3 mois' },
  { value: '4', label: '4 mois' },
  { value: '5', label: '5 mois' },
  { value: '6', label: '6 mois' },
  { value: '12', label: '1 an' },
]

function matchesSearch(patient: { first_name: string; last_name: string }, query: string): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(q)
}

export function RelaunchPanel({ open, onOpenChange }: RelaunchPanelProps) {
  const [months, setMonths] = useState('3')
  const [activeTab, setActiveTab] = useState('not-seen')
  const [notSeen, setNotSeen] = useState<NotSeenPatient[]>([])
  const [relaunched, setRelaunched] = useState<RelaunchedPatient[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sendingPatientId, setSendingPatientId] = useState<string | null>(null)
  const [isBulkSending, setIsBulkSending] = useState(false)
  const [campaign, setCampaign] = useState<CampaignStatus | null>(null)
  const [deduplicated, setDeduplicated] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [sinceDate, setSinceDate] = useState('')
  const [isSavingSinceDate, setIsSavingSinceDate] = useState(false)
  const [dailyLimit, setDailyLimit] = useState(450)
  const { toast } = useToast()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/messages/relaunch/candidates?months=${months}`)
      const data = await res.json()
      if (res.ok) {
        setNotSeen(data.notSeen || [])
        setRelaunched(data.relaunched || [])
        setSinceDate(data.sinceDate || '')
        if (data.dailyLimit) setDailyLimit(data.dailyLimit)
      }
    } catch (error) {
      console.error('Error fetching relaunch candidates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [months])

  useEffect(() => {
    if (open) fetchCandidates()
  }, [open, fetchCandidates])

  useEffect(() => {
    if (!open) setSearchQuery('')
  }, [open])

  const filteredNotSeen = notSeen.filter((p) => matchesSearch(p, searchQuery))
  const filteredRelaunched = relaunched.filter((p) => matchesSearch(p, searchQuery))

  const handleSinceDateChange = async (value: string) => {
    setSinceDate(value)
    setIsSavingSinceDate(true)
    try {
      const res = await fetch('/api/messages/relaunch/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sinceDate: value || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ variant: 'destructive', title: 'Erreur', description: data.error || 'Impossible d\'enregistrer la date' })
        return
      }
      fetchCandidates()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer la date' })
    } finally {
      setIsSavingSinceDate(false)
    }
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const pollCampaign = useCallback((campaignId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages/campaigns/${campaignId}`)
        const data = await res.json()
        if (!res.ok) return
        setCampaign(data)
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          if (pollRef.current) clearInterval(pollRef.current)
          setIsBulkSending(false)
          if (data.status === 'completed') {
            toast({
              variant: 'success',
              title: 'Relance envoyée',
              description: `${data.sent}/${data.total} email(s) envoyé(s)${data.failed ? `, ${data.failed} échec(s)` : ''}`,
            })
          }
          fetchCandidates()
        } else if (data.dailyLimitReached) {
          // Gmail's daily cap is reached — stop polling for now, sending
          // resumes automatically tomorrow via the background cron.
          if (pollRef.current) clearInterval(pollRef.current)
          setIsBulkSending(false)
        }
      } catch (error) {
        console.error('Error polling campaign:', error)
      }
    }, 1500)
  }, [fetchCandidates, toast])

  const handleSendOne = async (patientId: string) => {
    setSendingPatientId(patientId)
    try {
      const res = await fetch('/api/messages/relaunch/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erreur', description: data.error || "Erreur lors de l'envoi" })
      } else {
        toast({ variant: 'success', title: 'Relance envoyée' })
        fetchCandidates()
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'envoyer la relance' })
    } finally {
      setSendingPatientId(null)
    }
  }

  // On opening the panel, check whether a relaunch campaign is already in
  // flight (e.g. paused for the day, from before a page reload/app restart)
  // — otherwise this looks like nothing is happening and a fresh click could
  // start a duplicate campaign on top of the one still running server-side.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/messages/campaigns/active')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const active = data.campaign
        if (active && active.type === 'relaunch') {
          setCampaign(active)
          if (!active.dailyLimitReached) {
            setIsBulkSending(true)
            pollCampaign(active.id)
          }
        }
      })
      .catch((error) => console.error('Error checking active relaunch campaign:', error))
    return () => {
      cancelled = true
    }
  }, [open, pollCampaign])

  // A campaign paused for the day (Gmail's daily cap) is no longer "isBulkSending"
  // (polling stopped) but still has recipients left — don't let a fresh click
  // start a second, duplicate campaign on top of it.
  const hasUnfinishedCampaign = Boolean(
    campaign && !['completed', 'failed', 'cancelled'].includes(campaign.status)
  )

  const handleSendBulk = async () => {
    setIsBulkSending(true)
    setCampaign(null)
    try {
      const res = await fetch('/api/messages/relaunch/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: Number(months) }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erreur', description: data.error || 'Erreur lors du lancement' })
        setIsBulkSending(false)
        return
      }
      setCampaign({ id: data.campaignId, status: 'pending', total: data.total, sent: 0, failed: 0 })
      setDeduplicated(data.deduplicated || 0)
      pollCampaign(data.campaignId)
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de lancer la relance' })
      setIsBulkSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-primary" />
            Relances patients
          </DialogTitle>
          <DialogDescription>
            Retrouvez vos patients qui ne sont pas venus depuis longtemps et invitez-les à reprendre rendez-vous.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un patient par nom..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground whitespace-nowrap">Ignorer les patients vus avant le</span>
            <Input
              type="date"
              value={sinceDate}
              onChange={(e) => handleSinceDateChange(e.target.value)}
              className="w-40 h-8"
              disabled={isSavingSinceDate}
            />
            {sinceDate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => handleSinceDateChange('')}
                disabled={isSavingSinceDate}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Utile après un changement de cabinet, pour ne pas relancer des patients d&apos;une adresse précédente. Ce réglage est mémorisé.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="not-seen" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              À relancer ({notSeen.length})
            </TabsTrigger>
            <TabsTrigger value="relaunched" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Déjà relancés ({relaunched.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="not-seen" className="flex-1 flex flex-col min-h-0 mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Non vus depuis</span>
              <Select value={months} onValueChange={setMonths}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="ml-auto"
                onClick={handleSendBulk}
                disabled={isBulkSending || hasUnfinishedCampaign || notSeen.length === 0}
              >
                {isBulkSending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-1" />
                )}
                Relancer tous ({notSeen.length})
              </Button>
            </div>

            {!campaign && notSeen.length > dailyLimit && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Gmail limite l&apos;envoi à {dailyLimit} emails par jour : la relance de ces {notSeen.length} patients prendra environ{' '}
                {Math.ceil(notSeen.length / dailyLimit)} jours. Pensez à garder l&apos;application ouverte chaque jour pour que l&apos;envoi progresse.
              </p>
            )}

            {campaign && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {campaign.status === 'completed'
                      ? 'Relance terminée'
                      : campaign.status === 'failed'
                      ? 'Échec de la relance'
                      : campaign.dailyLimitReached
                      ? 'En pause — limite quotidienne atteinte'
                      : 'Envoi en cours…'}
                  </span>
                  <span className="text-muted-foreground">{campaign.sent}/{campaign.total}</span>
                </div>
                <Progress value={campaign.total > 0 ? (campaign.sent / campaign.total) * 100 : 0} />
                {campaign.dailyLimitReached && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Gmail limite l&apos;envoi à 450 emails par jour. Il reste {campaign.total - campaign.sent - campaign.failed} patient(s) à relancer — l&apos;envoi reprendra automatiquement demain jusqu&apos;à ce que tout le monde soit contacté.
                  </p>
                )}
                {deduplicated > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {deduplicated} patient{deduplicated > 1 ? 's' : ''} partage{deduplicated > 1 ? 'nt' : ''} une adresse email avec un autre — un seul email envoyé par adresse.
                  </p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto border rounded-lg min-h-[16rem]">
              {isLoading ? (
                <div className="p-2 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : filteredNotSeen.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
                  {notSeen.length === 0 ? 'Aucun patient non vu sur cette période' : 'Aucun patient ne correspond à la recherche'}
                </div>
              ) : (
                <div className="p-1">
                  {filteredNotSeen.map((patient) => (
                    <div key={patient.id} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(patient.first_name, patient.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{patient.first_name} {patient.last_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          Vu(e) le {patient.lastConsultationDate ? formatDate(patient.lastConsultationDate) : '—'}
                          {patient.daysSinceLastConsultation != null && (
                            <> · il y a {patient.daysSinceLastConsultation} jours</>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendOne(patient.id)}
                        disabled={sendingPatientId === patient.id || isBulkSending}
                        className="flex-shrink-0"
                      >
                        {sendingPatientId === patient.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-1" />
                            Relancer
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="relaunched" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="flex-1 overflow-y-auto border rounded-lg min-h-[16rem]">
              {isLoading ? (
                <div className="p-2 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : filteredRelaunched.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
                  {relaunched.length === 0 ? 'Aucun patient en attente de retour' : 'Aucun patient ne correspond à la recherche'}
                </div>
              ) : (
                <div className="p-1">
                  {filteredRelaunched.map((patient) => (
                    <div key={patient.id} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {getInitials(patient.first_name, patient.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{patient.first_name} {patient.last_name}</p>
                          <Badge variant="secondary" className="flex-shrink-0">
                            {patient.relaunchCount} relance{patient.relaunchCount > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          Relancé(e) le {formatDate(patient.lastRelaunchSentAt)} · il y a {patient.daysSinceRelaunch} jours
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendOne(patient.id)}
                        disabled={sendingPatientId === patient.id || isBulkSending}
                        className="flex-shrink-0"
                      >
                        {sendingPatientId === patient.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-1" />
                            Relancer à nouveau
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
