'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Delete, LogOut } from 'lucide-react'

const MAX_ATTEMPTS = 5

export default function PinPage() {
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [email, setEmail] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/license')
      .then((r) => r.json())
      .then((d) => setEmail(d.email))
      .catch(() => {})
  }, [])

  const handleDigit = (digit: string) => {
    if (pin.length < 4 && !isLoading) {
      const next = pin + digit
      setPin(next)
      if (next.length === 4) verifyPin(next)
    }
  }

  const handleDelete = () => {
    if (!isLoading) setPin(pin.slice(0, -1))
  }

  const verifyPin = async (code: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/license/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: code }),
      })
      const data = await res.json()

      if (data.valid) {
        // Mark session verified (in-memory flag)
        await fetch('/api/license/mark-verified', { method: 'POST' })
        // Background online check — non-blocking, grace period handles offline
        fetch('/api/license/online-verify', { method: 'POST' }).catch(() => {})
        router.push('/login')
      } else {
        const next = attempts + 1
        setAttempts(next)
        setPin('')
        if (next >= MAX_ATTEMPTS) {
          toast({
            variant: 'destructive',
            title: 'Trop de tentatives',
            description:
              'Reconnectez-vous avec votre compte Osteoupgrade.',
          })
          router.push('/auth/osteoupgrade')
        } else {
          toast({
            variant: 'destructive',
            title: 'Code incorrect',
            description: `${MAX_ATTEMPTS - next} tentative(s) restante(s)`,
          })
        }
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de vérifier le code.',
      })
      setPin('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeAccount = async () => {
    await fetch('/api/license', { method: 'DELETE' })
    router.push('/auth/osteoupgrade')
  }

  const dots = Array.from({ length: 4 }, (_, i) => i < pin.length)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
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
          <CardTitle className="text-xl">Osteoflow</CardTitle>
          <CardDescription>
            {email ? `Compte : ${email}` : 'Entrez votre code PIN'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PIN dots indicator */}
          <div className="flex justify-center gap-4 py-2">
            {dots.map((filled, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  filled
                    ? 'bg-primary border-primary scale-110'
                    : 'border-muted-foreground'
                }`}
              />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(
              (key, i) => {
                if (key === '') return <div key={i} />
                return (
                  <button
                    key={key + i}
                    onClick={() =>
                      key === '⌫' ? handleDelete() : handleDigit(key)
                    }
                    disabled={isLoading}
                    className="h-14 rounded-xl border bg-background hover:bg-muted active:scale-95 font-semibold text-lg transition-all disabled:opacity-50 flex items-center justify-center select-none"
                  >
                    {key === '⌫' ? (
                      <Delete className="h-5 w-5" />
                    ) : (
                      key
                    )}
                  </button>
                )
              }
            )}
          </div>

          {isLoading && (
            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <button
            onClick={handleChangeAccount}
            className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 py-1 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Changer de compte
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
