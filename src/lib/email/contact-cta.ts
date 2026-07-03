/**
 * Resolves the "prendre rendez-vous" call-to-action for an email: the
 * practitioner's booking link when configured, otherwise a direct contact
 * fallback (email or phone) so the button is always actionable.
 */

export interface ContactCta {
  label: string
  url: string
}

export function resolveBookingCta(practitioner: {
  booking_url?: string | null
  email?: string | null
  phone?: string | null
}): ContactCta | null {
  if (practitioner.booking_url) {
    return { label: 'Prendre rendez-vous en ligne', url: practitioner.booking_url }
  }
  if (practitioner.email) {
    return { label: 'Me contacter', url: `mailto:${practitioner.email}` }
  }
  if (practitioner.phone) {
    return { label: 'Me contacter', url: `tel:${practitioner.phone}` }
  }
  return null
}
