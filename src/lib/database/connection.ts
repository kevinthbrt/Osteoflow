/**
 * SQLite database connection manager for Osteoflow desktop.
 * Uses better-sqlite3 for synchronous, high-performance SQLite access.
 * The database file is stored in the user's app data directory,
 * or in a custom directory specified via config.json.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { SCHEMA_SQL, runMigrations } from './schema'

let db: Database.Database | null = null

/**
 * Get the default app data directory (platform-specific).
 */
export function getAppDataDir(): string {
  const appName = 'Osteoflow'
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'), appName)
  } else if (process.platform === 'darwin') {
    return path.join(process.env.HOME || '', 'Library', 'Application Support', appName)
  } else {
    return path.join(process.env.HOME || '', '.config', appName)
  }
}

/**
 * Get the config file path (always in the default app data directory).
 */
function getConfigPath(): string {
  const appDataDir = getAppDataDir()
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true })
  }
  return path.join(appDataDir, 'config.json')
}

/**
 * Read the config file. Returns empty config if file doesn't exist.
 */
export function readConfig(): { databaseDir?: string } {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch {
    // Ignore errors, return default
  }
  return {}
}

/**
 * Write to the config file.
 */
export function writeConfig(config: { databaseDir?: string }): void {
  const configPath = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * Get the path to the database file.
 * Uses custom directory from config.json if set, otherwise platform default.
 */
function getDatabasePath(): string {
  const config = readConfig()
  let dbDir: string

  if (config.databaseDir && fs.existsSync(config.databaseDir)) {
    dbDir = config.databaseDir
  } else {
    dbDir = getAppDataDir()
  }

  // Create directory if it doesn't exist
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  return path.join(dbDir, 'osteoflow.db')
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

  // Run migrations for existing databases
  runMigrations(db)

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
