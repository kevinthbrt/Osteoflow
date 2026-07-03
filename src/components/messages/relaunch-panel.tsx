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
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Send, Loader2, Clock, History, UserX } from 'lucide-react'
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

export function RelaunchPanel({ open, onOpenChange }: RelaunchPanelProps) {
  const [months, setMonths] = useState('3')
  const [activeTab, setActiveTab] = useState('not-seen')
  const [notSeen, setNotSeen] = useState<NotSeenPatient[]>([])
  const [relaunched, setRelaunched] = useState<RelaunchedPatient[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sendingPatientId, setSendingPatientId] = useState<string | null>(null)
  const [isBulkSending, setIsBulkSending] = useState(false)
  const [campaign, setCampaign] = useState<CampaignStatus | null>(null)
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
                disabled={isBulkSending || notSeen.length === 0}
              >
                {isBulkSending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-1" />
                )}
                Relancer tous ({notSeen.length})
              </Button>
            </div>

            {campaign && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {campaign.status === 'completed'
                      ? 'Relance terminée'
                      : campaign.status === 'failed'
                      ? 'Échec de la relance'
                      : 'Envoi en cours…'}
                  </span>
                  <span className="text-muted-foreground">{campaign.sent}/{campaign.total}</span>
                </div>
                <Progress value={campaign.total > 0 ? (campaign.sent / campaign.total) * 100 : 0} />
              </div>
            )}

            <div className="flex-1 overflow-y-auto border rounded-lg min-h-[16rem]">
              {isLoading ? (
                <div className="p-2 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : notSeen.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
                  Aucun patient non vu sur cette période
                </div>
              ) : (
                <div className="p-1">
                  {notSeen.map((patient) => (
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
              ) : relaunched.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
                  Aucun patient en attente de retour
                </div>
              ) : (
                <div className="p-1">
                  {relaunched.map((patient) => (
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
