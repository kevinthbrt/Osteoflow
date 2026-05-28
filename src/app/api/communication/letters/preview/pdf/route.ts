import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { header, body, template_name } = await req.json()

    if (!header || !body) {
      return NextResponse.json({ error: 'header et body requis' }, { status: 400 })
    }

    const { generateLetterPdf } = await import('@/lib/pdf/letter-pdfkit')
    const pdfBuffer = await generateLetterPdf({ header, body, template_name })
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
