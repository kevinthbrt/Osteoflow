'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListChecks, Check, RotateCcw, ChevronRight, ChevronLeft, CalendarPlus } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { calculateAge } from '@/lib/utils'

interface PlanItem {
  id: string
  status: 'pending' | 'done'
  patient: { id: string; first_name: string; last_name: string; birth_date: string | null } | null
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTimeSince(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  if (months < 12) return `il y a ${months} mois`
  const years = Math.floor(days / 365)
  return `il y a ${years} an${years > 1 ? 's' : ''}`
}

export function DayPlanWidget() {
  const [items, setItems] = useState<PlanItem[]>([])
  const [lastConsults, setLastConsults] = useState<Record<string, string>>({})
  const [cursor, setCursor] = useState(0)
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
        .select('id, status, patient:patients (id, first_name, last_name, birth_date)')
        .eq('practitioner_id', practitioner.id)
        .eq('plan_date', todayStr())
        .order('position', { ascending: true })
      const list = (data as PlanItem[] | null) ?? []
      setItems(list)
      const firstPending = list.findIndex((i) => i.status === 'pending')
      setCursor(firstPending >= 0 ? firstPending : 0)

      const patientIds = list.map((i) => i.patient?.id).filter((id): id is string => !!id)
      if (patientIds.length > 0) {
        const { data: consults } = await db
          .from('consultations')
          .select('patient_id, date_time')
          .in('patient_id', patientIds)
          .is('archived_at', null)
          .order('date_time', { ascending: false })
        const now = Date.now()
        const map: Record<string, string> = {}
        for (const c of (consults as Array<{ patient_id: string; date_time: string }> | null) ?? []) {
          const t = new Date(c.date_time).getTime()
          if (t >= now) continue
          const existing = map[c.patient_id]
          if (!existing || t > new Date(existing).getTime()) {
            map[c.patient_id] = c.date_time
          }
        }
        setLastConsults(map)
      }
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const toggleStatus = async (item: PlanItem) => {
    const nextStatus = item.status === 'pending' ? 'done' : 'pending'
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)))
    await db.from('daily_plan_items').update({ status: nextStatus }).eq('id', item.id)
  }

  const doneCount = items.filter((i) => i.status === 'done').length
  const progressPct = items.length > 0 ? (doneCount / items.length) * 100 : 0
  const current = items[cursor] ?? null
  const age = current?.patient?.birth_date ? calculateAge(current.patient.birth_date) : null
  const lastConsult = current?.patient?.id ? lastConsults[current.patient.id] : undefined
  const currentDetails = current
    ? [
        age != null ? `${age} ans` : null,
        lastConsult ? `Dernière consultation ${formatTimeSince(lastConsult)}` : 'Première consultation',
      ].filter(Boolean).join(' · ')
    : ''

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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {doneCount} / {items.length} patient{items.length > 1 ? 's' : ''} vu{doneCount > 1 ? 's' : ''}
                </span>
                {doneCount === items.length && (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Journée terminée 🎉</span>
                )}
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Navigation : prochain patient au centre, flèches pour parcourir la journée */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
                disabled={cursor === 0}
                className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={cursor}
                onChange={(e) => setCursor(Number(e.target.value))}
                className="flex-1 min-w-0 text-sm border rounded-md px-2 py-1.5 bg-background"
              >
                {items.map((item, i) => (
                  <option key={item.id} value={i}>
                    {i + 1}. {item.patient?.first_name} {item.patient?.last_name}
                    {item.status === 'done' ? ' — vu' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setCursor((c) => Math.min(items.length - 1, c + 1))}
                disabled={cursor === items.length - 1}
                className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {current && (
              <div className="rounded-xl border border-border/50 bg-accent/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/patients/${current.patient?.id}`}
                    className={`font-medium truncate hover:underline ${
                      current.status === 'done' ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {current.patient?.first_name} {current.patient?.last_name}
                  </Link>
                  <Button
                    variant={current.status === 'done' ? 'ghost' : 'outline'}
                    size="sm"
                    className="h-8 flex-shrink-0 gap-1.5"
                    onClick={() => toggleStatus(current)}
                  >
                    {current.status === 'done' ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Annuler
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Vu
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{currentDetails}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
