import { NextResponse } from 'next/server'
import path from 'path'
import os from 'os'

export const dynamic = 'force-dynamic'

// Démarre le chargement du pipeline dès l'import du module (pas dans le handler)
// → le téléchargement (~77 Mo) ne bloque pas les requêtes en cours.
// Le handler POST attend simplement que la promesse se résolve.
const pipelineReady: Promise<any> = (async () => {
  const { pipeline, env } = await import('@huggingface/transformers')

  env.cacheDir = process.env.ELECTRON_USER_DATA_PATH
    ? path.join(process.env.ELECTRON_USER_DATA_PATH, 'whisper-cache')
    : path.join(os.homedir(), '.cache', 'myosteoflow', 'whisper')

  console.log('[Whisper] Chargement du modèle whisper-base…')
  const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base')
  console.log('[Whisper] Modèle prêt.')
  return pipe
})()

// Appelé au démarrage de l'app par Electron pour déclencher le chargement
// du modèle en avance — évite tout délai lors de la première dictée.
export async function GET() {
  try {
    await pipelineReady
    return NextResponse.json({ status: 'ready' })
  } catch (err) {
    console.error('[Whisper warmup]', err)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const arrayBuffer = await req.arrayBuffer()
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Aucune donnée audio reçue' }, { status: 400 })
    }

    const float32 = new Float32Array(arrayBuffer)
    const pipe = await pipelineReady

    const result = await pipe(float32, {
      language: 'french',
      task: 'transcribe',
    })

    return NextResponse.json({ transcript: (result?.text ?? '').trim() })
  } catch (err) {
    console.error('[Transcribe]', err)
    return NextResponse.json({ error: 'Erreur lors de la transcription.' }, { status: 500 })
  }
}
