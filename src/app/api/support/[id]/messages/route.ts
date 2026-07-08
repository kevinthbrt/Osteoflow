import { NextRequest, NextResponse } from 'next/server'
import { getOsteoflowAuthHeaders } from '@/lib/osteoupgrade/proxy-auth'

const OSTEOUPGRADE_URL = 'https://osteoupgrade.vercel.app'
const OSTEOFLOW_SECRET = process.env.OSTEOFLOW_PROXY_SECRET

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!OSTEOFLOW_SECRET) {
    return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
  }

  const { id } = await params
  const url = new URL(req.url)
  const upstream = new URL(`${OSTEOUPGRADE_URL}/api/osteoflow/support/${id}/messages`)
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))

  const res = await fetch(upstream.toString(), {
    headers: {
      'Content-Type': 'application/json',
      'x-osteoflow-secret': OSTEOFLOW_SECRET,
      ...getOsteoflowAuthHeaders(),
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!OSTEOFLOW_SECRET) {
    return NextResponse.json({ error: 'Configuration serveur invalide (OSTEOFLOW_PROXY_SECRET manquant)' }, { status: 500 })
  }

  const { id } = await params
  const body = await req.json()

  const res = await fetch(`${OSTEOUPGRADE_URL}/api/osteoflow/support/${id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-osteoflow-secret': OSTEOFLOW_SECRET,
      ...getOsteoflowAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
