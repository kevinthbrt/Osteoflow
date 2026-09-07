/**
 * Les bases déjà installées ne rejouent pas SCHEMA_SQL : la table des canaux
 * d'acquisition personnalisés doit leur être ajoutée par `runMigrations`.
 * Sans ce test, une base existante afficherait un formulaire patient en échec
 * dès la première lecture de `referral_sources`.
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { SCHEMA_SQL, runMigrations } from '@/lib/database/schema'

const hasTable = (db: Database.Database) =>
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'referral_sources'").all()

describe('migration referral_sources', () => {
  it('ajoute la table à une base antérieure, sans effet la seconde fois', () => {
    // Base « ancienne » : le schéma d'installation privé de la nouvelle table.
    const legacySchema = SCHEMA_SQL.replace(/-- Referral sources[\s\S]*?(?=-- Session types)/, '')
    const db = new Database(':memory:')
    db.exec(legacySchema)
    expect(hasTable(db)).toHaveLength(0)

    runMigrations(db)
    expect(hasTable(db)).toHaveLength(1)

    runMigrations(db)
    expect(hasTable(db)).toHaveLength(1)
  })

  it('accepte une catégorie rattachée à un praticien', () => {
    const db = new Database(':memory:')
    db.exec(SCHEMA_SQL)
    runMigrations(db)

    db.prepare("INSERT INTO practitioners (user_id, first_name, last_name, email) VALUES ('u1', 'Kevin', 'T', 'k@t.fr')").run()
    const { id } = db.prepare('SELECT id FROM practitioners').get() as { id: string }
    db.prepare('INSERT INTO referral_sources (practitioner_id, name) VALUES (?, ?)').run(id, 'Salle de sport')

    const rows = db.prepare('SELECT name, is_active FROM referral_sources').all()
    expect(rows).toEqual([{ name: 'Salle de sport', is_active: 1 }])
  })
})
