'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Home,
  Loader2,
} from 'lucide-react'

const DOCTOLIB_HOME = 'https://pro.doctolib.fr'

export default function DoctolibPage() {
  const webviewRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUrl, setCurrentUrl] = useState(DOCTOLIB_HOME)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(!!(window as any).electronAPI?.isDesktop)
  }, [])

  useEffect(() => {
    if (!isElectron) return

    const webview = webviewRef.current
    if (!webview) return

    const handleStartLoading = () => setIsLoading(true)
    const handleStopLoading = () => {
      setIsLoading(false)
      setCanGoBack(webview.canGoBack())
      setCanGoForward(webview.canGoForward())
      setCurrentUrl(webview.getURL())
    }

    webview.addEventListener('did-start-loading', handleStartLoading)
    webview.addEventListener('did-stop-loading', handleStopLoading)

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
    }
  }, [isElectron])

  if (!isElectron) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center">
        <ExternalLink className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Doctolib</h2>
        <p className="text-muted-foreground mb-4">
          L&apos;intégration Doctolib est disponible uniquement dans l&apos;application de bureau.
        </p>
        <Button asChild variant="outline">
          <a href={DOCTOLIB_HOME} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Ouvrir Doctolib dans le navigateur
          </a>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => webviewRef.current?.goBack()}
          disabled={!canGoBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => webviewRef.current?.goForward()}
          disabled={!canGoForward}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => webviewRef.current?.reload()}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => webviewRef.current?.loadURL(DOCTOLIB_HOME)}
        >
          <Home className="h-4 w-4" />
        </Button>
        <Input
          value={currentUrl}
          readOnly
          className="flex-1 text-xs h-8 bg-muted/50"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const url = webviewRef.current?.getURL() || DOCTOLIB_HOME
            window.open(url, '_blank')
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Webview */}
      <div className="flex-1 relative">
        <webview
          ref={webviewRef}
          src={DOCTOLIB_HOME}
          style={{ width: '100%', height: '100%' }}
          partition="persist:doctolib"
        />
      </div>
    </div>
  )
}
