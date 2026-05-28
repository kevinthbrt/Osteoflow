import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { header, body, template_name } = await req.json()

    if (!header || !body) {
      return NextResponse.json({ error: 'header et body requis' }, { status: 400 })
    }

    const PDFDocument = (await import('@react-pdf/pdfkit')).default
    const { PassThrough } = await import('stream')

    const pageWidth = 595.28
    const margin = 65
    const contentWidth = pageWidth - margin * 2

    const doc = new PDFDocument({ size: 'A4', margin })
    const stream = new PassThrough()
    const chunks: Buffer[] = []

    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    const done = new Promise<Uint8Array>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })

    doc.pipe(stream)

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#1a1a1a')
      .text(header, { width: contentWidth, lineGap: 1.5 })

    doc.moveDown(2)

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#1a1a1a')
      .text(body, { width: contentWidth, lineGap: 1.5 })

    doc.end()

    const pdfBuffer = await done
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
