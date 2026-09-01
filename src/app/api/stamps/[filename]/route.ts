/**
 * Serves stamp/signature images from the local app data directory.
 */

import { NextResponse } from 'next/server'
import { getAppDataDir } from '@/lib/database/connection'
import path from 'path'
import fs from 'fs'

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const stampsDir = path.resolve(getAppDataDir(), 'stamps')
    const filePath = path.resolve(stampsDir, filename)

    // Security: prevent path traversal — the resolved file must sit directly
    // inside the stamps directory (the trailing separator also rules out a
    // sibling directory whose name merely starts with "stamps").
    if (!filePath.startsWith(stampsDir + path.sep)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const ext = (path.extname(filename || '').slice(1) || 'png').toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const fileBuffer = fs.readFileSync(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        // Never cache: a stamp is small, local, and read from disk, while a
        // cached copy would keep showing a replaced stamp long after the user
        // uploaded a new one.
        'Cache-Control': 'no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error serving stamp:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
