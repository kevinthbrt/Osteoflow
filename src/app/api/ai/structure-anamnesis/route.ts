import { NextResponse } from 'next/server'
import type { PatientFieldsDetected } from '@/types/ai'
import { HISTORY_FIELD_KEYS } from '@/types/ai'

export type { PatientFieldsDetected }

export const dynamic = 'force-dynamic'
// osteoupgrade est maintenant en plan Pro (jusqu'à 300s) — relevé de 60s.
// Garder >= le timeout du fetch sortant ci-dessous, qui masquerait sinon la
// vraie réponse du proxy derrière un 500 générique.
export const maxDuration = 160

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/ai'

interface CurrentPatientContext {
  age?: number | null
  sex?: string | null
  profession?: string | null
  sport_activity?: string | null
  primary_physician?: string | null
  pregnancy_due_date?: string | null
  surgical_history?: string | null
  trauma_history?: string | null
  medical_history?: string | null
  family_history?: string | null
}

const HISTORY_KEYS = new Set<string>(HISTORY_FIELD_KEYS)

/**
 * Normalise les champs patient détectés par le LLM.
 * - Antécédents (medical/surgical/trauma/family) → string[] : une entrée par
 *   élément (le LLM renvoie tantôt une chaîne, tantôt un tableau). On ne
 *   découpe jamais une chaîne nous-mêmes (une virgule peut appartenir à un
 *   même antécédent), on aplatit seulement les tableaux.
 * - Champs plats (profession, etc.) → string.
 * Garantit qu'aucun tableau ne fuit vers un champ qui attend une chaîne, et
 * que l'insertion SQLite reçoit des valeurs scalaires.
 */
function normalizePatientFields(fields: unknown): PatientFieldsDetected | null {
  if (!fields || typeof fields !== 'object') return null
  const out: Record<string, string | string[]> = {}
  for (const [key, raw] of Object.entries(fields as Record<string, unknown>)) {
    const items = (Array.isArray(raw) ? raw : [raw])
      .map((v) => (v == null ? '' : String(v).trim()))
      .filter(Boolean)
    if (items.length === 0) continue
    out[key] = HISTORY_KEYS.has(key) ? items : items.join(', ')
  }
  return Object.keys(out).length > 0 ? (out as PatientFieldsDetected) : null
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { transcript: string; currentPatient?: CurrentPatientContext }
    const { transcript, currentPatient } = body

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'Transcription vide' }, { status: 400 })
    }

    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
    }

    let proxyRes: Response
    try {
      proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-osteoflow-secret': secret,
        },
        body: JSON.stringify({ transcript, patientContext: currentPatient ?? null }),
        // Under our own 160s function cap, with headroom for the proxy
        // (maxDuration 120s, Anthropic call timeout 90s) to return its real
        // error before we abort.
        signal: AbortSignal.timeout(150000),
      })
    } catch {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 500 })
    }

    if (!proxyRes.ok) {
      const err = await proxyRes.text()
      console.error('[AI proxy]', proxyRes.status, err)
      return NextResponse.json({ error: `Erreur service IA (${proxyRes.status})` }, { status: 502 })
    }

    const data = await proxyRes.json()

    // patient_fields is returned by the proxy when it supports field detection.
    // detection_skipped is true when the proxy did not attempt detection.
    //
    // Le LLM renvoie parfois un tableau (ex. ["diabète", "HTA"]) là où le schéma
    // attend une chaîne. Sans normalisation, React affiche les éléments collés
    // sans séparateur ET SQLite plante à l'insertion ("Too many parameter values
    // were provided", car better-sqlite3 déplie le tableau en paramètres). On
    // aplatit donc chaque champ en chaîne propre.
    const patient_fields = normalizePatientFields(data.patient_fields ?? null)
    const detection_skipped: boolean = data.detection_skipped ?? (patient_fields === null)

    return NextResponse.json({ ...data, patient_fields, detection_skipped })
  } catch (err) {
    console.error('[AI proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la structuration.' }, { status: 500 })
  }
}
