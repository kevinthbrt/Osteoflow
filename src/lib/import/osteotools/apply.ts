/**
 * Écriture d'un plan OsteoTools dans la base locale (tout ou rien).
 *
 * Fusion avec l'existant : beaucoup de praticiens ont déjà tenté un import CSV
 * générique avant cet outil (sexe forcé à « M », dates de naissance perdues,
 * séances à 9 h sans contenu…). Plutôt que de créer des doublons :
 * - un patient de même nom et prénom (date de naissance identique, ou absente
 *   côté MyOsteoflow) est complété et corrigé, pas recréé ;
 * - une séance du même patient le même jour est complétée avec le contenu
 *   OsteoTools ; ce qui a été saisi à la main dans MyOsteoflow est conservé ;
 * - chaque ligne importée est mémorisée dans `import_links` : relancer
 *   l'import ne duplique rien.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { randomBytes, randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { normalizeName } from '@/lib/doctolib/import'
import { IMPORT_LINKS_SQL } from '@/lib/database/schema'
import type { OsteoToolsPlan, PaymentTarget, PlannedConsultation, PlannedPatient } from './transform'

const SOURCE = 'osteotools'

export interface ApplyOptions {
  practitionerId: string
  /** Mode de règlement OsteoTools (code) → mode MyOsteoflow. */
  paymentTargets: Record<string, PaymentTarget>
  /** Fichiers joints de l'archive (nom → contenu). */
  files: Map<string, Uint8Array>
  /** Dossier des pièces jointes (getAppDataDir()/attachments). */
  attachmentsDir: string
  /** Simulation : tout est calculé puis annulé, aucun fichier n'est copié. */
  dryRun?: boolean
}

class DryRunRollback extends Error {}

export interface ApplyReport {
  patientsCreated: number
  patientsMerged: number
  patientsAlreadyImported: number
  historyEntriesCreated: number
  consultationsCreated: number
  consultationsMerged: number
  consultationsAlreadyImported: number
  invoicesCreated: number
  invoicesSkippedExisting: number
  paymentsCreated: number
  attachmentsCreated: number
}

interface ExistingPatient {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  gender: string
  phone: string | null
  email: string | null
  profession: string | null
  sport_activity: string | null
  notes: string | null
}

interface ExistingConsultation {
  id: string
  date_time: string
  reason: string | null
  anamnesis: string | null
  examination: string | null
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const isPlaceholderPhone = (phone: string | null) => !phone || /^[0\s.+-]*$/.test(phone)
const isBlank = (value: string | null | undefined) => !value || !value.trim()

function nameKey(last: string, first: string): string {
  return `${normalizeName(last)}|${normalizeName(first)}`
}

function nowSql(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

/** Ajoute un texte OsteoTools à un champ déjà rempli, sans répétition. */
function mergeText(existing: string | null, incoming: string | null, heading = '**Repris d\'OsteoTools :**'): string | null {
  if (isBlank(incoming)) return existing
  if (isBlank(existing)) return incoming
  const a = normalizeName(existing!)
  const b = normalizeName(incoming!)
  if (a === b || a.includes(b)) return existing
  if (b.includes(a)) return incoming
  return `${existing}\n\n${heading}\n${incoming}`
}

export function applyOsteoToolsPlan(db: BetterSqlite3.Database, plan: OsteoToolsPlan, options: ApplyOptions): ApplyReport {
  db.exec(IMPORT_LINKS_SQL)
  const { practitionerId } = options

  const report: ApplyReport = {
    patientsCreated: 0,
    patientsMerged: 0,
    patientsAlreadyImported: 0,
    historyEntriesCreated: 0,
    consultationsCreated: 0,
    consultationsMerged: 0,
    consultationsAlreadyImported: 0,
    invoicesCreated: 0,
    invoicesSkippedExisting: 0,
    paymentsCreated: 0,
    attachmentsCreated: 0,
  }

  // --- Requêtes préparées --------------------------------------------------
  const linkRows = db
    .prepare('SELECT entity, source_id, record_id FROM import_links WHERE source = ? AND practitioner_id = ?')
    .all(SOURCE, practitionerId) as { entity: string; source_id: string; record_id: string }[]
  const links = new Map(linkRows.map((l) => [`${l.entity}|${l.source_id}`, l.record_id]))
  const insertLink = db.prepare(
    'INSERT OR REPLACE INTO import_links (source, entity, source_id, record_id, practitioner_id) VALUES (?, ?, ?, ?, ?)'
  )
  const link = (entity: string, sourceId: string, recordId: string) => {
    insertLink.run(SOURCE, entity, sourceId, recordId, practitionerId)
    links.set(`${entity}|${sourceId}`, recordId)
  }

  const existingPatients = db
    .prepare(
      `SELECT id, first_name, last_name, birth_date, gender, phone, email, profession, sport_activity, notes
       FROM patients WHERE practitioner_id = ?`
    )
    .all(practitionerId) as ExistingPatient[]
  const patientsById = new Map(existingPatients.map((p) => [p.id, p]))
  const patientsByName = new Map<string, ExistingPatient[]>()
  for (const p of existingPatients) {
    for (const key of [nameKey(p.last_name, p.first_name), nameKey(p.first_name, p.last_name)]) {
      const list = patientsByName.get(key)
      if (list) {
        if (!list.includes(p)) list.push(p)
      } else patientsByName.set(key, [p])
    }
  }
  const claimedPatients = new Set<string>(
    linkRows.filter((l) => l.entity === 'patient').map((l) => l.record_id)
  )
  const claimedConsultations = new Set<string>(
    linkRows.filter((l) => l.entity === 'consultation').map((l) => l.record_id)
  )

  const existingConsultationIds = new Set(
    (db
      .prepare('SELECT c.id FROM consultations c JOIN patients p ON p.id = c.patient_id WHERE p.practitioner_id = ?')
      .all(practitionerId) as { id: string }[]).map((r) => r.id)
  )
  const invoiceNumbers = new Set((db.prepare('SELECT invoice_number FROM invoices').all() as { invoice_number: string }[]).map((r) => r.invoice_number))
  const consultationsWithInvoice = new Set(
    (db.prepare('SELECT consultation_id FROM invoices').all() as { consultation_id: string }[]).map((r) => r.consultation_id)
  )

  const insertPatient = db.prepare(
    `INSERT INTO patients (id, practitioner_id, gender, first_name, last_name, birth_date, phone, email, profession,
       sport_activity, notes, created_at, updated_at, archived_at)
     VALUES (@id, @practitioner_id, @gender, @first_name, @last_name, @birth_date, @phone, @email, @profession,
       @sport_activity, @notes, @created_at, @updated_at, @archived_at)`
  )
  const updatePatient = db.prepare(
    `UPDATE patients SET gender = @gender, first_name = @first_name, last_name = @last_name, birth_date = @birth_date,
       phone = @phone, email = @email, profession = @profession, sport_activity = @sport_activity, notes = @notes,
       updated_at = @updated_at WHERE id = @id`
  )
  const historyOf = db.prepare('SELECT history_type, description FROM medical_history_entries WHERE patient_id = ?')
  const insertHistory = db.prepare(
    `INSERT INTO medical_history_entries (id, patient_id, history_type, description, is_vigilance, note, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const consultationsOf = db.prepare('SELECT id, date_time, reason, anamnesis, examination FROM consultations WHERE patient_id = ?')
  const insertConsultation = db.prepare(
    `INSERT INTO consultations (id, patient_id, date_time, reason, anamnesis, examination, follow_up_7d, created_at, updated_at, cabinet_id)
     VALUES (@id, @patient_id, @date_time, @reason, @anamnesis, @examination, 0, @created_at, @updated_at, @cabinet_id)`
  )
  const updateConsultation = db.prepare(
    'UPDATE consultations SET date_time = @date_time, reason = @reason, anamnesis = @anamnesis, examination = @examination, updated_at = @updated_at WHERE id = @id'
  )
  const insertInvoice = db.prepare(
    `INSERT INTO invoices (id, consultation_id, invoice_number, amount, status, issued_at, paid_at, notes, created_at, updated_at, cabinet_id)
     VALUES (@id, @consultation_id, @invoice_number, @amount, 'paid', @issued_at, @paid_at, @notes, @created_at, @created_at, @cabinet_id)`
  )
  const insertPayment = db.prepare(
    `INSERT INTO payments (id, invoice_id, amount, method, payment_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const insertAttachment = db.prepare(
    `INSERT INTO consultation_attachments (id, consultation_id, filename, original_name, mime_type, file_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  const writtenFiles: string[] = []
  const stamp = nowSql()

  const findMatch = (p: PlannedPatient): ExistingPatient | null => {
    const candidates = (patientsByName.get(nameKey(p.last_name, p.first_name)) || []).filter((e) => !claimedPatients.has(e.id))
    if (!candidates.length) return null
    const sameBirth = candidates.find((e) => e.birth_date && e.birth_date === p.birth_date)
    if (sameBirth) return sameBirth
    return candidates.find((e) => !e.birth_date || !DAY_RE.test(e.birth_date)) || null
  }

  const uniqueInvoiceNumber = (consultation: PlannedConsultation): string => {
    const base = `OT-${consultation.invoice!.sourceNumber || consultation.invoice!.sourceId}`
    let candidate = base
    let n = 2
    while (invoiceNumbers.has(candidate)) candidate = `${base}-${n++}`
    invoiceNumbers.add(candidate)
    return candidate
  }

  const run = db.transaction(() => {
    for (const p of plan.patients) {
      // 1. Patient ---------------------------------------------------------
      let patientId = links.get(`patient|${p.sourceId}`)
      if (patientId && !patientsById.has(patientId)) patientId = undefined // supprimé depuis

      let isNew = false
      if (patientId) {
        report.patientsAlreadyImported++
      } else {
        const match = findMatch(p)
        if (match) {
          patientId = match.id
          updatePatient.run({
            id: match.id,
            gender: p.gender,
            first_name: p.first_name || match.first_name,
            last_name: p.last_name || match.last_name,
            birth_date: match.birth_date && DAY_RE.test(match.birth_date) ? match.birth_date : p.birth_date,
            phone: isPlaceholderPhone(match.phone) ? p.phone : match.phone,
            email: isBlank(match.email) ? p.email : match.email,
            profession: isBlank(match.profession) ? p.profession : match.profession,
            sport_activity: isBlank(match.sport_activity) ? p.sport_activity : match.sport_activity,
            notes: mergeText(match.notes, p.notes),
            updated_at: stamp,
          })
          report.patientsMerged++
        } else {
          patientId = randomUUID()
          isNew = true
          insertPatient.run({
            id: patientId,
            practitioner_id: practitionerId,
            gender: p.gender,
            first_name: p.first_name,
            last_name: p.last_name,
            birth_date: p.birth_date,
            phone: p.phone,
            email: p.email,
            profession: p.profession,
            sport_activity: p.sport_activity,
            notes: p.notes,
            created_at: p.created_at || stamp,
            updated_at: stamp,
            archived_at: p.archived ? stamp : null,
          })
          report.patientsCreated++
        }
        claimedPatients.add(patientId)
        link('patient', p.sourceId, patientId)
      }

      // 2. Antécédents (dédoublonnés avec ceux déjà saisis) ---------------
      const knownHistory = new Set(
        isNew
          ? []
          : (historyOf.all(patientId) as { history_type: string; description: string }[]).map(
              (h) => `${h.history_type}|${normalizeName(h.description)}`
            )
      )
      let order = knownHistory.size
      for (const h of p.history) {
        const key = `${h.history_type}|${normalizeName(h.description)}`
        if (knownHistory.has(key)) continue
        knownHistory.add(key)
        insertHistory.run(randomUUID(), patientId, h.history_type, h.description, h.is_vigilance ? 1 : 0, h.note, order++)
        report.historyEntriesCreated++
      }

      // 3. Séances ---------------------------------------------------------
      const existingByDay = new Map<string, ExistingConsultation[]>()
      if (!isNew) {
        for (const c of consultationsOf.all(patientId) as ExistingConsultation[]) {
          const day = (c.date_time || '').slice(0, 10)
          const list = existingByDay.get(day)
          if (list) list.push(c)
          else existingByDay.set(day, [c])
        }
      }

      for (const c of p.consultations) {
        let consultationId = links.get(`consultation|${c.sourceId}`)
        if (consultationId && !existingConsultationIds.has(consultationId)) consultationId = undefined
        if (consultationId) {
          report.consultationsAlreadyImported++
        } else {
          const sameDay = (existingByDay.get(c.date_time.slice(0, 10)) || []).find((e) => !claimedConsultations.has(e.id))
          if (sameDay) {
            consultationId = sameDay.id
            const existingTime = sameDay.date_time.slice(11, 16)
            const genericReason = isBlank(sameDay.reason) || normalizeName(sameDay.reason!) === 'consultation'
            updateConsultation.run({
              id: sameDay.id,
              date_time: !existingTime || existingTime === '09:00' || existingTime === '00:00' ? c.date_time : sameDay.date_time,
              reason: genericReason ? c.reason : sameDay.reason,
              anamnesis: mergeText(sameDay.anamnesis, c.anamnesis),
              examination: mergeText(sameDay.examination, c.examination),
              updated_at: stamp,
            })
            report.consultationsMerged++
          } else {
            consultationId = randomUUID()
            insertConsultation.run({
              id: consultationId,
              patient_id: patientId,
              date_time: c.date_time,
              reason: c.reason,
              anamnesis: c.anamnesis,
              examination: c.examination,
              created_at: `${c.date_time.replace('T', ' ')}:00`,
              updated_at: stamp,
              cabinet_id: practitionerId,
            })
            existingConsultationIds.add(consultationId)
            report.consultationsCreated++
          }
          claimedConsultations.add(consultationId)
          link('consultation', c.sourceId, consultationId)
        }

        // 4. Facture + règlement ------------------------------------------
        if (c.invoice && !links.has(`invoice|${c.invoice.sourceId}`)) {
          if (consultationsWithInvoice.has(consultationId)) {
            report.invoicesSkippedExisting++
          } else {
            const invoiceId = randomUUID()
            const target = options.paymentTargets[c.invoice.paymentMode] || 'other'
            const notes = [c.invoice.notes, target === 'free' ? 'Séance gratuite' : null].filter(Boolean).join('\n')
            insertInvoice.run({
              id: invoiceId,
              consultation_id: consultationId,
              invoice_number: uniqueInvoiceNumber(c),
              amount: c.invoice.amount,
              issued_at: c.invoice.issuedAtIso,
              paid_at: c.invoice.paidAtIso,
              notes: notes || null,
              created_at: `${c.date_time.replace('T', ' ')}:00`,
              cabinet_id: practitionerId,
            })
            consultationsWithInvoice.add(consultationId)
            report.invoicesCreated++
            if (target !== 'free' && c.invoice.amount > 0) {
              insertPayment.run(
                randomUUID(),
                invoiceId,
                c.invoice.amount,
                target,
                c.invoice.paymentDate,
                target === 'other' ? `Mode de règlement OsteoTools n° ${c.invoice.paymentMode}` : null,
                `${c.invoice.paymentDate} 12:00:00`
              )
              report.paymentsCreated++
            }
            link('invoice', c.invoice.sourceId, invoiceId)
          }
        }

        // 5. Documents ----------------------------------------------------
        for (const att of c.attachments) {
          if (links.has(`attachment|${att.sourceId}`)) continue
          const data = options.files.get(att.fileName)
          if (!data) continue
          if (options.dryRun) {
            report.attachmentsCreated++
            continue
          }
          const ext = path.extname(att.fileName).toLowerCase()
          const safeExt = /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '.bin'
          const fileName = `${consultationId}_${randomBytes(8).toString('hex')}${safeExt}`
          if (!fs.existsSync(options.attachmentsDir)) fs.mkdirSync(options.attachmentsDir, { recursive: true })
          const filePath = path.join(options.attachmentsDir, fileName)
          fs.writeFileSync(filePath, data)
          writtenFiles.push(filePath)
          const attachmentId = randomUUID()
          insertAttachment.run(attachmentId, consultationId, fileName, att.originalName, att.mimeType, data.length, stamp)
          link('attachment', att.sourceId, attachmentId)
          report.attachmentsCreated++
        }
      }
    }
    if (options.dryRun) throw new DryRunRollback()
  })

  try {
    run()
  } catch (err) {
    if (err instanceof DryRunRollback) return report
    // La base est revenue à son état initial : on retire aussi les fichiers copiés.
    for (const file of writtenFiles) fs.rmSync(file, { force: true })
    throw err
  }

  return report
}
