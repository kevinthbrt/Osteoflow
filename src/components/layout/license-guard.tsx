'use client'

/**
 * LicenseGuard
 *
 * Invisible client component mounted inside the dashboard layout.
 * Listens for the 'license-expired' IPC event from the Electron main
 * process (30-min heartbeat) and handles it gracefully:
 *   - Shows a toast explaining why access is interrupted
 *   - Clears the local license state
 *   - Redirects to the Osteoupgrade login screen after a short delay
 *
 * Only active in Electron (window.electronAPI must exist).
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

const REDIRECT_DELAY_MS = 8_000 // 8 seconds to read the message

export function LicenseGuard() {
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onLicenseExpired) return // not in Electron, skip

    api.onLicenseExpired(async (payload: { message: string; code: string }) => {
      const isConcurrent = payload.code === 'CONCURRENT_SESSION'

      toast({
        variant: 'destructive',
        title: isConcurrent ? 'Session en double détectée' : 'Abonnement expiré',
        description:
          payload.message +
          ` Vous allez être redirigé dans ${REDIRECT_DELAY_MS / 1000} secondes.`,
        duration: REDIRECT_DELAY_MS + 1000,
      })

      setTimeout(async () => {
        // Clear local license so the PIN screen won’t appear
        await fetch('/api/license', { method: 'DELETE' }).catch(() => {})
        router.push('/auth/osteoupgrade')
      }, REDIRECT_DELAY_MS)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}