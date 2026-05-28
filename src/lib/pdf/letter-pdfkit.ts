import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'

export interface LetterPDFData {
  practitioner_lines: string[]   // practitioner block split by \n
  recipient_block?: string | null // "Dr. Dupont" or null
  body: string                   // letter body (may start with "Objet : …")
  closing?: string | null        // "Fait à City, le Date\n\nNom\nSpécialité"
  template_name?: string
}

const FONT_SIZE = 10
const LINE_H = 14     // pt per visual line
const MAX_CHARS = 82  // chars/line at Helvetica 10pt on 465pt

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

  const drawLine = (
    text: string,
    bold = false,
    opts: Record<string, unknown> = {},
  ) => {
    if (y + LINE_H > pageHeight - margin / 2) return
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(FONT_SIZE)
      .fillColor('#1a1a1a')
      .text(text || ' ', margin, y, { width: contentWidth, lineBreak: false, ...opts })
    y += LINE_H
  }

  const gap = (n = 1) => { y += LINE_H * n }

  // ── 1. EXPEDITEUR (haut gauche) ──────────────────────────────────────────
  data.practitioner_lines.forEach((line, i) => {
    drawLine(line, i === 0) // nom en gras
  })

  gap(2)

  // ── 2. DESTINATAIRE (aligné à droite) ────────────────────────────────────
  if (data.recipient_block?.trim()) {
    for (const line of data.recipient_block.split('\n')) {
      if (!line.trim()) { gap(); continue }
      drawLine(line, true, { align: 'right' })
    }
    gap(2)
  }

  // ── 3. OBJET + CORPS ─────────────────────────────────────────────────────
  let bodyText = data.body
  const objectMatch = bodyText.match(/^(Objet\s*:.*?)(\n|$)/i)
  if (objectMatch) {
    drawLine(objectMatch[1].trim(), true) // "Objet : …" en gras
    bodyText = bodyText.slice(objectMatch[0].length).replace(/^\n+/, '')
    gap()
  }

  for (const paragraph of bodyText.split('\n')) {
    if (!paragraph.trim()) {
      gap()
    } else {
      for (const visualLine of wrapParagraph(paragraph)) {
        drawLine(visualLine)
      }
    }
  }

  // ── 4. CLOSING (Fait à…, puis nom/spécialité) ────────────────────────────
  if (data.closing?.trim()) {
    gap(2)
    let prevBlank = false
    for (const line of data.closing.split('\n')) {
      if (!line.trim()) {
        gap()
        prevBlank = true
      } else {
        drawLine(line, prevBlank) // ligne après saut = nom → gras
        prevBlank = false
      }
    }
  }

  doc.end()
  return done
}
