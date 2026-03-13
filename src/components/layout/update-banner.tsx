'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, X, CheckCircle, ArrowRight } from 'lucide-react'
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
      setDismissed(false)
    })

    api.onUpdateProgress((percent) => {
      setProgress(percent)
    })

    api.onUpdateDownloaded((v) => {
      setVersion(v)
      setState('ready')
      setDismissed(false)
    })
  }, [])

  if (state === 'idle' || (state === 'downloading' && dismissed)) return null

  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI

  // When update is ready: prominent, non-dismissable banner with instructions
  if (state === 'ready') {
    return (
      <div className="relative z-50 border-b-2 border-emerald-400 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white px-4 py-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle className="h-5 w-5" />
            Mise à jour v{version} prête à installer
          </div>

          <div className="flex items-center gap-2 text-sm text-emerald-100">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
              Cliquez sur le bouton ci-dessous
            </span>
            <ArrowRight className="h-3 w-3 text-emerald-300" />
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
              L&apos;application se ferme et se met à jour
            </span>
            <ArrowRight className="h-3 w-3 text-emerald-300" />
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
              Elle redémarre automatiquement
            </span>
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="h-9 px-6 text-sm font-semibold shadow-lg"
            onClick={() => api?.installUpdate()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Redémarrer et mettre à jour
          </Button>
        </div>
      </div>
    )
  }

  // Downloading state: can be dismissed
  return (
    <div className="relative z-50 border-b bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5">
      <div className="flex items-center justify-center gap-3 text-sm">
        <Download className="h-4 w-4 animate-bounce" />
        <span>
          Mise à jour <strong>v{version}</strong> en cours de téléchargement...
          {progress > 0 && <span className="ml-1 tabular-nums">{Math.round(progress)}%</span>}
        </span>
        {progress > 0 && (
          <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
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
