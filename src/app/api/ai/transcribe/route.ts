import { NextResponse } from 'next/server'

// Transcription handled via Electron IPC (electron/main.ts) in the desktop app.
// This route is a fallback stub — not called in normal usage.
export async function POST() {
  return NextResponse.json(
    { error: 'Transcription disponible uniquement dans l\'application desktop.' },
    { status: 501 }
  )
}
