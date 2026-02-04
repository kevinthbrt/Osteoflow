/**
 * Stamp/signature upload API route for desktop mode.
 * Saves the uploaded image to the app data directory and returns a local URL.
 */

import { NextResponse } from 'next/server'
import { getAppDataDir } from '@/lib/database/connection'
import { createLocalClient } from '@/lib/database/query-builder'
import path from 'path'
import fs from 'fs'

/** Derive a safe file extension from MIME type or file name. */
function getExtension(file: File): string {
  // Prefer deriving from MIME type (always available on File objects)
  const mimeExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }

  const fileType = typeof file.type === 'string' ? file.type : ''
  if (mimeExt[fileType]) {
    return mimeExt[fileType]
  }

  // Fallback: extract from file name
  const fileName = typeof file.name === 'string' ? file.name : ''
  if (fileName) {
    const parts = fileName.split('.')
    if (parts.length > 1) {
      return parts.pop()!.toLowerCase()
    }
  }

  return 'png'
}

export async function POST(request: Request) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (parseError) {
      console.error('Error parsing form data:', parseError)
      return NextResponse.json(
        { error: 'Erreur lors de la lecture du fichier. Veuillez réessayer.' },
        { status: 400 }
      )
    }

    const file = formData.get('file')
    const practitionerId = formData.get('practitioner_id') as string | null

    if (!file || !practitionerId) {
      return NextResponse.json(
        { error: 'Fichier et practitioner_id requis' },
        { status: 400 }
      )
    }

    // Ensure we have a File/Blob object, not a string
    if (typeof file === 'string') {
      return NextResponse.json(
        { error: 'Le champ file doit être un fichier, pas du texte' },
        { status: 400 }
      )
    }

    const fileObj = file as File

    // Validate file type
    const fileType = typeof fileObj.type === 'string' ? fileObj.type : ''
    if (!fileType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Le fichier doit être une image' },
        { status: 400 }
      )
    }

    // Validate file size (max 2MB)
    if (fileObj.size > 2 * 1024 * 1024) {
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
    const ext = getExtension(fileObj)
    const fileName = `${practitionerId}.${ext}`
    const filePath = path.join(stampsDir, fileName)

    const buffer = Buffer.from(await fileObj.arrayBuffer())
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
