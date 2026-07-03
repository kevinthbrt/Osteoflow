/**
 * Groups patients sharing the same email address (e.g. a parent's address
 * used for several children) so mass sends (broadcast/relance) deliver a
 * single physical email per address instead of one per patient.
 */

export interface GroupedRecipient {
  primaryId: string
  email: string
  linkedIds: string[]
}

export function groupPatientsByEmail<T extends { id: string; email: string }>(
  patients: T[]
): GroupedRecipient[] {
  const groups = new Map<string, GroupedRecipient>()

  for (const patient of patients) {
    const key = patient.email.trim().toLowerCase()
    const existing = groups.get(key)
    if (existing) {
      existing.linkedIds.push(patient.id)
    } else {
      groups.set(key, { primaryId: patient.id, email: patient.email, linkedIds: [] })
    }
  }

  return Array.from(groups.values())
}

/** "Emma" / "Emma et Lucas" / "Emma, Lucas et Noah" */
export function joinNames(names: string[]): string {
  const filtered = names.filter(Boolean)
  if (filtered.length === 0) return ''
  if (filtered.length === 1) return filtered[0]
  return `${filtered.slice(0, -1).join(', ')} et ${filtered[filtered.length - 1]}`
}
