/**
 * Ouverture de l'archive d'export OsteoTools.
 *
 * OsteoTools livre un .zip chiffré en AES (WinZip AES) avec un mot de passe
 * communiqué à part. L'Explorateur Windows et l'utilitaire d'archive de macOS
 * ne savent pas ouvrir ce format : on le déchiffre donc directement dans
 * l'application, sur la machine du praticien.
 */

import { TextWriter, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, configure } from '@zip.js/zip.js'
import { parseSemicolonCsv, type CsvRow } from './csv'

configure({ useWebWorkers: false })

export type OsteoToolsTables = Record<string, CsvRow[]>

export interface OsteoToolsArchive {
  tables: OsteoToolsTables
  /** Fichiers joints, indexés par nom (ex. « 24169598265128c537c0c9.pdf »). */
  files: Map<string, Uint8Array>
}

export class OsteoToolsArchiveError extends Error {
  constructor(
    message: string,
    readonly code: 'password_required' | 'bad_password' | 'not_osteotools' | 'unreadable',
  ) {
    super(message)
  }
}

/** Tables indispensables pour reconnaître un export OsteoTools. */
const REQUIRED_TABLES = ['patients', 'consultations']

export async function readOsteoToolsArchive(data: Uint8Array, password?: string): Promise<OsteoToolsArchive> {
  let entries
  const reader = new ZipReader(new Uint8ArrayReader(data), password ? { password } : undefined)
  try {
    entries = await reader.getEntries()
  } catch {
    throw new OsteoToolsArchiveError('Le fichier n\'est pas une archive .zip lisible.', 'unreadable')
  }

  const tables: OsteoToolsTables = {}
  const files = new Map<string, Uint8Array>()

  try {
    for (const entry of entries) {
      if (entry.directory || !entry.getData) continue
      const parts = entry.filename.split(/[\\/]/)
      const name = parts[parts.length - 1]
      if (!name || name.startsWith('.') || parts.includes('__MACOSX')) continue
      if (entry.encrypted && !password) {
        throw new OsteoToolsArchiveError('Cette archive est protégée par un mot de passe.', 'password_required')
      }
      const parent = parts[parts.length - 2]?.toLowerCase()
      if (parent === 'attachments') {
        files.set(name, await entry.getData(new Uint8ArrayWriter()))
      } else if (name.toLowerCase().endsWith('.csv')) {
        const text = await entry.getData(new TextWriter('utf-8'))
        tables[name.slice(0, -4).toLowerCase()] = parseSemicolonCsv(text)
      }
    }
  } catch (err) {
    if (err instanceof OsteoToolsArchiveError) throw err
    const message = err instanceof Error ? err.message : ''
    if (/password/i.test(message)) {
      throw new OsteoToolsArchiveError('Mot de passe incorrect.', 'bad_password')
    }
    throw new OsteoToolsArchiveError('Impossible de lire le contenu de l\'archive.', 'unreadable')
  } finally {
    await reader.close().catch(() => undefined)
  }

  if (!REQUIRED_TABLES.every((table) => tables[table])) {
    throw new OsteoToolsArchiveError(
      'Cette archive ne ressemble pas à un export OsteoTools (fichiers patients.csv et consultations.csv introuvables).',
      'not_osteotools',
    )
  }

  return { tables, files }
}
