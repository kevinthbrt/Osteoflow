'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListChecks, Check, ChevronRight, CalendarPlus } from 'lucide-react'
import { createClient } from '@/lib/db/client'

interface PlanItem {
  id: string
  status: 'pending' | 'done'
  patient: { id: string; first_name: string; last_name: string } | null
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DayPlanWidget() {
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const db = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: practitioner } = await db.from('practitioners').select('id').single()
      if (!practitioner) {
        setItems([])
        return
      }
      const { data } = await db
        .from('daily_plan_items')
        .select('id, status, patient:patients (id, first_name, last_name)')
        .eq('practitioner_id', practitioner.id)
        .eq('plan_date', todayStr())
        .order('position', { ascending: true })
      setItems((data as PlanItem[] | null) ?? [])
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const markDone = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'done' } : i)))
    await db.from('daily_plan_items').update({ status: 'done' }).eq('id', id)
  }

  const doneCount = items.filter((i) => i.status === 'done').length
  const next = items.find((i) => i.status === 'pending')

  return (
    <Card className="border-border/30 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <ListChecks className="h-4 w-4 text-orange-500" />
          </div>
          <span className="text-orange-600 dark:text-orange-400">Ma journée</span>
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
          <Link href="/day-plan">
            Organiser
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-12 bg-muted/30 rounded-lg animate-pulse" />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun patient préparé pour aujourd&apos;hui.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/day-plan">
                <CalendarPlus className="h-4 w-4 mr-1.5" />
                Préparer ma journée
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {doneCount} / {items.length} patient{items.length > 1 ? 's' : ''} vu{doneCount > 1 ? 's' : ''}
            </p>
            {next ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-accent/30 p-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Prochain patient</p>
                  <Link
                    href={`/patients/${next.patient?.id}`}
                    className="font-medium truncate hover:underline"
                  >
                    {next.patient?.first_name} {next.patient?.last_name}
                  </Link>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-shrink-0 gap-1.5"
                  onClick={() => markDone(next.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Vu
                </Button>
              </div>
            ) : (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Tous les patients du jour ont été vus 🎉
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
