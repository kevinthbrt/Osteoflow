import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/ai'

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json()

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'Transcription vide' }, { status: 400 })
    }

    const secret = process.env.OSTEOFLOW_PROXY_SECRET
    if (!secret) {
      return NextResponse.json({ error: "Service IA non configuré." }, { status: 500 })
    }

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-osteoflow-secret': secret,
      },
      body: JSON.stringify({ transcript }),
      signal: AbortSignal.timeout(35000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[AI proxy]', res.status, err)
      return NextResponse.json({ error: `Erreur service IA (${res.status})` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[AI proxy]', err)
    return NextResponse.json({ error: 'Erreur lors de la structuration.' }, { status: 500 })
  }
}
