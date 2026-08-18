/**
 * Construction des requêtes d'export et mise en forme des lignes.
 *
 * Module pur (aucune dépendance Node) : la requête est assemblée exclusivement
 * à partir du catalogue `EXPORT_DATASETS`. Aucune chaîne reçue du client n'est
 * interpolée dans le SQL — les clés inconnues sont écartées, et les seules
 * valeurs qui atteignent SQLite le font par paramètres liés (période et
 * périmètre cabinet).
 */

import {
  getExportDataset,
  type ExportDataset,
  type ExportField,
} from './datasets'
import {
  formatCsvBoolean,
  formatCsvDate,
  formatCsvDateTime,
  formatCsvNumber,
} from './csv'

export interface ExportSelection {
  dataset: string
  fields: string[]
  startDate?: string | null
  endDate?: string | null
  /** Inclure les patients / consultations archivés. */
  includeArchived?: boolean
}

export interface ExportQuery {
  dataset: ExportDataset
  fields: ExportField[]
  sql: string
  params: unknown[]
}

export class ExportError extends Error {}

export function buildExportQuery(selection: ExportSelection, cabinetIds: string[]): ExportQuery {
  const dataset = getExportDataset(selection.dataset)
  if (!dataset) {
    throw new ExportError(`Jeu de données inconnu : ${selection.dataset}`)
  }

  const fields = resolveFields(dataset, selection.fields)
  if (fields.length === 0) {
    throw new ExportError(`Aucune colonne sélectionnée pour « ${dataset.label} »`)
  }

  if (cabinetIds.length === 0) {
    throw new ExportError('Aucun cabinet actif : impossible de délimiter les données à exporter')
  }

  const where: string[] = []
  const params: unknown[] = []

  where.push(dataset.cabinetFilter.replace('{ph}', cabinetIds.map(() => '?').join(', ')))
  params.push(...cabinetIds)

  if (dataset.archivedFilter && !selection.includeArchived) {
    where.push(dataset.archivedFilter)
  }

  if (dataset.dateColumn && selection.startDate) {
    where.push(`${dataset.dateColumn} >= ?`)
    params.push(selection.startDate)
  }
  if (dataset.dateColumn && selection.endDate) {
    where.push(`${dataset.dateColumn} <= ?`)
    params.push(selection.endDate)
  }

  const columns = fields.map((field) => `${field.sql} AS "${field.key}"`).join(', ')
  const sql =
    `SELECT ${columns} FROM ${dataset.from}` +
    ` WHERE ${where.join(' AND ')}` +
    ` ORDER BY ${dataset.orderBy}`

  return { dataset, fields, sql, params }
}

/**
 * Ne retient que les colonnes connues du catalogue, dans l'ordre du catalogue
 * pour que deux exports successifs produisent les mêmes colonnes au même
 * endroit, quel que soit l'ordre dans lequel le praticien les a cochées.
 */
export function resolveFields(dataset: ExportDataset, requested: string[]): ExportField[] {
  const wanted = new Set(requested)
  return dataset.fields.filter((field) => wanted.has(field.key))
}

/** Transforme les lignes brutes de SQLite en cellules prêtes pour le CSV. */
export function formatExportRows(
  rows: Array<Record<string, unknown>>,
  fields: ExportField[],
): string[][] {
  return rows.map((row) => fields.map((field) => formatExportValue(row[field.key], field)))
}

export function formatExportValue(value: unknown, field: ExportField): string {
  switch (field.kind) {
    case 'date':
      return formatCsvDate(value)
    case 'datetime':
      return formatCsvDateTime(value)
    case 'amount':
      return formatCsvNumber(value, 2)
    case 'number':
      return formatCsvNumber(value, 0)
    case 'boolean':
      return formatCsvBoolean(value)
    default:
      return value === null || value === undefined ? '' : String(value)
  }
}
