'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Progress } from '@/components/ui/progress'
import { Send, Clock } from 'lucide-react'

interface ActiveCampaign {
  id: string
  type: 'broadcast' | 'relaunch'
  status: string
  total: number
  sent: number
  failed: number
  dailyLimitReached?: boolean
}

const POLL_INTERVAL = 30_000

/**
 * Slim banner shown whenever a broadcast/relance campaign is still in
 * progress — including across days, when Gmail's daily cap paused it. Lets
 * the practitioner check on it without reopening the compose modal (which
 * would otherwise risk starting a second, duplicate campaign).
 */
export function ActiveCampaignBanner() {
  const [campaign, setCampaign] = useState<ActiveCampaign | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  if (!campaign) return null

  const remaining = campaign.total - campaign.sent - campaign.failed

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
        </span>
        <span className="text-muted-foreground">{campaign.sent}/{campaign.total}</span>
      </div>
      <Progress value={campaign.total > 0 ? (campaign.sent / campaign.total) * 100 : 0} />
      {campaign.dailyLimitReached && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Limite Gmail (450/jour) atteinte, {remaining} patient(s) restant(s) — reprise automatique demain.
        </p>
      )}
    </div>
  )
}
