'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { useDoctolibFeature } from '@/lib/doctolib/use-doctolib-feature'

/**
 * Prévient, où que l'on soit dans Osteoflow, quand des rendez-vous Doctolib
 * viennent d'arriver. Ma journée les affiche déjà : pas d'alerte là-bas.
 */
const SEEN_KEY = 'myosteoflow_doctolib_notified'

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
      if (document.hidden || pathRef.current?.startsWith('/day-plan')) return
      try {
        const res = await fetch('/api/doctolib/import', { headers: { 'x-osteoflow-app': '1' }, cache: 'no-store' })
        const { pending } = (await res.json()) as { pending: { receivedAt: string; appointments: unknown[] } | null }
        if (cancelled || !pending?.appointments?.length) return
        let already: string | null = null
        try {
          already = sessionStorage.getItem(SEEN_KEY)
        } catch {
          // Sans stockage, au pire une alerte en double.
        }
        if (already === pending.receivedAt) return
        try {
          sessionStorage.setItem(SEEN_KEY, pending.receivedAt)
        } catch {
          // idem
        }
        const count = pending.appointments.length
        toast({
          title: `${count} rendez-vous Doctolib reçu${count > 1 ? 's' : ''}`,
          description: 'À valider dans Ma journée avant d’ajouter les patients.',
          action: (
            <ToastAction altText="Ouvrir Ma journée" onClick={() => router.push('/day-plan')}>
              Ouvrir
            </ToastAction>
          ),
        })
      } catch {
        // Hors ligne : prochain passage.
      }
    }
    check()
    const timer = setInterval(check, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [visible, router, toast])

  return null
}
