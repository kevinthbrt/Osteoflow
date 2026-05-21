import { NextResponse } from 'next/server'
import path from 'path'
import os from 'os'

export const dynamic = 'force-dynamic'

// Singleton — le pipeline est chargé une seule fois puis gardé en mémoire
let whisperPipeline: any = null
let whisperLoading: Promise<any> | null = null

async function getPipeline() {
  if (whisperPipeline) return whisperPipeline
  if (!whisperLoading) {
    whisperLoading = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')

      // Cache du modèle dans un répertoire accessible en écriture
      const cacheDir = process.env.ELECTRON_USER_DATA_PATH
        ? path.join(process.env.ELECTRON_USER_DATA_PATH, 'whisper-cache')
        : path.join(os.homedir(), '.cache', 'myosteoflow', 'whisper')

      env.cacheDir = cacheDir

      whisperPipeline = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-base'
      )
      return whisperPipeline
    })()
  }
  return whisperLoading
}

export async function POST(req: Request) {
  try {
    // Le client envoie un Float32Array (PCM 16 kHz, mono) en binaire brut.
    // Le décodage WebM → Float32 est fait côté navigateur via AudioContext.
    const arrayBuffer = await req.arrayBuffer()
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Aucune donnée audio reçue' }, { status: 400 })
    }

    const float32 = new Float32Array(arrayBuffer)
    const pipe = await getPipeline()

    const result = await pipe(float32, {
      language: 'french',
      task: 'transcribe',
    })

    const transcript: string = (result?.text ?? '').trim()
    return NextResponse.json({ transcript })
  } catch (err) {
    console.error('[Transcribe]', err)
    return NextResponse.json({ error: 'Erreur lors de la transcription.' }, { status: 500 })
  }
}
