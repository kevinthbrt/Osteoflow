/**
 * Currency/market context for the current practitioner.
 *
 * The app runs as one local install per practitioner (or per cabinet), so a
 * module-level value is enough to drive currency formatting everywhere
 * without threading a `country` prop through every component that displays
 * an amount — it's set once from the practitioner record (see
 * `CurrencySync`) and read by `formatCurrency`. Server-side code (API
 * routes) should pass the practitioner's `country` explicitly instead, since
 * a request may serve a different practitioner than the one that last set
 * this module state.
 */

export type BillingCountry = 'FR' | 'QC'

let currentCountry: BillingCountry = 'FR'

export function setCurrentCountry(country: string | null | undefined): void {
  currentCountry = country === 'QC' ? 'QC' : 'FR'
}

export function getCurrentCountry(): BillingCountry {
  return currentCountry
}

export function getCurrencyCode(country?: string | null): 'EUR' | 'CAD' {
  return (country ?? currentCountry) === 'QC' ? 'CAD' : 'EUR'
}

export function getCurrencySymbol(country?: string | null): '€' | '$' {
  return getCurrencyCode(country) === 'CAD' ? '$' : '€'
}
