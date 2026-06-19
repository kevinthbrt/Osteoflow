import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'

export interface LetterPDFData {
  practitioner_lines: string[]   // practitioner block split by \n
  recipient_block?: string | null // "Dr. Dupont" or null
  body: string                   // letter body (may start with "Objet : …")
  closing?: string | null        // "Fait à City, le Date\n\nNom\nSpécialité"
  template_name?: string
  stampUrl?: string | null       // absolute URL to stamp image
}

const FONT_SIZE = 10
const LINE_H = 14     // pt per visual line

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

  // Right-aligned: computes x so text ends at right margin
  const drawLineRight = (text: string, bold = false) => {
    if (y + LINE_H > pageHeight - margin / 2) return
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

  // Justified paragraph rendering: manually place each word at precise x
  const drawJustifiedParagraph = (text: string) => {
    const words = text.split(' ').filter((w) => w.length > 0)
    if (words.length === 0) return

    doc.font('Helvetica').fontSize(FONT_SIZE)
    const spaceW = doc.widthOfString(' ')

    const lines: string[][] = []
    let cur: string[] = []
    let curW = 0
    for (const word of words) {
      const ww = doc.widthOfString(word)
      const needed = cur.length > 0 ? spaceW + ww : ww
      if (cur.length > 0 && curW + needed > contentWidth + 0.5) {
        lines.push(cur)
        cur = [word]
        curW = ww
      } else {
        cur.push(word)
        curW += needed
      }
    }
    if (cur.length > 0) lines.push(cur)

    for (let li = 0; li < lines.length; li++) {
      if (y + LINE_H > pageHeight - margin / 2) break
      const lineWords = lines[li]
      const isLast = li === lines.length - 1

      if (isLast || lineWords.length === 1) {
        doc.font('Helvetica').fontSize(FONT_SIZE).fillColor('#1a1a1a')
          .text(lineWords.join(' '), margin, y, { lineBreak: false })
      } else {
        const totalWordW = lineWords.reduce((s, w) => s + doc.widthOfString(w), 0)
        const wordGap = (contentWidth - totalWordW) / (lineWords.length - 1)
        let x = margin
        for (const word of lineWords) {
          doc.font('Helvetica').fontSize(FONT_SIZE).fillColor('#1a1a1a')
            .text(word, x, y, { lineBreak: false })
          x += doc.widthOfString(word) + wordGap
        }
      }
      y += LINE_H
    }
  }

  for (const paragraph of bodyText.split('\n')) {
    if (!paragraph.trim()) {
      gap()
    } else {
      if (y + LINE_H > pageHeight - margin / 2) break
      drawJustifiedParagraph(paragraph)
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

  // ── 5. TAMPON (image, bas droite) ────────────────────────────────────────
  if (data.stampUrl) {
    try {
      const response = await fetch(data.stampUrl)
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        const stampWidth = 140
        const stampX = pageWidth - margin - stampWidth
        const stampY = pageHeight - margin - 100
        doc.image(buffer, stampX, stampY, { width: stampWidth })
      }
    } catch (error) {
      console.warn('Letter PDF: unable to load stamp image.', error)
    }
  }

  doc.end()
  return done
}
