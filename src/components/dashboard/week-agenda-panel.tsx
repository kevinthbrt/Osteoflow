'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { localTime } from '@/lib/doctolib/import'
import { dayString, displayedWeek } from '@/lib/doctolib/week'

/**
 * Agenda Doctolib de la semaine, synchronisé par l'extension. Large : une
 * colonne par jour. Étroit : les prochains rendez-vous, jour par jour.
 */
interface Entry {
  doctolibId: string
  start: string
  firstName: string
  lastName: string
  patientId: string | null
  inPlan: boolean
  handled: boolean
}

const APP_HEADERS = { 'x-osteoflow-app': '1' }

const weekdayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const weekdayLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function dayDate(day: string) {
  return new Date(`${day}T12:00:00`)
}

function EntryRow({ entry, day, today, compact }: { entry: Entry; day: string; today: string; compact?: boolean }) {
  const past = day < today
  const toReview = !past && !entry.inPlan && !entry.handled
  const href = entry.patientId ? `/patients/${entry.patientId}` : `/day-plan?date=${day}`
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'group flex gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent',
          compact ? 'items-baseline' : 'items-start',
          past && 'opacity-55'
        )}
        title={toReview ? 'À vérifier dans Ma journée' : entry.inPlan ? 'Dans Ma journée' : undefined}
      >
        {compact ? (
          <>
            <span className="w-10 shrink-0 font-medium tabular-nums text-muted-foreground">{localTime(entry.start)}</span>
            <span className="min-w-0 flex-1 truncate">
              {entry.firstName} <span className="font-medium uppercase">{entry.lastName}</span>
            </span>
          </>
        ) : (
          // Colonne d'un jour : l'heure au-dessus, le nom sur toute la largeur
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block text-xs font-medium tabular-nums text-muted-foreground">{localTime(entry.start)}</span>
            <span className="block truncate" title={`${entry.firstName} ${entry.lastName}`}>
              {entry.firstName} <span className="font-medium uppercase">{entry.lastName}</span>
            </span>
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', compact && 'mt-0 self-center', toReview ? 'bg-warning' : entry.inPlan ? 'bg-success' : 'bg-transparent')}
        />
      </Link>
    </li>
  )
}

export function WeekAgendaPanel({ size }: { size: 1 | 2 | 3 }) {
  const [data, setData] = useState<{ syncedAt: string | null; days: Record<string, Entry[]> } | null>(null)
  const week = useMemo(() => displayedWeek(), [])
  const today = dayString(new Date())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctolib/agenda?start=${week.start}&end=${week.end}`, { headers: APP_HEADERS, cache: 'no-store' })
      setData(await res.json())
    } catch {
      // Hors ligne : on garde l'affichage précédent.
    }
  }, [week])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    window.addEventListener('focus', load)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [load])

  const days = data?.days ?? {}
  const total = Object.values(days).reduce((sum, list) => sum + list.length, 0)
  const toReview = Object.entries(days).reduce(
    (sum, [day, list]) => sum + (day < today ? 0 : list.filter((entry) => !entry.inPlan && !entry.handled).length),
    0
  )
  // Samedi et dimanche seulement s'ils ont des rendez-vous
  const shownDays = week.days.filter((day, index) => index < 5 || (days[day]?.length ?? 0) > 0)

  return (
    <section className="glass-card flex h-full flex-col rounded-xl" aria-labelledby="week-agenda-title">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 card-head border-b px-5 py-4">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h2 id="week-agenda-title" className="text-base font-semibold">Agenda de la semaine</h2>
        {data?.syncedAt && (
          <span className="text-[13px] text-muted-foreground">
            {total} rendez-vous · Doctolib, {formatDistanceToNow(new Date(data.syncedAt), { addSuffix: true, locale: fr })}
          </span>
        )}
        {toReview > 0 && (
          <Link href="/day-plan" className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning hover:underline">
            {toReview} à vérifier
          </Link>
        )}
      </div>

      {!data ? (
        <div className="grid gap-2 p-5">
          {[0, 1, 2].map((key) => <div key={key} className="h-8 animate-pulse rounded-md bg-muted" />)}
        </div>
      ) : !data.syncedAt ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Ouvrez votre agenda Doctolib dans Chrome : vos rendez-vous de la semaine s’afficheront ici.
          </p>
          <Link href="/settings?tab=doctolib" className="text-sm font-medium text-accent-foreground hover:underline">
            Mettre en place l’extension
          </Link>
        </div>
      ) : size === 3 ? (
        <div className="grid flex-1 grid-cols-1 divide-y divide-border/70 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))] sm:divide-x sm:divide-y-0" style={{ ['--cols' as string]: shownDays.length }}>
          {shownDays.map((day) => {
            const list = days[day] ?? []
            const isToday = day === today
            return (
              <div key={day} className={cn('min-w-0 px-2 py-3', isToday && 'bg-accent/40')}>
                <Link
                  href={`/day-plan?date=${day}`}
                  className={cn('mb-1 flex items-baseline gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide', isToday ? 'text-primary' : 'text-muted-foreground', day < today && 'opacity-60')}
                >
                  {weekdayShort.format(dayDate(day)).replace('.', '')} {dayDate(day).getDate()}
                  <span className="ml-auto font-normal normal-case tracking-normal">{list.length || ''}</span>
                </Link>
                {list.length === 0 ? (
                  <p className="px-2 py-1.5 text-[13px] text-muted-foreground/70">Aucun</p>
                ) : (
                  <ul>{list.map((entry) => <EntryRow key={entry.doctolibId} entry={entry} day={day} today={today} />)}</ul>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 space-y-3 px-3 py-3">
          {week.days.filter((day) => day >= today && (days[day]?.length ?? 0) > 0).slice(0, size === 1 ? 2 : 4).map((day) => (
            <div key={day}>
              <p className={cn('px-2 pb-1 text-xs font-semibold first-letter:uppercase', day === today ? 'text-primary' : 'text-muted-foreground')}>
                {day === today ? 'Aujourd’hui' : weekdayLong.format(dayDate(day))}
              </p>
              <ul>{days[day].map((entry) => <EntryRow key={entry.doctolibId} entry={entry} day={day} today={today} compact />)}</ul>
            </div>
          ))}
          {week.days.every((day) => day < today || !(days[day]?.length)) && (
            <p className="px-2 py-4 text-sm text-muted-foreground">Plus de rendez-vous cette semaine.</p>
          )}
        </div>
      )}
    </section>
  )
}
