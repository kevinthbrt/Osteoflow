'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Lock, Mail, Eye, EyeOff, ExternalLink } from 'lucide-react'
import Image from 'next/image'

const OSTEOUPGRADE_URL =
  process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://www.osteo-upgrade.fr'

// Auth is proxied through /api/license/auth to avoid CORS in dev and desktop
const AUTH_ENDPOINT = '/api/license/auth'

export default function OsteoupgradeLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/license')
      .then((r) => r.json())
      .then((d) => setDeviceId(d.device_id))
      .catch(() => {})
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceId) return
    setIsLoading(true)

    try {
      const authRes = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          device_id: deviceId,
          device_name: navigator.platform || 'Desktop',
        }),
      })

      const authData = await authRes.json()

      if (!authRes.ok) {
        toast({
          variant: 'destructive',
          title: 'Connexion impossible',
          description: authData.error || 'Identifiants incorrects',
        })
        return
      }

      await fetch('/api/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: authData.token,
          email: authData.email,
          role: authData.role,
          expires_at: authData.expires_at,
        }),
      })

      await fetch('/api/license/mark-verified', { method: 'POST' })

      toast({
        variant: 'success',
        title: 'Connecté',
        description: 'Bienvenue sur MyOsteoFlow',
      })

      router.push('/pin-setup')
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur réseau',
        description: 'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Image src="/icon.png" alt="MyOsteoFlow" width={56} height={56} />
          </div>
          <CardTitle className="text-2xl font-bold">MyOsteoFlow</CardTitle>
          <CardDescription>
            Connectez-vous avec votre compte Osteoupgrade Premium
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Osteoupgrade</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email || !password || !deviceId}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Pas encore abonné ?{' '}
              <a
                href={OSTEOUPGRADE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                S&apos;abonner à Osteoupgrade
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
