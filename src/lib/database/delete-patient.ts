/**
 * Suppression définitive d'un patient et de tout ce qui lui est rattaché.
 *
 * La base locale active `foreign_keys = ON` mais la plupart des tables
 * enfants n'ont pas de `ON DELETE CASCADE` : un simple
 * `DELETE FROM patients` échoue dès que le patient a une consultation,
 * un antécédent, un parrainage, etc. On supprime donc les dépendances
 * dans l'ordre, au sein d'une transaction (tout ou rien).
 *
 * Retourne les noms des fichiers de pièces jointes de consultation, à
 * effacer du disque par l'appelant une fois la transaction validée.
 */

import type BetterSqlite3 from 'better-sqlite3'

const CONSULTATIONS = 'SELECT id FROM consultations WHERE patient_id = @id'

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
    exec('DELETE FROM email_campaign_recipients WHERE patient_id = @id')

    // Les patients qu'il a recommandés restent, sans lien de parrainage
    exec('UPDATE patients SET referred_by_patient_id = NULL WHERE referred_by_patient_id = @id')

    exec('DELETE FROM consultations WHERE patient_id = @id')
    exec('DELETE FROM patients WHERE id = @id')

    return { deleted: true, attachmentFiles }
  })

  return run(patientId)
}
