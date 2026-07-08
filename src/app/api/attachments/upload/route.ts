/**
 * Upload attachment for a consultation.
 * Accepts base64-encoded file and stores it in the app data directory.
 */

import { NextResponse } from 'next/server'
import { getAppDataDir } from '@/lib/database/connection'
import { createLocalClient } from '@/lib/database/query-builder'
import { checkLocalApiToken } from '@/lib/local-api-auth'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_EXT_RE = /^\.[a-zA-Z0-9]{1,10}$/

export async function POST(request: Request) {
  const authError = checkLocalApiToken(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { file: base64Data, consultation_id, original_name, mimetype } = body as {
      file?: string
      consultation_id?: string
      original_name?: string
      mimetype?: string
    }

    if (!base64Data || !consultation_id || !original_name) {
      return NextResponse.json(
        { error: 'Fichier, consultation_id et original_name requis' },
        { status: 400 }
      )
    }

    if (!UUID_RE.test(consultation_id)) {
      return NextResponse.json({ error: 'consultation_id invalide' }, { status: 400 })
    }

    // Strip data URI prefix if present
    const base64 = base64Data.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Le fichier ne doit pas dépasser 20 Mo' },
        { status: 400 }
      )
    }

    // Determine extension from original filename — constrained to a safe
    // character set so it can never smuggle path separators.
    const rawExt = path.extname(original_name).toLowerCase()
    const ext = SAFE_EXT_RE.test(rawExt) ? rawExt : '.bin'
    const uniqueId = crypto.randomBytes(8).toString('hex')
    const filename = `${consultation_id}_${uniqueId}${ext}`

    // Create attachments directory
    const attachmentsDir = path.join(getAppDataDir(), 'attachments')
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true })
    }

    // Save file — resolved path is re-verified to stay under attachmentsDir
    // in case the filename construction above is ever changed carelessly.
    const filePath = path.join(attachmentsDir, filename)
    if (path.dirname(filePath) !== attachmentsDir) {
      return NextResponse.json({ error: 'Chemin de fichier invalide' }, { status: 400 })
    }
    fs.writeFileSync(filePath, buffer)

    // Save record in database
    const client = createLocalClient()
    const { data: attachment, error } = await client
      .from('consultation_attachments')
      .insert({
        consultation_id,
        filename,
        original_name,
        mime_type: mimetype || 'application/octet-stream',
        file_size: buffer.length,
      })
      .select()
      .single()

    if (error) {
      // Clean up file if DB insert fails
      fs.unlinkSync(filePath)
      throw error
    }

    return NextResponse.json({ attachment })
  } catch (error) {
    console.error('Error uploading attachment:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
