'use client'

import { useEffect } from 'react'
import { setCurrentCountry } from '@/lib/utils/currency'

/**
 * Bridges the practitioner's country (fetched server-side in the dashboard
 * layout) into the client-side currency module state, so `formatCurrency`
 * shows € or $ consistently across the app without prop-drilling.
 */
export function CurrencySync({ country }: { country: string | null | undefined }) {
  useEffect(() => {
    setCurrentCountry(country)
  }, [country])

  return null
}
