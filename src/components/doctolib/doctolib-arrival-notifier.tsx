'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { useDoctolibFeature, type DoctolibStatus } from '@/lib/doctolib/use-doctolib-feature'

/**
 * Prévient, où que l'on soit dans Osteoflow, quand une synchronisation
 * Doctolib a ajouté des patients à Ma journée ou apporté des rendez-vous à
 * vérifier. Les synchronisations sans nouveauté restent silencieuses.
 */
const SEEN_KEY = 'myosteoflow_doctolib_sync_notified'

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? 's' : ''}`
}

export function DoctolibArrivalNotifier() {
  const visible = useDoctolibFeature()
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const check = async () => {
      if (document.hidden) return
      try {
        const res = await fetch('/api/doctolib/status', { headers: { 'x-osteoflow-app': '1' }, cache: 'no-store' })
        const { lastSync } = (await res.json()) as DoctolibStatus
        if (cancelled || !lastSync) return
        let already: string | null = null
        try {
          already = sessionStorage.getItem(SEEN_KEY)
        } catch {
          // Sans stockage, au pire une alerte en double.
        }
        if (already === lastSync.at) return
        try {
          sessionStorage.setItem(SEEN_KEY, lastSync.at)
        } catch {
          // idem
        }
        // Première visite de la session : on note sans alerter sur un envoi ancien.
        if (!already && Date.now() - Date.parse(lastSync.at) > 2 * 60_000) return
        if (lastSync.added === 0 && lastSync.newToReview === 0) return
        const onDayPlan = pathRef.current?.startsWith('/day-plan')
        const parts: string[] = []
        if (lastSync.added > 0) parts.push(`${plural(lastSync.added, 'patient')} ajouté${lastSync.added > 1 ? 's' : ''} à vos journées`)
        if (lastSync.newToReview > 0) parts.push(`${lastSync.newToReview} rendez-vous à vérifier`)
        const target = `/day-plan${lastSync.firstReviewDate ? `?date=${lastSync.firstReviewDate}` : ''}`
        toast({
          title: 'Agenda Doctolib synchronisé',
          description: parts.join(', ') + '.',
          action: onDayPlan ? undefined : (
            <ToastAction altText="Ouvrir Ma journée" onClick={() => router.push(target)}>
              {lastSync.newToReview > 0 ? 'Vérifier' : 'Voir'}
            </ToastAction>
          ),
        })
      } catch {
        // Hors ligne : prochain passage.
      }
    }
    check()
    const timer = setInterval(check, 8000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [visible, router, toast])

  return null
}
