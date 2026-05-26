import { NextResponse } from 'next/server'
import type { PatientFieldsDetected } from '@/types/ai'

export type { PatientFieldsDetected }

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/ai'
const PROXY_SECRET = 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

interface CurrentPatientContext {
  profession?: string | null
  sport_activity?: string | null
  primary_physician?: string | null
  pregnancy_due_date?: string | null
}

async function detectPatientFields(
  transcript: string,
  currentPatient: CurrentPatientContext | undefined,
  apiKey: string
): Promise<PatientFieldsDetected | null> {
  const systemPrompt = `Tu es un assistant médical ostéopathique. Analyse le texte d'une dictée clinique et détecte si le patient mentionne des informations à mettre à jour dans son dossier.

Retourne UNIQUEMENT un objet JSON valide (sans texte autour, sans markdown) avec les champs détectés parmi :
- "profession" : la profession ou le métier du patient si mentionné ou changé
- "sport_activity" : l'activité sportive pratiquée si mentionnée
- "primary_physician" : le nom du médecin traitant ou du médecin référent si mentionné
- "pregnancy_due_date" : la date de terme d'une grossesse au format YYYY-MM-DD (si grossesse mentionnée avec un terme prévu)

Règles strictes :
- N'inclure un champ QUE s'il est explicitement mentionné dans le texte
- Ne pas inclure un champ dont la valeur est déjà connue (identique au contexte actuel)
- Si aucun champ n'est détecté, retourner {}
- Ne jamais inventer d'informations non mentionnées
- Pour pregnancy_due_date, approximer au 1er du mois si seul le mois est précisé`

  const lines: string[] = ['Contexte actuel du patient :']
  lines.push(currentPatient?.profession ? `- Profession : ${currentPatient.profession}` : '- Profession : inconnue')
  lines.push(currentPatient?.sport_activity ? `- Sport : ${currentPatient.sport_activity}` : '- Sport : inconnu')
  lines.push(currentPatient?.primary_physician ? `- Médecin traitant : ${currentPatient.primary_physician}` : '- Médecin traitant : inconnu')
  if (currentPatient?.pregnancy_due_date) {
    lines.push(`- Grossesse en cours, terme : ${new Date(currentPatient.pregnancy_due_date).toLocaleDateString('fr-FR')}`)
  }
  lines.push('', 'Texte de la dictée :', transcript)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: lines.join('\n') }],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = (data?.content?.[0]?.text ?? '').trim()
    if (!text) return null
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed: PatientFieldsDetected = JSON.parse(match[0])
    return Object.keys(parsed).length > 0 ? parsed : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { transcript: string; currentPatient?: CurrentPatientContext }
    const { transcript, currentPatient } = body

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'Transcription vide' }, { status: 400 })
    }

    const secret = process.env.OSTEOFLOW_PROXY_SECRET || PROXY_SECRET

    // Get API key from DB for field detection (optional feature)
    let apiKey: string | null = null
    try {
      const { getDatabase } = await import('@/lib/database/connection')
      const db = getDatabase()
      const row = db.prepare("SELECT value FROM app_config WHERE key = 'anthropic_api_key'").get() as { value: string } | undefined
      apiKey = row?.value ?? null
    } catch { /* no key available, skip detection */ }

    // Run proxy call + detection in parallel
    const [proxyResult, detectedFields] = await Promise.allSettled([
      fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-osteoflow-secret': secret,
        },
        body: JSON.stringify({ transcript }),
        signal: AbortSignal.timeout(35000),
      }),
      apiKey
        ? detectPatientFields(transcript, currentPatient, apiKey)
        : Promise.resolve(null),
    ])

    if (proxyResult.status === 'rejected') {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 500 })
    }
    const proxyRes = proxyResult.value
    if (!proxyRes.ok) {
      const err = await proxyRes.text()
      console.error('[AI proxy]', proxyRes.status, err)
      return NextResponse.json({ error: `Erreur service IA (${proxyRes.status})` }, { status: 502 })
    }

    const data = await proxyRes.json()
    const patient_fields = detectedFields.status === 'fulfilled' ? detectedFields.value : null

    return NextResponse.json({ ...data, patient_fields })
  } catch (err) {
    console.error('[AI proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la structuration.' }, { status: 500 })
  }
}
