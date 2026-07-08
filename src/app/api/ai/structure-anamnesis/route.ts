import { NextResponse } from 'next/server'
import type { PatientFieldsDetected } from '@/types/ai'

export type { PatientFieldsDetected }

export const dynamic = 'force-dynamic'
// Vercel Hobby hard-caps function duration at 60s (raise once on Pro). Keep this
// >= the outer fetch timeout below so the function isn't killed mid-wait, which
// would mask the proxy's real response as a generic 500.
export const maxDuration = 60

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
        // Under our own 60s function cap, with headroom for the proxy (which
        // times out its Anthropic call at 45s) to return its real error before
        // we abort. Bump both ceilings once on Vercel Pro.
        signal: AbortSignal.timeout(55000),
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
