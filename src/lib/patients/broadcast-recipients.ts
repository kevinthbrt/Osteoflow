/**
 * Shared patient-selection logic for the "diffusion à tous les patients"
 * feature — used both to actually send and to preview how many patients
 * (and how many physical emails, after dedup) a broadcast will reach.
 */

import { getDatabase } from '@/lib/database/connection'

export interface BroadcastPatient {
  id: string
  first_name: string
  last_name: string
  email: string
}

export function getBroadcastRecipients(practitionerId: string, activeSinceDate?: string | null): BroadcastPatient[] {
  const db = getDatabase()

  if (activeSinceDate) {
    // Only patients seen since the given date — excludes patients who came
    // once a long time ago and never returned, so the diffusion doesn't
    // reach out to essentially former patients.
    return db
      .prepare(
        `SELECT p.id, p.first_name, p.last_name, p.email
         FROM patients p
         INNER JOIN consultations c ON c.patient_id = p.id AND c.archived_at IS NULL
         WHERE p.practitioner_id = ?
           AND p.archived_at IS NULL
           AND p.email IS NOT NULL AND p.email != ''
         GROUP BY p.id
         HAVING MAX(c.date_time) >= ?`
      )
      .all(practitionerId, activeSinceDate) as BroadcastPatient[]
  }

  return db
    .prepare(
      `SELECT id, first_name, last_name, email
       FROM patients
       WHERE practitioner_id = ? AND archived_at IS NULL AND email IS NOT NULL AND email != ''`
    )
    .all(practitionerId) as BroadcastPatient[]
}
