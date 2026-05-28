import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'

export interface LetterPDFData {
  header: string
  body: string
  template_name?: string
}

export async function generateLetterPdf(data: LetterPDFData): Promise<Uint8Array> {
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
    .text(data.header, { width: contentWidth, lineGap: 1.5 })

  doc.moveDown(2)

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#1a1a1a')
    .text(data.body, { width: contentWidth, lineGap: 1.5 })

  doc.end()

  return done
}
