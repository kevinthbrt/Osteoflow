import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'

export interface AccountingRecapRow {
  date: string
  count: number
  total: string
  byMethod: Record<string, { count: number; amount: string }>
}

const methodOrder = ['Carte', 'Espèces', 'Chèque', 'Virement', 'Autre']

export interface AccountingPdfData {
  practitionerName: string
  periodLabel: string
  generatedAt: string
  totalRevenue: string
  totalConsultations: number
  revenueByMethod: Record<string, string>
  dailyRecaps: AccountingRecapRow[]
}

export async function generateAccountingPdf(data: AccountingPdfData): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  const pageWidth = 595.28
  const margin = 50
  const contentWidth = pageWidth - margin * 2

  stream.on('data', (chunk) => {
    chunks.push(Buffer.from(chunk))
  })

  const done = new Promise<Uint8Array>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })

  doc.pipe(stream)

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0F172A')
  doc.text('Récapitulatif comptable', margin, 40)

  doc.font('Helvetica').fontSize(10).fillColor('#475569')
  doc.text(data.practitionerName, margin, 66)
  doc.text(data.periodLabel, margin, 82)
  doc.text(`Généré le ${data.generatedAt}`, margin, 98)

  doc
    .moveTo(margin, 120)
    .lineTo(margin + contentWidth, 120)
    .strokeColor('#E2E8F0')
    .stroke()

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A')
  doc.text('Synthèse', margin, 138)

  doc.font('Helvetica').fontSize(10).fillColor('#334155')
  doc.text(`Chiffre d'affaires : ${data.totalRevenue}`, margin, 158)
  doc.text(`Consultations : ${data.totalConsultations}`, margin, 174)

  let summaryY = 198
  doc.font('Helvetica-Bold').text('Répartition par moyen de paiement', margin, summaryY)
  summaryY += 16
  doc.font('Helvetica').fontSize(10)

  for (const [method, amount] of Object.entries(data.revenueByMethod)) {
    doc.text(`${method} : ${amount}`, margin, summaryY)
    summaryY += 14
  }

  let tableY = summaryY + 24
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A')
  doc.text('Détail par jour', margin, tableY)
  tableY += 18

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A')
  doc.text('Date', margin, tableY)
  doc.text('Consult.', margin + 110, tableY)
  doc.text('Total', margin + 170, tableY)
  doc.text('CB', margin + 250, tableY)
  doc.text('Espèces', margin + 310, tableY)
  doc.text('Chèque', margin + 390, tableY)
  doc.text('Virement', margin + 460, tableY)
  doc.text('Autre', margin + 535, tableY)
  tableY += 12

  doc.strokeColor('#E2E8F0')
  doc.moveTo(margin, tableY).lineTo(margin + contentWidth, tableY).stroke()
  tableY += 10

  doc.font('Helvetica').fontSize(9).fillColor('#334155')
  for (const recap of data.dailyRecaps) {
    if (tableY > 760) {
      doc.addPage()
      tableY = 60
    }

    doc.text(recap.date, margin, tableY)
    doc.text(recap.count.toString(), margin + 120, tableY, { width: 40, align: 'left' })
    doc.text(recap.total, margin + 170, tableY)
    const methodAmounts = methodOrder.map((label) => recap.byMethod[label]?.amount || '-')
    doc.text(methodAmounts[0], margin + 250, tableY)
    doc.text(methodAmounts[1], margin + 310, tableY)
    doc.text(methodAmounts[2], margin + 390, tableY)
    doc.text(methodAmounts[3], margin + 460, tableY)
    doc.text(methodAmounts[4], margin + 535, tableY)
    tableY += 14
  }

  doc.end()

  return done
}
