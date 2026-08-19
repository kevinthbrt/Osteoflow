import { describe, it, expect } from 'vitest'
import {
  CSV_BOM,
  escapeCsvValue,
  toCsv,
  formatCsvDate,
  formatCsvDateTime,
  formatCsvNumber,
  formatCsvBoolean,
  buildCsvFileName,
} from '@/lib/export/csv'
import { EXPORT_DATASETS, getExportDataset, preselectedFieldKeys } from '@/lib/export/datasets'

describe('escapeCsvValue', () => {
  it('renvoie une cellule vide pour null et undefined', () => {
    expect(escapeCsvValue(null)).toBe('')
    expect(escapeCsvValue(undefined)).toBe('')
  })

  it('laisse une valeur simple intacte', () => {
    expect(escapeCsvValue('Dupont')).toBe('Dupont')
  })

  it('entoure de guillemets une valeur contenant le séparateur', () => {
    expect(escapeCsvValue('Dupont; Jean')).toBe('"Dupont; Jean"')
  })

  it('double les guillemets internes', () => {
    expect(escapeCsvValue('Douleur "aiguë"')).toBe('"Douleur ""aiguë"""')
  })

  it('entoure de guillemets une valeur multiligne', () => {
    expect(escapeCsvValue('Ligne 1\nLigne 2')).toBe('"Ligne 1\nLigne 2"')
  })

  it('neutralise les débuts de formule pour le tableur', () => {
    expect(escapeCsvValue('=1+1')).toBe("'=1+1")
    expect(escapeCsvValue('-20 kg')).toBe("'-20 kg")
    expect(escapeCsvValue('@patient')).toBe("'@patient")
  })
})

describe('toCsv', () => {
  it('assemble en-têtes et lignes avec des fins de ligne CRLF', () => {
    const csv = toCsv(['Nom', 'Montant'], [['Dupont', '45,00'], ['Martin; Léa', '60,00']])
    expect(csv).toBe('Nom;Montant\r\nDupont;45,00\r\n"Martin; Léa";60,00')
  })

  it('produit uniquement la ligne d\'en-tête sans données', () => {
    expect(toCsv(['Nom'], [])).toBe('Nom')
  })
})

describe('formatCsvDate', () => {
  it('formate une date locale sans décalage de fuseau', () => {
    expect(formatCsvDate('1985-03-15')).toBe('15/03/1985')
  })

  it('accepte une date-heure locale', () => {
    expect(formatCsvDate('2026-03-15T09:30')).toBe('15/03/2026')
  })

  it('renvoie une cellule vide pour une valeur absente ou illisible', () => {
    expect(formatCsvDate(null)).toBe('')
    expect(formatCsvDate('')).toBe('')
    expect(formatCsvDate('pas une date')).toBe('')
  })
})

describe('formatCsvDateTime', () => {
  it('affiche la date et l\'heure', () => {
    expect(formatCsvDateTime('2026-03-15T09:30')).toBe('15/03/2026 09:30')
  })

  it('accepte le format SQLite avec espace', () => {
    expect(formatCsvDateTime('2026-03-15 09:30:00')).toBe('15/03/2026 09:30')
  })

  it('se limite à la date quand il n\'y a pas d\'heure', () => {
    expect(formatCsvDateTime('2026-03-15')).toBe('15/03/2026')
  })
})

describe('formatCsvNumber', () => {
  it('utilise la virgule décimale', () => {
    expect(formatCsvNumber(45)).toBe('45,00')
    expect(formatCsvNumber('60.5')).toBe('60,50')
  })

  it('respecte le nombre de décimales demandé', () => {
    expect(formatCsvNumber(3, 0)).toBe('3')
  })

  it('renvoie une cellule vide pour une valeur non numérique', () => {
    expect(formatCsvNumber(null)).toBe('')
    expect(formatCsvNumber('')).toBe('')
    expect(formatCsvNumber('abc')).toBe('')
  })
})

describe('formatCsvBoolean', () => {
  it('traduit les booléens SQLite', () => {
    expect(formatCsvBoolean(1)).toBe('Oui')
    expect(formatCsvBoolean(0)).toBe('Non')
    expect(formatCsvBoolean(null)).toBe('')
  })
})

describe('buildCsvFileName', () => {
  it('inclut la période quand elle est fournie', () => {
    expect(buildCsvFileName('consultations', '2026-01-01', '2026-12-31')).toBe(
      'myosteoflow_consultations_2026-01-01_2026-12-31.csv',
    )
  })

  it('retombe sur la date du jour sans période', () => {
    expect(buildCsvFileName('patients')).toMatch(/^myosteoflow_patients_\d{2}-\d{2}-\d{4}\.csv$/)
  })
})

describe('CSV_BOM', () => {
  it('est bien le BOM UTF-8 attendu par Excel', () => {
    expect(CSV_BOM).toBe('﻿')
  })
})

describe('catalogue des exports', () => {
  it('n\'a pas de clé de jeu de données en double', () => {
    const keys = EXPORT_DATASETS.map((dataset) => dataset.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('n\'a pas de clé de colonne en double au sein d\'un jeu de données', () => {
    for (const dataset of EXPORT_DATASETS) {
      const keys = dataset.fields.map((field) => field.key)
      expect(new Set(keys).size, `doublon dans ${dataset.key}`).toBe(keys.length)
    }
  })

  it('propose au moins une colonne cochée par défaut', () => {
    for (const dataset of EXPORT_DATASETS) {
      expect(preselectedFieldKeys(dataset).length, dataset.key).toBeGreaterThan(0)
    }
  })

  it('ne présélectionne aucune colonne de données de santé, hormis le motif', () => {
    for (const dataset of EXPORT_DATASETS) {
      const preselectedHealth = dataset.fields.filter((field) => field.health && field.preselected)
      expect(preselectedHealth.map((field) => field.key)).toEqual(
        dataset.key === 'consultations' ? ['reason'] : [],
      )
    }
  })

  it('prévoit un filtre de cloisonnement cabinet paramétré', () => {
    for (const dataset of EXPORT_DATASETS) {
      expect(dataset.cabinetFilter, dataset.key).toContain('{ph}')
    }
  })

  it('retrouve un jeu de données par sa clé', () => {
    expect(getExportDataset('patients')?.label).toBe('Patients')
    expect(getExportDataset('inconnu')).toBeUndefined()
  })
})
