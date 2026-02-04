/**
 * Stamp/signature upload API route for desktop mode.
 * Accepts a base64-encoded image via JSON and saves it to the app data directory.
 */

import { NextResponse } from 'next/server'
import { getAppDataDir } from '@/lib/database/connection'
import { createLocalClient } from '@/lib/database/query-builder'
import path from 'path'
import fs from 'fs'

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export async function POST(request: Request) {
  try {
    let body: { file?: string; practitioner_id?: string; mimetype?: string; filename?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Corps de requête invalide' },
        { status: 400 }
      )
    }

    const { file: base64Data, practitioner_id: practitionerId, mimetype, filename } = body

    if (!base64Data || !practitionerId) {
      return NextResponse.json(
        { error: 'Fichier et practitioner_id requis' },
        { status: 400 }
      )
    }

    // Strip data URI prefix if present (e.g. "data:image/png;base64,...")
    const base64 = base64Data.replace(/^data:[^;]+;base64,/, '')

    // Decode to buffer
    const buffer = Buffer.from(base64, 'base64')

    // Validate size (max 2MB)
    if (buffer.length > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "L'image ne doit pas dépasser 2 Mo" },
        { status: 400 }
      )
    }

    // Determine extension from MIME type, then filename, fallback to png
    let ext = 'png'
    if (mimetype && MIME_TO_EXT[mimetype]) {
      ext = MIME_TO_EXT[mimetype]
    } else if (filename) {
      const parts = filename.split('.')
      if (parts.length > 1) {
        ext = parts.pop()!.toLowerCase()
      }
    }

    // Validate it's an image MIME type
    if (mimetype && !mimetype.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Le fichier doit être une image' },
        { status: 400 }
      )
    }

    // Create stamps directory in app data
    const stampsDir = path.join(getAppDataDir(), 'stamps')
    if (!fs.existsSync(stampsDir)) {
      fs.mkdirSync(stampsDir, { recursive: true })
    }

    // Save file
    const stampFileName = `${practitionerId}.${ext}`
    const filePath = path.join(stampsDir, stampFileName)
    fs.writeFileSync(filePath, buffer)

    // The stamp URL will be served via the /api/stamps/[filename] route
    const stampUrl = `/api/stamps/${stampFileName}`

    // Update practitioner record
    const client = createLocalClient()
    await client
      .from('practitioners')
      .update({ stamp_url: stampUrl })
      .eq('id', practitionerId)

    return NextResponse.json({ stampUrl })
  } catch (error) {
    console.error('Error uploading stamp:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
