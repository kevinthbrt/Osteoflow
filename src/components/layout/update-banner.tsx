'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, X, CheckCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ElectronAPI {
  isDesktop: boolean
  platform: string
  arch: string
  onUpdateAvailable: (callback: (version: string) => void) => void
  onUpdateProgress: (callback: (percent: number) => void) => void
  onUpdateDownloaded: (callback: (version: string) => void) => void
  installUpdate: () => void
}

type UpdateState = 'idle' | 'downloading' | 'ready'

function getElectronAPI(): ElectronAPI | undefined {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
}

function getMacArm64DmgUrl(version: string): string {
  return `https://github.com/kevinthbrt/Osteoflow/releases/download/v${version}/Myosteoflow-${version}-arm64.dmg`
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [dismissed, setDismissed] = useState(false)
  const [showXattrHelp, setShowXattrHelp] = useState(false)

  useEffect(() => {
    const api = getElectronAPI()
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

  const api = getElectronAPI()
  const isMacArm64 = api?.platform === 'darwin' && api?.arch === 'arm64'

  // Mac ARM64 : téléchargement manuel du DMG + instructions xattr
  if (state === 'ready' && isMacArm64) {
    return (
      <div className="relative z-50 border-b-2 border-emerald-400 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white px-4 py-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle className="h-5 w-5" />
            Mise à jour v{version} disponible
          </div>

          <div className="flex flex-wrap justify-center items-center gap-2 text-sm text-emerald-100">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
              Téléchargez le nouveau DMG
            </span>
            <ArrowRight className="h-3 w-3 text-emerald-300" />
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
              Glissez l&apos;app dans Applications
            </span>
            <ArrowRight className="h-3 w-3 text-emerald-300" />
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
              Relancez l&apos;application
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-9 px-6 text-sm font-semibold shadow-lg"
              onClick={() => window.open(getMacArm64DmgUrl(version), '_blank')}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger v{version} (Apple Silicon)
            </Button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setShowXattrHelp(!showXattrHelp)}
            className="text-xs text-emerald-200 hover:text-white flex items-center gap-1 transition-colors"
          >
            {showXattrHelp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            ⚠️ Si l&apos;app ne s&apos;ouvre pas après installation
          </button>

          {showXattrHelp && (
            <div className="max-w-lg w-full bg-black/20 rounded-lg p-3 text-xs text-emerald-100 space-y-2">
              <p className="font-semibold text-white">
                macOS peut bloquer l&apos;app après une mise à jour manuelle. Voici comment débloquer en 3 étapes :
              </p>
              <p>
                <span className="font-semibold text-white">1.</span> Ouvrez le <span className="font-semibold text-white">Terminal</span> :
                appuyez sur <kbd className="bg-white/20 px-1 rounded">⌘ Espace</kbd>, tapez{' '}
                <span className="font-semibold text-white">Terminal</span>, puis appuyez sur{' '}
                <kbd className="bg-white/20 px-1 rounded">Entrée</kbd>.
              </p>
              <p>
                <span className="font-semibold text-white">2.</span> Dans la fenêtre noire qui s&apos;ouvre,
                copiez-collez la commande ci-dessous puis appuyez sur <kbd className="bg-white/20 px-1 rounded">Entrée</kbd> :
              </p>
              <div className="bg-black/40 rounded px-3 py-2 font-mono text-white text-xs select-all cursor-text">
                xattr -cr /Applications/MyOsteoFlow.app
              </div>
              <p>
                <span className="font-semibold text-white">3.</span> Fermez le Terminal et relancez MyOsteoFlow
                normalement depuis le dossier Applications.
              </p>
              <p className="text-emerald-300 text-[10px]">
                Cette manipulation est nécessaire à chaque mise à jour installée manuellement via DMG.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Windows / Linux / Mac Intel : mise à jour automatique via redémarrage
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

  // Téléchargement en cours (Windows/Linux/Mac Intel)
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
