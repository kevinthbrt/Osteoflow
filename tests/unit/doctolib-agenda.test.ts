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
const planCabinets = () =>
  (db.prepare('SELECT DISTINCT practitioner_id FROM daily_plan_items').all() as Array<{ practitioner_id: string }>).map((row) => row.practitioner_id)

beforeEach(() => {
  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE practitioners (id TEXT PRIMARY KEY, user_id TEXT, owner_id TEXT);
    INSERT INTO practitioners VALUES ('dr', 'u1', 'o1'), ('dr2', 'u2', 'o1');
    INSERT INTO app_config VALUES ('current_user_id', 'u1');
    CREATE TABLE patients (id TEXT PRIMARY KEY, practitioner_id TEXT, first_name TEXT, last_name TEXT, birth_date TEXT, archived_at TEXT);
    CREATE TABLE daily_plan_items (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      practitioner_id TEXT NOT NULL, patient_id TEXT NOT NULL, plan_date TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO patients VALUES ('p-lea', 'dr', 'Léa', 'BERNARD', '1990-04-12', NULL);
    INSERT INTO patients VALUES ('p-marc', 'dr', 'Marc', 'PETIT', '1978-09-02', NULL);
    INSERT INTO patients VALUES ('p-old', 'dr', 'Ancien', 'ARCHIVE', '1950-01-01', '2025-01-01');
    INSERT INTO patients VALUES ('p-autre', 'dr2', 'Chloé', 'DAVID', '1985-05-05', NULL);
    CREATE TABLE consultations (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))), patient_id TEXT, date_time TEXT);
    INSERT INTO patients VALUES ('p-ines', 'dr', 'Inès', 'FABRE', '1991-03-14', NULL);
    INSERT INTO patients VALUES ('p-tom', 'dr', 'Tom', 'ROUX', '2001-07-07', NULL);
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

  it('cabinets cloisonnés : jamais le dossier d’un autre cabinet, et Ma journée du cabinet actif', () => {
    const summary = syncAgenda({
      start: TODAY,
      end: TODAY,
      appointments: [appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12'), appt('a2', TODAY, 'Chloé', 'David', '1985-05-05')],
    })
    expect(summary.added).toBe(1)
    expect(plan(TODAY).map((row) => row.patient_id)).toEqual(['p-lea'])
    expect(planCabinets()).toEqual(['dr'])
    const chloe = readAgendaRange(TODAY, TODAY).days[TODAY].find((entry) => entry.doctolibId === 'a2')
    expect(chloe?.patientId).toBeNull()
  })

  it('patients partagés entre cabinets : le dossier est reconnu, ajouté au cabinet actif', () => {
    db.prepare("INSERT INTO app_config VALUES ('cabinet_shared_categories', '[\"patients\"]')").run()
    syncAgenda({ start: TODAY, end: TODAY, appointments: [appt('a2', TODAY, 'Chloé', 'David', '1985-05-05')] })
    expect(plan(TODAY).map((row) => row.patient_id)).toEqual(['p-autre'])
    expect(planCabinets()).toEqual(['dr'])
  })

  it('sans cabinet actif (session verrouillée), rien n’est ajouté automatiquement', () => {
    db.prepare("DELETE FROM app_config WHERE key = 'current_user_id'").run()
    const summary = syncAgenda({ start: TODAY, end: TODAY, appointments: [appt('a1', TODAY, 'Léa', 'Bernard', '1990-04-12')] })
    expect(summary.added).toBe(0)
    expect(summary.toReview).toBe(1)
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

describe('ordre de Ma journée', () => {
  const at = (id: string, date: string, time: string, first: string, last: string, birth: string | null) =>
    appt(id, date, first, last, birth, { start_date: `${date}T${time}:00.000+01:00`, end_date: `${date}T${time}:00.000+01:00` })
  const ids = (date: string) => plan(date).map((row) => row.patient_id)

  it('ajoute les patients dans l’ordre des heures, même si Doctolib les envoie dans le désordre', () => {
    syncAgenda({
      start: TODAY,
      end: TODAY,
      appointments: [
        at('a1', TODAY, '16:00', 'Tom', 'Roux', '2001-07-07'),
        at('a2', TODAY, '09:00', 'Léa', 'Bernard', '1990-04-12'),
        at('a3', TODAY, '11:30', 'Inès', 'Fabre', '1991-03-14'),
      ],
    })
    expect(ids(TODAY)).toEqual(['p-lea', 'p-ines', 'p-tom'])
  })

  it('range un rendez-vous ajouté plus tard à sa place, pas en fin de liste', () => {
    const morning = at('a1', TODAY, '09:00', 'Léa', 'Bernard', '1990-04-12')
    const evening = at('a3', TODAY, '17:00', 'Tom', 'Roux', '2001-07-07')
    syncAgenda({ start: TODAY, end: TODAY, appointments: [morning, evening] })
    syncAgenda({ start: TODAY, end: TODAY, appointments: [morning, evening, at('a2', TODAY, '14:00', 'Inès', 'Fabre', '1991-03-14')] })
    expect(ids(TODAY)).toEqual(['p-lea', 'p-ines', 'p-tom'])
  })

  it('range un patient validé depuis Ma journée, et laisse en place un patient ajouté à la main', () => {
    syncAgenda({
      start: TODAY,
      end: TODAY,
      appointments: [at('a1', TODAY, '10:00', 'Léa', 'Bernard', '1990-04-12'), at('a2', TODAY, '08:30', 'Marc', 'Petit', null)],
    })
    // Patient sans rendez-vous, ajouté à la main en tête de journée
    db.prepare("UPDATE daily_plan_items SET position = position + 1").run()
    db.prepare("INSERT INTO daily_plan_items (practitioner_id, patient_id, plan_date, position) VALUES ('dr', 'p-autre', ?, 0)").run(TODAY)
    // Marc (probable) validé : la fenêtre l'ajoute en fin de liste, puis le signale
    db.prepare("INSERT INTO daily_plan_items (practitioner_id, patient_id, plan_date, position) VALUES ('dr', 'p-marc', ?, 9)").run(TODAY)
    markHandled([{ doctolibId: 'a2', date: TODAY, patientId: 'p-marc' }])
    expect(ids(TODAY)).toEqual(['p-autre', 'p-marc', 'p-lea'])
  })

  it('ne défait pas un ordre changé à la main quand rien n’est ajouté', () => {
    const appointments = [at('a1', TODAY, '09:00', 'Léa', 'Bernard', '1990-04-12'), at('a2', TODAY, '11:00', 'Inès', 'Fabre', '1991-03-14')]
    syncAgenda({ start: TODAY, end: TODAY, appointments })
    db.prepare("UPDATE daily_plan_items SET position = CASE patient_id WHEN 'p-lea' THEN 1 ELSE 0 END").run()
    syncAgenda({ start: TODAY, end: TODAY, appointments })
    expect(ids(TODAY)).toEqual(['p-ines', 'p-lea'])
  })

  it('rend l’agenda dans l’ordre des heures', () => {
    syncAgenda({
      start: TODAY,
      end: TODAY,
      appointments: [at('a1', TODAY, '15:00', 'Nina', 'Garcia', null), at('a2', TODAY, '08:00', 'Zoé', 'Martin', null)],
    })
    expect(readAgendaRange(TODAY, TODAY).days[TODAY].map((entry) => entry.lastName.toUpperCase())).toEqual(['MARTIN', 'GARCIA'])
  })
  it('remet une fois dans l’ordre une journée remplie dans le désordre par une version précédente', () => {
    const appointments = [at('a1', TODAY, '09:00', 'Léa', 'Bernard', '1990-04-12'), at('a2', TODAY, '11:00', 'Inès', 'Fabre', '1991-03-14')]
    syncAgenda({ start: TODAY, end: TODAY, appointments })
    // Simule l'état d'avant la correction : ordre inversé, et rattrapage jamais fait
    db.prepare("UPDATE daily_plan_items SET position = CASE patient_id WHEN 'p-lea' THEN 1 ELSE 0 END").run()
    db.prepare("DELETE FROM app_config WHERE key = 'doctolib_plan_ordered'").run()
    syncAgenda({ start: TODAY, end: TODAY, appointments })
    expect(ids(TODAY)).toEqual(['p-lea', 'p-ines'])
  })
  it('signale le premier rendez-vous, même une fois le dossier créé', () => {
    db.prepare("INSERT INTO consultations (patient_id, date_time) VALUES ('p-lea', '2025-01-10T10:00:00.000Z')").run()
    syncAgenda({
      start: TODAY,
      end: TOMORROW,
      appointments: [
        at('a1', TODAY, '09:00', 'Léa', 'Bernard', '1990-04-12'), // déjà vue
        at('a2', TODAY, '10:00', 'Inès', 'Fabre', '1991-03-14'), // dossier créé, jamais vue
        at('a3', TODAY, '11:00', 'Nina', 'Garcia', '1988-02-02'), // pas encore de dossier
        at('a4', TOMORROW, '09:00', 'Tom', 'Roux', '2001-07-07'),
      ],
    })
    // Tom est vu aujourd'hui : demain, ce n'est plus sa première fois
    db.prepare(`INSERT INTO consultations (patient_id, date_time) VALUES ('p-tom', '${TODAY}T08:00:00.000+01:00')`).run()
    const range = readAgendaRange(TODAY, TOMORROW).days
    const first = (date: string) => Object.fromEntries(range[date].map((entry) => [entry.lastName, entry.firstVisit]))
    expect(first(TODAY)).toEqual({ Bernard: false, Fabre: true, Garcia: true })
    expect(first(TOMORROW)).toEqual({ Roux: false })
  })
})
