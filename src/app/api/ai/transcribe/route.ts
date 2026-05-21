import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─── Mode 1 : proxy centralisé Osteoupgrade (production commerciale) ──────────
// Quand OSTEOFLOW_PROXY_SECRET est défini, l'audio passe par le proxy qui gère
// sa propre clé Groq. Coût ~0,04$/heure côté proxy, transparent pour l'utilisateur.
// À activer sur osteoupgrade.vercel.app : POST /api/osteoflow/transcribe
// avec header x-osteoflow-secret + body multipart/form-data (champ "file").

const PROXY_BASE = 'https://osteoupgrade.vercel.app'
const PROXY_SECRET_DEFAULT = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

// ─── Mode 2 : clé Groq locale (développement / utilisateur avec clé perso) ────
// Définir GROQ_API_KEY dans .env.local. Gratuit jusqu'à 7200 s/jour par clé.

async function transcribeViaProxy(arrayBuffer: ArrayBuffer, secret: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', new File([arrayBuffer], 'audio.webm', { type: 'audio/webm' }))

  const res = await fetch(`${PROXY_BASE}/api/osteoflow/transcribe`, {
    method: 'POST',
    headers: { 'x-osteoflow-secret': secret },
    body: formData,
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const err = await res.text()
    if (res.status === 429) {
      throw Object.assign(new Error(`Proxy error 429: ${err}`), { isRateLimit: true })
    }
    throw new Error(`Proxy error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return (data.transcript ?? '').trim()
}

async function transcribeViaGroq(arrayBuffer: ArrayBuffer, apiKey: string): Promise<string> {
  const Groq = (await import('groq-sdk')).default
  const groq = new Groq({ apiKey })

  const transcription = await groq.audio.transcriptions.create({
    file: new File([arrayBuffer], 'audio.webm', { type: 'audio/webm' }),
    model: 'whisper-large-v3-turbo',
    language: 'fr',
    response_format: 'text',
  })

  return (typeof transcription === 'string' ? transcription : (transcription as any).text ?? '').trim()
}

export async function POST(req: Request) {
  try {
    const arrayBuffer = await req.arrayBuffer()
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Aucune donnée audio reçue.' }, { status: 400 })
    }

    let text: string

    const groqKey = process.env.GROQ_API_KEY
    const proxySecret = process.env.OSTEOFLOW_PROXY_SECRET || PROXY_SECRET_DEFAULT

    if (proxySecret) {
      // Mode proxy — production commerciale (pas de clé Groq nécessaire côté client)
      text = await transcribeViaProxy(arrayBuffer, proxySecret)
    } else if (groqKey) {
      // Mode clé locale — développement ou utilisateur avec sa propre clé
      text = await transcribeViaGroq(arrayBuffer, groqKey)
    } else {
      return NextResponse.json(
        { error: 'Transcription non configurée. Ajoutez GROQ_API_KEY dans .env.local.' },
        { status: 503 }
      )
    }

    return NextResponse.json({ transcript: text })
  } catch (err: any) {
    console.error('[Transcribe]', err)
    if (err?.isRateLimit || (err instanceof Error && err.message.includes('429'))) {
      return NextResponse.json(
        { error: 'Limite quotidienne de transcription atteinte. Réessayez demain ou contactez le support.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Erreur lors de la transcription.' }, { status: 500 })
  }
}
