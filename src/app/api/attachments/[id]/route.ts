/**
 * Serve and delete consultation attachments.
 */

import { NextResponse } from 'next/server'
import { getAppDataDir } from '@/lib/database/connection'
import { createLocalClient } from '@/lib/database/query-builder'
import path from 'path'
import fs from 'fs'

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  dicom: 'application/dicom',
  dcm: 'application/dicom',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = createLocalClient()

    const { data: attachment, error } = await client
      .from('consultation_attachments')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !attachment) {
      return NextResponse.json({ error: 'Pièce jointe introuvable' }, { status: 404 })
    }

    const attachmentsDir = path.join(getAppDataDir(), 'attachments')
    const filePath = path.join(attachmentsDir, attachment.filename)

    // Security: prevent path traversal
    if (!filePath.startsWith(attachmentsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
    }

    const ext = path.extname(attachment.filename).slice(1).toLowerCase()
    const contentType = attachment.mime_type || MIME_TYPES[ext] || 'application/octet-stream'
    const fileBuffer = fs.readFileSync(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.original_name)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error serving attachment:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = createLocalClient()

    const { data: attachment, error: fetchError } = await client
      .from('consultation_attachments')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !attachment) {
      return NextResponse.json({ error: 'Pièce jointe introuvable' }, { status: 404 })
    }

    // Delete file from disk
    const attachmentsDir = path.join(getAppDataDir(), 'attachments')
    const filePath = path.join(attachmentsDir, attachment.filename)

    if (!filePath.startsWith(attachmentsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete record from database
    const { error: deleteError } = await client
      .from('consultation_attachments')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
