'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PatientField =
  | 'last_name'
  | 'first_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'birth_date'
  | 'gender'
  | 'profession'
  | 'trauma_history'
  | 'medical_history'
  | 'surgical_history'
  | 'family_history'

type ConsultationField =
  | 'consultation_date'
  | 'reason'
  | 'anamnesis'
  | 'examination'
  | 'advice'

type MappableField = PatientField | ConsultationField | '__ignore__'

interface FieldDefinition {
  key: PatientField | ConsultationField
  label: string
}

const PATIENT_FIELDS: FieldDefinition[] = [
  { key: 'last_name', label: 'Nom' },
  { key: 'first_name', label: 'Prenom' },
  { key: 'full_name', label: 'Nom Prenom (combine)' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telephone' },
  { key: 'birth_date', label: 'Date de naissance' },
  { key: 'gender', label: 'Sexe (M/F)' },
  { key: 'profession', label: 'Profession' },
  { key: 'trauma_history', label: 'Antecedents traumatiques' },
  { key: 'medical_history', label: 'Antecedents medicaux' },
  { key: 'surgical_history', label: 'Antecedents chirurgicaux' },
  { key: 'family_history', label: 'Antecedents familiaux' },
]

const CONSULTATION_FIELDS: FieldDefinition[] = [
  { key: 'consultation_date', label: 'Date de consultation' },
  { key: 'reason', label: 'Motif de consultation' },
  { key: 'anamnesis', label: 'Anamnese' },
  { key: 'examination', label: 'Examen clinique' },
  { key: 'advice', label: 'Conseils' },
]

const ALL_FIELDS: FieldDefinition[] = [...PATIENT_FIELDS, ...CONSULTATION_FIELDS]

// Mapping of common French CSV column headers to our internal field keys.
// Keys are lowercased & trimmed before lookup.
const COLUMN_ALIASES: Record<string, MappableField> = {
  // last_name
  nom: 'last_name',
  last_name: 'last_name',
  'nom de famille': 'last_name',
  nom_famille: 'last_name',
  // full_name (combined)
  'nom prenom': 'full_name',
  'nom prénom': 'full_name',
  'nom et prenom': 'full_name',
  'nom et prénom': 'full_name',
  patient: 'full_name',
  'nom complet': 'full_name',
  'nom_prenom': 'full_name',
  'nom patient': 'full_name',
  // first_name
  prenom: 'first_name',
  'prénom': 'first_name',
  first_name: 'first_name',
  // email
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  courriel: 'email',
  // phone
  telephone: 'phone',
  'téléphone': 'phone',
  tel: 'phone',
  'tél': 'phone',
  phone: 'phone',
  portable: 'phone',
  mobile: 'phone',
  // birth_date
  date_naissance: 'birth_date',
  'date de naissance': 'birth_date',
  birth_date: 'birth_date',
  naissance: 'birth_date',
  ddn: 'birth_date',
  // gender
  sexe: 'gender',
  gender: 'gender',
  genre: 'gender',
  // profession
  profession: 'profession',
  metier: 'profession',
  'métier': 'profession',
  // consultation_date
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
  // reason
  motif: 'reason',
  'motif de consultation': 'reason',
  'motif consultation': 'reason',
  raison: 'reason',
  objet: 'reason',
  plainte: 'reason',
  // anamnesis
  'anamnèse': 'anamnesis',
  anamnese: 'anamnesis',
  anamnesis: 'anamnesis',
  interrogatoire: 'anamnesis',
  'histoire clinique': 'anamnesis',
  // trauma_history
  'antecedents traumatiques': 'trauma_history',
  'antécédents traumatiques': 'trauma_history',
  'histoire traumatique': 'trauma_history',
  traumatismes: 'trauma_history',
  trauma: 'trauma_history',
  // medical_history
  'antecedents medicaux': 'medical_history',
  'antécédents médicaux': 'medical_history',
  'histoire medicale': 'medical_history',
  'histoire médicale': 'medical_history',
  antecedents: 'medical_history',
  'antécédents': 'medical_history',
  // surgical_history
  'antecedents chirurgicaux': 'surgical_history',
  'antécédents chirurgicaux': 'surgical_history',
  chirurgie: 'surgical_history',
  operations: 'surgical_history',
  'opérations': 'surgical_history',
  // family_history
  'antecedents familiaux': 'family_history',
  'antécédents familiaux': 'family_history',
  'histoire familiale': 'family_history',
  'heredite': 'family_history',
  'hérédité': 'family_history',
  // examination
  examen: 'examination',
  'examen clinique': 'examination',
  examination: 'examination',
  observation: 'examination',
  'bilan clinique': 'examination',
  bilan: 'examination',
  // advice
  conseil: 'advice',
  conseils: 'advice',
  advice: 'advice',
  recommandations: 'advice',
  'conseils post-seance': 'advice',
  'conseils post-séance': 'advice',
  traitement: 'advice',
}

type ImportStep = 'upload' | 'mapping' | 'importing' | 'done'

interface ImportResult {
  total: number
  patientsImported: number
  consultationsImported: number
  errors: { row: number; message: string }[]
}

// ---------------------------------------------------------------------------
// Inline CSV parser
// ---------------------------------------------------------------------------

/**
 * Detects whether the CSV uses comma or semicolon as delimiter by counting
 * occurrences in the first line.
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] || ''
  const commas = (firstLine.match(/,/g) || []).length
  const semicolons = (firstLine.match(/;/g) || []).length
  return semicolons > commas ? ';' : ','
}

/**
 * Parses a CSV string into an array of string arrays.
 * Handles quoted fields (including escaped quotes ""), auto-detects
 * comma vs semicolon delimiter.
 */
function parseCSV(text: string): string[][] {
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
        // Check for escaped quote ""
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        }
        // End of quoted field
        inQuotes = false
        i++
        continue
      }
      currentField += char
      i++
      continue
    }

    // Not in quotes
    if (char === '"') {
      inQuotes = true
      i++
      continue
    }

    if (char === delimiter) {
      currentRow.push(currentField.trim())
      currentField = ''
      i++
      continue
    }

    if (char === '\r') {
      // Skip \r, handled with \n
      i++
      continue
    }

    if (char === '\n') {
      currentRow.push(currentField.trim())
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow)
      }
      currentRow = []
      currentField = ''
      i++
      continue
    }

    currentField += char
    i++
  }

  // Last field / row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

// ---------------------------------------------------------------------------
// Date parsing helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to parse a date string in common French formats (DD/MM/YYYY,
 * DD-MM-YYYY, DD.MM.YYYY) or ISO (YYYY-MM-DD) and returns an ISO date
 * string (YYYY-MM-DD). Returns null if parsing fails.
 */
function parseDateToISO(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()

  // Try ISO format first: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    if (!isNaN(date.getTime())) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  // French formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const frenchMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (frenchMatch) {
    const [, d, m, y] = frenchMatch
    const day = Number(d)
    const month = Number(m)
    const year = Number(y)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  // French short year: DD/MM/YY
  const frenchShortMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/)
  if (frenchShortMatch) {
    const [, d, m, yy] = frenchShortMatch
    const day = Number(d)
    const month = Number(m)
    const shortYear = Number(yy)
    const year = shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return null
}

/**
 * Normalizes gender value to 'M' or 'F'. Defaults to 'M' if unrecognizable.
 */
function normalizeGender(raw: string): 'M' | 'F' {
  const val = raw.trim().toUpperCase()
  if (val === 'F' || val === 'FEMME' || val === 'FEMININ' || val === 'FEMININE' || val === 'FÉMININ' || val === 'W') {
    return 'F'
  }
  return 'M'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<number, MappableField>>({})
  const [isDragOver, setIsDragOver] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // -----------------------------------------------------------------------
  // Auto-detect column mapping from headers
  // -----------------------------------------------------------------------
  const autoDetectMapping = useCallback((csvHeaders: string[]): Record<number, MappableField> => {
    const mapping: Record<number, MappableField> = {}
    const usedFields = new Set<MappableField>()

    csvHeaders.forEach((header, index) => {
      const normalized = header.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics for lookup
      // Also try the original lowercased (with accents) for exact matches
      const originalLower = header.toLowerCase().trim()

      const match = COLUMN_ALIASES[originalLower] || COLUMN_ALIASES[normalized]
      if (match && !usedFields.has(match)) {
        mapping[index] = match
        usedFields.add(match)
      }
    })

    return mapping
  }, [])

  // -----------------------------------------------------------------------
  // File processing
  // -----------------------------------------------------------------------
  const processFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast({
          variant: 'destructive',
          title: 'Format invalide',
          description: 'Veuillez selectionner un fichier CSV.',
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const rows = parseCSV(text)

          if (rows.length < 2) {
            toast({
              variant: 'destructive',
              title: 'Fichier vide',
              description: 'Le fichier CSV ne contient pas de donnees a importer.',
            })
            return
          }

          const csvHeaders = rows[0]
          const csvData = rows.slice(1)

          setHeaders(csvHeaders)
          setDataRows(csvData)
          setFileName(file.name)
          setColumnMapping(autoDetectMapping(csvHeaders))
          setStep('mapping')
        } catch {
          toast({
            variant: 'destructive',
            title: 'Erreur de lecture',
            description: 'Impossible de lire le fichier CSV. Verifiez le format.',
          })
        }
      }
      reader.onerror = () => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de lire le fichier.',
        })
      }
      reader.readAsText(file, 'UTF-8')
    },
    [toast, autoDetectMapping],
  )

  // -----------------------------------------------------------------------
  // Drag & drop handlers
  // -----------------------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  // -----------------------------------------------------------------------
  // Column mapping change
  // -----------------------------------------------------------------------
  const handleMappingChange = useCallback((colIndex: number, value: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev }
      if (value === '__ignore__') {
        next[colIndex] = '__ignore__'
      } else {
        // Remove this field if already mapped to another column
        for (const key of Object.keys(next)) {
          if (next[Number(key)] === value) {
            delete next[Number(key)]
          }
        }
        next[colIndex] = value as MappableField
      }
      return next
    })
  }, [])

  // -----------------------------------------------------------------------
  // Import
  // -----------------------------------------------------------------------
  const handleImport = useCallback(async () => {
    // Validate required mappings
    const mappedFields = new Set(Object.values(columnMapping).filter((v) => v !== '__ignore__'))
    if (!mappedFields.has('last_name') && !mappedFields.has('full_name')) {
      toast({
        variant: 'destructive',
        title: 'Mapping incomplet',
        description: 'Le champ "Nom" ou "Nom Prenom (combine)" est obligatoire.',
      })
      return
    }

    setStep('importing')
    setImportProgress(0)

    const db = createClient()

    // Get current practitioner
    let practitionerId: string
    try {
      const { data: { user } } = await db.auth.getUser()
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Non connecte',
          description: 'Veuillez vous connecter pour importer des patients.',
        })
        setStep('mapping')
        return
      }

      const { data: practitioner, error: practError } = await db
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (practError || !practitioner) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de recuperer votre profil praticien.',
        })
        setStep('mapping')
        return
      }

      practitionerId = practitioner.id
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Erreur de connexion a la base de donnees.',
      })
      setStep('mapping')
      return
    }

    // Build reverse mapping: field -> column index
    const fieldToCol: Partial<Record<MappableField, number>> = {}
    for (const [colStr, field] of Object.entries(columnMapping)) {
      if (field !== '__ignore__') {
        fieldToCol[field] = Number(colStr)
      }
    }

    // Check if any consultation fields are mapped
    const hasConsultationMapping = CONSULTATION_FIELDS.some(
      (f) => fieldToCol[f.key] !== undefined
    )

    const errors: { row: number; message: string }[] = []
    let patientsImported = 0
    let consultationsImported = 0
    const total = dataRows.length

    // Track patients by name to avoid duplicates when multiple consultations
    // exist for the same patient (common in practice software exports)
    const patientMap = new Map<string, string>() // "lastName|firstName" -> patientId

    for (let i = 0; i < total; i++) {
      const row = dataRows[i]

      const getValue = (field: MappableField): string => {
        const colIdx = fieldToCol[field]
        if (colIdx === undefined) return ''
        return (row[colIdx] || '').trim()
      }

      let lastName = getValue('last_name')
      let firstName = getValue('first_name')

      // Handle combined "Nom Prénom" column: split into last_name + first_name
      const fullNameVal = getValue('full_name')
      if (fullNameVal && !lastName) {
        const parts = fullNameVal.split(/\s+/)
        lastName = parts[0] || ''
        firstName = parts.slice(1).join(' ')
      }

      // Skip empty rows
      if (!lastName && !firstName) {
        setImportProgress(Math.round(((i + 1) / total) * 100))
        continue
      }

      // Dedup key: same name = same patient
      const patientKey = `${(lastName || 'Inconnu').toLowerCase()}|${(firstName || '').toLowerCase()}`
      let patientId = patientMap.get(patientKey)

      // Create patient if not already created in this import batch
      if (!patientId) {
        // Look up existing patient in database (useful when importing a second
        // CSV, e.g. consultations, after patients have already been imported)
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
        } catch {
          // No existing patient found, will create below
        }
      }

      if (!patientId) {
        const genderRaw = getValue('gender')
        const birthDateRaw = getValue('birth_date')
        const phoneRaw = getValue('phone')

        const patient: Record<string, string> = {
          practitioner_id: practitionerId,
          last_name: lastName || 'Inconnu',
          first_name: firstName || '',
          gender: normalizeGender(genderRaw),
          phone: phoneRaw || '0000000000',
        }

        const emailVal = getValue('email')
        if (emailVal) patient.email = emailVal

        const professionVal = getValue('profession')
        if (professionVal) patient.profession = professionVal

        const traumaVal = getValue('trauma_history')
        if (traumaVal) patient.trauma_history = traumaVal

        const medicalVal = getValue('medical_history')
        if (medicalVal) patient.medical_history = medicalVal

        const surgicalVal = getValue('surgical_history')
        if (surgicalVal) patient.surgical_history = surgicalVal

        const familyVal = getValue('family_history')
        if (familyVal) patient.family_history = familyVal

        if (birthDateRaw) {
          const parsed = parseDateToISO(birthDateRaw)
          if (parsed) patient.birth_date = parsed
        }

        try {
          const { data, error } = await db
            .from('patients')
            .insert(patient)
            .select('id')
            .single()

          if (error || !data) {
            errors.push({
              row: i + 2,
              message: error?.message || 'Erreur d\'insertion patient',
            })
            setImportProgress(Math.round(((i + 1) / total) * 100))
            continue
          }

          patientId = data.id
          patientMap.set(patientKey, data.id)
          patientsImported++
        } catch (err) {
          errors.push({
            row: i + 2,
            message: err instanceof Error ? err.message : 'Erreur inconnue',
          })
          setImportProgress(Math.round(((i + 1) / total) * 100))
          continue
        }
      }

      // Create consultation if consultation fields are mapped and have data
      if (hasConsultationMapping && patientId) {
        const reasonVal = getValue('reason')
        const consultDateRaw = getValue('consultation_date')
        const anamnesisVal = getValue('anamnesis')
        const examinationVal = getValue('examination')
        const adviceVal = getValue('advice')

        // Only create consultation if there's at least a reason or a date
        if (reasonVal || consultDateRaw) {
          const consultation: Record<string, string> = {
            patient_id: patientId,
            reason: reasonVal || 'Consultation',
          }

          if (consultDateRaw) {
            const parsed = parseDateToISO(consultDateRaw)
            if (parsed) {
              consultation.date_time = `${parsed}T09:00:00`
            }
          }

          if (anamnesisVal) consultation.anamnesis = anamnesisVal
          if (examinationVal) consultation.examination = examinationVal
          if (adviceVal) consultation.advice = adviceVal

          try {
            const { error } = await db.from('consultations').insert(consultation)
            if (error) {
              errors.push({
                row: i + 2,
                message: `Consultation: ${error.message}`,
              })
            } else {
              consultationsImported++
            }
          } catch (err) {
            errors.push({
              row: i + 2,
              message: `Consultation: ${err instanceof Error ? err.message : 'Erreur inconnue'}`,
            })
          }
        }
      }

      setImportProgress(Math.round(((i + 1) / total) * 100))
    }

    setImportResult({ total, patientsImported, consultationsImported, errors })
    setStep('done')
  }, [columnMapping, dataRows, toast])

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------
  const handleReset = useCallback(() => {
    setStep('upload')
    setFileName(null)
    setHeaders([])
    setDataRows([])
    setColumnMapping({})
    setImportResult(null)
    setImportProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------
  const previewRows = dataRows.slice(0, 5)
  const mappedFieldsSet = new Set<string>(
    Object.values(columnMapping).filter((v) => v !== '__ignore__'),
  )

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import CSV</h1>
        <p className="text-muted-foreground">
          Importez vos patients et leurs consultations depuis un fichier CSV (export d&apos;un autre logiciel)
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        <StepIndicator
          number={1}
          label="Fichier"
          active={step === 'upload'}
          completed={step !== 'upload'}
        />
        <div className="h-px w-8 bg-border" />
        <StepIndicator
          number={2}
          label="Mapping"
          active={step === 'mapping'}
          completed={step === 'importing' || step === 'done'}
        />
        <div className="h-px w-8 bg-border" />
        <StepIndicator
          number={3}
          label="Import"
          active={step === 'importing'}
          completed={step === 'done'}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Step 1: Upload */}
      {/* ----------------------------------------------------------------- */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Selectionner un fichier CSV</CardTitle>
            <CardDescription>
              Glissez-deposez votre fichier CSV ou cliquez pour parcourir.
              Les delimiteurs virgule et point-virgule sont detectes automatiquement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed
                p-12 cursor-pointer transition-colors
                ${isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary hover:bg-muted/50'
                }
              `}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Glissez votre fichier CSV ici
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ou cliquez pour parcourir
                </p>
              </div>
              <Badge variant="secondary">CSV</Badge>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
              <h4 className="font-medium mb-2 text-sm">Colonnes reconnues automatiquement</h4>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Patient</p>
                <div className="flex flex-wrap gap-2">
                  {PATIENT_FIELDS.map((f) => (
                    <Badge key={f.key} variant="outline" className="text-xs">
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Consultation</p>
                <div className="flex flex-wrap gap-2">
                  {CONSULTATION_FIELDS.map((f) => (
                    <Badge key={f.key} variant="outline" className="text-xs">
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Les en-tetes courants en francais et anglais sont detectes
                automatiquement. Vous pourrez ajuster le mapping manuellement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 2: Mapping + Preview */}
      {/* ----------------------------------------------------------------- */}
      {step === 'mapping' && (
        <>
          {/* File info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataRows.length} ligne{dataRows.length > 1 ? 's' : ''} detectee{dataRows.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Changer de fichier
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Column mapping */}
          <Card>
            <CardHeader>
              <CardTitle>Correspondance des colonnes</CardTitle>
              <CardDescription>
                Verifiez et ajustez la correspondance entre les colonnes de votre fichier
                et les champs patient. Les champs detectes automatiquement sont pre-remplis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {headers.map((header, index) => (
                  <div key={index} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium truncate" title={header}>
                      {header}
                    </label>
                    <Select
                      value={columnMapping[index] || '__ignore__'}
                      onValueChange={(val) => handleMappingChange(index, val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ignore__">-- Ignorer --</SelectItem>
                        <SelectItem value="__patient_header__" disabled className="text-xs font-semibold text-muted-foreground">
                          — Patient —
                        </SelectItem>
                        {PATIENT_FIELDS.map((f) => {
                          const alreadyMapped =
                            mappedFieldsSet.has(f.key) && columnMapping[index] !== f.key
                          return (
                            <SelectItem
                              key={f.key}
                              value={f.key}
                              disabled={alreadyMapped}
                            >
                              {f.label}
                              {alreadyMapped ? ' (deja assigne)' : ''}
                            </SelectItem>
                          )
                        })}
                        <SelectItem value="__consult_header__" disabled className="text-xs font-semibold text-muted-foreground">
                          — Consultation —
                        </SelectItem>
                        {CONSULTATION_FIELDS.map((f) => {
                          const alreadyMapped =
                            mappedFieldsSet.has(f.key) && columnMapping[index] !== f.key
                          return (
                            <SelectItem
                              key={f.key}
                              value={f.key}
                              disabled={alreadyMapped}
                            >
                              {f.label}
                              {alreadyMapped ? ' (deja assigne)' : ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    {columnMapping[index] && columnMapping[index] !== '__ignore__' && (
                      <Badge variant="success" className="w-fit text-xs">
                        Mappe
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              {/* Mapping summary */}
              <div className="mt-6 space-y-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Patient</p>
                  <div className="flex flex-wrap gap-2">
                    {PATIENT_FIELDS.map((f) => (
                      <Badge
                        key={f.key}
                        variant={mappedFieldsSet.has(f.key) ? 'success' : 'outline'}
                        className="text-xs"
                      >
                        {f.label}: {mappedFieldsSet.has(f.key) ? 'OK' : 'non mappe'}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Consultation (optionnel)</p>
                  <div className="flex flex-wrap gap-2">
                    {CONSULTATION_FIELDS.map((f) => (
                      <Badge
                        key={f.key}
                        variant={mappedFieldsSet.has(f.key) ? 'success' : 'outline'}
                        className="text-xs"
                      >
                        {f.label}: {mappedFieldsSet.has(f.key) ? 'OK' : 'non mappe'}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Apercu des donnees</CardTitle>
              <CardDescription>
                {previewRows.length} premiere{previewRows.length > 1 ? 's' : ''} ligne{previewRows.length > 1 ? 's' : ''} de votre fichier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">
                        #
                      </th>
                      {headers.map((header, i) => (
                        <th
                          key={i}
                          className="text-left py-2 px-3 text-xs font-medium"
                        >
                          <div>{header}</div>
                          {columnMapping[i] && columnMapping[i] !== '__ignore__' && (
                            <Badge variant="secondary" className="text-[10px] mt-0.5">
                              {ALL_FIELDS.find((f) => f.key === columnMapping[i])?.label}
                            </Badge>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b last:border-0">
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {rowIndex + 1}
                        </td>
                        {headers.map((_, colIndex) => (
                          <td key={colIndex} className="py-2 px-3 max-w-[200px] truncate">
                            {row[colIndex] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dataRows.length > 5 && (
                <p className="text-xs text-muted-foreground mt-3">
                  ... et {dataRows.length - 5} autre{dataRows.length - 5 > 1 ? 's' : ''} ligne{dataRows.length - 5 > 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset}>
              Annuler
            </Button>
            <Button onClick={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              Importer {dataRows.length} ligne{dataRows.length > 1 ? 's' : ''}
            </Button>
          </div>
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 3: Importing */}
      {/* ----------------------------------------------------------------- */}
      {step === 'importing' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-medium">Import en cours...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Veuillez ne pas fermer cette page.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">{importProgress}%</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 4: Results */}
      {/* ----------------------------------------------------------------- */}
      {step === 'done' && importResult && (
        <>
          {/* Summary card */}
          <Card
            className={
              importResult.errors.length === 0
                ? 'border-green-200'
                : importResult.patientsImported === 0
                  ? 'border-red-200'
                  : 'border-yellow-200'
            }
          >
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-6">
                {importResult.errors.length === 0 ? (
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                ) : importResult.patientsImported === 0 ? (
                  <AlertCircle className="h-12 w-12 text-red-500" />
                ) : (
                  <AlertCircle className="h-12 w-12 text-yellow-500" />
                )}

                <div className="text-center">
                  <h2 className="text-xl font-semibold">
                    {importResult.errors.length === 0
                      ? 'Import termine avec succes !'
                      : importResult.patientsImported === 0
                        ? 'Echec de l\'import'
                        : 'Import termine avec des erreurs'}
                  </h2>
                </div>

                <div className="flex gap-6 mt-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {importResult.patientsImported}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      patient{importResult.patientsImported > 1 ? 's' : ''}
                    </p>
                  </div>
                  {importResult.consultationsImported > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {importResult.consultationsImported}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        consultation{importResult.consultationsImported > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {importResult.errors.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        erreur{importResult.errors.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">
                      {importResult.total}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ligne{importResult.total > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Errors detail */}
          {importResult.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Erreurs d&apos;import
                </CardTitle>
                <CardDescription>
                  Les lignes suivantes n&apos;ont pas pu etre importees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {importResult.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 text-sm p-2 rounded bg-red-50 dark:bg-red-950/20"
                    >
                      <Badge variant="destructive" className="text-xs shrink-0">
                        Ligne {err.row}
                      </Badge>
                      <span className="text-red-700 dark:text-red-300">
                        {err.message}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button onClick={handleReset}>
              <Upload className="mr-2 h-4 w-4" />
              Nouvel import
            </Button>
            <Button variant="outline" asChild>
              <a href="/patients">Voir les patients</a>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number
  label: string
  active: boolean
  completed: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium
          ${completed
            ? 'bg-primary text-primary-foreground'
            : active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }
        `}
      >
        {completed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          number
        )}
      </div>
      <span
        className={`text-sm ${
          active || completed ? 'font-medium' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
