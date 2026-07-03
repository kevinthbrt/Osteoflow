'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserX, Clock, History, ArrowRight } from 'lucide-react'

interface RelaunchSummary {
  notSeenCount: number
  relaunchedCount: number
}

export function RelaunchWidget() {
  const [data, setData] = useState<RelaunchSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/messages/relaunch/candidates?months=3')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active && json) {
          setData({
            notSeenCount: (json.notSeen || []).length,
            relaunchedCount: (json.relaunched || []).length,
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <Card className="border-border/30 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <UserX className="h-4 w-4 text-primary" />
          </div>
          Relances patients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 bg-muted/40 rounded-lg" />
            <div className="h-10 bg-muted/30 rounded-lg" />
          </div>
        ) : (
          <>
            <Link
              href="/messages?panel=relaunch"
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{data?.notSeenCount ?? 0} patient{(data?.notSeenCount ?? 0) > 1 ? 's' : ''} à relancer</p>
                <p className="text-xs text-muted-foreground">Non vus depuis 3 mois ou plus</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <Link
              href="/messages?panel=relaunch"
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <History className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{data?.relaunchedCount ?? 0} en attente de retour</p>
                <p className="text-xs text-muted-foreground">Déjà relancés, pas encore revus</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/messages?panel=relaunch">
                Voir les relances
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
