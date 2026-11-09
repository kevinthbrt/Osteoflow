'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
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
  end?: string | null
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

type Tone = 'plan' | 'review' | 'other'

function toneOf(entry: Entry, day: string, today: string): Tone {
  if (day >= today && !entry.inPlan && !entry.handled) return 'review'
  return entry.inPlan ? 'plan' : 'other'
}

const TONE_STYLES: Record<Tone, string> = {
  plan: 'border-l-success bg-success-soft/60',
  review: 'border-l-warning bg-warning-soft/70',
  other: 'border-l-border bg-muted/40',
}

const TONE_TITLE: Record<Tone, string | undefined> = {
  plan: 'Dans Ma journée',
  review: 'À vérifier dans Ma journée',
  other: undefined,
}

/** Rendez-vous passé : terminé, ou commencé depuis plus d'une heure faute d'heure de fin. */
function isOver(entry: Entry, now: number) {
  const end = entry.end ? Date.parse(entry.end) : Date.parse(entry.start) + 60 * 60 * 1000
  return Number.isFinite(end) && end <= now
}

function EntryCard({ entry, day, today, now, compact }: { entry: Entry; day: string; today: string; now: number; compact?: boolean }) {
  const tone = toneOf(entry, day, today)
  const past = day < today || (day === today && isOver(entry, now))
  const href = entry.patientId ? `/patients/${entry.patientId}` : `/day-plan?date=${day}`
  const time = entry.end ? `${localTime(entry.start)} – ${localTime(entry.end)}` : localTime(entry.start)
  return (
    <li>
      <Link
        href={href}
        title={[TONE_TITLE[tone], `${entry.firstName} ${entry.lastName}`].filter(Boolean).join(' · ')}
        className={cn(
          'block rounded-md border-l-[3px] px-2 py-1.5 text-[13px] leading-snug transition-colors hover:bg-accent',
          TONE_STYLES[tone],
          past && 'opacity-50',
          compact && 'flex items-baseline gap-2'
        )}
      >
        <span className={cn('tabular-nums text-muted-foreground', compact ? 'w-24 shrink-0 text-[12px]' : 'block text-[11px] font-medium')}>
          {compact ? localTime(entry.start) : time}
        </span>
        <span className={cn('truncate', compact ? 'min-w-0 flex-1' : 'block')}>
          {entry.firstName} <span className="font-semibold uppercase">{entry.lastName}</span>
        </span>
      </Link>
    </li>
  )
}

/** Trait « maintenant » placé entre les rendez-vous passés et à venir du jour. */
function NowLine() {
  return (
    <li aria-label="Maintenant" className="relative flex items-center py-0.5">
      <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
      <span className="h-px flex-1 bg-destructive/70" />
    </li>
  )
}

function DayList({ list, day, today, now, compact }: { list: Entry[]; day: string; today: string; now: number; compact?: boolean }) {
  const nowIndex = day === today ? list.findIndex((entry) => !isOver(entry, now)) : -1
  const showNowAt = day === today ? (nowIndex === -1 ? list.length : nowIndex) : -1
  return (
    <ul className="space-y-1">
      {list.map((entry, index) => (
        <Fragment key={entry.doctolibId}>
          {index === showNowAt && index > 0 && <NowLine />}
          <EntryCard entry={entry} day={day} today={today} now={now} compact={compact} />
        </Fragment>
      ))}
      {showNowAt === list.length && list.length > 0 && <NowLine />}
    </ul>
  )
}

export function WeekAgendaPanel({ size }: { size: 1 | 2 | 3 }) {
  const [data, setData] = useState<{ syncedAt: string | null; days: Record<string, Entry[]> } | null>(null)
  const week = useMemo(() => displayedWeek(), [])
  const today = dayString(new Date())
  const [now, setNow] = useState(() => Date.now())

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
    const timer = setInterval(() => {
      load()
      setNow(Date.now())
    }, 60_000)
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
        {data?.syncedAt && (
          <span className="hidden items-center gap-3 text-xs text-muted-foreground md:inline-flex">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-1 rounded-full bg-success" />Dans Ma journée</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-1 rounded-full bg-warning" />À vérifier</span>
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
              <div key={day} className={cn('min-w-0 px-2 py-3', isToday && 'bg-accent/30')}>
                <Link
                  href={`/day-plan?date=${day}`}
                  className={cn('mb-2 flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent', day < today && 'opacity-60')}
                >
                  <span className={cn('text-[11px] font-semibold uppercase tracking-wide', isToday ? 'text-primary' : 'text-muted-foreground')}>
                    {weekdayShort.format(dayDate(day)).replace('.', '')}
                  </span>
                  <span
                    className={cn(
                      'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold tabular-nums',
                      isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                    )}
                  >
                    {dayDate(day).getDate()}
                  </span>
                  {list.length > 0 && <span className="ml-auto text-[11px] text-muted-foreground">{list.length} rdv</span>}
                </Link>
                {list.length === 0 ? (
                  <p className="px-2 py-1.5 text-[13px] text-muted-foreground/70">Aucun rendez-vous</p>
                ) : (
                  <DayList list={list} day={day} today={today} now={now} />
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
              <DayList list={days[day]} day={day} today={today} now={now} compact />
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
