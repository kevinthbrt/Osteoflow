import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'openai_api_key'")
      .get() as { value: string } | undefined
    const key = row?.value ?? null
    return NextResponse.json({
      configured: !!key,
      preview: key ? `sk-...${key.slice(-4)}` : null,
    })
  } catch {
    return NextResponse.json({ configured: false, preview: null })
  }
}

export async function POST(req: Request) {
  try {
    const { key } = await req.json()
    const db = getDatabase()
    if (key) {
      db.prepare(
        "INSERT INTO app_config (key, value) VALUES ('openai_api_key', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(key.trim())
    } else {
      db.prepare("DELETE FROM app_config WHERE key = 'openai_api_key'").run()
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const db = getDatabase()
    db.prepare("DELETE FROM app_config WHERE key = 'openai_api_key'").run()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
