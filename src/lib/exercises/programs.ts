import type { ExercisePrescription, ExercisePrescriptionItem } from '@/types/exercise'
import { computeUsage, type Usage, type UsageReport } from './usage'
import { sessionsPerWeek } from './patient-link-codec'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface ProgramRow {
  id: string
  patient_id: string
  title: string
  status: 'active' | 'ended'
  start_date: string
  ended_at: string | null
  link_sent_at: string | null
  link_channel: string | null
  content_updated_at: string
  created_at: string
}

export interface ProgramReport extends UsageReport {
  id: string
  source: string
  kind: 'full' | 'short'
}

export interface ProgramView extends ProgramRow {
  phases: ExercisePrescription[]
  changes: Array<{ id: string; note: string; created_at: string }>
  reports: ProgramReport[]
  usage: Usage
  /** le programme a changé depuis le dernier envoi du lien */
  link_out_of_date: boolean
  /** index de l'étape en cours */
  current_phase: number
}

/** Dates SQLite (« 2026-10-13 09:00:00 », UTC) ou ISO : comparées en millisecondes. */
export function toTime(value: string): number {
  return Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
}

export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Programmes complets (étapes, exercices, bilans, journal, indicateur). */
export async function loadPrograms(db: Db, filter: { patientId?: string; programId?: string }): Promise<ProgramView[]> {
  let q = db.from('exercise_programs').select('*')
  if (filter.programId) q = q.eq('id', filter.programId)
  if (filter.patientId) q = q.eq('patient_id', filter.patientId)
  const { data: programs } = await q.order('created_at', { ascending: false })
  if (!programs?.length) return []
  const ids = programs.map((p: ProgramRow) => p.id)

  const [{ data: phases }, { data: changes }, { data: reports }] = await Promise.all([
    db.from('exercise_prescriptions').select('*').in('program_id', ids).order('starts_after_days', { ascending: true }),
    db.from('exercise_program_changes').select('*').in('program_id', ids).order('created_at', { ascending: false }),
    db.from('exercise_adherence_reports').select('*').in('program_id', ids).order('created_at', { ascending: false }),
  ])
  const phaseIds = (phases || []).map((p: ExercisePrescription) => p.id)
  const { data: items } = phaseIds.length
    ? await db.from('exercise_prescription_items').select('*').in('prescription_id', phaseIds).order('position', { ascending: true })
    : { data: [] }

  const today = localToday()
  return programs.map((p: ProgramRow) => {
    const own = (phases || [])
      .filter((ph: ExercisePrescription & { program_id: string }) => ph.program_id === p.id)
      .map((ph: ExercisePrescription) => ({ ...ph, items: (items || []).filter((it: ExercisePrescriptionItem) => it.prescription_id === ph.id) }))
    const progReports: ProgramReport[] = (reports || [])
      .filter((r: { program_id: string }) => r.program_id === p.id)
      .map((r: { id: string; source: string; kind: 'full' | 'short'; payload: string; created_at: string }) => {
        try {
          const payload = JSON.parse(r.payload)
          return { id: r.id, source: r.source, kind: r.kind, created_at: r.created_at, weeks: payload.weeks ?? [], report: payload.report }
        } catch {
          return { id: r.id, source: r.source, kind: r.kind, created_at: r.created_at, weeks: [] }
        }
      })
    const elapsed = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${p.start_date}T12:00:00`)) / 864e5)
    let current = 0
    own.forEach((ph: ExercisePrescription & { starts_after_days?: number }, k: number) => { if ((ph.starts_after_days ?? 0) <= elapsed) current = k })
    const cur = own[current] as (ExercisePrescription & { items: ExercisePrescriptionItem[] }) | undefined
    const target = cur ? sessionsPerWeek(cur.weekly_routine, cur.items.map(i => i.frequency)) : 3
    return {
      ...p,
      phases: own,
      changes: (changes || []).filter((c: { program_id: string }) => c.program_id === p.id),
      reports: progReports,
      usage: computeUsage(p, progReports[0] ?? null, today, target),
      link_out_of_date: !!p.link_sent_at && toTime(p.content_updated_at) > toTime(p.link_sent_at),
      current_phase: current,
    }
  })
}

/** Note le changement dans le journal et date la nouvelle version du programme. */
export async function logProgramChange(db: Db, programId: string, note: string) {
  await db.from('exercise_program_changes').insert({ program_id: programId, note })
  await db.from('exercise_programs').update({ content_updated_at: new Date().toISOString() }).eq('id', programId)
}

export { describeItemChanges } from './program-diff'

/** Libellé d'une étape : « Étape 2 (dès la semaine 3) ». */
export function phaseLabel(index: number, startsAfterDays: number): string {
  return startsAfterDays > 0 ? `Étape ${index + 1} (dès la semaine ${Math.floor(startsAfterDays / 7) + 1})` : `Étape ${index + 1}`
}

/** Marque l'envoi du lien au patient. */
export async function markLinkSent(db: Db, programId: string, channel: 'email' | 'copie' | 'papier') {
  await db.from('exercise_programs').update({ link_sent_at: new Date().toISOString(), link_channel: channel }).eq('id', programId)
}

/** Lien patient du programme auquel appartient une fiche. */
export async function patientLinkForPrescription(
  db: Db,
  prescription: { id: string; program_id?: string | null },
  practitionerLabel: string,
): Promise<{ url: string; programId: string } | null> {
  const { buildPatientLink } = await import('./patient-link')
  const [program] = await loadPrograms(db, { programId: prescription.program_id ?? prescription.id })
  if (!program) return null
  return { url: await buildPatientLink(program, practitionerLabel), programId: program.id }
}
