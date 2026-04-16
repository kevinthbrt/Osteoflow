'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Delete } from 'lucide-react'

export default function PinSetupPage() {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'enter' | 'confirm'>('enter')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const activePin = step === 'enter' ? pin : confirmPin
  const setActivePin = step === 'enter' ? setPin : setConfirmPin

  const handleDigit = (digit: string) => {
    if (activePin.length < 4) {
      setActivePin(activePin + digit)
    }
  }

  const handleDelete = () => {
    setActivePin(activePin.slice(0, -1))
  }

  const handleNext = async () => {
    if (step === 'enter') {
      if (pin.length !== 4) return
      setStep('confirm')
      return
    }

    // Confirm step — check codes match
    if (confirmPin !== pin) {
      toast({
        variant: 'destructive',
        title: 'Codes différents',
        description: 'Les deux codes PIN ne correspondent pas. Réessayez.',
      })
      setPin('')
      setConfirmPin('')
      setStep('enter')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/license/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', pin }),
      })
      if (!res.ok) throw new Error()
      toast({
        variant: 'success',
        title: 'Code PIN créé',
        description: 'Vous pourrez vous connecter rapidement au prochain démarrage.',
      })
      router.push('/login')
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder le code PIN.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const dots = Array.from({ length: 4 }, (_, i) => i < activePin.length)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {step === 'enter' ? 'Créer votre code PIN' : 'Confirmer le code PIN'}
          </CardTitle>
          <CardDescription>
            {step === 'enter'
              ? 'Choisissez un code à 4 chiffres pour vous connecter rapidement'
              : 'Saisissez à nouveau votre code PIN pour confirmer'}
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

          <Button
            onClick={handleNext}
            className="w-full"
            disabled={activePin.length !== 4 || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {step === 'enter' ? 'Continuer' : 'Valider'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
