'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RotateCcw, X } from 'lucide-react'

interface DraftResumeBannerProps {
  patientId: string
}

export function DraftResumeBanner({ patientId }: DraftResumeBannerProps) {
  const [hasDraft, setHasDraft] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const refresh = () => {
      fetch('/api/consultation/draft')
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          if (data.draft?.patient_id === patientId) {
            setHasDraft(true)
            setSavedAt(data.draft.savedAt ?? null)
          } else {
            setHasDraft(false)
            setSavedAt(null)
          }
        })
        .catch(() => {})
    }

    refresh()

    const onFocus = () => refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [patientId])

  if (!hasDraft) return null

  const handleResume = () => {
    sessionStorage.setItem('restore_consultation_draft', '1')
    router.push(`/patients/${patientId}/consultation/new`)
  }

  const handleDiscard = async () => {
    await fetch('/api/consultation/draft', { method: 'DELETE' })
    setHasDraft(false)
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0">
          <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Consultation en cours
          </p>
          {savedAt && (
            <p className="text-xs text-amber-600/70 dark:text-amber-500/70">
              Sauvegardée le {new Date(savedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs"
          onClick={handleResume}
        >
          Reprendre
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
          onClick={handleDiscard}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
