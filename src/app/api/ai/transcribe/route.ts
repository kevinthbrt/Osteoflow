import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const db = getDatabase()
    const keyRow = db
      .prepare("SELECT value FROM app_config WHERE key = 'openai_api_key'")
      .get() as { value: string } | undefined
    const apiKey = keyRow?.value

    if (!apiKey) {
      return NextResponse.json({ error: 'NO_KEY' }, { status: 400 })
    }

    const formData = await req.formData()
    const audio = formData.get('audio') as File | null

    if (!audio || audio.size === 0) {
      return NextResponse.json({ error: 'Aucun fichier audio reçu' }, { status: 400 })
    }

    const whisperForm = new FormData()
    whisperForm.append('file', audio, 'recording.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'fr')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[Transcribe] Whisper error:', res.status, err)
      return NextResponse.json(
        { error: err?.error?.message || `Erreur Whisper (${res.status})` },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json({ transcript: data.text ?? '' })
  } catch (err) {
    console.error('[Transcribe]', err)
    return NextResponse.json({ error: 'Erreur lors de la transcription.' }, { status: 500 })
  }
}
