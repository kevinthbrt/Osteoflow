'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react'

interface CompletionArea {
  key: string
  label: string
  href: string
  complete: boolean
  missing: string[]
}

interface CompletionData {
  percentage: number
  completedCount: number
  total: number
  areas: CompletionArea[]
}

export function ProfileCompletionWidget() {
  const [data, setData] = useState<CompletionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/profile/completion')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json && typeof json.percentage === 'number') {
          setData(json)
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

  // Render nothing while loading, on error, or once everything is complete.
  if (loading || !data || data.percentage >= 100) {
    return null
  }

  return (
    <Card className="border border-primary/30 border-l-4 border-l-primary bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Complétez votre profil
            </CardTitle>
            <CardDescription className="mt-1">
              Renseignez les informations manquantes pour profiter pleinement de MyOsteoFlow.
            </CardDescription>
          </div>
          <span className="shrink-0 text-2xl font-bold text-primary">{data.percentage}%</span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-primary/15">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${data.percentage}%` }}
          />
        </div>
      </CardHeader>

      <CardContent>
        <ul className="space-y-3">
          {data.areas.map((area) => (
            <li
              key={area.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background/60 p-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                {area.complete ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                )}
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{area.label}</p>
                  {area.complete ? (
                    <p className="mt-0.5 text-sm text-emerald-600">Terminé</p>
                  ) : (
                    area.missing.length > 0 && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        À compléter : {area.missing.join(', ')}
                      </p>
                    )
                  )}
                </div>
              </div>
              {!area.complete && (
                <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
                  <Link href={area.href}>
                    Compléter
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
