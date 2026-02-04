// Use eval('require') to bypass Turbopack's module name hashing.
// See invoice-pdfkit.ts for detailed explanation.
// eslint-disable-next-line no-eval
const _require = eval('require') as NodeRequire
const PDFDocument = (_require('@react-pdf/pdfkit').default ?? _require('@react-pdf/pdfkit')) as typeof import('@react-pdf/pdfkit')['default']

import { PassThrough } from 'stream'

export interface AccountingRecapRow {
  date: string
  count: number
  total: string
  byMethod: Record<string, { count: number; amount: string }>
  checkNumbers?: string[]
}

const methodOrder = ['Carte', 'Espèces', 'Chèque', 'Virement']

const normalizeAmount = (value: string) => value.replace(/\s/g, '\u00A0')

export interface AccountingPdfData {
  practitionerName: string
  periodLabel: string
  generatedAt: string
  totalRevenue: string
  totalConsultations: number
  revenueByMethod: Record<string, string>
  dailyRecaps: AccountingRecapRow[]
  checkNumbers?: string[]
}

// Colors
const PRIMARY = '#1e40af'
const DARK = '#0f172a'
const TEXT = '#334155'
const MUTED = '#64748b'
const LIGHT_BG = '#f1f5f9'
const BORDER = '#e2e8f0'
const WHITE = '#ffffff'

function drawRoundedRect(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillColor: string
) {
  doc
    .save()
    .fillColor(fillColor)
    .moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y)
    .fill()
    .restore()
}

export async function generateAccountingPdf(data: AccountingPdfData): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  const pageWidth = 595.28
  const margin = 40
  const contentWidth = pageWidth - margin * 2

  stream.on('data', (chunk) => {
    chunks.push(Buffer.from(chunk))
  })

  const done = new Promise<Uint8Array>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })

  doc.pipe(stream)

  // ── Header bar ──
  drawRoundedRect(doc, margin, 30, contentWidth, 70, 8, PRIMARY)

  doc.font('Helvetica-Bold').fontSize(20).fillColor(WHITE)
  doc.text('Récapitulatif Comptable', margin + 20, 45)
  doc.font('Helvetica').fontSize(10).fillColor(WHITE).opacity(0.85)
  doc.text(data.practitionerName, margin + 20, 72)
  doc.opacity(1)

  // ── Period & date ──
  let y = 115
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
  doc.text(data.periodLabel, margin, y)
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
  doc.text(`Généré le ${data.generatedAt}`, margin, y + 14, {
    width: contentWidth,
    align: 'right',
  })
  y += 34

  // ── Summary cards ──
  const cardW = (contentWidth - 20) / 3
  const cardH = 60
  const cards = [
    { label: "Chiffre d'affaires", value: normalizeAmount(data.totalRevenue) },
    { label: 'Consultations', value: data.totalConsultations.toString() },
    {
      label: 'Panier moyen',
      value:
        data.totalConsultations > 0
          ? normalizeAmount(data.totalRevenue) // approximation — callers already format
          : '0,00 €',
    },
  ]

  // Calculate average from total revenue
  const revenueNum = parseFloat(
    data.totalRevenue
      .replace(/[^\d,.-]/g, '')
      .replace(',', '.')
  )
  if (!isNaN(revenueNum) && data.totalConsultations > 0) {
    const avg = revenueNum / data.totalConsultations
    cards[2].value = avg.toFixed(2).replace('.', ',') + ' €'
  }

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + 10)
    drawRoundedRect(doc, x, y, cardW, cardH, 6, LIGHT_BG)
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    doc.text(card.label, x + 12, y + 12, { width: cardW - 24 })
    doc.font('Helvetica-Bold').fontSize(16).fillColor(DARK)
    doc.text(card.value, x + 12, y + 28, { width: cardW - 24 })
  })
  y += cardH + 20

  // ── Payment method breakdown ──
  drawRoundedRect(doc, margin, y, contentWidth, 24, 4, DARK)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
  doc.text('Répartition par mode de paiement', margin + 12, y + 7)
  y += 32

  const methodEntries = Object.entries(data.revenueByMethod)
  const methodColW = contentWidth / Math.max(methodEntries.length, 1)

  methodEntries.forEach(([method, amount], i) => {
    const x = margin + i * methodColW
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    doc.text(method, x + 8, y, { width: methodColW - 16 })
    doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT)
    doc.text(normalizeAmount(amount), x + 8, y + 14, { width: methodColW - 16 })
  })
  y += 38

  // ── Separator ──
  doc.strokeColor(BORDER).lineWidth(0.5)
  doc.moveTo(margin, y).lineTo(margin + contentWidth, y).stroke()
  y += 16

  // ── Table header ──
  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
  doc.text('Détail par jour', margin, y)
  y += 20

  const colWidths = [90, 55, 75, 70, 70, 70, 70]
  const colX = [margin]
  for (let i = 1; i < colWidths.length; i++) {
    colX.push(colX[i - 1] + colWidths[i - 1])
  }

  const headers = ['Date', 'Consult.', 'Total', 'CB', 'Espèces', 'Chèque', 'Virement']

  // Table header row
  drawRoundedRect(doc, margin, y, contentWidth, 22, 4, DARK)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
  headers.forEach((h, i) => {
    const align = i >= 2 ? 'right' : 'left'
    const textX = i >= 2 ? colX[i] - 4 : colX[i] + 8
    const width = i >= 2 ? colWidths[i] - 4 : colWidths[i] - 8
    doc.text(h, textX, y + 7, { width, align })
  })
  y += 28

  // ── Table rows ──
  let rowIndex = 0
  for (const recap of data.dailyRecaps) {
    if (y > 750) {
      doc.addPage()
      y = 50
      // Re-draw header on new page
      drawRoundedRect(doc, margin, y, contentWidth, 22, 4, DARK)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
      headers.forEach((h, i) => {
        const align = i >= 2 ? 'right' : 'left'
        const textX = i >= 2 ? colX[i] - 4 : colX[i] + 8
        const width = i >= 2 ? colWidths[i] - 4 : colWidths[i] - 8
        doc.text(h, textX, y + 7, { width, align })
      })
      y += 28
      rowIndex = 0
    }

    // Alternating row background
    if (rowIndex % 2 === 0) {
      drawRoundedRect(doc, margin, y - 2, contentWidth, 18, 2, LIGHT_BG)
    }

    doc.font('Helvetica').fontSize(8).fillColor(TEXT)
    doc.text(recap.date, colX[0] + 8, y + 2, { width: colWidths[0] - 8 })
    doc.text(recap.count.toString(), colX[1] + 8, y + 2, { width: colWidths[1] - 8 })

    doc.font('Helvetica-Bold').fillColor(DARK)
    doc.text(normalizeAmount(recap.total), colX[2] - 4, y + 2, { width: colWidths[2] - 4, align: 'right' })

    doc.font('Helvetica').fillColor(TEXT)
    const methodAmounts = methodOrder.map((label) => recap.byMethod[label]?.amount || '-')
    methodAmounts.forEach((amt, i) => {
      doc.text(normalizeAmount(amt), colX[3 + i] - 4, y + 2, { width: colWidths[3 + i] - 4, align: 'right' })
    })

    y += 18
    rowIndex++
  }

  // ── Total row ──
  y += 4
  drawRoundedRect(doc, margin, y - 2, contentWidth, 22, 4, PRIMARY)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
  doc.text('TOTAL', colX[0] + 8, y + 4, { width: colWidths[0] - 8 })
  doc.text(data.totalConsultations.toString(), colX[1] + 8, y + 4, { width: colWidths[1] - 8 })
  doc.text(normalizeAmount(data.totalRevenue), colX[2] - 4, y + 4, { width: colWidths[2] - 4, align: 'right' })

  methodOrder.forEach((label, i) => {
    const amount = data.revenueByMethod[label] || '0,00 €'
    doc.text(normalizeAmount(amount), colX[3 + i] - 4, y + 4, { width: colWidths[3 + i] - 4, align: 'right' })
  })
  y += 32

  // ── Check numbers section ──
  if (data.checkNumbers && data.checkNumbers.length > 0) {
    if (y > 700) {
      doc.addPage()
      y = 50
    }

    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
    doc.text('Détail des chèques', margin, y)
    y += 18

    drawRoundedRect(doc, margin, y, contentWidth, 22, 4, LIGHT_BG)
    doc.font('Helvetica').fontSize(9).fillColor(TEXT)

    const checkColW = contentWidth / 3
    data.checkNumbers.forEach((checkNum, i) => {
      const colIndex = i % 3
      if (i > 0 && colIndex === 0) {
        y += 22
        if (y > 750) {
          doc.addPage()
          y = 50
        }
        if ((Math.floor(i / 3)) % 2 === 0) {
          drawRoundedRect(doc, margin, y, contentWidth, 22, 2, LIGHT_BG)
        }
      }
      doc.text(checkNum, margin + colIndex * checkColW + 8, y + 5, {
        width: checkColW - 16,
      })
    })
    y += 30
  }

  // ── Footer ──
  const footerY = 800
  doc.strokeColor(BORDER).lineWidth(0.5)
  doc.moveTo(margin, footerY).lineTo(margin + contentWidth, footerY).stroke()
  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
  doc.text('Document généré automatiquement par Osteoflow', margin, footerY + 6)
  doc.text('Récapitulatif comptable - Document non contractuel', margin, footerY + 6, {
    width: contentWidth,
    align: 'right',
  })

  doc.end()

  return done
}
