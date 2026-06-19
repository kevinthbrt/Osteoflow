import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { generateLetterPdf } = await import('@/lib/pdf/letter-pdfkit')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const [{ data: letter, error }, { data: practitioner }] = await Promise.all([
      db.from('generated_letters').select('*').eq('id', id).single(),
      db.from('practitioners').select('stamp_url').eq('user_id', user.id).single(),
    ])

    if (error || !letter) {
      return NextResponse.json({ error: 'Courrier non trouvé' }, { status: 404 })
    }

    let stampUrl: string | null = null
    if (practitioner?.stamp_url) {
      const raw = practitioner.stamp_url as string
      stampUrl = raw.startsWith('/')
        ? new URL(raw, req.nextUrl.origin).toString()
        : raw
    }

    const recipientParts = [letter.recipient_title, letter.recipient_name].filter(Boolean)

    const pdfBuffer = await generateLetterPdf({
      practitioner_lines: (letter.header as string).split('\n'),
      recipient_block: recipientParts.length ? recipientParts.join(' ') : null,
      body: letter.body,
      closing: letter.closing ?? null,
      template_name: letter.template_name,
      stampUrl,
    })
    const safeName = (letter.template_name ?? 'courrier').replace(/[^a-z0-9]/gi, '-').toLowerCase()

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[letters/pdf GET]', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Erreur génération PDF', details: msg }, { status: 500 })
  }
}
