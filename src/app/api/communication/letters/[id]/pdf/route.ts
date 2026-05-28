import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const PDFDocument = (await import('@react-pdf/pdfkit')).default
    const { PassThrough } = await import('stream')
    const db = await createClient()

    const { data: letter, error } = await db
      .from('generated_letters')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !letter) {
      return NextResponse.json({ error: 'Courrier non trouvé' }, { status: 404 })
    }

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

    // En-tête (bloc praticien + date + destinataire)
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#1a1a1a')
      .text(letter.header, { width: contentWidth, lineGap: 1.5 })

    doc.moveDown(2)

    // Corps du courrier
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#1a1a1a')
      .text(letter.body, { width: contentWidth, lineGap: 1.5 })

    doc.end()

    const pdfBuffer = await done
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
