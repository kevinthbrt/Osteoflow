'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { setCurrentCountry } from '@/lib/utils/currency'
import type { Practitioner } from '@/types/database'

type BillingCountry = 'FR' | 'QC'

const COUNTRIES: { value: BillingCountry; flag: string; label: string; defaultVatRegime: string }[] = [
  { value: 'FR', flag: '🇫🇷', label: 'France', defaultVatRegime: 'exempt_261' },
  { value: 'QC', flag: '🇨🇦', label: 'Québec', defaultVatRegime: 'qc_not_registered' },
]

/**
 * Quick country switcher shown in the header. Changing it updates the
 * practitioner's billing country right away — currency, tax regime and
 * document mentions everywhere else in the app follow from that single
 * setting (see src/lib/utils/currency.ts and the Paramètres > Profil tab).
 */
export function CountrySwitcher({ practitioner }: { practitioner: Practitioner | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [country, setCountry] = useState<BillingCountry>(
    practitioner?.country === 'QC' ? 'QC' : 'FR'
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setCountry(practitioner?.country === 'QC' ? 'QC' : 'FR')
  }, [practitioner?.country])

  if (!practitioner) return null

  const current = COUNTRIES.find((c) => c.value === country) ?? COUNTRIES[0]

  const handleSelect = async (next: BillingCountry) => {
    if (next === country || isSaving) return

    const previous = country
    const nextConfig = COUNTRIES.find((c) => c.value === next)!

    // Optimistic: currency/labels elsewhere in the app update immediately.
    setCountry(next)
    setCurrentCountry(next)
    setIsSaving(true)

    try {
      const db = createClient()
      const { error } = await db
        .from('practitioners')
        .update({ country: next, vat_regime: nextConfig.defaultVatRegime })
        .eq('id', practitioner.id)

      if (error) throw error

      toast({
        variant: 'success',
        title: `Pays de facturation : ${nextConfig.label}`,
        description: "Devise, taxes et numéros affichés ont été mis à jour. Vérifiez l'onglet Profil dans les paramètres.",
      })
      router.refresh()
    } catch {
      // Revert on failure
      setCountry(previous)
      setCurrentCountry(previous)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de changer le pays de facturation',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-lg h-9 w-9"
          title="Pays de facturation"
          disabled={isSaving}
        >
          <span aria-hidden>{current.flag}</span>
          <span className="sr-only">Pays de facturation : {current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
        <DropdownMenuLabel className="px-2 text-xs font-normal text-muted-foreground">
          Pays de facturation
        </DropdownMenuLabel>
        {COUNTRIES.map((c) => (
          <DropdownMenuItem
            key={c.value}
            onClick={() => handleSelect(c.value)}
            className="rounded-xl py-2.5 gap-2"
          >
            <span className="text-lg" aria-hidden>{c.flag}</span>
            <span className="flex-1">{c.label}</span>
            {c.value === country && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
