/**
 * Stamp/signature upload API route for desktop mode.
 * Saves the uploaded image to the app data directory and returns a local URL.
 */

import { NextResponse } from 'next/server'
import { getAppDataDir } from '@/lib/database/connection'
import { createLocalClient } from '@/lib/database/query-builder'
import path from 'path'
import fs from 'fs'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const practitionerId = formData.get('practitioner_id') as string | null

    if (!file || !practitionerId) {
      return NextResponse.json(
        { error: 'Fichier et practitioner_id requis' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Le fichier doit être une image' },
        { status: 400 }
      )
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "L'image ne doit pas dépasser 2 Mo" },
        { status: 400 }
      )
    }

    // Create stamps directory in app data
    const stampsDir = path.join(getAppDataDir(), 'stamps')
    if (!fs.existsSync(stampsDir)) {
      fs.mkdirSync(stampsDir, { recursive: true })
    }

    // Save file
    const ext = file.name.split('.').pop() || 'png'
    const fileName = `${practitionerId}.${ext}`
    const filePath = path.join(stampsDir, fileName)

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    // The stamp URL will be served via the /api/stamps/[filename] route
    const stampUrl = `/api/stamps/${fileName}`

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
