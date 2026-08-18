/**
 * Vérifie que chaque requête d'export s'exécute réellement contre le schéma de
 * l'application. Le catalogue d'export cite des colonnes SQL à la main : sans
 * ce test, une colonne renommée ou mal orthographiée ne se verrait qu'au
 * moment où un praticien clique sur « Exporter ».
 */

import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { SCHEMA_SQL, runMigrations } from '@/lib/database/schema'
import { EXPORT_DATASETS } from '@/lib/export/datasets'
import { buildExportQuery, formatExportRows, ExportError } from '@/lib/export/query'

const CABINET_ID = 'cabinet-1'

let db: Database.Database

beforeAll(() => {
  db = new Database(':memory:')
  db.exec(SCHEMA_SQL)
  runMigrations(db)
})

describe('buildExportQuery', () => {
  it('exécute chaque jeu de données avec toutes ses colonnes', () => {
    for (const dataset of EXPORT_DATASETS) {
      const query = buildExportQuery(
        {
          dataset: dataset.key,
          fields: dataset.fields.map((field) => field.key),
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
        [CABINET_ID],
      )

      expect(() => db.prepare(query.sql).all(...(query.params as string[])), dataset.key).not.toThrow()
    }
  })

  it('exécute chaque jeu de données sans filtre de période ni exclusion des archivés', () => {
    for (const dataset of EXPORT_DATASETS) {
      const query = buildExportQuery(
        {
          dataset: dataset.key,
          fields: dataset.fields.map((field) => field.key),
          includeArchived: true,
        },
        [CABINET_ID, 'cabinet-2'],
      )

      expect(() => db.prepare(query.sql).all(...(query.params as string[])), dataset.key).not.toThrow()
    }
  })

  it('ignore les colonnes inconnues et conserve l\'ordre du catalogue', () => {
    const query = buildExportQuery(
      { dataset: 'patients', fields: ['email', 'last_name', 'colonne_inexistante'] },
      [CABINET_ID],
    )

    expect(query.fields.map((field) => field.key)).toEqual(['last_name', 'email'])
    expect(query.sql).not.toContain('colonne_inexistante')
  })

  it('lie la période et le périmètre cabinet par paramètres', () => {
    const query = buildExportQuery(
      {
        dataset: 'consultations',
        fields: ['date_time'],
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
      [CABINET_ID],
    )

    expect(query.params).toEqual([CABINET_ID, '2026-01-01', '2026-01-31'])
    expect(query.sql).not.toContain('2026-01-01')
  })

  it('refuse un jeu de données inconnu, une sélection vide ou un périmètre vide', () => {
    expect(() => buildExportQuery({ dataset: 'inconnu', fields: ['x'] }, [CABINET_ID])).toThrow(ExportError)
    expect(() => buildExportQuery({ dataset: 'patients', fields: [] }, [CABINET_ID])).toThrow(ExportError)
    expect(() => buildExportQuery({ dataset: 'patients', fields: ['last_name'] }, [])).toThrow(ExportError)
  })
})

describe('export bout en bout sur des données réelles', () => {
  beforeAll(() => {
    db.exec(`
      INSERT INTO practitioners (id, user_id, email, first_name, last_name, address, city, postal_code)
        VALUES ('${CABINET_ID}', 'user-1', 'praticien@example.com', 'Claire', 'Bernard', '1 rue A', 'Lyon', '69000');
      INSERT INTO patients (id, practitioner_id, gender, first_name, last_name, birth_date, phone, email, medical_history)
        VALUES ('pat-1', '${CABINET_ID}', 'F', 'Léa', 'Martin; Dubois', '1985-03-15', '0600000000', 'lea@example.com', 'Asthme');
      INSERT INTO patients (id, practitioner_id, gender, first_name, last_name, birth_date, phone, archived_at)
        VALUES ('pat-2', '${CABINET_ID}', 'M', 'Paul', 'Archivé', '1970-01-02', '0611111111', '2026-02-01T10:00');
      INSERT INTO practitioners (id, user_id, email, first_name, last_name)
        VALUES ('cabinet-2', 'user-2', 'autre@example.com', 'Marc', 'Roux');
      INSERT INTO patients (id, practitioner_id, gender, first_name, last_name, birth_date, phone)
        VALUES ('pat-3', 'cabinet-2', 'M', 'Autre', 'Cabinet', '1990-01-01', '0622222222');
      INSERT INTO consultations (id, patient_id, cabinet_id, date_time, reason)
        VALUES ('cons-1', 'pat-1', '${CABINET_ID}', '2026-03-15T09:30', 'Lombalgie');
      INSERT INTO invoices (id, consultation_id, cabinet_id, invoice_number, amount, status, issued_at)
        VALUES ('inv-1', 'cons-1', '${CABINET_ID}', 'F2026-001', 60, 'paid', '2026-03-15');
      INSERT INTO payments (id, invoice_id, amount, method, payment_date)
        VALUES ('pay-1', 'inv-1', 60, 'card', '2026-03-16');
    `)
  })

  const run = (selection: Parameters<typeof buildExportQuery>[0]) => {
    const query = buildExportQuery(selection, [CABINET_ID])
    const rows = db.prepare(query.sql).all(...(query.params as string[])) as Array<Record<string, unknown>>
    return { fields: query.fields, rows: formatExportRows(rows, query.fields) }
  }

  it('exporte le patient avec ses colonnes formatées', () => {
    const { fields, rows } = run({
      dataset: 'patients',
      fields: ['last_name', 'first_name', 'birth_date', 'consultation_count', 'last_consultation'],
    })

    expect(fields.map((f) => f.label)).toEqual([
      'Nom',
      'Prénom',
      'Date de naissance',
      'Nombre de consultations',
      'Dernière consultation',
    ])
    expect(rows).toEqual([['Martin; Dubois', 'Léa', '15/03/1985', '1', '15/03/2026']])
  })

  it('exclut les patients archivés sauf demande explicite', () => {
    expect(run({ dataset: 'patients', fields: ['last_name'] }).rows).toEqual([['Martin; Dubois']])
    expect(
      run({ dataset: 'patients', fields: ['last_name'], includeArchived: true }).rows,
    ).toEqual([['Archivé'], ['Martin; Dubois']])
  })

  it('n\'exporte pas les patients d\'un autre cabinet', () => {
    const noms = run({ dataset: 'patients', fields: ['last_name'], includeArchived: true }).rows.flat()
    expect(noms).not.toContain('Cabinet')
  })

  it('respecte le filtre de période', () => {
    expect(
      run({
        dataset: 'consultations',
        fields: ['date_time'],
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      }).rows,
    ).toEqual([['15/03/2026 09:30']])

    expect(
      run({
        dataset: 'consultations',
        fields: ['date_time'],
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      }).rows,
    ).toEqual([])
  })

  it('traduit les libellés et calcule le reste à encaisser', () => {
    expect(
      run({ dataset: 'invoices', fields: ['invoice_number', 'status', 'amount', 'paid_amount', 'balance'] }).rows,
    ).toEqual([['F2026-001', '60,00', 'Payée', '60,00', '0,00']])

    expect(run({ dataset: 'payments', fields: ['payment_date', 'method', 'amount'] }).rows).toEqual([
      ['16/03/2026', '60,00', 'Carte bancaire'],
    ])
  })
})
