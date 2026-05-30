/**
 * Shared CSV import logic for MyOsteoFlow.
 *
 * Parses a CSV file, auto-detects which columns map to patient/consultation
 * fields (recognising common French & English headers), and imports the rows
 * into the local database (patients + their consultations).
 *
 * Used by the "Import" tab in Settings (step 2: integrate the transformed file
 * returned by support).
 */

import { createClient } from '@/lib/db/client'

export type PatientField =
  | 'last_name'
  | 'first_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'birth_date'
  | 'gender'
  | 'profession'
  | 'notes'
  | 'sport_activity'
  | 'trauma_history'
  | 'medical_history'
  | 'surgical_history'
  | 'family_history'

export type ConsultationField =
  | 'consultation_date'
  | 'reason'
  | 'anamnesis'
  | 'examination'
  | 'advice'

export type MappableField = PatientField | ConsultationField | '__ignore__'

export interface FieldDefinition {
  key: PatientField | ConsultationField
  label: string
}

export const PATIENT_FIELDS: FieldDefinition[] = [
  { key: 'last_name', label: 'Nom' },
  { key: 'first_name', label: 'Prenom' },
  { key: 'full_name', label: 'Nom Prenom (combine)' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telephone' },
  { key: 'birth_date', label: 'Date de naissance' },
  { key: 'gender', label: 'Sexe (M/F)' },
  { key: 'profession', label: 'Profession' },
  { key: 'sport_activity', label: 'Activite sportive' },
  { key: 'notes', label: 'Notes' },
  { key: 'trauma_history', label: 'Antecedents traumatiques' },
  { key: 'medical_history', label: 'Antecedents medicaux' },
  { key: 'surgical_history', label: 'Antecedents chirurgicaux' },
  { key: 'family_history', label: 'Antecedents familiaux' },
]

export const CONSULTATION_FIELDS: FieldDefinition[] = [
  { key: 'consultation_date', label: 'Date de consultation' },
  { key: 'reason', label: 'Motif de consultation' },
  { key: 'anamnesis', label: 'Anamnese' },
  { key: 'examination', label: 'Examen clinique' },
  { key: 'advice', label: 'Conseils' },
]

export const ALL_FIELDS: FieldDefinition[] = [...PATIENT_FIELDS, ...CONSULTATION_FIELDS]

// Mapping of common French/English CSV column headers to internal field keys.
// Keys are lowercased & trimmed before lookup.
export const COLUMN_ALIASES: Record<string, MappableField> = {
  nom: 'last_name',
  last_name: 'last_name',
  'nom de famille': 'last_name',
  nom_famille: 'last_name',
  'nom prenom': 'full_name',
  'nom prénom': 'full_name',
  'nom et prenom': 'full_name',
  'nom et prénom': 'full_name',
  patient: 'full_name',
  'nom complet': 'full_name',
  'nom_prenom': 'full_name',
  'nom patient': 'full_name',
  prenom: 'first_name',
  'prénom': 'first_name',
  first_name: 'first_name',
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  courriel: 'email',
  telephone: 'phone',
  'téléphone': 'phone',
  tel: 'phone',
  'tél': 'phone',
  phone: 'phone',
  portable: 'phone',
  mobile: 'phone',
  date_naissance: 'birth_date',
  'date de naissance': 'birth_date',
  birth_date: 'birth_date',
  naissance: 'birth_date',
  ddn: 'birth_date',
  sexe: 'gender',
  gender: 'gender',
  genre: 'gender',
  profession: 'profession',
  metier: 'profession',
  'métier': 'profession',
  sport: 'sport_activity',
  'activite sportive': 'sport_activity',
  'activité sportive': 'sport_activity',
  sport_activity: 'sport_activity',
  'activite physique': 'sport_activity',
  'activité physique': 'sport_activity',
  notes: 'notes',
  note: 'notes',
  remarques: 'notes',
  remarque: 'notes',
  commentaires: 'notes',
  commentaire: 'notes',
  observations: 'notes',
  'date consultation': 'consultation_date',
  'date de consultation': 'consultation_date',
  'date rdv': 'consultation_date',
  'date de rendez-vous': 'consultation_date',
  'date rendez-vous': 'consultation_date',
  'date seance': 'consultation_date',
  'date de seance': 'consultation_date',
  'date séance': 'consultation_date',
  'date de séance': 'consultation_date',
  date: 'consultation_date',
  motif: 'reason',
  'motif de consultation': 'reason',
  'motif consultation': 'reason',
  raison: 'reason',
  objet: 'reason',
  plainte: 'reason',
  'anamnèse': 'anamnesis',
  anamnese: 'anamnesis',
  anamnesis: 'anamnesis',
  interrogatoire: 'anamnesis',
  'histoire clinique': 'anamnesis',
  'antecedents traumatiques': 'trauma_history',
  'antécédents traumatiques': 'trauma_history',
  'histoire traumatique': 'trauma_history',
  traumatismes: 'trauma_history',
  trauma: 'trauma_history',
  'antecedents medicaux': 'medical_history',
  'antécédents médicaux': 'medical_history',
  'histoire medicale': 'medical_history',
  'histoire médicale': 'medical_history',
  antecedents: 'medical_history',
  'antécédents': 'medical_history',
  'antecedents chirurgicaux': 'surgical_history',
  'antécédents chirurgicaux': 'surgical_history',
  chirurgie: 'surgical_history',
  operations: 'surgical_history',
  'opérations': 'surgical_history',
  'antecedents familiaux': 'family_history',
  'antécédents familiaux': 'family_history',
  'histoire familiale': 'family_history',
  'heredite': 'family_history',
  'hérédité': 'family_history',
  examen: 'examination',
  'examen clinique': 'examination',
  examination: 'examination',
  observation: 'examination',
  'bilan clinique': 'examination',
  bilan: 'examination',
  conseil: 'advice',
  conseils: 'advice',
  advice: 'advice',
  recommandations: 'advice',
  'conseils post-seance': 'advice',
  'conseils post-séance': 'advice',
  traitement: 'advice',
}

export interface ImportResult {
  total: number
  patientsImported: number
  consultationsImported: number
  errors: { row: number; message: string }[]
}

/** Detects whether the CSV uses comma or semicolon as delimiter. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] || ''
  const commas = (firstLine.match(/,/g) || []).length
  const semicolons = (firstLine.match(/;/g) || []).length
  return semicolons > commas ? ';' : ','
}

/** Parses a CSV string into an array of string arrays (handles quoted fields). */
export function parseCSV(text: string): string[][] {
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      currentField += char
      i++
      continue
    }
    if (char === '"') { inQuotes = true; i++; continue }
    if (char === delimiter) { currentRow.push(currentField.trim()); currentField = ''; i++; continue }
    if (char === '\r') { i++; continue }
    if (char === '\n') {
      currentRow.push(currentField.trim())
      if (currentRow.some((cell) => cell !== '')) rows.push(currentRow)
      currentRow = []
      currentField = ''
      i++
      continue
    }
    currentField += char
    i++
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((cell) => cell !== '')) rows.push(currentRow)
  }
  return rows
}

/** Parses common French/ISO date formats and returns ISO (YYYY-MM-DD) or null. */
export function parseDateToISO(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    if (!isNaN(date.getTime())) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const frenchMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (frenchMatch) {
    const [, d, m, y] = frenchMatch
    const day = Number(d), month = Number(m), year = Number(y)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  const frenchShortMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/)
  if (frenchShortMatch) {
    const [, d, m, yy] = frenchShortMatch
    const day = Number(d), month = Number(m), shortYear = Number(yy)
    const year = shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return null
}

/** Normalizes gender value to 'M' or 'F'. Defaults to 'M'. */
export function normalizeGender(raw: string): 'M' | 'F' {
  const val = raw.trim().toUpperCase()
  if (val === 'F' || val === 'FEMME' || val === 'FEMININ' || val === 'FEMININE' || val === 'FÉMININ' || val === 'W') {
    return 'F'
  }
  return 'M'
}

/** Auto-detects the column→field mapping from CSV headers. */
export function autoDetectMapping(csvHeaders: string[]): Record<number, MappableField> {
  const mapping: Record<number, MappableField> = {}
  const usedFields = new Set<MappableField>()
  csvHeaders.forEach((header, index) => {
    const normalized = header.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const originalLower = header.toLowerCase().trim()
    const match = COLUMN_ALIASES[originalLower] || COLUMN_ALIASES[normalized]
    if (match && !usedFields.has(match)) {
      mapping[index] = match
      usedFields.add(match)
    }
  })
  return mapping
}

/**
 * Imports parsed CSV rows into the local database.
 * `columnMapping` maps a column index to a field key.
 * `onProgress` receives a 0-100 percentage.
 */
export async function importRows(
  headers: string[],
  dataRows: string[][],
  columnMapping: Record<number, MappableField>,
  onProgress?: (pct: number) => void,
): Promise<ImportResult> {
  const db = createClient()

  // Resolve current practitioner
  const { data: { user } } = await db.auth.getUser()
  if (!user) throw new Error('Vous devez être connecté pour importer.')
  const { data: practitioner, error: practError } = await db
    .from('practitioners')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (practError || !practitioner) throw new Error('Impossible de récupérer votre profil praticien.')
  const practitionerId = practitioner.id

  // Reverse mapping: field -> column index
  const fieldToCol: Partial<Record<MappableField, number>> = {}
  for (const [colStr, field] of Object.entries(columnMapping)) {
    if (field !== '__ignore__') fieldToCol[field] = Number(colStr)
  }

  const hasConsultationMapping = CONSULTATION_FIELDS.some((f) => fieldToCol[f.key] !== undefined)

  const errors: { row: number; message: string }[] = []
  let patientsImported = 0
  let consultationsImported = 0
  const total = dataRows.length
  const patientMap = new Map<string, string>()

  for (let i = 0; i < total; i++) {
    const row = dataRows[i]
    const getValue = (field: MappableField): string => {
      const colIdx = fieldToCol[field]
      if (colIdx === undefined) return ''
      return (row[colIdx] || '').trim()
    }

    let lastName = getValue('last_name')
    let firstName = getValue('first_name')

    const fullNameVal = getValue('full_name')
    if (fullNameVal && !lastName) {
      const parts = fullNameVal.split(/\s+/)
      lastName = parts[0] || ''
      firstName = parts.slice(1).join(' ')
    }

    if (!lastName && !firstName) {
      onProgress?.(Math.round(((i + 1) / total) * 100))
      continue
    }

    const patientKey = `${(lastName || 'Inconnu').toLowerCase()}|${(firstName || '').toLowerCase()}`
    let patientId = patientMap.get(patientKey)

    if (!patientId) {
      try {
        const { data: existingPatient } = await db
          .from('patients')
          .select('id')
          .eq('practitioner_id', practitionerId)
          .ilike('last_name', lastName || 'Inconnu')
          .ilike('first_name', firstName || '')
          .single()
        if (existingPatient) {
          patientId = existingPatient.id
          patientMap.set(patientKey, existingPatient.id)
        }
      } catch { /* none found */ }
    }

    if (!patientId) {
      const patient: Record<string, string> = {
        practitioner_id: practitionerId,
        last_name: lastName || 'Inconnu',
        first_name: firstName || '',
        gender: normalizeGender(getValue('gender')),
        phone: getValue('phone') || '0000000000',
      }
      const emailVal = getValue('email'); if (emailVal) patient.email = emailVal
      const professionVal = getValue('profession'); if (professionVal) patient.profession = professionVal
      const sportVal = getValue('sport_activity'); if (sportVal) patient.sport_activity = sportVal
      const notesVal = getValue('notes'); if (notesVal) patient.notes = notesVal
      const traumaVal = getValue('trauma_history'); if (traumaVal) patient.trauma_history = traumaVal
      const medicalVal = getValue('medical_history'); if (medicalVal) patient.medical_history = medicalVal
      const surgicalVal = getValue('surgical_history'); if (surgicalVal) patient.surgical_history = surgicalVal
      const familyVal = getValue('family_history'); if (familyVal) patient.family_history = familyVal
      const birthDateRaw = getValue('birth_date')
      if (birthDateRaw) {
        const parsed = parseDateToISO(birthDateRaw)
        if (parsed) patient.birth_date = parsed
      }

      try {
        const { data, error } = await db.from('patients').insert(patient).select('id').single()
        if (error || !data) {
          errors.push({ row: i + 2, message: error?.message || 'Erreur d\'insertion patient' })
          onProgress?.(Math.round(((i + 1) / total) * 100))
          continue
        }
        patientId = data.id
        patientMap.set(patientKey, data.id)
        patientsImported++
      } catch (err) {
        errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Erreur inconnue' })
        onProgress?.(Math.round(((i + 1) / total) * 100))
        continue
      }
    }

    if (hasConsultationMapping && patientId) {
      const reasonVal = getValue('reason')
      const consultDateRaw = getValue('consultation_date')
      const anamnesisVal = getValue('anamnesis')
      const examinationVal = getValue('examination')
      const adviceVal = getValue('advice')

      if (reasonVal || consultDateRaw) {
        const consultation: Record<string, string> = {
          patient_id: patientId,
          reason: reasonVal || 'Consultation',
        }
        if (consultDateRaw) {
          const parsed = parseDateToISO(consultDateRaw)
          if (parsed) consultation.date_time = `${parsed}T09:00:00`
        }
        if (anamnesisVal) consultation.anamnesis = anamnesisVal
        if (examinationVal) consultation.examination = examinationVal
        if (adviceVal) consultation.advice = adviceVal

        try {
          const { error } = await db.from('consultations').insert(consultation)
          if (error) errors.push({ row: i + 2, message: `Consultation: ${error.message}` })
          else consultationsImported++
        } catch (err) {
          errors.push({ row: i + 2, message: `Consultation: ${err instanceof Error ? err.message : 'Erreur inconnue'}` })
        }
      }
    }

    onProgress?.(Math.round(((i + 1) / total) * 100))
  }

  return { total, patientsImported, consultationsImported, errors }
}
