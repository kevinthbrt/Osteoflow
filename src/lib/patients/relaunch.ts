/**
 * "Patients non vus depuis longtemps" — computes who should be relaunched.
 *
 * A patient is "awaiting return" (already relaunched) when their last relaunch
 * email is more recent than their last consultation — no separate flag to
 * reset: a new consultation after the relaunch date naturally drops them out
 * of that state and, if recent enough, out of the "not seen" list too.
 */

import { getDatabase } from '@/lib/database/connection'

export interface RelaunchCandidate {
  id: string
  first_name: string
  last_name: string
  email: string
  lastConsultationDate: string | null
  daysSinceLastConsultation: number | null
}

export interface RelaunchedPatient {
  id: string
  first_name: string
  last_name: string
  email: string
  lastConsultationDate: string | null
  lastRelaunchSentAt: string
  relaunchCount: number
  daysSinceRelaunch: number
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000)
}

/**
 * Patients not seen since `months` months ago, who aren't currently
 * "awaiting return" from a previous relaunch, ordered by longest absence first.
 *
 * `sinceDate` (optional) is a floor on the last consultation date — useful
 * after a change of practice/cabinet, so patients whose last visit predates
 * the move aren't nudged to come back to a location that's no longer valid.
 * A patient who visited both before and after the move is still included,
 * since their most recent visit is what's compared against the floor.
 */
export function getRelaunchCandidates(
  practitionerId: string,
  months: number,
  sinceDate?: string | null
): RelaunchCandidate[] {
  const db = getDatabase()
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffIso = cutoff.toISOString()
  const nowIso = new Date().toISOString()

  const rows = db
    .prepare(
      `SELECT p.id, p.first_name, p.last_name, p.email,
              MAX(c.date_time) AS last_consultation_date
       FROM patients p
       INNER JOIN consultations c ON c.patient_id = p.id AND c.archived_at IS NULL
       WHERE p.practitioner_id = ?
         AND p.archived_at IS NULL
         AND p.email IS NOT NULL AND p.email != ''
       GROUP BY p.id
       HAVING MAX(c.date_time) <= ?
          AND (p.last_relaunch_sent_at IS NULL OR p.last_relaunch_sent_at <= MAX(c.date_time))
          AND (? IS NULL OR MAX(c.date_time) >= ?)
       ORDER BY last_consultation_date ASC`
    )
    .all(practitionerId, cutoffIso, sinceDate || null, sinceDate || null) as Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    last_consultation_date: string
  }>

  return rows.map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    lastConsultationDate: r.last_consultation_date,
    daysSinceLastConsultation: daysBetween(r.last_consultation_date, nowIso),
  }))
}

/**
 * Patients currently "awaiting return": relaunched more recently than their
 * last consultation (or never seen since), and not yet returned.
 */
export function getRelaunchedPatients(practitionerId: string, sinceDate?: string | null): RelaunchedPatient[] {
  const db = getDatabase()
  const nowIso = new Date().toISOString()

  const rows = db
    .prepare(
      `SELECT p.id, p.first_name, p.last_name, p.email, p.last_relaunch_sent_at, p.relaunch_count,
              (SELECT MAX(c.date_time) FROM consultations c WHERE c.patient_id = p.id AND c.archived_at IS NULL) AS last_consultation_date
       FROM patients p
       WHERE p.practitioner_id = ?
         AND p.archived_at IS NULL
         AND p.last_relaunch_sent_at IS NOT NULL
         AND (
           (SELECT MAX(c.date_time) FROM consultations c WHERE c.patient_id = p.id AND c.archived_at IS NULL) IS NULL
           OR p.last_relaunch_sent_at > (SELECT MAX(c.date_time) FROM consultations c WHERE c.patient_id = p.id AND c.archived_at IS NULL)
         )
         AND (
           ? IS NULL
           OR (SELECT MAX(c.date_time) FROM consultations c WHERE c.patient_id = p.id AND c.archived_at IS NULL) IS NULL
           OR (SELECT MAX(c.date_time) FROM consultations c WHERE c.patient_id = p.id AND c.archived_at IS NULL) >= ?
         )
       ORDER BY p.last_relaunch_sent_at DESC`
    )
    .all(practitionerId, sinceDate || null, sinceDate || null) as Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    last_relaunch_sent_at: string
    relaunch_count: number
    last_consultation_date: string | null
  }>

  return rows.map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    lastConsultationDate: r.last_consultation_date,
    lastRelaunchSentAt: r.last_relaunch_sent_at,
    relaunchCount: r.relaunch_count || 0,
    daysSinceRelaunch: daysBetween(r.last_relaunch_sent_at, nowIso),
  }))
}
