'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

/**
 * Paramètres financiers du praticien, partagés entre les onglets Charges et
 * Ma rémunération.
 *
 * L'état est volontairement détenu à un seul endroit : les deux onglets
 * éditent des champs différents de la même ligne, et l'enregistrement réécrit
 * toute la ligne. Deux copies indépendantes du formulaire se seraient écrasées
 * l'une l'autre au premier enregistrement.
 */
export interface FinanceSettingsForm {
  regime: string
  retirement_fund: string
  versement_liberatoire: boolean
  acre: boolean
  marital_status: string
  dependents: number
  other_household_income: number
  safety_margin_rate: number
  target_monthly_draw: number | null
  vehicle_mode: string
  vehicle_kind: string
  vehicle_horsepower: number
  vehicle_annual_km: number
  vehicle_electric: boolean
  optional_retirement: number
  optional_prevoyance: number
  input_mode: string
  simple_annual_expenses: number
  simple_annual_expenses_vat: number
  simple_flat_allowances: number
  prior_year_social_settlement: number
}

export const DEFAULT_FINANCE_FORM: FinanceSettingsForm = {
  regime: 'micro_bnc',
  retirement_fund: 'ssi',
  versement_liberatoire: false,
  acre: false,
  marital_status: 'single',
  dependents: 0,
  other_household_income: 0,
  safety_margin_rate: 5,
  target_monthly_draw: null,
  vehicle_mode: 'none',
  vehicle_kind: 'car',
  vehicle_horsepower: 5,
  vehicle_annual_km: 0,
  vehicle_electric: false,
  optional_retirement: 0,
  optional_prevoyance: 0,
  input_mode: 'real',
  simple_annual_expenses: 0,
  simple_annual_expenses_vat: 0,
  simple_flat_allowances: 0,
  prior_year_social_settlement: 0,
}

export interface UseFinanceSettings {
  form: FinanceSettingsForm
  setForm: (updater: (previous: FinanceSettingsForm) => FinanceSettingsForm) => void
  patch: (values: Partial<FinanceSettingsForm>) => void
  /** Régime de TVA, piloté depuis les paramètres de facturation. */
  vatRegime: string
  country: string
  isLoading: boolean
  isSaving: boolean
  /** Faux tant que le praticien n'a jamais enregistré ses paramètres. */
  isConfigured: boolean
  save: () => Promise<boolean>
  /** Incrémenté à chaque enregistrement, pour rafraîchir la simulation. */
  revision: number
}

export function useFinanceSettings(): UseFinanceSettings {
  const [form, setFormState] = useState<FinanceSettingsForm>(DEFAULT_FINANCE_FORM)
  const [vatRegime, setVatRegime] = useState('exempt_261')
  const [country, setCountry] = useState('FR')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [revision, setRevision] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/finance/settings')
        if (!response.ok) return
        const payload = await response.json()
        if (cancelled) return

        setVatRegime(payload.vatRegime ?? 'exempt_261')
        setCountry(payload.country ?? 'FR')

        if (payload.settings) {
          setIsConfigured(true)
          setFormState({
            regime: payload.settings.regime ?? 'micro_bnc',
            retirement_fund: payload.settings.retirement_fund ?? 'ssi',
            versement_liberatoire: Boolean(payload.settings.versement_liberatoire),
            acre: Boolean(payload.settings.acre),
            marital_status: payload.settings.marital_status ?? 'single',
            dependents: payload.settings.dependents ?? 0,
            other_household_income: payload.settings.other_household_income ?? 0,
            safety_margin_rate: payload.settings.safety_margin_rate ?? 5,
            target_monthly_draw: payload.settings.target_monthly_draw ?? null,
            vehicle_mode: payload.settings.vehicle_mode ?? 'none',
            vehicle_kind: payload.settings.vehicle_kind ?? 'car',
            vehicle_horsepower: payload.settings.vehicle_horsepower ?? 5,
            vehicle_annual_km: payload.settings.vehicle_annual_km ?? 0,
            vehicle_electric: Boolean(payload.settings.vehicle_electric),
            optional_retirement: payload.settings.optional_retirement ?? 0,
            optional_prevoyance: payload.settings.optional_prevoyance ?? 0,
            input_mode: payload.settings.input_mode ?? 'real',
            simple_annual_expenses: payload.settings.simple_annual_expenses ?? 0,
            simple_annual_expenses_vat: payload.settings.simple_annual_expenses_vat ?? 0,
            simple_flat_allowances: payload.settings.simple_flat_allowances ?? 0,
            prior_year_social_settlement:
              payload.settings.prior_year_social_settlement ?? 0,
          })
        }
      } catch {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: 'Impossible de charger vos paramètres financiers',
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [toast])

  const setForm = useCallback(
    (updater: (previous: FinanceSettingsForm) => FinanceSettingsForm) => {
      setFormState(updater)
    },
    [],
  )

  const patch = useCallback((values: Partial<FinanceSettingsForm>) => {
    setFormState((previous) => ({ ...previous, ...values }))
  }, [])

  const save = useCallback(async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/finance/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Enregistrement impossible')
      }

      setIsConfigured(true)
      setRevision((value) => value + 1)
      toast({ variant: 'success', title: 'Paramètres enregistrés' })
      return true
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description:
          error instanceof Error ? error.message : 'Enregistrement impossible',
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }, [form, toast])

  return {
    form,
    setForm,
    patch,
    vatRegime,
    country,
    isLoading,
    isSaving,
    isConfigured,
    save,
    revision,
  }
}
