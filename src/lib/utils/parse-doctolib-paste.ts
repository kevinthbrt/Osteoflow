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

  // Pre-process: split on known label boundaries when text is on a single line
  const preprocessed = text.replace(
    /\s+(Tél(?:éphone)?\s*(?:\([^)]*\))?\s*:|Tel(?:ephone)?\s*(?:\([^)]*\))?\s*:|E-mail\s*:|Email\s*:|Mail\s*:|Médecin traitant\s*:|Medecin traitant\s*:|Lieu de naissance\s*:|Profession\s*:|Date de naissance\s*:)/gi,
    '\n$1'
  )

  const lines = preprocessed.split('\n').map((l) => l.trim()).filter(Boolean)

  // Try to detect Doctolib multi-line header format:
  // Line 0: "Monsieur" or "Madame"
  // Line 1: "LE FAOU" (last name, ALL CAPS)
  // Line 2: "Mathieu" (first name)
  // Line 3: "H, 20/11/1993 (32 ans)" (optional suffix + birth date)
  if (lines.length >= 3) {
    const civilityMatch = lines[0].match(/^(Monsieur|Madame|Mme|Mr|M\.)$/i)
    if (civilityMatch) {
      const civility = civilityMatch[1].toLowerCase()
      result.gender = (civility === 'madame' || civility === 'mme') ? 'F' : 'M'

      // Line 1 should be the last name (typically ALL CAPS)
      const potentialLastName = lines[1]
      // Line 2 should be the first name
      const potentialFirstName = lines[2]

      // Validate: last name should not look like a label (no colon)
      if (!potentialLastName.includes(':') && !potentialFirstName.includes(':')) {
        result.last_name = potentialLastName
        result.first_name = potentialFirstName

        // Line 3 might contain birth date: "H, 20/11/1993 (32 ans)"
        if (lines.length > 3) {
          const dateLine = lines[3]
          const dateMatch = dateLine.match(/(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})/)
          if (dateMatch) {
            const parsed = parseFrenchDate(dateMatch[1])
            if (parsed) result.birth_date = parsed
          }
        }
      }
    }
  }

  // Parse labeled lines (with value on same line or next line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()
    // Get inline value (after the colon) or the next line if empty
    const getValueOrNextLine = (): string => {
      const inline = extractValue(line)
      if (inline) return inline
      // Value might be on the next line
      if (i + 1 < lines.length && !looksLikeLabel(lines[i + 1])) {
        i++ // consume next line
        return lines[i].trim()
      }
      return ''
    }

    // Last name
    if (!result.last_name && matchesLabel(lower, ['nom de famille', 'nom'])) {
      result.last_name = getValueOrNextLine()
      continue
    }

    // First name
    if (!result.first_name && matchesLabel(lower, ['prénom', 'prenom'])) {
      result.first_name = getValueOrNextLine()
      continue
    }

    // Birth date
    if (!result.birth_date && matchesLabel(lower, ['date de naissance', 'né(e) le', 'née le', 'né le', 'naissance'])) {
      const dateStr = getValueOrNextLine()
      const parsed = parseFrenchDate(dateStr)
      if (parsed) result.birth_date = parsed
      continue
    }

    // Gender
    if (!result.gender && matchesLabel(lower, ['sexe', 'genre', 'civilité', 'civilite'])) {
      const val = getValueOrNextLine().toLowerCase()
      if (val.startsWith('m') && !val.startsWith('mm')) {
        result.gender = 'M'
      } else if (val.startsWith('f') || val.startsWith('femme') || val.startsWith('mme') || val.startsWith('mm')) {
        result.gender = 'F'
      }
      continue
    }

    // Phone (portable)
    if (!result.phone && matchesLabel(lower, ['téléphone', 'telephone', 'tél', 'tel', 'mobile', 'portable'])) {
      const val = getValueOrNextLine()
      if (val) result.phone = val
      continue
    }

    // Phone (fixe) - only use if no phone found yet
    if (!result.phone && matchesLabel(lower, ['tél (fixe)', 'tel (fixe)', 'téléphone fixe', 'telephone fixe'])) {
      const val = getValueOrNextLine()
      if (val) result.phone = val
      continue
    }

    // Email
    if (!result.email && matchesLabel(lower, ['email', 'e-mail', 'courriel', 'mail'])) {
      const val = getValueOrNextLine()
      if (val) result.email = val
      continue
    }

    // Lieu de naissance - skip (not stored in patient form)
    if (matchesLabel(lower, ['lieu de naissance'])) {
      getValueOrNextLine() // consume value line
      continue
    }

    // Profession
    if (!result.profession && matchesLabel(lower, ['profession', 'métier', 'metier', 'activité professionnelle'])) {
      result.profession = getValueOrNextLine()
      continue
    }

    // Physician
    if (!result.primary_physician && matchesLabel(lower, ['médecin traitant', 'medecin traitant', 'médecin', 'medecin', 'docteur'])) {
      const val = getValueOrNextLine()
      if (val) result.primary_physician = val
      continue
    }

    // Try single-line header format: "Monsieur LE FAOU Mathieu H, 20/11/1993 (32 ans)"
    if (!result.last_name && !result.first_name) {
      const headerMatch = line.match(/^(Monsieur|Madame|Mme|Mr|M\.)\s+(.+?)(?:,\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}))?(?:\s*\(.*\))?\s*$/)
      if (headerMatch) {
        const civility = headerMatch[1].toLowerCase()
        result.gender = (civility === 'madame' || civility === 'mme') ? 'F' : 'M'

        const namePart = headerMatch[2].trim()
        const nameTokens = namePart.split(/\s+/)
        if (nameTokens.length >= 2) {
          const lastNameParts: string[] = []
          const firstNameParts: string[] = []
          let foundFirstName = false
          for (const token of nameTokens) {
            if (!foundFirstName && token === token.toUpperCase() && token.length > 1) {
              lastNameParts.push(token)
            } else {
              if (token.length > 1 || firstNameParts.length === 0) {
                firstNameParts.push(token)
              }
              foundFirstName = true
            }
          }
          if (lastNameParts.length > 0 && firstNameParts.length > 0) {
            result.last_name = lastNameParts.join(' ')
            result.first_name = firstNameParts.join(' ')
          }
        }

        if (headerMatch[3]) {
          const parsed = parseFrenchDate(headerMatch[3])
          if (parsed) result.birth_date = parsed
        }
        continue
      }
    }
  }

  // Fallback: try to detect patterns in the full text for any fields NOT yet found
  if (!result.phone) {
    const phoneMatch = text.match(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/)
    if (phoneMatch) result.phone = phoneMatch[0].trim()
  }

  if (!result.email) {
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    if (emailMatch) result.email = emailMatch[0]
  }

  if (!result.birth_date) {
    const dateMatch = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/)
    if (dateMatch) {
      const parsed = parseFrenchDate(dateMatch[0])
      if (parsed) result.birth_date = parsed
    }
  }

  if (!result.gender) {
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
    // Match label at start, optionally followed by parenthetical text, then separator
    const pattern = new RegExp(`^${escapeRegex(label)}(?:\\s*\\([^)]*\\))?\\s*[:=\\-–—\\t]`)
    return pattern.test(lowerLine)
  })
}

function looksLikeLabel(line: string): boolean {
  const lower = line.toLowerCase().trim()
  const knownLabels = [
    'tél', 'tel', 'téléphone', 'telephone', 'e-mail', 'email', 'mail',
    'médecin', 'medecin', 'lieu de naissance', 'profession', 'nom', 'prénom',
    'prenom', 'date de naissance', 'sexe', 'civilité', 'civilite',
    'monsieur', 'madame', 'mme',
  ]
  return knownLabels.some((label) => lower.startsWith(label))
}

function extractValue(line: string): string {
  // Remove the label part - prefer splitting on " : " (with spaces) first,
  // then fall back to first colon, equals, or tab
  const colonWithSpaces = line.match(/^.+?\s*:\s+(.*)$/)
  if (colonWithSpaces) return colonWithSpaces[1].trim()

  const match = line.match(/^[^:=\t]+[:=\t]\s*(.*)$/)
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
