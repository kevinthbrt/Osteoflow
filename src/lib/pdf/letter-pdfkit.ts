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
const FOOTER_FONT_SIZE = 8
const FOOTER_LINE_H = 11

export async function generateLetterPdf(data: LetterPDFData): Promise<Uint8Array> {
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 65
  const contentWidth = pageWidth - margin * 2

  // Reserve space at bottom for tampon footer
  const footerLines = data.practitioner_lines.length
  const footerHeight = FOOTER_LINE_H * footerLines + 16 // separator + lines

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
    const maxY = pageHeight - margin / 2 - footerHeight
    if (y + LINE_H > maxY) return
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(FONT_SIZE)
      .fillColor('#1a1a1a')
      .text(text || ' ', margin, y, { width: contentWidth, lineBreak: false, ...opts })
    y += LINE_H
  }

  // Right-aligned drawLine: computes x so text ends at right margin
  const drawLineRight = (text: string, bold = false) => {
    const maxY = pageHeight - margin / 2 - footerHeight
    if (y + LINE_H > maxY) return
    const font = bold ? 'Helvetica-Bold' : 'Helvetica'
    const tw = doc.font(font).fontSize(FONT_SIZE).widthOfString(text)
    const x = pageWidth - margin - tw
    doc
      .font(font)
      .fontSize(FONT_SIZE)
      .fillColor('#1a1a1a')
      .text(text || ' ', x, y, { lineBreak: false })
    y += LINE_H
  }

  const gap = (n = 1) => { y += LINE_H * n }

  // ── 1. EXPEDITEUR (haut gauche) ──────────────────────────────────────────
  data.practitioner_lines.forEach((line, i) => {
    drawLine(line, i === 0)
  })

  gap(2)

  // ── 2. DESTINATAIRE (aligné à droite) ────────────────────────────────────
  if (data.recipient_block?.trim()) {
    for (const line of data.recipient_block.split('\n')) {
      if (!line.trim()) { gap(); continue }
      drawLineRight(line, true)
    }
    gap(2)
  }

  // ── 3. OBJET + CORPS ─────────────────────────────────────────────────────
  let bodyText = data.body
  const objectMatch = bodyText.match(/^(Objet\s*:.*?)(\n|$)/i)
  if (objectMatch) {
    drawLine(objectMatch[1].trim(), true)
    bodyText = bodyText.slice(objectMatch[0].length).replace(/^\n+/, '')
    gap()
  }

  const maxBodyY = pageHeight - margin / 2 - footerHeight
  for (const paragraph of bodyText.split('\n')) {
    if (!paragraph.trim()) {
      gap()
    } else {
      if (y + LINE_H > maxBodyY) break
      doc
        .font('Helvetica')
        .fontSize(FONT_SIZE)
        .fillColor('#1a1a1a')
        .text(paragraph, margin, y, { width: contentWidth, align: 'justify' })
      y = doc.y
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
        drawLine(line, prevBlank)
        prevBlank = false
      }
    }
  }

  // ── 5. TAMPON EN PIED DE PAGE ─────────────────────────────────────────────
  const footerTop = pageHeight - margin / 2 - footerHeight
  // Separator line
  doc
    .moveTo(margin, footerTop)
    .lineTo(pageWidth - margin, footerTop)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke()

  // Practitioner info centered
  data.practitioner_lines.forEach((line, i) => {
    const font = i === 0 ? 'Helvetica-Bold' : 'Helvetica'
    doc
      .font(font)
      .fontSize(FOOTER_FONT_SIZE)
      .fillColor('#555555')
      .text(line || ' ', margin, footerTop + 8 + i * FOOTER_LINE_H, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      })
  })

  doc.end()
  return done
}
