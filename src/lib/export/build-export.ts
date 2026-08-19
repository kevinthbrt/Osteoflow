/**
 * Exécution des exports CSV côté serveur.
 *
 * Le cloisonnement cabinet est appliqué ici comme partout ailleurs dans
 * l'application : un export ne doit jamais laisser fuir les données d'un autre
 * cabinet. La construction de la requête elle-même vit dans `query.ts`, qui
 * reste pur et testable sans base.
 */

import { getDatabase } from '@/lib/database/connection'
import { getScopeCabinetIds } from '@/lib/database/cabinet-scope'
import { buildCsvFileName, toCsv } from './csv'
import { getExportDataset } from './datasets'
import { buildExportQuery, ExportError, formatExportRows, type ExportSelection } from './query'

export { ExportError } from './query'
export type { ExportSelection } from './query'

export interface ExportResult {
  dataset: string
  label: string
  filename: string
  csv: string
  rowCount: number
}

export function buildDatasetCsv(
  selection: ExportSelection,
  fallbackCabinetId: string,
): ExportResult {
  const dataset = getExportDataset(selection.dataset)
  if (!dataset) {
    throw new ExportError(`Jeu de données inconnu : ${selection.dataset}`)
  }

  const db = getDatabase()

  // Le périmètre dépend des catégories partagées entre cabinets ; sans cabinet
  // actif on se rabat sur le praticien authentifié plutôt que de tout exporter.
  const scopeIds = getScopeCabinetIds(dataset.scope, db)
  const cabinetIds = scopeIds.length ? scopeIds : [fallbackCabinetId]

  const query = buildExportQuery(selection, cabinetIds)
  const rows = db.prepare(query.sql).all(...query.params) as Array<Record<string, unknown>>

  const csv = toCsv(
    query.fields.map((field) => field.label),
    formatExportRows(rows, query.fields),
  )

  return {
    dataset: dataset.key,
    label: dataset.label,
    filename: buildCsvFileName(
      dataset.key,
      selection.startDate || undefined,
      selection.endDate || undefined,
    ),
    csv,
    rowCount: rows.length,
  }
}
