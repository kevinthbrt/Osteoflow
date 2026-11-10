/**
 * Conversion d'un export OsteoTools vers le modèle MyOsteoflow.
 *
 * Fonctions pures : aucune écriture en base ici, seulement la construction
 * d'un « plan » (patients, antécédents, consultations, factures, documents)
 * que `apply.ts` écrit ensuite dans la base locale.
 *
 * Correspondances principales :
 * - patients.csv + patient_details.csv + phones.csv + addresses.csv → patient ;
 * - antecedents.csv, spheres.csv, pediatrics.csv, family_antecedents → antécédents structurés ;
 * - consultations.csv + examens.csv (+ mesures, EVA, tests d'exclusion) → consultation ;
 * - events.csv (agenda) → heure réelle des séances saisies sans heure ;
 * - invoices.csv → facture + règlement ;
 * - attachments.csv + dossier attachments/ → documents joints.
 */

import { normalizeName } from '@/lib/doctolib/import'
import type { OsteoToolsTables } from './archive'
import type { CsvRow } from './csv'

export type HistoryType = 'traumatic' | 'medical' | 'surgical' | 'family'
export type PaymentMethod = 'card' | 'cash' | 'check' | 'transfer' | 'other'
/** « free » : séance gratuite, facture à 0 € sans règlement. */
export type PaymentTarget = PaymentMethod | 'free'

export interface PlannedHistoryEntry {
  history_type: HistoryType
  description: string
  note: string | null
  is_vigilance: boolean
}

export interface PlannedInvoice {
  sourceId: string
  sourceNumber: string
  amount: number
  /** Code du mode de règlement OsteoTools (0, 1, 2…). */
  paymentMode: string
  /** Date du règlement, AAAA-MM-JJ. */
  paymentDate: string
  issuedAtIso: string
  paidAtIso: string
  notes: string | null
}

export interface PlannedAttachment {
  sourceId: string
  fileName: string
  originalName: string
  mimeType: string | null
}

export interface PlannedConsultation {
  sourceId: string
  /** Heure locale, format du formulaire : AAAA-MM-JJTHH:MM */
  date_time: string
  reason: string
  anamnesis: string | null
  examination: string | null
  invoice: PlannedInvoice | null
  attachments: PlannedAttachment[]
  /** Consultation créée uniquement pour porter une facture orpheline. */
  invoiceOnly: boolean
}

export interface PlannedPatient {
  sourceId: string
  first_name: string
  last_name: string
  gender: 'M' | 'F'
  birth_date: string
  phone: string
  email: string | null
  profession: string | null
  sport_activity: string | null
  notes: string | null
  created_at: string | null
  archived: boolean
  history: PlannedHistoryEntry[]
  consultations: PlannedConsultation[]
}

export interface PaymentModeSummary {
  code: string
  count: number
  total: number
  firstYear: string
  lastYear: string
  suggested: PaymentTarget
}

export interface OsteoToolsPlan {
  patients: PlannedPatient[]
  paymentModes: PaymentModeSummary[]
  stats: {
    patients: number
    consultations: number
    invoices: number
    historyEntries: number
    attachments: number
    firstConsultation: string | null
    lastConsultation: string | null
    consultationTimesFromAgenda: number
    skippedEmptyInvoices: number
  }
}

// ---------------------------------------------------------------------------
// Petits utilitaires de nettoyage
// ---------------------------------------------------------------------------

const PARTICLES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'd', 'l', 'van', 'von', 'der', 'di', 'da', 'et'])
/** Mots de liaison des noms composés de communes : Saint-Médard-en-Jalles. */
const HYPHEN_PARTICLES = new Set(['en', 'sur', 'sous', 'les', 'lès', 'le', 'la', 'de', 'du', 'des', 'aux', 'au', 'et'])

/** « jean-pierre » → « Jean-Pierre », « souliÉ » → « Soulié », « de la tour » → « de la Tour ». */
export function formatName(raw: string): string {
  const lower = raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR')
  if (!lower) return ''
  let wordIndex = 0
  return lower.replace(/[\p{L}\p{M}]+/gu, (word, offset: number) => {
    const isFirst = wordIndex++ === 0
    const nextChar = lower[offset + word.length]
    const prevChar = lower[offset - 1]
    if (!isFirst && PARTICLES.has(word) && (nextChar === ' ' || nextChar === '\'' || nextChar === '’')) return word
    if (!isFirst && prevChar === '-' && nextChar === '-' && HYPHEN_PARTICLES.has(word)) return word
    return word.charAt(0).toLocaleUpperCase('fr-FR') + word.slice(1)
  })
}

/** Première lettre en majuscule, reste inchangé. */
function capitalize(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1) : value
}

/** Texte nettoyé : espaces de fin de ligne, lignes vides multiples, encodage cassé connu. */
export function cleanText(raw: string | undefined | null): string {
  if (!raw) return ''
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/m\?dical/gi, 'médical')
    .replace(/obst\?trique/gi, 'obstétrique')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '').replace(/^[ \t]+/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function oneLine(value: string): string {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).join(' / ')
}

function comparable(value: string): string {
  return normalizeName(value)
}

/** +33641706070 → 06 41 70 60 70. Les numéros étrangers restent tels quels. */
export function formatPhone(raw: string | undefined | null): string {
  const value = (raw || '').replace(/[\s.\-()]/g, '')
  if (!value) return ''
  let national = value
  if (/^\+33\d{9}$/.test(value)) national = `0${value.slice(3)}`
  else if (/^0033\d{9}$/.test(value)) national = `0${value.slice(4)}`
  if (/^0\d{9}$/.test(national)) return national.replace(/(\d{2})(?=\d)/g, '$1 ')
  return value
}

/** Jour local AAAA-MM-JJ d'une date OsteoTools (2016-02-18T00:00:00+01:00). */
export function sourceDay(raw: string | undefined | null): string {
  const match = (raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const year = Number(match[1])
  if (year < 1900 || year > 2100) return ''
  return `${match[1]}-${match[2]}-${match[3]}`
}

/** Heure locale HH:MM d'une date OsteoTools. */
export function sourceTime(raw: string | undefined | null): string {
  const match = (raw || '').match(/T(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : ''
}

function sourceOffset(raw: string | undefined | null): string {
  const match = (raw || '').match(/([+-]\d{2}:\d{2}|Z)$/)
  return match ? match[1] : '+01:00'
}

/** Date + heure locales + fuseau d'origine → ISO UTC (format des factures MyOsteoflow). */
function toIso(day: string, time: string, offset: string): string {
  const date = new Date(`${day}T${time}:00${offset}`)
  return isNaN(date.getTime()) ? `${day}T12:00:00.000Z` : date.toISOString()
}

function frenchDate(day: string): string {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

function toSqlTimestamp(raw: string): string | null {
  const day = sourceDay(raw)
  if (!day) return null
  return `${day} ${sourceTime(raw) || '00:00'}:00`
}

export function parseAmount(raw: string | undefined | null): number {
  const value = Number((raw || '').trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`
}

const isTrue = (value: string | undefined) => value === 'true'
const isEmptyId = (value: string | undefined) => !value || value === '-1'

function groupBy(rows: CsvRow[] | undefined, key: string): Map<string, CsvRow[]> {
  const map = new Map<string, CsvRow[]>()
  for (const row of rows || []) {
    const id = row[key]
    if (isEmptyId(id)) continue
    const list = map.get(id)
    if (list) list.push(row)
    else map.set(id, [row])
  }
  return map
}

function indexBy(rows: CsvRow[] | undefined, key: string): Map<string, CsvRow> {
  const map = new Map<string, CsvRow>()
  for (const row of rows || []) if (!isEmptyId(row[key])) map.set(row[key], row)
  return map
}

// ---------------------------------------------------------------------------
// Sexe
// ---------------------------------------------------------------------------

/**
 * OsteoTools : 0 = homme, 1 = femme, 2 = non renseigné. Pour « 2 », on
 * s'appuie sur le prénom tel qu'il est utilisé ailleurs dans le même fichier.
 */
function buildGenderResolver(patients: CsvRow[]) {
  const byFirstName = new Map<string, { M: number; F: number }>()
  for (const p of patients) {
    if (p.gender !== '0' && p.gender !== '1') continue
    const key = comparable(p.first_name)
    const counts = byFirstName.get(key) || { M: 0, F: 0 }
    counts[p.gender === '1' ? 'F' : 'M']++
    byFirstName.set(key, counts)
  }
  return (p: CsvRow): 'M' | 'F' => {
    if (p.gender === '1') return 'F'
    if (p.gender === '0') return 'M'
    const counts = byFirstName.get(comparable(p.first_name))
    if (counts && counts.F > counts.M) return 'F'
    if (counts && counts.M > counts.F) return 'M'
    return /[ae]$/.test(comparable(p.first_name)) ? 'F' : 'M'
  }
}

// ---------------------------------------------------------------------------
// Antécédents
// ---------------------------------------------------------------------------

interface Category {
  type: HistoryType
  label?: string
}

const CATEGORY_WORDS: Record<string, Category> = {
  chirurgical: { type: 'surgical' },
  chirurgicale: { type: 'surgical' },
  chirurgicaux: { type: 'surgical' },
  chirurgie: { type: 'surgical' },
  chirugie: { type: 'surgical' },
  traumatique: { type: 'traumatic' },
  traumatiques: { type: 'traumatic' },
  trauma: { type: 'traumatic' },
  medical: { type: 'medical' },
  medicale: { type: 'medical' },
  medicaux: { type: 'medical' },
  mdical: { type: 'medical' },
  familial: { type: 'family' },
  familiaux: { type: 'family' },
  famillaux: { type: 'family' },
  obstetrique: { type: 'medical', label: 'Gynéco-obstétrique' },
  obsttrique: { type: 'medical', label: 'Gynéco-obstétrique' },
  obstertrique: { type: 'medical', label: 'Gynéco-obstétrique' },
  gynecologique: { type: 'medical', label: 'Gynéco-obstétrique' },
  gyneco: { type: 'medical', label: 'Gynéco-obstétrique' },
  grossesse: { type: 'medical', label: 'Gynéco-obstétrique' },
  dentaire: { type: 'medical', label: 'Dentaire' },
  psychologique: { type: 'medical', label: 'Psychologique' },
  imagerie: { type: 'medical', label: 'Imagerie' },
  irm: { type: 'medical', label: 'Imagerie' },
  autre: { type: 'medical' },
}

const TRAUMA_HINTS = /^(avp|entorses?|fractures?|luxations?|chutes?)\b/

function categoryOf(raw: string): Category | null {
  const key = comparable(raw.replace(/\?/g, ''))
  return CATEGORY_WORDS[key] || null
}

function withLabel(category: Category, text: string): string {
  return category.label ? `${category.label} : ${text}` : text
}

/**
 * La date d'un antécédent OsteoTools est le plus souvent celle de sa saisie
 * (le jour d'une séance), parfois une année seule saisie avec un jour
 * arbitraire. On n'affiche le jour que s'il correspond à une séance.
 */
function historyNote(row: CsvRow, consultationDays?: Set<string>): string | null {
  const parts: string[] = []
  const day = sourceDay(row.event_date)
  if (day && !day.startsWith('1970')) {
    parts.push(consultationDays?.has(day) ? `Noté en séance le ${frenchDate(day)}` : `Année : ${day.slice(0, 4)}`)
  }
  if (isTrue(row.periodic)) parts.push('Récurrent')
  return parts.length ? `${parts.join('. ')} (OsteoTools)` : null
}

/** Une ligne antecedents.csv ou spheres.csv → antécédent MyOsteoflow (ou null si vide). */
export function mapAntecedent(
  row: CsvRow,
  kind: 'antecedent' | 'sphere' = 'antecedent',
  consultationDays?: Set<string>,
): PlannedHistoryEntry | null {
  const title = oneLine(cleanText(row.title))
  const description = oneLine(cleanText(row.description))
  const type = cleanText(row.type)

  let category: Category
  let text: string
  if (kind === 'sphere') {
    category = { type: 'medical', label: type ? capitalize(type) : undefined }
    text = [capitalize(title), description].filter(Boolean).join(' : ')
  } else {
    const fromTitle = categoryOf(title)
    if (fromTitle) {
      category = fromTitle
      text = capitalize(description)
    } else {
      category = categoryOf(type) || (TRAUMA_HINTS.test(comparable(type)) ? { type: 'traumatic' } : { type: 'medical', label: type ? capitalize(type) : undefined })
      text = [capitalize(title), description].filter(Boolean).join(' : ')
    }
  }
  if (!text) return null
  return {
    history_type: category.type,
    description: withLabel(category, text),
    note: historyNote(row, consultationDays),
    is_vigilance: isTrue(row.important),
  }
}

const NOTHING_TO_REPORT = new Set(['ras', 'r a s', 'rien', 'neant', 'aucun', 'aucune', 'non', 'nc', 'r'])

function mapFamilyHistory(raw: string): PlannedHistoryEntry | null {
  const text = oneLine(cleanText(raw))
  if (!text || NOTHING_TO_REPORT.has(comparable(text))) return null
  return { history_type: 'family', description: capitalize(text), note: null, is_vigilance: false }
}

/** Fiche pédiatrique (naissance) → un antécédent médical, uniquement si elle contient une information. */
export function mapPediatrics(row: CsvRow): PlannedHistoryEntry | null {
  const parts: string[] = []
  const weight = parseAmount(row.weight)
  const size = parseAmount(row.size)
  if (weight > 0) parts.push(`poids ${String(weight).replace('.', ',')} kg`)
  if (size > 0) parts.push(`taille ${String(size).replace('.', ',')} cm`)
  const apgar = (['1', '3', '5', '10'] as const)
    .filter((n) => isTrue(row[`with_apgar${n}`]) && Number(row[`apgar${n}`]) > 0)
    .map((n) => `${row[`apgar${n}`]} à ${n} min`)
  if (apgar.length) parts.push(`Apgar ${apgar.join(', ')}`)

  const textFields: Array<[string, string]> = [
    ['presentation', 'présentation'],
    ['anesthesia', 'anesthésie'],
    ['caesarean', 'césarienne'],
    ['accelerators', 'déclenchement'],
    ['deformed_skull', 'déformation du crâne'],
    ['reflux', 'reflux'],
    ['sleep', 'sommeil'],
    ['allergies', 'allergies'],
    ['disease', 'maladie'],
    ['accident', 'accident'],
  ]
  for (const [field, label] of textFields) {
    const value = oneLine(cleanText(row[field]))
    if (value) parts.push(`${label} : ${value}`)
    else if (isTrue(row[`with_${field}`])) parts.push(label)
  }
  if (isTrue(row.with_caesarean) && !cleanText(row.caesarean) && !parts.includes('césarienne')) parts.push('césarienne')
  if (isTrue(row.forceps)) parts.push('forceps')
  if (isTrue(row.suction_cup)) parts.push('ventouse')
  if (isTrue(row.premature) || isTrue(row.with_premature)) parts.push('prématuré')
  for (const field of ['remarks1', 'remarks2', 'remarks3', 'remarks4', 'remarks5']) {
    const value = oneLine(cleanText(row[field]))
    if (value) parts.push(value)
  }
  if (!parts.length) return null
  return { history_type: 'medical', description: `Naissance : ${parts.join(', ')}`, note: '(OsteoTools, fiche pédiatrique)', is_vigilance: false }
}

// ---------------------------------------------------------------------------
// Consultations
// ---------------------------------------------------------------------------

const MAX_REASON_LENGTH = 150

export function splitReason(raw: string): { reason: string; overflow: string | null } {
  const full = cleanText(raw)
  if (!full) return { reason: 'Consultation', overflow: null }
  const firstLine = full.split('\n')[0].trim()
  let reason = firstLine
  if (reason.length > MAX_REASON_LENGTH) {
    const cut = reason.slice(0, MAX_REASON_LENGTH)
    reason = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60)).trim()}…`
  }
  reason = capitalize(reason)
  return { reason, overflow: reason === capitalize(full) ? null : full }
}

const GENERIC_REASON_RE = /^(consultation|séance|seance|rdv)?( du)? ?(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})?$/i

export function isGenericReason(raw: string): boolean {
  return GENERIC_REASON_RE.test(cleanText(raw))
}

function section(label: string, value: string): string | null {
  const text = cleanText(value)
  return text ? `**${label} :** ${text}` : null
}

export function buildConsultationTexts(
  consultation: CsvRow,
  exam: CsvRow | undefined,
  extras: { measurement?: CsvRow; eva?: CsvRow; exclusionTests?: CsvRow[] },
): { reason: string; anamnesis: string | null; examination: string | null } {
  // Les séances reprises d'un ancien logiciel portent souvent un motif
  // « Consultation du 17/07/2012 » et leur contenu dans « Évolution » ou
  // « Diagnostic » : on en tire alors le motif.
  let reasonSource = consultation.reason || ''
  let diagnostic = exam?.diagnostic || ''
  if (isGenericReason(reasonSource)) {
    const evolutionText = cleanText(exam?.evolution)
    reasonSource = evolutionText || cleanText(diagnostic)
    if (!evolutionText && reasonSource) diagnostic = ''
  }
  const { reason, overflow } = splitReason(reasonSource)

  const anamnesis: string[] = []
  if (overflow) anamnesis.push(capitalize(overflow))
  const evolution = cleanText(exam?.evolution)
  if (evolution) {
    const already = comparable(overflow || reasonSource)
    if (comparable(evolution) !== already && !already.includes(comparable(evolution))) {
      anamnesis.push(anamnesis.length || comparable(evolution) !== comparable(reason) ? `**Évolution :** ${evolution}` : evolution)
    }
  }

  const examination: string[] = []
  const add = (value: string | null) => {
    if (value) examination.push(value)
  }
  add(section('Observation', exam?.observation || ''))
  add(section('Tests', exam?.tests || ''))
  add(section('Diagnostic', diagnostic))
  add(section('Traitement', exam?.treatment || ''))

  const m = extras.measurement
  if (m) {
    const size = parseAmount(m.size)
    const weight = parseAmount(m.weight)
    const parts = [size > 0 ? `taille ${String(size).replace('.', ',')} cm` : '', weight > 0 ? `poids ${String(weight).replace('.', ',')} kg` : ''].filter(Boolean)
    if (parts.length) add(`**Mesures :** ${parts.join(', ')}`)
  }
  const eva = extras.eva
  if (eva && (Number(eva.before) > 0 || Number(eva.after) > 0)) {
    add(`**EVA :** avant ${eva.before || '?'}, après ${eva.after || '?'}`)
  }
  for (const test of extras.exclusionTests || []) {
    const name = cleanText(test.name)
    if (!name) continue
    const comment = oneLine(cleanText(test.comment))
    add(`**Test d'exclusion (${name}) :** ${isTrue(test.positive) ? 'positif' : 'négatif'}${comment ? `, ${comment}` : ''}`)
  }

  return {
    reason,
    anamnesis: anamnesis.length ? anamnesis.join('\n\n') : null,
    examination: examination.length ? examination.join('\n\n') : null,
  }
}

// ---------------------------------------------------------------------------
// Règlements
// ---------------------------------------------------------------------------

/**
 * Codes de règlement OsteoTools. Seul le code 2 (toujours à 0 €) est certain ;
 * les autres sont proposés au praticien, qui confirme lors de l'import.
 */
export const DEFAULT_PAYMENT_MODES: Record<string, PaymentTarget> = {
  '0': 'check',
  '1': 'card',
  '2': 'free',
  '3': 'cash',
  '4': 'transfer',
}

export function suggestPaymentTarget(code: string, total: number): PaymentTarget {
  if (total === 0) return 'free'
  return DEFAULT_PAYMENT_MODES[code] || 'other'
}

// ---------------------------------------------------------------------------
// Plan complet
// ---------------------------------------------------------------------------

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const DEFAULT_TIME = '09:00'

export function buildOsteoToolsPlan(tables: OsteoToolsTables, files: Map<string, Uint8Array> | Set<string> = new Set()): OsteoToolsPlan {
  const patientsRows = tables.patients || []
  const resolveGender = buildGenderResolver(patientsRows)
  const details = indexBy(tables.patient_details, 'pat_id')
  const phones = groupBy(tables.phones, 'link_id')
  const addresses = groupBy(tables.addresses, 'link_id')
  const antecedents = groupBy(tables.antecedents, 'pat_id')
  const spheres = groupBy(tables.spheres, 'pat_id')
  const pediatrics = groupBy(tables.pediatrics, 'pat_id')
  const members = groupBy(tables.members, 'pat_id')
  const consultationsByPatient = groupBy(tables.consultations, 'pat_id')
  const exams = indexBy(tables.examens, 'con_id')
  const measurements = indexBy(tables.measurements, 'con_id')
  const evas = indexBy(tables.evas, 'con_id')
  const exclusionTests = groupBy(tables.exclusion_tests, 'con_id')
  const invoicesByConsultation = indexBy(tables.invoices, 'con_id')
  const orphanInvoices = groupBy((tables.invoices || []).filter((i) => isEmptyId(i.con_id)), 'pat_id')
  const attachmentsByPatient = groupBy(tables.attachments, 'pat_id')
  const patientById = indexBy(patientsRows, 'pat_id')
  const fileNames = new Set(files instanceof Map ? files.keys() : files)
  const filesById = new Map<string, string>()
  for (const name of fileNames) filesById.set(name.replace(/\.[^.]+$/, ''), name)

  // Heures réelles : l'agenda garde l'heure des rendez-vous que la fiche de
  // consultation n'a pas (séances saisies « à minuit »).
  const agendaTimes = new Map<string, string[]>()
  for (const event of tables.events || []) {
    if (isEmptyId(event.pat_id) || isTrue(event.missed) || isTrue(event.unvalid)) continue
    const key = `${event.pat_id}|${sourceDay(event.start_date)}`
    const time = sourceTime(event.start_date)
    if (!time) continue
    const list = agendaTimes.get(key)
    if (list) list.push(time)
    else agendaTimes.set(key, [time])
  }
  agendaTimes.forEach((list) => list.sort())

  const fullNameOf = (id: string) => {
    const p = patientById.get(id)
    return p ? `${formatName(p.first_name)} ${formatName(p.last_name)}`.trim() : ''
  }

  const stats: OsteoToolsPlan['stats'] = {
    patients: 0,
    consultations: 0,
    invoices: 0,
    historyEntries: 0,
    attachments: 0,
    firstConsultation: null,
    lastConsultation: null,
    consultationTimesFromAgenda: 0,
    skippedEmptyInvoices: 0,
  }
  const modes = new Map<string, { count: number; total: number; years: string[] }>()

  const planInvoice = (row: CsvRow, day: string, time: string, offset: string, patientNames: string[]): PlannedInvoice => {
    const amount = parseAmount(row.ttc)
    const paymentDay = sourceDay(row.settlement_date) || day
    const notes: string[] = [`Facture OsteoTools n° ${row.number.trim() || '?'}`]
    const label = oneLine(cleanText(row.label))
    if (label && !['consultation', '.'].includes(comparable(label)) && !patientNames.includes(comparable(label))) {
      notes.push(`Libellé : ${label}`)
    }
    const retrocession = parseAmount(row.retrocession)
    if (retrocession > 0) notes.push(`Rétrocession : ${formatEuros(retrocession)}`)
    const mode = row.mode || '0'
    const summary = modes.get(mode) || { count: 0, total: 0, years: [] }
    summary.count++
    summary.total += amount
    summary.years.push(paymentDay.slice(0, 4))
    modes.set(mode, summary)
    stats.invoices++
    return {
      sourceId: row.id,
      sourceNumber: row.number.trim(),
      amount,
      paymentMode: mode,
      paymentDate: paymentDay,
      issuedAtIso: toIso(day, time, offset),
      paidAtIso: toIso(paymentDay, time, sourceOffset(row.settlement_date) || offset),
      notes: notes.join('\n'),
    }
  }

  const patients: PlannedPatient[] = []

  for (const row of patientsRows) {
    const id = row.pat_id
    const detail = details.get(id)
    const firstName = formatName(row.first_name)
    const lastName = formatName(row.last_name) || 'Inconnu'
    const patientNames = [comparable(`${row.first_name} ${row.last_name}`), comparable(`${row.last_name} ${row.first_name}`)]

    // Téléphones
    const phoneList = (phones.get(id) || [])
      .sort((a, b) => Number(a.order) - Number(b.order))
      .map((p) => formatPhone(p.number))
      .filter(Boolean)
    const mainPhone = formatPhone(row.phone) || phoneList[0] || ''
    const otherPhones = Array.from(new Set(phoneList.filter((p) => p !== mainPhone)))

    // Notes du dossier
    const notes: string[] = []
    const detailNotes = cleanText(detail?.notes)
    if (detailNotes) notes.push(detailNotes)
    const address = (addresses.get(id) || [])[0]
    if (address && (address.street || address.city)) {
      const street = [address.number, cleanText(address.street)].filter(Boolean).join(' ')
      const city = [address.zipcode, formatName(address.city || '')].filter(Boolean).join(' ')
      notes.push(`Adresse : ${[street, city].filter(Boolean).join(', ')}`)
    } else if (cleanText(row.address)) {
      notes.push(`Adresse : ${cleanText(row.address).replace(/,\s*france$/i, '')}`)
    }
    if (otherPhones.length) notes.push(`Autre téléphone : ${otherPhones.join(', ')}`)
    const nir = (detail?.nir || '').replace(/\s/g, '')
    if (nir) notes.push(`N° de sécurité sociale : ${nir}`)
    const children = Number(detail?.number_of_children)
    if (children > 0) notes.push(`Nombre d'enfants : ${children}`)
    const reference = cleanText(detail?.reference)
    if (reference && comparable(reference) !== 'autre') notes.push(`Adressé par : ${reference}`)
    const relatives = (members.get(id) || []).map((m) => fullNameOf(m.link_id)).filter(Boolean)
    if (relatives.length) notes.push(`Proches suivis au cabinet : ${Array.from(new Set(relatives)).join(', ')}`)
    if (isTrue(row.blacklist)) notes.push('Patient signalé « liste noire » dans OsteoTools.')
    if (isTrue(row.deceased)) notes.push('Patient décédé (information OsteoTools).')

    // Antécédents
    const history: PlannedHistoryEntry[] = []
    const seen = new Set<string>()
    const pushHistory = (entry: PlannedHistoryEntry | null) => {
      if (!entry) return
      const key = `${entry.history_type}|${comparable(entry.description)}`
      if (seen.has(key)) return
      seen.add(key)
      history.push(entry)
    }
    const consultationDays = new Set((consultationsByPatient.get(id) || []).map((c) => sourceDay(c.act_date)))
    for (const a of (antecedents.get(id) || []).sort((x, y) => x.event_date.localeCompare(y.event_date))) {
      pushHistory(mapAntecedent(a, 'antecedent', consultationDays))
    }
    for (const s of spheres.get(id) || []) pushHistory(mapAntecedent(s, 'sphere', consultationDays))
    pushHistory(mapFamilyHistory(detail?.family_antecedents || ''))
    for (const p of pediatrics.get(id) || []) pushHistory(mapPediatrics(p))
    stats.historyEntries += history.length

    // Consultations
    const consultations: PlannedConsultation[] = []
    const consultationRows = (consultationsByPatient.get(id) || []).sort((a, b) => a.start_schedule.localeCompare(b.start_schedule))
    const usedAgenda = new Map<string, number>()
    for (const c of consultationRows) {
      const rawDate = c.start_schedule || c.act_date
      const day = sourceDay(rawDate) || sourceDay(c.act_date)
      if (!day) continue
      let time = sourceTime(rawDate)
      if (!time || time === '00:00') {
        const key = `${id}|${day}`
        const slots = agendaTimes.get(key)
        const used = usedAgenda.get(key) || 0
        if (slots && used < slots.length) {
          time = slots[used]
          usedAgenda.set(key, used + 1)
          stats.consultationTimesFromAgenda++
        } else {
          time = DEFAULT_TIME
        }
      }
      const texts = buildConsultationTexts(c, exams.get(c.id), {
        measurement: measurements.get(c.id),
        eva: evas.get(c.id),
        exclusionTests: exclusionTests.get(c.id),
      })
      const invoiceRow = invoicesByConsultation.get(c.id)
      consultations.push({
        sourceId: c.id,
        date_time: `${day}T${time}`,
        ...texts,
        invoice: invoiceRow ? planInvoice(invoiceRow, day, time, sourceOffset(rawDate), patientNames) : null,
        attachments: [],
        invoiceOnly: false,
      })
      stats.consultations++
      if (!stats.firstConsultation || day < stats.firstConsultation) stats.firstConsultation = day
      if (!stats.lastConsultation || day > stats.lastConsultation) stats.lastConsultation = day
    }

    // Factures sans consultation : MyOsteoflow rattache toute facture à une
    // séance, on crée donc une séance « support » à la date de la facture.
    for (const inv of orphanInvoices.get(id) || []) {
      if (parseAmount(inv.ttc) <= 0) {
        stats.skippedEmptyInvoices++
        continue
      }
      const day = sourceDay(inv.settlement_date)
      if (!day) continue
      const time = sourceTime(inv.settlement_date) && sourceTime(inv.settlement_date) !== '00:00' ? sourceTime(inv.settlement_date) : DEFAULT_TIME
      consultations.push({
        sourceId: `invoice:${inv.id}`,
        date_time: `${day}T${time}`,
        reason: 'Facture OsteoTools sans fiche de séance',
        anamnesis: null,
        examination: null,
        invoice: planInvoice(inv, day, time, sourceOffset(inv.settlement_date), patientNames),
        attachments: [],
        invoiceOnly: true,
      })
      stats.consultations++
    }
    consultations.sort((a, b) => a.date_time.localeCompare(b.date_time))

    // Documents : rattachés à la séance la plus proche de leur date.
    const documentsWithoutFile: string[] = []
    for (const att of attachmentsByPatient.get(id) || []) {
      const day = sourceDay(att.act_date)
      const title = oneLine(cleanText(att.name)) || 'Document'
      const description = oneLine(cleanText(att.description))
      const fileName = filesById.get(att.id)
      if (!fileName || consultations.length === 0) {
        documentsWithoutFile.push(`${capitalize(title)}${day ? ` (${frenchDate(day)})` : ''}${description ? ` : ${description}` : ''}`)
        continue
      }
      const target = day
        ? consultations.reduce((best, c) => {
            const diff = Math.abs(Date.parse(c.date_time.slice(0, 10)) - Date.parse(day))
            const bestDiff = Math.abs(Date.parse(best.date_time.slice(0, 10)) - Date.parse(day))
            return diff < bestDiff ? c : best
          })
        : consultations[consultations.length - 1]
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      target.attachments.push({
        sourceId: att.id,
        fileName,
        originalName: `${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/[.\s]+$/, '').trim() || 'Document'}.${ext}`,
        mimeType: MIME_BY_EXT[ext] || null,
      })
      if (description) documentsWithoutFile.push(`${capitalize(title)} : ${description}`)
      stats.attachments++
    }
    if (documentsWithoutFile.length) notes.push(`Documents OsteoTools :\n${documentsWithoutFile.map((d) => `- ${d}`).join('\n')}`)

    const habitus = cleanText(detail?.habitus)
    patients.push({
      sourceId: id,
      first_name: firstName,
      last_name: lastName,
      gender: resolveGender(row),
      birth_date: sourceDay(row.birth_date),
      phone: mainPhone,
      email: (row.email || '').trim().toLowerCase() || null,
      profession: capitalize(oneLine(cleanText(row.profession))) || null,
      sport_activity: habitus ? capitalize(habitus) : null,
      notes: notes.length ? notes.join('\n\n') : null,
      created_at: toSqlTimestamp(row.creation_date),
      archived: isTrue(row.deceased),
      history,
      consultations,
    })
    stats.patients++
  }

  const paymentModes: PaymentModeSummary[] = Array.from(modes.entries())
    .map(([code, s]) => {
      const years = s.years.filter(Boolean).sort()
      const total = Math.round(s.total * 100) / 100
      return {
        code,
        count: s.count,
        total,
        firstYear: years[0] || '',
        lastYear: years[years.length - 1] || '',
        suggested: suggestPaymentTarget(code, total),
      }
    })
    .sort((a, b) => b.count - a.count)

  return { patients, paymentModes, stats }
}
