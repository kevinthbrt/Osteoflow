import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'
import type { InvoicePDFData } from '@/lib/pdf/invoice-template'

export async function generateInvoicePdf(data: InvoicePDFData): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  const pageWidth = 595.28
  const margin = 40

  stream.on('data', (chunk) => {
    chunks.push(Buffer.from(chunk))
  })

  const done = new Promise<Uint8Array>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })

  doc.pipe(stream)

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1F2937').text(data.practitionerName)
  doc.font('Helvetica').fontSize(10).fillColor('#6B7280')
  if (data.practitionerSpecialty) doc.text(data.practitionerSpecialty)
  if (data.practitionerAddress) doc.text(data.practitionerAddress)
  if (data.practitionerCityLine) doc.text(data.practitionerCityLine)
  if (data.practitionerSiret) doc.text(`N SIREN: ${data.practitionerSiret}`)
  if (data.practitionerRpps) doc.text(`N RPPS: ${data.practitionerRpps}`)

  doc
    .fillColor('#10B981')
    .roundedRect(pageWidth - margin - 220, 40, 220, 44, 4)
    .fill()
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(data.patientName, pageWidth - margin - 210, 52)
  if (data.patientEmail) {
    doc.font('Helvetica').fontSize(8).text(data.patientEmail, pageWidth - margin - 210, 66)
  }

  doc.fillColor('#10B981').fontSize(9).text(data.locationLine, pageWidth - margin - 200, 96)

  doc.fillColor('#1F2937').fontSize(12).font('Helvetica').text('Recu d honoraires n', margin, 140)
  doc.fillColor('#10B981').font('Helvetica-Bold').text(data.invoiceNumber, margin + 160, 140)

  doc.fillColor('#6B7280').fontSize(9).font('Helvetica-Bold').text('DESCRIPTION', margin, 180)
  doc.text('MONTANT', pageWidth - margin - 80, 180)

  doc
    .fillColor('#1F2937')
    .fontSize(10)
    .font('Helvetica')
    .text(`Type de séance - ${data.sessionTypeLabel}`, margin, 200)
  doc.fillColor('#10B981').font('Helvetica-Bold').text(data.amount, pageWidth - margin - 80, 200)

  doc.fillColor('#1F2937').fontSize(11).font('Helvetica-Bold').text('Somme a regler', pageWidth - margin - 200, 250)
  doc.fillColor('#10B981').text(data.amount, pageWidth - margin - 80, 250)

  doc.fillColor('#6B7280').fontSize(9).font('Helvetica').text('Reglement', pageWidth - margin - 200, 290)
  doc.fillColor('#10B981').font('Helvetica-Bold').text(data.paymentMethod, pageWidth - margin - 80, 290)
  doc.fillColor('#6B7280').font('Helvetica').text('Type de reglement', pageWidth - margin - 200, 304)
  doc.fillColor('#1F2937').font('Helvetica').text(data.paymentType, pageWidth - margin - 80, 304)
  doc.fillColor('#6B7280').font('Helvetica').text('Date du reglement', pageWidth - margin - 200, 318)
  doc.fillColor('#1F2937').font('Helvetica').text(data.paymentDate, pageWidth - margin - 80, 318)
  doc.fillColor('#6B7280').font('Helvetica').text('Date de facturation', pageWidth - margin - 200, 332)
  doc.fillColor('#1F2937').font('Helvetica').text(data.invoiceDate, pageWidth - margin - 80, 332)

  if (data.stampUrl) {
    try {
      const response = await fetch(data.stampUrl)
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer())
        doc.image(buffer, pageWidth - margin - 140, 650, { width: 120 })
      }
    } catch (error) {
      console.warn('Invoice PDF: unable to load stamp image.', error)
    }
  }

  doc.fillColor('#9CA3AF').fontSize(7).font('Helvetica')
  doc.text('TVA non applicable selon article 261, 4-1 du CGI', margin, 780)
  doc.text('Absence d escompte pour paiement anticipe', margin, 790)
  doc.text('En cas de retard, penalites suivant le taux minimum legal en vigueur', margin, 800)
  doc.text('Indemnite forfaitaire pour frais de recouvrement: 40 euros', margin, 810)

  doc.end()

  return done
}
