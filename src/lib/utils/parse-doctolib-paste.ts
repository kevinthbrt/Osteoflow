import type { PatientFormData } from '@/lib/validations/patient'

type ParsedPatientData = Partial<PatientFormData>

/**
 * Parse raw text copied from a Doctolib patient page into structured patient data.
 * Supports various formats: labeled lines ("Nom : Dupont"), tab-separated, etc.
 */
export function parseDoctolibPaste(rawText: string): ParsedPatientData {
  const result: ParsedPatientData = {}
  const text = rawText.trim()

  if (!text) return result

  // Try labeled format first (most common when copying from Doctolib)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  for (const line of lines) {
    const lower = line.toLowerCase()

    // Last name
    if (matchesLabel(lower, ['nom de famille', 'nom'])) {
      result.last_name = extractValue(line)
      continue
    }

    // First name
    if (matchesLabel(lower, ['prénom', 'prenom'])) {
      result.first_name = extractValue(line)
      continue
    }

    // Birth date
    if (matchesLabel(lower, ['date de naissance', 'né(e) le', 'née le', 'né le', 'naissance'])) {
      const dateStr = extractValue(line)
      const parsed = parseFrenchDate(dateStr)
      if (parsed) result.birth_date = parsed
      continue
    }

    // Gender
    if (matchesLabel(lower, ['sexe', 'genre', 'civilité', 'civilite'])) {
      const val = extractValue(line).toLowerCase()
      if (val.startsWith('m') && !val.startsWith('mm')) {
        result.gender = 'M'
      } else if (val.startsWith('f') || val.startsWith('femme') || val.startsWith('mme') || val.startsWith('mm')) {
        result.gender = 'F'
      }
      continue
    }

    // Phone
    if (matchesLabel(lower, ['téléphone', 'telephone', 'tél', 'tel', 'mobile', 'portable'])) {
      result.phone = extractValue(line)
      continue
    }

    // Email
    if (matchesLabel(lower, ['email', 'e-mail', 'courriel', 'mail'])) {
      result.email = extractValue(line)
      continue
    }

    // Profession
    if (matchesLabel(lower, ['profession', 'métier', 'metier', 'activité professionnelle'])) {
      result.profession = extractValue(line)
      continue
    }

    // Physician
    if (matchesLabel(lower, ['médecin traitant', 'medecin traitant', 'médecin', 'medecin', 'docteur'])) {
      result.primary_physician = extractValue(line)
      continue
    }
  }

  // If labeled parsing found nothing, try to detect patterns directly in the full text
  if (Object.keys(result).length === 0) {
    // Try to find a phone number
    const phoneMatch = text.match(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/)
    if (phoneMatch) result.phone = phoneMatch[0].trim()

    // Try to find an email
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    if (emailMatch) result.email = emailMatch[0]

    // Try to find a date (dd/mm/yyyy)
    const dateMatch = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/)
    if (dateMatch) {
      const parsed = parseFrenchDate(dateMatch[0])
      if (parsed) result.birth_date = parsed
    }

    // Try to detect gender from M./Mme/Mr
    const genderMatch = text.match(/\b(Mme|Madame|Mr|M\.|Monsieur)\b/i)
    if (genderMatch) {
      const g = genderMatch[1].toLowerCase()
      if (g === 'mme' || g === 'madame') {
        result.gender = 'F'
      } else {
        result.gender = 'M'
      }
    }
  }

  return result
}

function matchesLabel(lowerLine: string, labels: string[]): boolean {
  return labels.some((label) => {
    const pattern = new RegExp(`^${escapeRegex(label)}\\s*[:=\\-–—\\t]`)
    return pattern.test(lowerLine)
  })
}

function extractValue(line: string): string {
  // Remove the label part (everything before the first : = - tab)
  const match = line.match(/^[^:=\-–—\t]+[:=\-–—\t]\s*(.*)$/)
  return match ? match[1].trim() : line.trim()
}

function parseFrenchDate(dateStr: string): string | null {
  // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  const match = dateStr.match(/(\d{1,2})[/.\-–](\d{1,2})[/.\-–](\d{4})/)
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = match[2].padStart(2, '0')
    const year = match[3]
    const isoDate = `${year}-${month}-${day}`
    // Validate the date
    const d = new Date(isoDate)
    if (!isNaN(d.getTime()) && d <= new Date()) {
      return isoDate
    }
  }

  // Try yyyy-mm-dd (already ISO)
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return isoMatch[0]
  }

  return null
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
