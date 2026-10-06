/**
 * La base locale active les clés étrangères sans `ON DELETE CASCADE` sur la
 * plupart des tables : supprimer directement un patient ou une consultation
 * ayant des données liées échouait. Ces tests remplissent chaque table
 * rattachée et vérifient que la suppression passe, ne laisse aucune donnée
 * orpheline et épargne les autres patients.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SCHEMA_SQL, runMigrations } from '@/lib/database/schema'
import { deletePatientCascade, deleteConsultationCascade } from '@/lib/database/delete-cascade'

let db: Database.Database

const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

function seedPatient(id: string, referredBy: string | null = null) {
  db.prepare(`INSERT INTO patients (id, practitioner_id, gender, first_name, last_name, birth_date, phone, referred_by_patient_id)
    VALUES (?, 'pr', 'F', 'Jeanne', 'Martin', '1980-01-01', '0600000000', ?)`).run(id, referredBy)
  const c = `${id}-c`, inv = `${id}-inv`, conv = `${id}-conv`, msg = `${id}-msg`, ep = `${id}-ep`
  db.prepare(`INSERT INTO consultations (id, patient_id, reason) VALUES (?, ?, 'Lombalgie')`).run(c, id)
  db.prepare(`INSERT INTO invoices (id, consultation_id, invoice_number, amount) VALUES (?, ?, ?, 60)`).run(inv, c, `F-${id}`)
  db.prepare(`INSERT INTO payments (invoice_id, amount, method) VALUES (?, 60, 'card')`).run(inv)
  db.prepare(`INSERT INTO conversations (id, practitioner_id, patient_id) VALUES (?, 'pr', ?)`).run(conv, id)
  db.prepare(`INSERT INTO messages (id, conversation_id, consultation_id, content) VALUES (?, ?, ?, 'Bonjour')`).run(msg, conv, c)
  db.prepare(`INSERT INTO message_attachments (message_id, filename, data) VALUES (?, 'a.pdf', x'00')`).run(msg)
  db.prepare(`INSERT INTO scheduled_tasks (practitioner_id, consultation_id, type, scheduled_for) VALUES ('pr', ?, 'follow_up_email', datetime('now'))`).run(c)
  db.prepare(`INSERT INTO medical_history_entries (patient_id, history_type, description) VALUES (?, 'medical', 'Asthme')`).run(id)
  db.prepare(`INSERT INTO consultation_attachments (consultation_id, filename, original_name) VALUES (?, ?, 'radio.pdf')`).run(c, `${id}.pdf`)
  db.prepare(`INSERT INTO exercise_prescriptions (id, patient_id, consultation_id) VALUES (?, ?, ?)`).run(ep, id, c)
  db.prepare(`INSERT INTO exercise_prescription_items (prescription_id, exercise_id, exercise_name, exercise_description, exercise_region, exercise_type)
    VALUES (?, 'e', 'Gainage', 'desc', 'lombaire', 'renforcement')`).run(ep)
  db.prepare(`INSERT INTO survey_responses (consultation_id, patient_id, practitioner_id, token) VALUES (?, ?, 'pr', ?)`).run(c, id, `t-${id}`)
  db.prepare(`INSERT INTO generated_letters (practitioner_id, patient_id, consultation_id, template_id, template_name, header, body)
    VALUES ('pr', ?, ?, 't', 'Courrier', 'h', 'b')`).run(id, c)
  db.prepare(`INSERT INTO daily_plan_items (practitioner_id, patient_id, plan_date) VALUES ('pr', ?, date('now'))`).run(id)
  db.prepare(`INSERT INTO email_campaign_recipients (campaign_id, patient_id, email) VALUES ('camp', ?, 'j@m.fr')`).run(id)
}

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  runMigrations(db)
  db.prepare(`INSERT INTO practitioners (id, user_id, first_name, last_name, email) VALUES ('pr', 'u', 'A', 'B', 'a@b.fr')`).run()
  db.prepare(`INSERT INTO email_campaigns (id, practitioner_id, type, subject, content) VALUES ('camp', 'pr', 'broadcast', 's', 'c')`).run()
  seedPatient('p1')
  seedPatient('p2', 'p1')
})

describe('deletePatientCascade', () => {
  it('échoue sans cascade : le DELETE direct est refusé par les clés étrangères', () => {
    expect(() => db.prepare("DELETE FROM patients WHERE id = 'p1'").run()).toThrow(/FOREIGN KEY/)
  })

  it('supprime le patient et toutes ses données, sans toucher aux autres', () => {
    const before = Object.fromEntries(
      ['consultations', 'invoices', 'payments', 'conversations', 'messages', 'message_attachments', 'scheduled_tasks',
        'medical_history_entries', 'consultation_attachments', 'exercise_prescriptions', 'exercise_prescription_items',
        'survey_responses', 'generated_letters', 'daily_plan_items', 'email_campaign_recipients'].map((t) => [t, count(t)])
    )

    const result = deletePatientCascade(db, 'p1')

    expect(result).toEqual({ deleted: true, attachmentFiles: ['p1.pdf'] })
    expect(count('patients')).toBe(1)
    for (const [table, n] of Object.entries(before)) expect(count(table), table).toBe(n / 2)
    expect(db.prepare("SELECT referred_by_patient_id FROM patients WHERE id = 'p2'").get()).toEqual({ referred_by_patient_id: null })
    expect(db.pragma('foreign_key_check')).toEqual([])
  })

  it('ne fait rien pour un patient inexistant', () => {
    expect(deletePatientCascade(db, 'inconnu')).toEqual({ deleted: false, attachmentFiles: [] })
    expect(count('patients')).toBe(2)
  })
})

describe('deleteConsultationCascade', () => {
  it('échoue sans cascade : le DELETE direct est refusé par les clés étrangères', () => {
    expect(() => db.prepare("DELETE FROM consultations WHERE id = 'p1-c'").run()).toThrow(/FOREIGN KEY/)
  })

  it('supprime la séance et sa facturation, en gardant les données du patient', () => {
    const result = deleteConsultationCascade(db, 'p1-c')

    expect(result).toEqual({ deleted: true, attachmentFiles: ['p1.pdf'] })
    expect(count('consultations')).toBe(1)
    for (const table of ['invoices', 'payments', 'scheduled_tasks', 'survey_responses', 'consultation_attachments']) {
      expect(count(table), table).toBe(1)
    }
    // Rattachés au patient : conservés, détachés de la séance
    for (const table of ['messages', 'exercise_prescriptions', 'generated_letters']) {
      expect(count(table), table).toBe(2)
      expect(db.prepare(`SELECT consultation_id FROM ${table} WHERE consultation_id = 'p1-c'`).all(), table).toEqual([])
    }
    expect(count('patients')).toBe(2)
    expect(db.pragma('foreign_key_check')).toEqual([])
  })

  it('ne fait rien pour une consultation inexistante', () => {
    expect(deleteConsultationCascade(db, 'inconnue')).toEqual({ deleted: false, attachmentFiles: [] })
    expect(count('consultations')).toBe(2)
  })
})
