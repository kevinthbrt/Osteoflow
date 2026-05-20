'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Lock, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Step = 'verify-pin' | 'new-password' | 'success' | 'no-pin'

function ForgotPasswordContent() {
  const [step, setStep] = useState<Step>('verify-pin')
  const [pin, setPin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const { toast } = useToast()

  useEffect(() => {
    // Check if PIN is configured
    fetch('/api/license/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check' }) })
      .then((r) => r.json())
      .then((d) => setHasPinConfigured(!!d.has_pin))
      .catch(() => setHasPinConfigured(false))
  }, [])

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length !== 4) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/license/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin }),
      })
      const data = await res.json()
      if (data.valid) {
        setStep('new-password')
      } else {
        toast({ variant: 'destructive', title: 'PIN incorrect', description: 'Veuillez réessayer.' })
        setPin('')
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de vérifier le PIN.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Les mots de passe ne correspondent pas.' })
      return
    }
    if (newPassword.length < 4) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le mot de passe doit contenir au moins 4 caractères.' })
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword, skipOldPassword: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erreur', description: data.error || 'Impossible de changer le mot de passe.' })
        return
      }
      setStep('success')
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de changer le mot de passe.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (hasPinConfigured === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
          <CardDescription>
            {step === 'verify-pin' && 'Vérifiez votre identité avec votre code PIN'}
            {step === 'new-password' && 'Choisissez un nouveau mot de passe'}
            {step === 'success' && 'Mot de passe mis à jour avec succès'}
            {step === 'no-pin' && 'Récupération impossible sans PIN'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!hasPinConfigured ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p className="font-medium mb-1">Aucun PIN configuré</p>
                <p>La récupération du mot de passe nécessite un PIN. Contactez le support si vous ne pouvez pas accéder à l&apos;application.</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Pour éviter ce problème à l&apos;avenir, configurez un PIN dans Paramètres → Sécurité.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Button>
              </Link>
            </div>
          ) : step === 'verify-pin' ? (
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">Code PIN (4 chiffres)</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="• • • •"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  disabled={isLoading}
                  autoFocus
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || pin.length !== 4}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vérifier le PIN
              </Button>
              <Link href="/login">
                <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  Annuler
                </Button>
              </Link>
            </form>
          ) : step === 'new-password' ? (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 pr-10"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || !newPassword || !confirmPassword}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer le mot de passe
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                Votre mot de passe a été mis à jour avec succès.
              </div>
              <Button className="w-full" onClick={() => router.push('/login')}>
                Se connecter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  )
}
