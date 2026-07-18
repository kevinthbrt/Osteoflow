/**
 * Centralised helpers for practitioner profession, display label and
 * registration numbers (RPPS vs RPE/RNE for étiopathes).
 *
 * Single source of truth used by invoices, letters and emails so that
 * the "profession" field drives everything (the old free-text "specialty"
 * field has been removed from the settings form).
 */

export type Profession = 'osteopathe' | 'etiopathe' | 'chiropracteur' | 'autre'

/** Human-readable label shown on invoices, letters and emails. */
export const PROFESSION_LABELS: Record<Profession, string> = {
  osteopathe: 'Ostéopathe D.O',
  etiopathe: 'Étiopathe',
  chiropracteur: 'Chiropracteur',
  autre: 'Praticien',
}

/** Options for the profession <Select> in settings. */
export const PROFESSION_OPTIONS: { value: Profession; label: string }[] = [
  { value: 'osteopathe', label: 'Ostéopathe D.O' },
  { value: 'chiropracteur', label: 'Chiropracteur' },
  { value: 'etiopathe', label: 'Étiopathe' },
  { value: 'autre', label: 'Autre' },
]

function normalizeProfession(profession?: string | null): Profession {
  if (profession === 'etiopathe' || profession === 'chiropracteur' || profession === 'autre') {
    return profession
  }
  return 'osteopathe'
}

/**
 * Display label for a practitioner's profession.
 * For "autre", falls back to the stored free-text specialty if any.
 */
export function getProfessionLabel(
  profession?: string | null,
  specialty?: string | null
): string {
  const p = normalizeProfession(profession)
  if (p === 'autre' && specialty && specialty.trim()) {
    return specialty.trim()
  }
  return PROFESSION_LABELS[p]
}

export interface RegistrationLine {
  label: string
  value: string
}

/**
 * Registration number lines to print on invoices / letters.
 * - Québec has no equivalent registry: practitioners show their association
 *   membership number instead (osteopathy isn't a regulated order there).
 * - Étiopathes (France) use RPE + RNE (two separate lines).
 * - Everyone else in France uses RPPS.
 */
export function getRegistrationLines(practitioner: {
  profession?: string | null
  rpps?: string | null
  rpe?: string | null
  rne?: string | null
  country?: string | null
  association_number?: string | null
}): RegistrationLine[] {
  const lines: RegistrationLine[] = []

  if (practitioner.country === 'QC') {
    if (practitioner.association_number && practitioner.association_number.trim()) {
      lines.push({ label: 'N° de membre', value: practitioner.association_number.trim() })
    }
    return lines
  }

  const p = normalizeProfession(practitioner.profession)

  if (p === 'etiopathe') {
    if (practitioner.rpe && practitioner.rpe.trim()) {
      lines.push({ label: 'RPE', value: practitioner.rpe.trim() })
    }
    if (practitioner.rne && practitioner.rne.trim()) {
      lines.push({ label: 'RNE', value: practitioner.rne.trim() })
    }
  } else {
    if (practitioner.rpps && practitioner.rpps.trim()) {
      lines.push({ label: 'RPPS', value: practitioner.rpps.trim() })
    }
  }

  return lines
}
