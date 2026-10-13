/**
 * Les fiches d'exercices existantes deviennent des programmes d'une étape, avec
 * le même identifiant : les liens patient et les bilans déjà émis pour une
 * fiche restent rattachés au bon programme.
 */
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { SCHEMA_SQL, runMigrations } from '@/lib/database/schema'
import { describeItemChanges } from '@/lib/exercises/programs'
import type { ExercisePrescriptionItem, ExercisePrescriptionItemDraft } from '@/types/exercise'

describe('migration des programmes d’exercices', () => {
  it('transforme chaque fiche en programme, une seule fois', () => {
    const db = new Database(':memory:')
    db.exec(SCHEMA_SQL)
    db.prepare(`INSERT INTO practitioners (id, user_id, first_name, last_name, email) VALUES ('pr', 'u', 'A', 'B', 'a@b.fr')`).run()
    db.prepare(`INSERT INTO patients (id, practitioner_id, gender, first_name, last_name, birth_date, phone) VALUES ('p1', 'pr', 'F', 'Marie', 'Dupont', '1980-01-01', '0600000000')`).run()
    db.prepare(`INSERT INTO exercise_prescriptions (id, patient_id, title, created_at) VALUES ('fiche-1', 'p1', 'Lombalgie', '2026-09-02 08:00:00')`).run()

    runMigrations(db)
    runMigrations(db)

    expect(db.prepare('SELECT id, patient_id, title, start_date, status FROM exercise_programs').all()).toEqual([
      { id: 'fiche-1', patient_id: 'p1', title: 'Lombalgie', start_date: '2026-09-02', status: 'active' },
    ])
    expect(db.prepare('SELECT program_id, starts_after_days FROM exercise_prescriptions').get()).toEqual({ program_id: 'fiche-1', starts_after_days: 0 })
  })
})

describe('journal des changements', () => {
  const item = (exercise_id: string, exercise_name: string, sets: number): ExercisePrescriptionItem => ({
    id: exercise_id, prescription_id: 'f', exercise_id, exercise_name, exercise_description: '', exercise_region: '', exercise_type: '',
    exercise_level: 1, illustration_url: null, nerve_target: null, progression_regression: null, sets, reps: '10', hold_time: null,
    rest_time: 60, frequency: '3 fois par semaine', notes: null, position: 0, created_at: '',
  })
  const draft = (id: string, name: string, sets: number) => ({
    exercise: { id, name }, sets, reps: '10', hold_time: null, rest_time: 60, frequency: '3 fois par semaine',
  }) as unknown as ExercisePrescriptionItemDraft

  it('résume ajouts, retraits et dosages', () => {
    const before = [item('a', 'Pont fessier', 3), item('b', 'Bird-dog', 3)]
    const after = [draft('a', 'Pont fessier', 4), draft('c', 'Nordic hamstring curl', 2)]
    expect(describeItemChanges(before, after)).toBe('ajouté : Nordic hamstring curl ; retiré : Bird-dog ; dosage modifié : Pont fessier')
    expect(describeItemChanges(before, [draft('a', 'Pont fessier', 3), draft('b', 'Bird-dog', 3)])).toBeNull()
  })
})
