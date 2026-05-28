import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'

export interface LetterPDFData {
  header: string
  body: string
  template_name?: string
}

const FONT_SIZE = 10
const LINE_HEIGHT = 14.5  // 10pt * 1.2 leading + 2.5 gap
const CHARS_PER_LINE = 85 // approx. at 10pt Helvetica on 465pt content width

export async function generateLetterPdf(data: LetterPDFData): Promise<Uint8Array> {
  const pageWidth = 595.28
  const pageHeight = 841.89
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

  let y = margin

  // Render one "paragraph" at explicit (margin, y).
  // wrap=false for header lines (always short, lineBreak off).
  // wrap=true for body paragraphs (may span multiple visual lines).
  const renderLine = (text: string, wrap: boolean) => {
    if (y > pageHeight - margin) return
    doc
      .font('Helvetica')
      .fontSize(FONT_SIZE)
      .fillColor('#1a1a1a')
      .text(text.length > 0 ? text : ' ', margin, y, {
        width: contentWidth,
        lineBreak: wrap,
      })
    // Advance Y: for wrapped text estimate visual line count from char length.
    const visualLines = wrap && text.length > 0
      ? Math.max(1, Math.ceil(text.length / CHARS_PER_LINE))
      : 1
    y += LINE_HEIGHT * visualLines
  }

  // Header — short lines, no wrapping needed
  for (const line of data.header.split('\n')) {
    renderLine(line, false)
  }

  y += LINE_HEIGHT * 2 // blank space between header and body

  // Body — paragraphs can be long
  for (const line of data.body.split('\n')) {
    renderLine(line, true)
  }

  doc.end()
  return done
}
