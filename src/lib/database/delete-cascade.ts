/**
 * Suppressions définitives (patient, consultation) avec leurs dépendances.
 *
 * La base locale active `foreign_keys = ON` mais la plupart des tables
 * enfants n'ont pas de `ON DELETE CASCADE` : un simple `DELETE` échoue dès
 * qu'une ligne est référencée (facture, antécédent, message, parrainage...).
 * On supprime donc les dépendances dans l'ordre, au sein d'une transaction
 * (tout ou rien).
 *
 * Les fonctions retournent les noms des fichiers de pièces jointes, à
 * effacer du disque (`removeAttachmentFiles`) une fois la transaction validée.
 */

import type BetterSqlite3 from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const CONSULTATIONS = 'SELECT id FROM consultations WHERE patient_id = @id'

/**
 * Un envoi groupé (même adresse pour plusieurs patients) porte un patient
 * principal (`patient_id`) et les autres dans `linked_patient_ids`. On retire
 * le patient supprimé de chaque groupe : s'il était principal, le premier
 * patient lié prend sa place ; s'il était seul, la ligne disparaît. Sans cela,
 * l'envoi d'une campagne en attente échouait sur un patient disparu et
 * recommençait à chaque passage.
 */
function detachFromCampaignRecipients(db: BetterSqlite3.Database, patientId: string): void {
  const rows = db
    .prepare(
      `SELECT id, patient_id, linked_patient_ids FROM email_campaign_recipients
       WHERE patient_id = ? OR linked_patient_ids LIKE ?`
    )
    .all(patientId, `%${patientId}%`) as { id: string; patient_id: string; linked_patient_ids: string | null }[]

  const update = db.prepare('UPDATE email_campaign_recipients SET patient_id = ?, linked_patient_ids = ? WHERE id = ?')
  const remove = db.prepare('DELETE FROM email_campaign_recipients WHERE id = ?')

  for (const row of rows) {
    let linked: string[] = []
    try {
      const parsed = row.linked_patient_ids ? JSON.parse(row.linked_patient_ids) : []
      if (Array.isArray(parsed)) linked = parsed
    } catch {
      linked = []
    }
    const remaining = [row.patient_id, ...linked].filter((pid) => pid !== patientId)
    if (remaining.length === 0) {
      remove.run(row.id)
      continue
    }
    const [primary, ...others] = remaining
    update.run(primary, others.length ? JSON.stringify(others) : null, row.id)
  }
}

/** Supprime un patient et tout ce qui lui est rattaché. */
export function deletePatientCascade(
  db: BetterSqlite3.Database,
  patientId: string
): { deleted: boolean; attachmentFiles: string[] } {
  const run = db.transaction((id: string) => {
    const exists = db.prepare('SELECT 1 FROM patients WHERE id = ?').get(id)
    if (!exists) return { deleted: false, attachmentFiles: [] as string[] }

    const p = { id }
    const exec = (sql: string) => db.prepare(sql).run(p)

    const attachmentFiles = (
      db
        .prepare(`SELECT filename FROM consultation_attachments WHERE consultation_id IN (${CONSULTATIONS})`)
        .all(p) as { filename: string }[]
    ).map((a) => a.filename)

    // Facturation
    exec(`DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE consultation_id IN (${CONSULTATIONS}))`)
    exec(`DELETE FROM invoices WHERE consultation_id IN (${CONSULTATIONS})`)

    // Messagerie (les pièces jointes des messages suivent par ON DELETE CASCADE)
    exec(`UPDATE messages SET consultation_id = NULL WHERE consultation_id IN (${CONSULTATIONS})`)
    exec('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE patient_id = @id)')
    exec('DELETE FROM conversations WHERE patient_id = @id')

    // Données rattachées aux consultations ou au patient
    exec(`DELETE FROM scheduled_tasks WHERE consultation_id IN (${CONSULTATIONS})`)
    exec(`DELETE FROM consultation_attachments WHERE consultation_id IN (${CONSULTATIONS})`)
    exec(`DELETE FROM survey_responses WHERE patient_id = @id OR consultation_id IN (${CONSULTATIONS})`)
    exec(`DELETE FROM generated_letters WHERE patient_id = @id OR consultation_id IN (${CONSULTATIONS})`)
    exec('DELETE FROM exercise_prescriptions WHERE patient_id = @id')
    exec(`UPDATE exercise_prescriptions SET consultation_id = NULL WHERE consultation_id IN (${CONSULTATIONS})`)
    exec('DELETE FROM medical_history_entries WHERE patient_id = @id')
    exec('DELETE FROM daily_plan_items WHERE patient_id = @id')
    detachFromCampaignRecipients(db, id)

    // Les patients qu'il a recommandés restent, sans lien de parrainage
    exec('UPDATE patients SET referred_by_patient_id = NULL WHERE referred_by_patient_id = @id')

    exec('DELETE FROM consultations WHERE patient_id = @id')
    exec('DELETE FROM patients WHERE id = @id')

    return { deleted: true, attachmentFiles }
  })

  return run(patientId)
}

/**
 * Suppression définitive d'une consultation, même principe que pour le
 * patient. Les éléments qui appartiennent au patient plus qu'à la séance
 * (messages, programmes d'exercices, courriers) sont conservés, détachés de
 * la consultation.
 */
export function deleteConsultationCascade(
  db: BetterSqlite3.Database,
  consultationId: string
): { deleted: boolean; attachmentFiles: string[] } {
  const run = db.transaction((id: string) => {
    const exists = db.prepare('SELECT 1 FROM consultations WHERE id = ?').get(id)
    if (!exists) return { deleted: false, attachmentFiles: [] as string[] }

    const p = { id }
    const exec = (sql: string) => db.prepare(sql).run(p)

    const attachmentFiles = (
      db
        .prepare('SELECT filename FROM consultation_attachments WHERE consultation_id = @id')
        .all(p) as { filename: string }[]
    ).map((a) => a.filename)

    exec('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE consultation_id = @id)')
    exec('DELETE FROM invoices WHERE consultation_id = @id')
    exec('DELETE FROM scheduled_tasks WHERE consultation_id = @id')
    exec('DELETE FROM survey_responses WHERE consultation_id = @id')
    exec('DELETE FROM consultation_attachments WHERE consultation_id = @id')
    exec('UPDATE messages SET consultation_id = NULL WHERE consultation_id = @id')
    exec('UPDATE exercise_prescriptions SET consultation_id = NULL WHERE consultation_id = @id')
    exec('UPDATE generated_letters SET consultation_id = NULL WHERE consultation_id = @id')
    exec('DELETE FROM consultations WHERE id = @id')

    return { deleted: true, attachmentFiles }
  })

  return run(consultationId)
}

/** Efface du disque les fichiers de pièces jointes, sans sortir du dossier dédié. */
export function removeAttachmentFiles(attachmentsDir: string, filenames: string[]): void {
  for (const filename of filenames) {
    const filePath = path.join(attachmentsDir, filename)
    if (!filePath.startsWith(attachmentsDir + path.sep)) continue
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (err) {
      console.error('Error removing attachment file:', err)
    }
  }
}
