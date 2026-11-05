import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'

// Base en mémoire à la place de la base du poste
let db: Database.Database
vi.mock('@/lib/database/connection', () => ({ getDatabase: () => db }))

import { syncAgenda, markHandled, readAgendaRange, setAutoAdd } from '@/lib/doctolib/agenda'

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const TODAY = day(0)
const TOMORROW = day(1)
const IN2 = day(2)

// Patients et rendez-vous entièrement fictifs
const appt = (id: string, date: string, first: string, last: string, birth: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'appt',
  status: 'confirmed',
  start_date: `${date}T09:00:00.000+01:00`,
  end_date: `${date}T09:40:00.000+01:00`,
  patient: { first_name: first, last_name: last, birthdate: birth, biological_sex: 'female', phone_number: '0600000000' },
  ...extra,
})

const plan = (date: string) =>
  (db.prepare('SELECT patient_id, status FROM daily_plan_items WHERE plan_date = ? ORDER BY position').all(date) as Array<{ patient_id: string; status: string }>)

beforeEach(() => {
  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE patients (id TEXT PRIMARY KEY, practitioner_id TEXT, first_name TEXT, last_name TEXT, birth_date TEXT, archived_at TEXT);
    CREATE TABLE daily_plan_items (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      practitioner_id TEXT NOT NULL, patient_id TEXT NOT NULL, plan_date TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending'
    );
    INSERT INTO patients VALUES ('p-lea', 'dr', 'Léa', 'BERNARD', '1990-04-12', NULL);
    INSERT INTO patients VALUES ('p-marc', 'dr', 'Marc', 'PETIT', '1978-09-02', NULL);
    INSERT INTO patients VALUES ('p-old', 'dr', 'Ancien', 'ARCHIVE', '1950-01-01', '2025-01-01');
  `)
})

describe('syncAgenda', () => {
  it('ajoute à Ma journée les patients reconnus avec certitude, et seulement eux', () => {
    const summary = syncAgenda({
      start: TODAY,
      end: TOMORROW,
      appointments: [
        appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12'),
        appt('a2', TODAY, 'Marc', 'Petit', null), // probable : à vérifier
        appt('a3', TOMORROW, 'Nina', 'Garcia', '1988-02-02'), // inconnue : à vérifier
      ],
    })
    expect(summary.added).toBe(1)
    expect(summary.toReview).toBe(2)
    expect(summary.newToReview).toBe(2)
    expect(summary.firstReviewDate).toBe(TODAY)
    expect(plan(TODAY).map((row) => row.patient_id)).toEqual(['p-lea'])
    expect(plan(TOMORROW)).toEqual([])
  })

  it('ne rajoute pas un patient déjà présent, et n’annonce pas deux fois les mêmes rendez-vous à vérifier', () => {
    const appointments = [appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12'), appt('a2', TODAY, 'Nina', 'Garcia', null)]
    syncAgenda({ start: TODAY, end: TODAY, appointments })
    const second = syncAgenda({ start: TODAY, end: TODAY, appointments })
    expect(second.added).toBe(0)
    expect(second.newToReview).toBe(0)
    expect(second.toReview).toBe(1)
    expect(plan(TODAY)).toHaveLength(1)
  })

  it('retire le patient ajouté si le rendez-vous est annulé, tant qu’il n’a pas été vu', () => {
    syncAgenda({ start: TODAY, end: TOMORROW, appointments: [appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12'), appt('a2', TOMORROW, 'Marc', 'Petit', '1978-09-02')] })
    db.prepare("UPDATE daily_plan_items SET status = 'done' WHERE patient_id = 'p-lea'").run()
    const summary = syncAgenda({
      start: TODAY,
      end: TOMORROW,
      appointments: [
        appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12', { status: 'deleted' }),
        appt('a2', TOMORROW, 'Marc', 'Petit', '1978-09-02', { status: 'cancelled' }),
      ],
    })
    expect(summary.removed).toBe(1)
    expect(plan(TODAY)).toEqual([{ patient_id: 'p-lea', status: 'done' }]) // déjà vue : on garde
    expect(plan(TOMORROW)).toEqual([])
  })

  it('suit un rendez-vous déplacé à un autre jour', () => {
    syncAgenda({ start: TODAY, end: IN2, appointments: [appt('a1', TOMORROW, 'Léa', 'Bernard', '1990-04-12')] })
    syncAgenda({ start: TODAY, end: IN2, appointments: [appt('a1', IN2, 'Léa', 'Bernard', '1990-04-12')] })
    expect(plan(TOMORROW)).toEqual([])
    expect(plan(IN2).map((row) => row.patient_id)).toEqual(['p-lea'])
  })

  it('ne touche pas aux jours non envoyés (envoi d’un seul jour)', () => {
    syncAgenda({ start: TODAY, end: TOMORROW, appointments: [appt('a1', TOMORROW, 'Léa', 'Bernard', '1990-04-12')] })
    syncAgenda({ start: TODAY, end: TODAY, appointments: [] })
    expect(plan(TOMORROW)).toHaveLength(1)
    expect(readAgendaRange(TOMORROW, TOMORROW).days[TOMORROW]).toHaveLength(1)
  })

  it('ne réajoute pas un patient retiré à la main de la journée', () => {
    const appointments = [appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12')]
    syncAgenda({ start: TODAY, end: TODAY, appointments })
    db.prepare('DELETE FROM daily_plan_items').run()
    const summary = syncAgenda({ start: TODAY, end: TODAY, appointments })
    expect(summary.added).toBe(0)
    expect(summary.toReview).toBe(0)
    expect(plan(TODAY)).toEqual([])
  })

  it('n’ajoute rien quand l’option est coupée, et ignore les dossiers archivés', () => {
    setAutoAdd(false)
    const summary = syncAgenda({
      start: TODAY,
      end: TODAY,
      appointments: [appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12'), appt('a2', TODAY, 'Ancien', 'Archive', '1950-01-01')],
    })
    expect(summary.added).toBe(0)
    expect(summary.toReview).toBe(2)
    expect(plan(TODAY)).toEqual([])
  })

  it('les rendez-vous ignorés ou ajoutés depuis Ma journée ne sont plus proposés', () => {
    setAutoAdd(false)
    const appointments = [appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12'), appt('a2', TODAY, 'Nina', 'Garcia', null)]
    syncAgenda({ start: TODAY, end: TODAY, appointments })
    markHandled([{ doctolibId: 'a1', date: TODAY, patientId: 'p-lea' }, { doctolibId: 'a2', date: TODAY, ignored: true }])
    expect(syncAgenda({ start: TODAY, end: TODAY, appointments }).toReview).toBe(0)
    const days = readAgendaRange(TODAY, TODAY).days[TODAY]
    expect(days.find((entry) => entry.doctolibId === 'a2')?.ignored).toBe(true)
    expect(days.find((entry) => entry.doctolibId === 'a1')?.patientId).toBe('p-lea')
  })
})
