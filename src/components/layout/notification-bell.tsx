'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Bell,
  Mail,
  ClipboardList,
  Download,
  RefreshCw,
  X,
  CheckCheck,
} from 'lucide-react'

interface ElectronAPI {
  isDesktop: boolean
  platform: string
  onUpdateAvailable: (callback: (version: string) => void) => void
  onUpdateProgress: (callback: (percent: number) => void) => void
  onUpdateDownloaded: (callback: (version: string) => void) => void
  installUpdate: () => void
  onSurveySynced?: (callback: (count: number) => void) => void
  onInboxSynced?: (callback: (count: number) => void) => void
}

interface SurveyNotification {
  id: string
  patient_name: string
  patient_id: string
  overall_rating: number | null
  responded_at: string
  consultation_id: string
}

interface MailNotification {
  conversationId: string
  contactName: string
  unreadCount: number
  lastMessageAt: string
}

type UpdateState = 'idle' | 'downloading' | 'ready'

interface UpdateNotification {
  state: UpdateState
  version: string
  progress: number
}

const ratingEmojis = ['', '\u{1F622}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F601}']

export function NotificationBell() {
  const router = useRouter()
  const db = createClient()
  const [open, setOpen] = useState(false)

  // Mail notifications
  const [mailNotifs, setMailNotifs] = useState<MailNotification[]>([])

  // Survey notifications
  const [surveyNotifs, setSurveyNotifs] = useState<SurveyNotification[]>([])

  // Update notification
  const [updateNotif, setUpdateNotif] = useState<UpdateNotification>({
    state: 'idle',
    version: '',
    progress: 0,
  })

  // Ephemeral toast
  const [ephemeralMessage, setEphemeralMessage] = useState<string | null>(null)
  const ephemeralTimer = useRef<NodeJS.Timeout | null>(null)

  // Track previously seen survey IDs to detect new ones
  const prevSurveyIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)

  const showEphemeral = useCallback((message: string) => {
    setEphemeralMessage(message)
    if (ephemeralTimer.current) clearTimeout(ephemeralTimer.current)
    ephemeralTimer.current = setTimeout(() => {
      setEphemeralMessage(null)
    }, 4000)
  }, [])

  // Fetch mail notifications (unread conversations)
  const fetchMailNotifs = useCallback(async () => {
    const { data, error } = await db
      .from('conversations')
      .select('id, patient_id, unread_count, last_message_at, external_name, external_email, patient:patients (id, first_name, last_name)')
      .isNot('patient_id', null)
      .gt('unread_count', 0)
      .order('last_message_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching mail notifs:', error)
      return
    }

    const notifs: MailNotification[] = (data || []).map((conv: any) => {
      const patient = Array.isArray(conv.patient) ? conv.patient[0] : conv.patient
      return {
        conversationId: conv.id,
        contactName: patient
          ? `${patient.first_name} ${patient.last_name}`
          : conv.external_name || conv.external_email || 'Contact',
        unreadCount: conv.unread_count,
        lastMessageAt: conv.last_message_at,
      }
    })
    setMailNotifs(notifs)
  }, [db])

  // Fetch survey notifications (recently completed surveys, not yet acknowledged)
  const fetchSurveyNotifs = useCallback(async () => {
    const { data, error } = await db
      .from('survey_responses')
      .select('id, overall_rating, responded_at, consultation_id, patient_id, patient:patients (id, first_name, last_name)')
      .eq('status', 'completed')
      .not('responded_at', 'is', null)
      .is('acknowledged_at', null)
      .order('responded_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching survey notifs:', error)
      return
    }

    const notifs: SurveyNotification[] = (data || []).map((s: any) => {
      const patient = Array.isArray(s.patient) ? s.patient[0] : s.patient
      return {
        id: s.id,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Patient',
        patient_id: s.patient_id,
        overall_rating: s.overall_rating,
        responded_at: s.responded_at,
        consultation_id: s.consultation_id,
      }
    })

    // Detect new survey responses for ephemeral popup
    if (!isFirstLoadRef.current) {
      const prevIds = prevSurveyIdsRef.current
      const newSurveys = notifs.filter(n => !prevIds.has(n.id))
      if (newSurveys.length > 0) {
        const first = newSurveys[0]
        showEphemeral(`${first.patient_name} a répondu au sondage J+7 ${first.overall_rating ? ratingEmojis[first.overall_rating] : ''}`)
      }
    }

    prevSurveyIdsRef.current = new Set(notifs.map(n => n.id))
    isFirstLoadRef.current = false
    setSurveyNotifs(notifs)
  }, [db, showEphemeral])

  // Acknowledge all survey notifications
  const acknowledgeSurveys = useCallback(async () => {
    if (surveyNotifs.length === 0) return
    try {
      await fetch('/api/surveys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledge_all: true }),
      })
      setSurveyNotifs([])
      prevSurveyIdsRef.current = new Set()
    } catch (error) {
      console.error('Error acknowledging surveys:', error)
    }
  }, [surveyNotifs])

  // Listen for Electron events (updates + survey sync)
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
    if (!api?.isDesktop) return

    api.onUpdateAvailable((v) => {
      setUpdateNotif(prev => ({ ...prev, state: 'downloading', version: v }))
      showEphemeral(`Mise à jour v${v} en cours de téléchargement...`)
    })

    api.onUpdateProgress((percent) => {
      setUpdateNotif(prev => ({ ...prev, progress: percent }))
    })

    api.onUpdateDownloaded((v) => {
      setUpdateNotif(prev => ({ ...prev, state: 'ready', version: v }))
      showEphemeral(`Mise à jour v${v} prête ! Redémarrez pour l'installer.`)
    })

    // When cron syncs new survey responses, immediately refresh
    api.onSurveySynced?.(() => {
      fetchSurveyNotifs()
    })

    // When cron syncs new emails, immediately refresh
    api.onInboxSynced?.(() => {
      fetchMailNotifs()
    })
  }, [showEphemeral, fetchSurveyNotifs, fetchMailNotifs])

  // Poll for notifications
  useEffect(() => {
    fetchMailNotifs()
    fetchSurveyNotifs()

    const interval = setInterval(() => {
      fetchMailNotifs()
      fetchSurveyNotifs()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchMailNotifs, fetchSurveyNotifs])

  const totalUnreadMails = mailNotifs.reduce((sum, n) => sum + n.unreadCount, 0)
  const totalCount = totalUnreadMails + surveyNotifs.length + (updateNotif.state !== 'idle' ? 1 : 0)

  const handleInstallUpdate = () => {
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
    api?.installUpdate()
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffH = Math.floor(diffMs / 3600000)
    const diffD = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return "À l'instant"
    if (diffMin < 60) return `Il y a ${diffMin}min`
    if (diffH < 24) return `Il y a ${diffH}h`
    if (diffD < 7) return `Il y a ${diffD}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative">
      {/* Ephemeral popup */}
      {ephemeralMessage && (
        <div className="absolute -bottom-14 right-0 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-border/50 shadow-lg rounded-xl px-3 py-2 text-sm whitespace-nowrap">
            <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-foreground">{ephemeralMessage}</span>
            <button
              onClick={() => setEphemeralMessage(null)}
              className="ml-1 text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full text-muted-foreground hover:text-foreground h-9 w-9"
            aria-label={totalCount > 0 ? `${totalCount} notification${totalCount > 1 ? 's' : ''}` : 'Aucune notification'}
          >
            <Bell className="h-4 w-4" />
            {totalCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full px-1 text-[9px] font-semibold leading-4 text-white gradient-primary">
                {totalCount > 99 ? '99+' : totalCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-96 p-0 rounded-2xl border-border/50 shadow-xl"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/40">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {totalCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalCount} notification{totalCount > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {/* Update notification */}
            {updateNotif.state !== 'idle' && (
              <div className="border-b border-border/40">
                <div className="px-4 py-3 bg-indigo-50/50 dark:bg-indigo-950/20">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      {updateNotif.state === 'downloading' ? (
                        <Download className="h-4 w-4 text-indigo-600 animate-bounce" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-indigo-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {updateNotif.state === 'downloading' ? (
                        <>
                          <p className="text-sm font-medium">Mise à jour v{updateNotif.version}</p>
                          <p className="text-xs text-muted-foreground">Téléchargement en cours...</p>
                          {updateNotif.progress > 0 && (
                            <div className="mt-1.5 w-full h-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                style={{ width: `${updateNotif.progress}%` }}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium">Mise à jour v{updateNotif.version} prête</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Redémarrez l'application pour appliquer la mise à jour.
                          </p>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleInstallUpdate}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Redémarrer maintenant
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Survey notifications */}
            {surveyNotifs.length > 0 && (
              <div className="border-b border-border/40">
                <div className="px-4 py-2 bg-muted/30 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="h-3 w-3" />
                    Sondages ({surveyNotifs.length})
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      acknowledgeSurveys()
                    }}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Tout lu
                  </button>
                </div>
                {surveyNotifs.slice(0, 5).map(survey => (
                  <button
                    key={survey.id}
                    onClick={() => {
                      setOpen(false)
                      router.push('/surveys')
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-accent/50 transition-colors flex items-start gap-3 border-b border-border/20 last:border-0"
                  >
                    <div className="mt-0.5 h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                      {survey.overall_rating ? (
                        <span className="text-sm">{ratingEmojis[survey.overall_rating]}</span>
                      ) : (
                        <ClipboardList className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {survey.patient_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        A répondu au sondage J+7
                        {survey.overall_rating && (
                          <span> — Note : {survey.overall_rating}/5</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {formatTime(survey.responded_at)}
                      </p>
                    </div>
                  </button>
                ))}
                {surveyNotifs.length > 5 && (
                  <button
                    onClick={() => {
                      setOpen(false)
                      router.push('/surveys')
                    }}
                    className="w-full text-center py-2 text-xs text-primary hover:underline"
                  >
                    Voir tous les sondages
                  </button>
                )}
              </div>
            )}

            {/* Mail notifications */}
            {mailNotifs.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    Messages ({totalUnreadMails})
                  </p>
                </div>
                {mailNotifs.slice(0, 5).map(notif => (
                  <button
                    key={notif.conversationId}
                    onClick={() => {
                      setOpen(false)
                      router.push('/messages')
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-accent/50 transition-colors flex items-start gap-3 border-b border-border/20 last:border-0"
                  >
                    <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{notif.contactName}</p>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                          {notif.unreadCount}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {notif.unreadCount} message{notif.unreadCount > 1 ? 's' : ''} non lu{notif.unreadCount > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {formatTime(notif.lastMessageAt)}
                      </p>
                    </div>
                  </button>
                ))}
                {mailNotifs.length > 5 && (
                  <button
                    onClick={() => {
                      setOpen(false)
                      router.push('/messages')
                    }}
                    className="w-full text-center py-2 text-xs text-primary hover:underline"
                  >
                    Voir toute la messagerie
                  </button>
                )}
              </div>
            )}

            {/* Empty state */}
            {totalCount === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Aucune notification</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Vous serez notifié des réponses aux sondages, messages et mises à jour
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {totalCount > 0 && (
            <div className="px-4 py-2 border-t border-border/40 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => {
                  setOpen(false)
                  router.push('/surveys')
                }}
              >
                <ClipboardList className="h-3 w-3 mr-1" />
                Sondages
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => {
                  setOpen(false)
                  router.push('/messages')
                }}
              >
                <Mail className="h-3 w-3 mr-1" />
                Messagerie
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
