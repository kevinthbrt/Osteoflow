'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Send, Clock, AlertTriangle, RotateCw, X } from 'lucide-react'

interface ActiveCampaign {
  id: string
  type: 'broadcast' | 'relaunch'
  status: string
  total: number
  sent: number
  failed: number
  retryableFailedCount?: number
  dailyLimitReached?: boolean
}

const POLL_INTERVAL = 30_000
const DISMISSED_KEY = 'osteoflow_dismissed_campaign_banner'

/**
 * Slim banner shown whenever a broadcast/relance campaign is still in
 * progress — including across days, when Gmail's daily cap paused it — or
 * has just finished with failures. Lets the practitioner check on it without
 * reopening the compose modal (which would otherwise risk starting a second,
 * duplicate campaign), and retry failures that look worth retrying (network
 * hiccups, Gmail's daily cap) without needing to touch the database by hand.
 */
export function ActiveCampaignBanner() {
  const [campaign, setCampaign] = useState<ActiveCampaign | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setDismissedId(localStorage.getItem(DISMISSED_KEY))
  }, [])

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/campaigns/active')
      const data = await res.json()
      if (res.ok) setCampaign(data.campaign || null)
    } catch (error) {
      console.error('Error fetching active campaign:', error)
    }
  }, [])

  useEffect(() => {
    fetchActive()
    pollRef.current = setInterval(fetchActive, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchActive])

  const dismiss = () => {
    if (!campaign) return
    localStorage.setItem(DISMISSED_KEY, campaign.id)
    setDismissedId(campaign.id)
  }

  const retryFailed = async () => {
    if (!campaign) return
    setIsRetrying(true)
    try {
      const res = await fetch(`/api/messages/campaigns/${campaign.id}/retry-failed`, { method: 'POST' })
      if (res.ok) await fetchActive()
    } catch (error) {
      console.error('Error retrying failed recipients:', error)
    } finally {
      setIsRetrying(false)
    }
  }

  if (!campaign || campaign.id === dismissedId) return null

  const remaining = campaign.total - campaign.sent - campaign.failed
  const isFinished = ['completed', 'failed', 'cancelled'].includes(campaign.status)
  const retryableCount = campaign.retryableFailedCount || 0

  return (
    <div className="mx-4 mt-3 rounded-lg border p-3 space-y-1.5 bg-muted/30">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Send className="h-3.5 w-3.5 text-primary" />
          {campaign.type === 'relaunch' ? 'Relance patients' : 'Diffusion'}
          {campaign.dailyLimitReached && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              en pause
            </span>
          )}
          {isFinished && campaign.failed > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              terminée avec échecs
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {campaign.sent}/{campaign.total}
            {campaign.failed > 0 ? ` (${campaign.failed} échec${campaign.failed > 1 ? 's' : ''})` : ''}
          </span>
          {isFinished && (
            <button
              type="button"
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Masquer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <Progress value={campaign.total > 0 ? (campaign.sent / campaign.total) * 100 : 0} />
      {campaign.dailyLimitReached && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Limite Gmail (450/jour) atteinte, {remaining} patient(s) restant(s) — reprise automatique demain.
        </p>
      )}
      {isFinished && retryableCount > 0 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {retryableCount} échec{retryableCount > 1 ? 's' : ''} sur {campaign.failed} semble{retryableCount > 1 ? 'nt' : ''} lié
            {retryableCount > 1 ? 's' : ''} à un problème réseau ou au quota Gmail — peut valoir le coup de réessayer.
          </p>
          <Button size="sm" variant="outline" onClick={retryFailed} disabled={isRetrying} className="shrink-0">
            <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`} />
            Réessayer ({retryableCount})
          </Button>
        </div>
      )}
    </div>
  )
}
