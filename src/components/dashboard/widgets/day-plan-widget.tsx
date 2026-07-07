'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListChecks, Check, ChevronRight, CalendarPlus } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { calculateAge } from '@/lib/utils'

interface PlanItem {
  id: string
  status: 'pending' | 'done'
  patient: { id: string; first_name: string; last_name: string; birth_date: string | null } | null
}

interface LastConsult {
  date_time: string
  reason: string
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTimeSince(dateStr: string): string {
  // Compare calendar dates (midnight to midnight), not raw elapsed hours —
  // otherwise "yesterday afternoon" checked "this morning" reads as "today"
  // since less than 24h have actually elapsed.
  const consultDay = new Date(dateStr)
  consultDay.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - consultDay.getTime()) / 86400000)
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

export function DayPlanWidget({ variant = 'card' }: { variant?: 'card' | 'banner' }) {
  const banner = variant === 'banner'
  const [items, setItems] = useState<PlanItem[]>([])
  const [lastConsults, setLastConsults] = useState<Record<string, LastConsult>>({})
  const [loading, setLoading] = useState(true)
  const db = createClient()
  const listRef = useRef<HTMLDivElement>(null)
  const nextItemRef = useRef<HTMLDivElement>(null)

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

      const patientIds = list.map((i) => i.patient?.id).filter((id): id is string => !!id)
      if (patientIds.length > 0) {
        const { data: consults } = await db
          .from('consultations')
          .select('patient_id, date_time, reason')
          .in('patient_id', patientIds)
          .is('archived_at', null)
          .order('date_time', { ascending: false })
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        const map: Record<string, LastConsult> = {}
        for (const c of (consults as Array<{ patient_id: string; date_time: string; reason: string }> | null) ?? []) {
          const t = new Date(c.date_time).getTime()
          // Exclude today's own consultation(s) — "dernière consultation" should
          // reflect the previous visit, not one already logged earlier today.
          if (t >= startOfToday.getTime()) continue
          const existing = map[c.patient_id]
          if (!existing || t > new Date(existing.date_time).getTime()) {
            map[c.patient_id] = { date_time: c.date_time, reason: c.reason }
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
  const nextId = items.find((i) => i.status === 'pending')?.id

  // Keep the next patient in view — centered in the scrollable list when
  // possible, or just scrolled into sight if it's near the top/bottom.
  // Uses getBoundingClientRect rather than offsetTop, since offsetTop is
  // relative to the nearest *positioned* ancestor — which may not be this
  // container (e.g. inside the banner) and would throw the math off.
  useEffect(() => {
    if (loading || !nextId) return
    const container = listRef.current
    const item = nextItemRef.current
    if (!container || !item) return
    const containerRect = container.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    const itemTopInContainer = (itemRect.top - containerRect.top) + container.scrollTop
    const target = itemTopInContainer - container.clientHeight / 2 + item.offsetHeight / 2
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [loading, nextId])

  const mutedClass = banner ? 'text-white/70' : 'text-muted-foreground'

  const headerRow = (
    <div className="flex items-center justify-between">
      <div className={`flex items-center gap-2 text-base font-semibold ${banner ? 'text-white' : ''}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${banner ? 'bg-white/15' : 'bg-orange-500/10'}`}>
          <ListChecks className={`h-4 w-4 ${banner ? 'text-white' : 'text-orange-500'}`} />
        </div>
        <span className={banner ? 'text-white' : 'text-orange-600 dark:text-orange-400'}>Ma journée</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 gap-1 px-2 text-xs ${banner ? 'text-white/80 hover:text-white hover:bg-white/10' : ''}`}
        asChild
      >
        <Link href="/day-plan">
          Organiser
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  )

  const bodyContent = loading ? (
    <div className={`h-12 rounded-lg animate-pulse ${banner ? 'bg-white/15' : 'bg-muted/30'}`} />
  ) : items.length === 0 ? (
    <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
      <p className={`text-sm ${banner ? 'text-white/80' : 'text-muted-foreground'}`}>
        Aucun patient préparé pour aujourd&apos;hui.
      </p>
      <Button
        variant="outline"
        size="sm"
        className={banner ? 'bg-white/10 text-white border-white/30 hover:bg-white/20' : ''}
        asChild
      >
        <Link href="/day-plan">
          <CalendarPlus className="h-4 w-4 mr-1.5" />
          Préparer ma journée
        </Link>
      </Button>
    </div>
  ) : (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className={`flex items-center justify-between text-xs ${mutedClass}`}>
          <span>
            {doneCount} / {items.length} patient{items.length > 1 ? 's' : ''} vu{doneCount > 1 ? 's' : ''}
          </span>
          {doneCount === items.length && (
            <span className={`font-medium ${banner ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`}>
              Journée terminée 🎉
            </span>
          )}
        </div>
        <div className={`h-1.5 w-full rounded-full overflow-hidden ${banner ? 'bg-white/15' : 'bg-muted'}`}>
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Vue d'ensemble de la journée, défilable à la molette */}
      <div ref={listRef} className="space-y-1 max-h-36 overflow-y-auto pr-1">
        {items.map((item) => {
          const isNext = item.id === nextId
          const isDone = item.status === 'done'
          const age = item.patient?.birth_date ? calculateAge(item.patient.birth_date) : null
          const lastConsult = item.patient?.id ? lastConsults[item.patient.id] : undefined
          const details = [
            age != null ? `${age} ans` : null,
            lastConsult
              ? `${formatTimeSince(lastConsult.date_time)} · ${lastConsult.reason}`
              : 'Première consultation',
          ].filter(Boolean).join(' · ')

          return (
            <div
              key={item.id}
              ref={isNext ? nextItemRef : undefined}
              className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 ${
                isNext ? (banner ? 'bg-white/15 border border-white/25' : 'bg-accent/40 border border-border/50') : ''
              }`}
            >
              <button
                onClick={() => toggleStatus(item)}
                title={isDone ? 'Marquer à revoir' : 'Marquer comme vu'}
                className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                  isDone
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : banner
                    ? 'border-white/40 text-transparent hover:border-white'
                    : 'border-muted-foreground/40 text-transparent hover:border-orange-400'
                }`}
              >
                <Check className="h-3 w-3" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/patients/${item.patient?.id}`}
                    onClick={() => { if (!isDone) toggleStatus(item) }}
                    className={`text-sm truncate hover:underline ${
                      isDone
                        ? (banner ? 'text-white/50 line-through' : 'text-muted-foreground line-through')
                        : (banner ? 'text-white font-medium' : 'font-medium')
                    }`}
                  >
                    {item.patient?.first_name} {item.patient?.last_name}
                  </Link>
                  {isNext && (
                    <span className={`text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                      banner ? 'text-amber-200' : 'text-orange-600 dark:text-orange-400'
                    }`}>
                      Prochain
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate ${mutedClass}`}>{details}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  if (banner) {
    return (
      <div className="space-y-3">
        {headerRow}
        {bodyContent}
      </div>
    )
  }

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
      <CardContent>{bodyContent}</CardContent>
    </Card>
  )
}
