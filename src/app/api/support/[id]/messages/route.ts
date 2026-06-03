import { NextRequest, NextResponse } from 'next/server'

const OSTEOUPGRADE_URL = 'https://osteoupgrade.vercel.app'
const OSTEOFLOW_SECRET = process.env.OSTEOFLOW_PROXY_SECRET || 'a8c0fcc6aa558582564131768fd6aa6b0628b84ac0abe494948b088f086be1a6'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(req.url)
  const upstream = new URL(`${OSTEOUPGRADE_URL}/api/osteoflow/support/${id}/messages`)
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))

  const res = await fetch(upstream.toString(), {
    headers: {
      'Content-Type': 'application/json',
      'x-osteoflow-secret': OSTEOFLOW_SECRET,
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const res = await fetch(`${OSTEOUPGRADE_URL}/api/osteoflow/support/${id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-osteoflow-secret': OSTEOFLOW_SECRET,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
