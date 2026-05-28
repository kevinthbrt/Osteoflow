import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { generateLetterPdf } = await import('@/lib/pdf/letter-pdfkit')
    const db = await createClient()

    const { data: letter, error } = await db
      .from('generated_letters')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !letter) {
      return NextResponse.json({ error: 'Courrier non trouvé' }, { status: 404 })
    }

    const recipientParts = [letter.recipient_title, letter.recipient_name].filter(Boolean)

    const pdfBuffer = await generateLetterPdf({
      practitioner_lines: (letter.header as string).split('\n'),
      recipient_block: recipientParts.length ? recipientParts.join(' ') : null,
      body: letter.body,
      closing: letter.closing ?? null,
      template_name: letter.template_name,
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
