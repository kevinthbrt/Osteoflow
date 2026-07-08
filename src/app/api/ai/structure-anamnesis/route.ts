import { NextResponse } from 'next/server'
import type { PatientFieldsDetected } from '@/types/ai'

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
    const patient_fields: PatientFieldsDetected | null = data.patient_fields ?? null
    const detection_skipped: boolean = data.detection_skipped ?? (patient_fields === null)

    return NextResponse.json({ ...data, patient_fields, detection_skipped })
  } catch (err) {
    console.error('[AI proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la structuration.' }, { status: 500 })
  }
}
