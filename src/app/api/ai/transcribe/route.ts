import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API Groq non configurée.' }, { status: 503 })
    }

    const arrayBuffer = await req.arrayBuffer()
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Aucune donnée audio reçue.' }, { status: 400 })
    }

    const groq = new Groq({ apiKey })

    // Groq expects a File/Blob object with a filename and MIME type
    const file = new File([arrayBuffer], 'audio.webm', { type: 'audio/webm' })

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      language: 'fr',
      response_format: 'text',
    })

    const text = (typeof transcription === 'string' ? transcription : (transcription as any).text ?? '').trim()
    return NextResponse.json({ transcript: text })
  } catch (err) {
    console.error('[Groq transcribe]', err)
    return NextResponse.json({ error: 'Erreur lors de la transcription.' }, { status: 500 })
  }
}
