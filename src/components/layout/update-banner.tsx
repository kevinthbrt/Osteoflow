'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ElectronAPI {
  isDesktop: boolean
  platform: string
  onUpdateAvailable: (callback: (version: string) => void) => void
  onUpdateProgress: (callback: (percent: number) => void) => void
  onUpdateDownloaded: (callback: (version: string) => void) => void
  installUpdate: () => void
}

type UpdateState = 'idle' | 'downloading' | 'ready'

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
    if (!api?.isDesktop) return

    api.onUpdateAvailable((v) => {
      setVersion(v)
      setState('downloading')
    })

    api.onUpdateProgress((percent) => {
      setProgress(percent)
    })

    api.onUpdateDownloaded((v) => {
      setVersion(v)
      setState('ready')
    })
  }, [])

  if (state === 'idle' || dismissed) return null

  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI

  return (
    <div className="relative z-50 border-b bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5">
      <div className="flex items-center justify-center gap-3 text-sm">
        {state === 'downloading' && (
          <>
            <Download className="h-4 w-4 animate-bounce" />
            <span>
              Mise à jour <strong>v{version}</strong> en cours de téléchargement...
              {progress > 0 && <span className="ml-1 tabular-nums">{progress}%</span>}
            </span>
            {progress > 0 && (
              <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </>
        )}

        {state === 'ready' && (
          <>
            <RefreshCw className="h-4 w-4" />
            <span>
              La version <strong>v{version}</strong> est prête. Redémarrez pour appliquer la mise à jour.
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-3 text-xs font-semibold"
              onClick={() => api?.installUpdate()}
            >
              Redémarrer maintenant
            </Button>
          </>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
