import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { header, recipient_block, body, closing, template_name } = await req.json()

    if (!body) {
      return NextResponse.json({ error: 'body requis' }, { status: 400 })
    }

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    let stampUrl: string | null = null
    if (user) {
      const { data: practitioner } = await db
        .from('practitioners')
        .select('stamp_url')
        .eq('user_id', user.id)
        .single()
      if (practitioner?.stamp_url) {
        const raw = practitioner.stamp_url as string
        stampUrl = raw.startsWith('/')
          ? new URL(raw, req.nextUrl.origin.replace('://localhost', '://127.0.0.1')).toString()
          : raw
      }
    }

    const { generateLetterPdf } = await import('@/lib/pdf/letter-pdfkit')
    const pdfBuffer = await generateLetterPdf({
      practitioner_lines: (header as string || '').split('\n'),
      recipient_block: recipient_block || null,
      body: body || '',
      closing: closing || null,
      template_name,
      stampUrl,
    })
    const safeName = ((template_name as string) ?? 'courrier').replace(/[^a-z0-9]/gi, '-').toLowerCase()

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[letters/preview/pdf POST]', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Erreur génération PDF', details: msg }, { status: 500 })
  }
}
