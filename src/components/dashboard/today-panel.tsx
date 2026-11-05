'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarArrowDown, CalendarPlus, Check, PanelTop } from 'lucide-react'
import { openPatientTabs } from '@/components/layout/patient-tabs'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/db/client'
import { calculateAge, cn } from '@/lib/utils'
import { useDoctolibFeature } from '@/lib/doctolib/use-doctolib-feature'

/**
 * Bloc « Aujourd'hui » du tableau de bord : la liste préparée dans Ma journée,
 * avec le prochain patient mis en avant et son bouton pour démarrer la séance.
 */
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

function sinceLabel(dateStr: string): string {
  const day = new Date(dateStr)
  day.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (days <= 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  if (months < 12) return `il y a ${months} mois`
  const years = Math.floor(days / 365)
  return `il y a ${years} an${years > 1 ? 's' : ''}`
}

export interface TodaySummary {
  total: number
  done: number
  next: { first_name: string; last_name: string } | null
}

export function TodayPanel({ onSummary }: { onSummary?: (summary: TodaySummary) => void }) {
  const [items, setItems] = useState<PlanItem[]>([])
  const [lastConsults, setLastConsults] = useState<Record<string, LastConsult>>({})
  const [loading, setLoading] = useState(true)
  const doctolibVisible = useDoctolibFeature()
  const [db] = useState(() => createClient())

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
      const list = ((data as PlanItem[] | null) ?? []).filter((item) => item.patient)
      setItems(list)

      const patientIds = list.map((item) => item.patient!.id)
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
          const time = new Date(c.date_time).getTime()
          // La séance du jour n'est pas « la précédente »
          if (time >= startOfToday.getTime()) continue
          const existing = map[c.patient_id]
          if (!existing || time > new Date(existing.date_time).getTime()) {
            map[c.patient_id] = { date_time: c.date_time, reason: c.reason }
          }
        }
        setLastConsults(map)
      }
    } finally {
      setLoading(false)
    }
  }, [db])

  useEffect(() => {
    load()
  }, [load])

  const nextItem = items.find((item) => item.status === 'pending')

  useEffect(() => {
    if (loading) return
    onSummary?.({
      total: items.length,
      done: items.filter((item) => item.status === 'done').length,
      next: nextItem?.patient ?? null,
    })
  }, [loading, items, nextItem, onSummary])

  const toggleStatus = async (item: PlanItem) => {
    const nextStatus = item.status === 'pending' ? 'done' : 'pending'
    setItems((previous) => previous.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)))
    await db.from('daily_plan_items').update({ status: nextStatus }).eq('id', item.id)
  }

  return (
    <section className="glass-card rounded-xl" aria-labelledby="today-title">
      <div className="flex items-center justify-between gap-3 card-head border-b border-sidebar-border px-5 py-4">
        <h2 id="today-title" className="text-base font-semibold">Aujourd’hui</h2>
        <div className="flex items-center gap-4">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = nextItem?.patient ?? items[0].patient!
                openPatientTabs({
                  patients: items.map((item) => ({
                    id: item.patient!.id,
                    first_name: item.patient!.first_name,
                    last_name: item.patient!.last_name,
                  })),
                  focusId: next.id,
                })
              }}
              title="Un onglet par patient du jour, dans l’ordre de passage"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-foreground hover:underline"
            >
              <PanelTop className="h-4 w-4" />
              Ouvrir en onglets
            </button>
          )}
          <Link href="/day-plan" className="text-sm font-medium text-accent-foreground hover:underline">
            Organiser Ma journée
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">Aucun patient préparé pour aujourd’hui.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/day-plan">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Préparer ma journée
              </Link>
            </Button>
            {doctolibVisible && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/day-plan">
                  <CalendarArrowDown className="mr-2 h-4 w-4" />
                  Importer depuis Doctolib
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {items.map((item) => {
            const patient = item.patient!
            const isNext = item.id === nextItem?.id
            const isDone = item.status === 'done'
            const last = lastConsults[patient.id]
            const age = patient.birth_date ? calculateAge(patient.birth_date) : null
            return (
              <li
                key={item.id}
                className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3', isNext && 'bg-accent/50')}
              >
                <button
                  type="button"
                  onClick={() => toggleStatus(item)}
                  aria-label={isDone ? `Marquer ${patient.first_name} ${patient.last_name} comme à voir` : `Marquer ${patient.first_name} ${patient.last_name} comme vu`}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                    isDone ? 'border-success bg-success text-success-foreground' : 'border-input hover:border-primary'
                  )}
                >
                  {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <Link href={`/patients/${patient.id}`} className="min-w-0 flex-1 basis-48">
                  <span className={cn('block truncate text-sm font-semibold', isDone && 'text-muted-foreground')}>
                    {patient.first_name} {patient.last_name}
                    {age !== null && <span className="font-normal text-muted-foreground"> · {age} ans</span>}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {last ? `${last.reason || 'Consultation'} · ${sinceLabel(last.date_time)}` : 'Première consultation'}
                  </span>
                </Link>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    isDone && 'bg-success-soft text-success',
                    isNext && 'bg-accent text-accent-foreground',
                    !isDone && !isNext && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isDone ? 'Vu' : isNext ? 'Prochain' : 'À venir'}
                </span>
                {isNext ? (
                  <Button size="sm" className="h-9" asChild>
                    <Link href={`/patients/${patient.id}/consultation/new`}>Démarrer la séance</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-9" asChild>
                    <Link href={isDone ? `/patients/${patient.id}` : `/patients/${patient.id}/consultation/new`}>
                      {isDone ? 'Dossier' : 'Consulter'}
                    </Link>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
