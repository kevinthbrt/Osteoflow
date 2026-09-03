import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { SCHEMA_SQL, runMigrations } from '@/lib/database/schema'

function columns(db: any, table: string): string[] {
  return (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((c) => c.name)
}

describe('migration anamnesis_summary', () => {
  it('existe sur une base neuve, créée depuis SCHEMA_SQL', () => {
    const db = new Database(':memory:')
    db.exec(SCHEMA_SQL)
    expect(columns(db, 'consultations')).toContain('anamnesis_summary')
    db.close()
  })

  it('est ajoutée à une base existante, et rejouable sans erreur', () => {
    const db = new Database(':memory:')
    db.exec(SCHEMA_SQL)
    // On simule une base antérieure à la colonne.
    db.exec('ALTER TABLE consultations DROP COLUMN anamnesis_summary;')
    expect(columns(db, 'consultations')).not.toContain('anamnesis_summary')

    runMigrations(db as any)
    expect(columns(db, 'consultations')).toContain('anamnesis_summary')

    // Idempotence : la migration est rejouée à chaque démarrage.
    runMigrations(db as any)
    expect(columns(db, 'consultations').filter((c) => c === 'anamnesis_summary')).toHaveLength(1)
    db.close()
  })

  it('conserve les anamnèses déjà enregistrées et accepte la nouvelle colonne', () => {
    const db = new Database(':memory:')
    db.exec(SCHEMA_SQL)
    db.exec('ALTER TABLE consultations DROP COLUMN anamnesis_summary;')
    db.prepare("INSERT INTO practitioners (id, user_id, first_name, last_name, email) VALUES ('p1','u1','A','B','a@b.c')").run()
    db.prepare("INSERT INTO patients (id, practitioner_id, first_name, last_name, gender, birth_date, phone) VALUES ('pa1','p1','C','D','F','1980-06-12','0600000000')").run()
    db.prepare("INSERT INTO consultations (id, patient_id, reason, anamnesis_sections) VALUES ('c1','pa1','Lombalgie', ?)")
      .run(JSON.stringify([{ id: 'pain', label: 'Douleur', icon: '📍', items: ['Intensité : EVA 7/10'] }]))

    runMigrations(db as any)

    const row = db.prepare('SELECT anamnesis_sections, anamnesis_summary FROM consultations WHERE id = ?').get('c1') as any
    // La consultation antérieure garde ses cartes et n'a pas de synthèse : c'est
    // exactement le cas que le bandeau doit savoir afficher (pastilles seules).
    expect(JSON.parse(row.anamnesis_sections)[0].items[0]).toBe('Intensité : EVA 7/10')
    expect(row.anamnesis_summary).toBeNull()

    db.prepare('UPDATE consultations SET anamnesis_summary = ? WHERE id = ?').run('Lombalgie, EVA 7/10.', 'c1')
    expect((db.prepare('SELECT anamnesis_summary FROM consultations WHERE id = ?').get('c1') as any).anamnesis_summary)
      .toBe('Lombalgie, EVA 7/10.')
    db.close()
  })
})
