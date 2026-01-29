/**
 * SQLite database connection manager for Osteoflow desktop.
 * Uses better-sqlite3 for synchronous, high-performance SQLite access.
 * The database file is stored in the user's app data directory.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { SCHEMA_SQL } from './schema'

let db: Database.Database | null = null

/**
 * Get the path to the database file.
 * Uses platform-specific app data directories.
 */
function getDatabasePath(): string {
  const appName = 'Osteoflow'

  let appDataDir: string
  if (process.platform === 'win32') {
    appDataDir = path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'), appName)
  } else if (process.platform === 'darwin') {
    appDataDir = path.join(process.env.HOME || '', 'Library', 'Application Support', appName)
  } else {
    appDataDir = path.join(process.env.HOME || '', '.config', appName)
  }

  // Create directory if it doesn't exist
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true })
  }

  return path.join(appDataDir, 'osteoflow.db')
}

/**
 * Get or create the SQLite database connection.
 * Initializes the schema on first connection.
 */
export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDatabasePath()
  console.log(`[Database] Opening database at: ${dbPath}`)

  db = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Initialize schema
  db.exec(SCHEMA_SQL)

  console.log('[Database] Schema initialized successfully')

  return db
}

/**
 * Close the database connection gracefully.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[Database] Connection closed')
  }
}

/**
 * Generate a UUID v4 string.
 */
export function generateUUID(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}
