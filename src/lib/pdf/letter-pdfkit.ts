import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'

export interface LetterPDFData {
  header: string
  body: string
  template_name?: string
}

const FONT_SIZE = 10
const LINE_H = 14       // pt per visual line (10pt * 1.2 leading + ~2pt gap)
const MAX_CHARS = 82    // chars per line at Helvetica 10pt on 465pt content width

// Word-wrap a paragraph into visual lines of at most MAX_CHARS characters.
// We do this ourselves because @react-pdf/pdfkit ignores \n and lineBreak options.
function wrapParagraph(text: string): string[] {
  if (!text.trim()) return ['']
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= MAX_CHARS) {
      current = candidate
    } else {
      if (current) lines.push(current)
      // A single word longer than MAX_CHARS gets its own line
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export async function generateLetterPdf(data: LetterPDFData): Promise<Uint8Array> {
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 65

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

  // Render a single visual line at explicit (margin, y) — no PDFKit layout magic.
  const renderLine = (text: string) => {
    if (y + LINE_H > pageHeight - margin / 2) return // safety guard
    doc
      .font('Helvetica')
      .fontSize(FONT_SIZE)
      .fillColor('#1a1a1a')
      .text(text || ' ', margin, y, { lineBreak: false })
    y += LINE_H
  }

  // Header: already short lines (address block, date…), no wrapping needed
  for (const line of data.header.split('\n')) {
    renderLine(line)
  }

  // Blank space between header and body
  y += LINE_H * 1.5

  // Body: wrap long paragraphs ourselves, blank lines become a single empty line
  for (const paragraph of data.body.split('\n')) {
    if (!paragraph.trim()) {
      renderLine('') // blank line between paragraphs
    } else {
      for (const visualLine of wrapParagraph(paragraph)) {
        renderLine(visualLine)
      }
    }
  }

  doc.end()
  return done
}
