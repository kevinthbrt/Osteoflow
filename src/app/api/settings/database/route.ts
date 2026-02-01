/**
 * Database storage path management API route.
 *
 * GET: Returns current database path and default path
 * POST: Updates the database storage directory
 */

import { NextResponse } from 'next/server'
import { getAppDataDir, readConfig, writeConfig, closeDatabase } from '@/lib/database/connection'
import path from 'path'
import fs from 'fs'

export async function GET() {
  try {
    const config = readConfig()
    const defaultDir = getAppDataDir()
    const currentDir = config.databaseDir || defaultDir
    const dbPath = path.join(currentDir, 'osteoflow.db')
    const dbExists = fs.existsSync(dbPath)

    return NextResponse.json({
      currentDir,
      defaultDir,
      dbPath,
      dbExists,
      isCustom: !!config.databaseDir,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to read config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { databaseDir } = await request.json()

    if (databaseDir) {
      // Validate the directory exists
      if (!fs.existsSync(databaseDir)) {
        return NextResponse.json(
          { error: `Le dossier n'existe pas : ${databaseDir}` },
          { status: 400 }
        )
      }

      // Check write permissions by trying to create a test file
      const testFile = path.join(databaseDir, '.osteoflow-test')
      try {
        fs.writeFileSync(testFile, 'test')
        fs.unlinkSync(testFile)
      } catch {
        return NextResponse.json(
          { error: `Pas de permission d'écriture dans : ${databaseDir}` },
          { status: 400 }
        )
      }
    }

    // Close existing database connection before switching
    closeDatabase()

    // Write the new config (null/undefined = reset to default)
    writeConfig({ databaseDir: databaseDir || undefined })

    const config = readConfig()
    const defaultDir = getAppDataDir()
    const currentDir = config.databaseDir || defaultDir

    return NextResponse.json({
      success: true,
      currentDir,
      message: databaseDir
        ? `Base de données déplacée vers : ${currentDir}`
        : 'Réinitialisé au dossier par défaut',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
