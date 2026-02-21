'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, KeyRound, ShieldCheck } from 'lucide-react'

declare global {
  interface Window {
    electronAPI?: {
      isDesktop?: boolean
      reloadApp?: () => Promise<void>
    }
  }
}

export default function ActivatePage() {
  const [licenseKey, setLicenseKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activated, setActivated] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const { toast } = useToast()

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!licenseKey.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      })

      const data = await res.json()

      if (!res.ok || !data.valid) {
        toast({
          variant: 'destructive',
          title: 'Licence invalide',
          description: data.error ?? 'La clé de licence fournie est incorrecte.',
        })
        return
      }

      setCustomerName(data.customer ?? '')
      setActivated(true)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de vérifier la licence. Veuillez réessayer.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = async () => {
    // In Electron, ask the main process to reload the app (re-checks the license)
    if (window.electronAPI?.reloadApp) {
      await window.electronAPI.reloadApp()
    } else {
      // Web fallback
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Osteoflow</CardTitle>
          <CardDescription>
            {activated
              ? 'Votre licence a été activée avec succès'
              : 'Entrez votre clé de licence pour activer l\'application'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {activated ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
                <ShieldCheck className="h-10 w-10 text-green-600" />
                <div className="text-center">
                  <p className="font-semibold">Licence activée</p>
                  {customerName && (
                    <p className="text-sm text-green-700 mt-1">Bienvenue, {customerName}</p>
                  )}
                </div>
              </div>
              <Button onClick={handleContinue} className="w-full">
                Continuer vers l&apos;application
              </Button>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="license_key">Clé de licence</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="license_key"
                    placeholder="Collez votre clé de licence ici"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 font-mono text-xs"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Vous avez reçu cette clé par email après votre achat.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !licenseKey.trim()}
                className="w-full"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activer la licence
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Pas encore de licence ?{' '}
                <a
                  href="mailto:contact@osteoflow.fr"
                  className="underline hover:text-foreground"
                >
                  Contactez-nous
                </a>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
