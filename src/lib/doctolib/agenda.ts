import { getDatabase } from '@/lib/database/connection'
import { getActiveCabinetId, getScopeCabinetIds } from '@/lib/database/cabinet-scope'
import { localDay, matchPatient, parseDoctolibAppointments, type DoctolibAppointment, type MatchablePatient } from '@/lib/doctolib/import'

/**
 * Agenda Doctolib synchronisé sur le poste (table app_config).
 *
 * L'extension envoie la semaine en cours dès que l'agenda Doctolib est ouvert,
 * puis toutes les 10 minutes. À chaque envoi :
 * - l'agenda gardé ici est remplacé pour les jours envoyés ;
 * - les patients reconnus avec certitude (nom, prénom et date de naissance)
 *   sont ajoutés à « Ma journée » du jour du rendez-vous, s'ils n'y sont pas ;
 * - un rendez-vous annulé ou déplacé retire le patient ajouté automatiquement,
 *   tant qu'il n'a pas été vu ;
 * - le reste attend une validation dans Ma journée.
 *
 * Un rendez-vous « traité » (ajouté automatiquement, ajouté à la main depuis
 * Ma journée ou ignoré) n'est plus jamais proposé : retirer un patient de la
 * journée ne le fait pas revenir.
 */
const AGENDA_KEY = 'doctolib_agenda'
const HANDLED_KEY = 'doctolib_handled'
const LAST_SYNC_KEY = 'doctolib_last_sync'
const ORDER_FIXED_KEY = 'doctolib_plan_ordered'
const REVIEW_SEEN_KEY = 'doctolib_review_seen'
const AUTO_ADD_KEY = 'doctolib_auto_add'

const KEEP_DAYS = 21
const MAX_APPOINTMENTS = 1500

export interface StoredAgenda {
  syncedAt: string | null
  days: Record<string, DoctolibAppointment[]>
}

export interface HandledEntry {
  date: string
  /** Ligne de Ma journée créée pour ce rendez-vous */
  itemId?: string
  patientId?: string
  /** Ajouté par la synchronisation (et donc retirable si le rendez-vous disparaît) */
  auto?: boolean
  ignored?: boolean
}

export interface SyncSummary {
  at: string
  received: number
  added: number
  removed: number
  toReview: number
  /** Rendez-vous à vérifier apparus avec cet envoi */
  newToReview: number
  /** Premier jour avec un rendez-vous à vérifier */
  firstReviewDate: string | null
}

function read<T>(key: string, fallback: T): T {
  const row = getDatabase().prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return fallback
  try {
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  getDatabase().prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
}

export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function readAgenda(): StoredAgenda {
  return read<StoredAgenda>(AGENDA_KEY, { syncedAt: null, days: {} })
}

export function readHandled(): Record<string, HandledEntry> {
  return read<Record<string, HandledEntry>>(HANDLED_KEY, {})
}

export function readLastSync(): SyncSummary | null {
  return read<SyncSummary | null>(LAST_SYNC_KEY, null)
}

export function isAutoAddEnabled(): boolean {
  const row = getDatabase().prepare('SELECT value FROM app_config WHERE key = ?').get(AUTO_ADD_KEY) as { value: string } | undefined
  return row?.value !== '0'
}

export function setAutoAdd(enabled: boolean) {
  getDatabase().prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(AUTO_ADD_KEY, enabled ? '1' : '0')
}

interface PatientRow extends MatchablePatient {
  practitioner_id: string
}

/**
 * Patients du périmètre du cabinet actif : sur une installation à plusieurs
 * cabinets cloisonnés, un rendez-vous ne doit jamais être associé au dossier
 * d'un autre cabinet.
 */
function loadPatients(): PatientRow[] {
  const db = getDatabase()
  const scope = getScopeCabinetIds('patients', db)
  const base = 'SELECT id, practitioner_id, first_name, last_name, birth_date FROM patients WHERE archived_at IS NULL'
  if (!scope.length) return db.prepare(base).all() as PatientRow[]
  return db.prepare(`${base} AND practitioner_id IN (${scope.map(() => '?').join(',')})`).all(...scope) as PatientRow[]
}

/** Patients déjà dans Ma journée du cabinet actif ce jour-là. */
function planPatientIds(date: string): Set<string> {
  const db = getDatabase()
  const cabinet = getActiveCabinetId(db)
  const rows = (cabinet
    ? db.prepare('SELECT patient_id FROM daily_plan_items WHERE plan_date = ? AND practitioner_id = ?').all(date, cabinet)
    : db.prepare('SELECT patient_id FROM daily_plan_items WHERE plan_date = ?').all(date)) as Array<{ patient_id: string }>
  return new Set(rows.map((row) => row.patient_id))
}

/** Rendez-vous d'un jour qui attendent une décision dans Ma journée. */
function needsReview(
  appointment: DoctolibAppointment,
  handled: Record<string, HandledEntry>,
  patients: PatientRow[],
  inPlan: Set<string>
): boolean {
  if (handled[appointment.doctolibId]) return false
  const match = matchPatient(appointment, patients)
  return !(match.patientId && inPlan.has(match.patientId))
}

/**
 * Enregistre les rendez-vous reçus pour les jours `start` à `end` (inclus) et
 * met Ma journée à jour.
 */
export function syncAgenda(input: { start: string; end: string; appointments: unknown }): SyncSummary {
  const db = getDatabase()
  const today = todayLocal()
  const appointments = parseDoctolibAppointments(input.appointments).slice(0, MAX_APPOINTMENTS)
  const start = input.start <= input.end ? input.start : input.end
  const end = input.start <= input.end ? input.end : input.start

  // 1. Agenda : on remplace les jours envoyés, on oublie les jours trop anciens.
  const agenda = readAgenda()
  for (let day = start, guard = 0; day <= end && guard < 62; day = addDays(day, 1), guard++) {
    agenda.days[day] = []
  }
  for (const appointment of appointments) {
    const day = localDay(appointment.start)
    if (day < start || day > end) continue
    ;(agenda.days[day] ??= []).push(appointment)
  }
  // Doctolib renvoie les rendez-vous dans l'ordre de sa page, pas forcément
  // par heure : on les range, pour l'agenda comme pour l'ajout à Ma journée.
  for (const day of Object.keys(agenda.days)) agenda.days[day].sort(byStart)
  const oldest = addDays(today, -KEEP_DAYS)
  for (const day of Object.keys(agenda.days)) if (day < oldest) delete agenda.days[day]
  agenda.syncedAt = new Date().toISOString()

  const handled = readHandled()
  const patients = loadPatients()
  const byId = new Map(patients.map((patient) => [patient.id, patient]))
  const present = new Map<string, string>() // doctolibId → jour
  for (const [day, list] of Object.entries(agenda.days)) for (const appointment of list) present.set(appointment.doctolibId, day)

  let removed = 0
  const removeIfUntouched = (entry: HandledEntry) => {
    if (!entry.auto || !entry.itemId) return
    const result = db.prepare("DELETE FROM daily_plan_items WHERE id = ? AND status = 'pending'").run(entry.itemId)
    removed += result.changes
  }

  // 2. Rendez-vous annulés ou déplacés (jours envoyés, à venir seulement).
  for (const [doctolibId, entry] of Object.entries(handled)) {
    if (entry.date < today || entry.date < start || entry.date > end) continue
    const nowOn = present.get(doctolibId)
    if (nowOn === entry.date) continue
    removeIfUntouched(entry)
    delete handled[doctolibId]
  }

  // 3. Ajout automatique des patients reconnus avec certitude.
  let added = 0
  const daysAdded = new Set<string>()
  // Les patients reconnus rejoignent Ma journée du cabinet actif ; sans
  // cabinet actif (session verrouillée), tout attend la validation.
  const cabinet = getActiveCabinetId(db)
  if (cabinet && isAutoAddEnabled()) {
    const insert = db.prepare(
      "INSERT INTO daily_plan_items (practitioner_id, patient_id, plan_date, position, status) VALUES (?, ?, ?, ?, 'pending') RETURNING id"
    )
    const maxPosition = db.prepare(
      'SELECT COALESCE(MAX(position), -1) AS max FROM daily_plan_items WHERE practitioner_id = ? AND plan_date = ?'
    )
    const transaction = db.transaction(() => {
      for (let day = start > today ? start : today; day <= end; day = addDays(day, 1)) {
        const inPlan = planPatientIds(day)
        for (const appointment of agenda.days[day] ?? []) {
          if (handled[appointment.doctolibId]) continue
          const match = matchPatient(appointment, patients)
          if (match.status !== 'exact' || !match.patientId) continue
          const patient = byId.get(match.patientId)
          if (!patient) continue
          if (inPlan.has(patient.id)) {
            handled[appointment.doctolibId] = { date: day, patientId: patient.id }
            continue
          }
          const { max } = maxPosition.get(cabinet, day) as { max: number }
          const row = insert.get(cabinet, patient.id, day, max + 1) as { id: string }
          handled[appointment.doctolibId] = { date: day, itemId: row.id, patientId: patient.id, auto: true }
          inPlan.add(patient.id)
          daysAdded.add(day)
          added++
        }
      }
    })
    transaction()
  }

  // 4. Ce qui reste à vérifier (aujourd'hui et après).
  const previouslySeen = new Set(read<string[]>(REVIEW_SEEN_KEY, []))
  const review: string[] = []
  let firstReviewDate: string | null = null
  for (const day of Object.keys(agenda.days).sort()) {
    if (day < today) continue
    const inPlan = planPatientIds(day)
    for (const appointment of agenda.days[day]) {
      if (!needsReview(appointment, handled, patients, inPlan)) continue
      review.push(appointment.doctolibId)
      firstReviewDate ??= day
    }
  }
  const newToReview = review.filter((id) => !previouslySeen.has(id)).length

  // Entrées « traitées » trop anciennes : inutiles désormais.
  for (const [doctolibId, entry] of Object.entries(handled)) if (entry.date < oldest) delete handled[doctolibId]

  const summary: SyncSummary = {
    at: agenda.syncedAt,
    received: appointments.length,
    added,
    removed,
    toReview: review.length,
    newToReview,
    firstReviewDate,
  }
  write(AGENDA_KEY, agenda)
  write(HANDLED_KEY, handled)
  write(REVIEW_SEEN_KEY, review)
  write(LAST_SYNC_KEY, summary)
  // Une fois, après la mise à jour : les journées déjà remplies dans le
  // désordre par les versions précédentes sont remises dans l'ordre.
  if (!read<boolean>(ORDER_FIXED_KEY, false)) {
    for (const day of Object.keys(agenda.days)) if (day >= today) daysAdded.add(day)
    write(ORDER_FIXED_KEY, true)
  }
  for (const day of daysAdded) orderDayByAppointments(day)
  return summary
}

/** Rendez-vous traités depuis Ma journée : ajoutés à la main, ou ignorés. */
export function markHandled(entries: Array<{ doctolibId: string; date: string; patientId?: string | null; itemId?: string | null; ignored?: boolean }>) {
  const handled = readHandled()
  for (const entry of entries) {
    if (typeof entry.doctolibId !== 'string' || !isDay(entry.date)) continue
    handled[entry.doctolibId] = {
      date: entry.date,
      ...(entry.patientId ? { patientId: entry.patientId } : {}),
      ...(entry.itemId ? { itemId: entry.itemId } : {}),
      ...(entry.ignored ? { ignored: true } : {}),
    }
  }
  write(HANDLED_KEY, handled)
  // Patients validés depuis Ma journée : ils y ont été ajoutés en fin de liste.
  const days = new Set(entries.filter((entry) => entry.patientId && !entry.ignored && isDay(entry.date)).map((entry) => entry.date))
  for (const day of days) orderDayByAppointments(day)
}

function byStart(a: DoctolibAppointment, b: DoctolibAppointment): number {
  return (Date.parse(a.start) || 0) - (Date.parse(b.start) || 0)
}

/**
 * Range Ma journée dans l'ordre des rendez-vous Doctolib du jour.
 *
 * Seuls les patients qui ont un rendez-vous ce jour-là sont déplacés, entre
 * eux : ils reprennent les places qu'ils occupaient, dans l'ordre des heures.
 * Un patient ajouté à la main, sans rendez-vous, garde sa place. Appelé
 * uniquement quand des patients viennent d'être ajoutés depuis Doctolib,
 * pour ne pas défaire un ordre changé à la main entre deux synchronisations.
 */
export function orderDayByAppointments(day: string) {
  const db = getDatabase()
  const cabinet = getActiveCabinetId(db)
  const appointments = readAgenda().days[day] ?? []
  if (!appointments.length) return
  const handled = readHandled()
  const patients = loadPatients()
  const startOf = new Map<string, number>()
  for (const appointment of [...appointments].sort(byStart)) {
    const patientId = handled[appointment.doctolibId]?.patientId ?? matchPatient(appointment, patients).patientId
    if (patientId && !startOf.has(patientId)) startOf.set(patientId, Date.parse(appointment.start) || 0)
  }
  const items = (cabinet
    ? db.prepare('SELECT id, patient_id FROM daily_plan_items WHERE plan_date = ? AND practitioner_id = ? ORDER BY position, created_at').all(day, cabinet)
    : db.prepare('SELECT id, patient_id FROM daily_plan_items WHERE plan_date = ? ORDER BY position, created_at').all(day)) as Array<{ id: string; patient_id: string }>
  const timedSlots: number[] = []
  const timed: Array<{ id: string; start: number }> = []
  items.forEach((item, index) => {
    const start = startOf.get(item.patient_id)
    if (start === undefined) return
    timedSlots.push(index)
    timed.push({ id: item.id, start })
  })
  const sorted = [...timed].sort((a, b) => a.start - b.start)
  const ordered = items.map((item) => item.id)
  timedSlots.forEach((slot, k) => { ordered[slot] = sorted[k].id })
  const update = db.prepare('UPDATE daily_plan_items SET position = ? WHERE id = ?')
  db.transaction(() => ordered.forEach((id, position) => update.run(position, id)))()
}

export interface AgendaEntry extends DoctolibAppointment {
  /** Dossier associé (reconnu, ou choisi à la validation) */
  patientId: string | null
  matchStatus: 'exact' | 'probable' | 'ambiguous' | 'none'
  inPlan: boolean
  handled: boolean
  ignored: boolean
}

/** Agenda des jours demandés, avec l'état de chaque rendez-vous. */
export function readAgendaRange(start: string, end: string) {
  const agenda = readAgenda()
  const handled = readHandled()
  const patients = loadPatients()
  const days: Record<string, AgendaEntry[]> = {}
  for (let day = start, guard = 0; day <= end && guard < 62; day = addDays(day, 1), guard++) {
    const list = agenda.days[day]
    if (!list) continue
    const inPlan = planPatientIds(day)
    days[day] = list.map((appointment) => {
      const entry = handled[appointment.doctolibId]
      const match = matchPatient(appointment, patients)
      const patientId = entry?.patientId ?? match.patientId
      return {
        ...appointment,
        patientId,
        matchStatus: match.status,
        inPlan: !!patientId && inPlan.has(patientId),
        handled: !!entry,
        ignored: !!entry?.ignored,
      }
    })
  }
  return { syncedAt: agenda.syncedAt, days }
}
