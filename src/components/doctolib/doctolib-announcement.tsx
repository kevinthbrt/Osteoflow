'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck2, CalendarDays, RefreshCw, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDoctolibFeature, useDoctolibStatus } from '@/lib/doctolib/use-doctolib-feature'

/**
 * Annonce de la synchronisation Doctolib sur le tableau de bord : visible
 * une fois la fonction disponible, tant que l'extension n'est pas installée
 * et que le praticien ne l'a pas écartée.
 */
const DISMISS_KEY = 'myosteoflow_doctolib_announcement_dismissed'

const POINTS = [
  { icon: RefreshCw, text: 'Votre agenda Doctolib se synchronise tout seul, toute la semaine.' },
  { icon: UserCheck, text: 'Les patients reconnus arrivent d’eux-mêmes dans Ma journée.' },
  { icon: CalendarDays, text: 'Votre semaine s’affiche ici, sur le tableau de bord.' },
]

export function DoctolibAnnouncement() {
  const visible = useDoctolibFeature()
  const { status } = useDoctolibStatus(visible)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!visible || dismissed || !status || status.seen) return null

  const close = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Sans stockage, l'annonce reviendra à la prochaine ouverture.
    }
  }

  return (
    <section
      aria-labelledby="doctolib-announcement-title"
      className="relative overflow-hidden rounded-xl border border-primary/30 bg-card"
    >
      <div className="card-head flex flex-wrap items-start gap-4 px-5 py-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CalendarCheck2 className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Nouveau</p>
          <h2 id="doctolib-announcement-title" className="text-lg font-semibold">
            Vos rendez-vous Doctolib, sans rien ressaisir
          </h2>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-3 sm:gap-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-2 text-sm text-muted-foreground">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2 self-center">
          <Button asChild>
            <Link href="/settings?tab=doctolib">Mettre en place, 2 minutes</Link>
          </Button>
          <Button variant="ghost" onClick={close}>Plus tard</Button>
        </div>
        <button
          type="button"
          aria-label="Masquer l’annonce"
          onClick={close}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
