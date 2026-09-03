import { NextResponse } from 'next/server'
import type { AnamnesisSection } from '@/lib/anamnesis'

export const dynamic = 'force-dynamic'
// Une phrase à partir de cartes déjà structurées : appel court. On reste
// au-dessus du timeout du fetch sortant, qui masquerait sinon la vraie erreur.
export const maxDuration = 60

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/summarize-anamnesis'

/**
 * Synthèse d'une anamnèse déjà structurée, à la demande.
 *
 * Sert la reprise des consultations antérieures : leurs cartes sont enregistrées
 * mais ont été produites avant que la structuration ne renvoie une phrase de
 * synthèse. Seuls le libellé et les items sont transmis : ni identité du
 * patient, ni transcription brute, ni contexte du dossier.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reason?: string; sections?: AnamnesisSection[] }
    const sections = Array.isArray(body.sections) ? body.sections : []

    if (sections.length === 0) {
      return NextResponse.json({ error: 'Aucune carte à synthétiser' }, { status: 400 })
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
        body: JSON.stringify({
          reason: body.reason,
          // On n'envoie que ce que la synthèse utilise.
          sections: sections.map((s) => ({ label: s.label, items: s.items })),
        }),
        signal: AbortSignal.timeout(50000),
      })
    } catch {
      return NextResponse.json({ error: 'Impossible de contacter le serveur.' }, { status: 500 })
    }

    if (!proxyRes.ok) {
      const err = await proxyRes.text()
      console.error('[summary proxy]', proxyRes.status, err)
      let message = `Erreur service (${proxyRes.status})`
      try {
        const parsed = JSON.parse(err)
        if (parsed?.error) message = parsed.error
      } catch { /* corps non-JSON : on garde le message générique */ }
      return NextResponse.json({ error: message }, { status: 502 })
    }

    const data = await proxyRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[summary proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la synthèse.' }, { status: 500 })
  }
}
