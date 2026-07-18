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
import { cn } from '@/lib/utils'
import type { Practitioner } from '@/types/database'

type BillingCountry = 'FR' | 'QC'

// Pastille "découverte" affichée sur le drapeau jusqu'à la première
// ouverture du menu — même logique que le hint du bouton de thème
// (voir src/lib/theme.ts), mais propre à cette fonctionnalité.
const COUNTRY_SWITCHER_HINT_SEEN_KEY = 'myosteoflow-country-switcher-hint-seen'

function isCountrySwitcherHintSeen(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(COUNTRY_SWITCHER_HINT_SEEN_KEY) === '1'
}

function markCountrySwitcherHintSeen() {
  window.localStorage.setItem(COUNTRY_SWITCHER_HINT_SEEN_KEY, '1')
}

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
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    setCountry(practitioner?.country === 'QC' ? 'QC' : 'FR')
  }, [practitioner?.country])

  // Lu seulement après le montage (le rendu serveur ne connaît pas
  // localStorage) pour éviter un mismatch d'hydratation.
  useEffect(() => {
    setShowHint(!isCountrySwitcherHintSeen())
  }, [])

  const dismissHint = () => {
    if (!showHint) return
    setShowHint(false)
    markCountrySwitcherHintSeen()
  }

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
    <div className="relative">
      <DropdownMenu onOpenChange={(open) => { if (open) dismissHint() }}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('rounded-full text-lg h-9 w-9', showHint && 'pulse-dot')}
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

      {showHint && (
        <div className="absolute top-full right-0 mt-2 z-50 w-56 animate-in fade-in slide-in-from-top-1">
          <div className="relative rounded-2xl border border-primary/30 bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-xl">
            <div className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-primary/30 bg-popover" />
            <p className="font-medium">Nouveau 🇫🇷 🇨🇦</p>
            <p className="mt-0.5 text-muted-foreground">
              Choisissez ici votre pays de facturation : la devise, les taxes et les factures s&apos;adaptent automatiquement.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
