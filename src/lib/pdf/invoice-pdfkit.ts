import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'
import type { InvoicePDFData } from '@/lib/pdf/invoice-template'

export async function generateInvoicePdf(data: InvoicePDFData): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const stream = new PassThrough()
  const chunks: Buffer[] = []

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
    .roundedRect(330, 40, 220, 40, 4)
    .fill()
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(data.patientName, 340, 50)
  if (data.patientEmail) {
    doc.font('Helvetica').fontSize(8).text(data.patientEmail, 340, 64)
  }

  doc.fillColor('#10B981').fontSize(9).text(data.locationLine, 350, 92)

  doc.fillColor('#1F2937').fontSize(12).font('Helvetica').text('Recu d honoraires n', 40, 140)
  doc.fillColor('#10B981').font('Helvetica-Bold').text(data.invoiceNumber, 200, 140)

  doc.fillColor('#6B7280').fontSize(9).font('Helvetica-Bold').text('DESCRIPTION', 40, 180)
  doc.text('MONTANT', 470, 180)

  doc.fillColor('#1F2937').fontSize(10).font('Helvetica').text(`Seance du jour - ${data.reason}`, 40, 200)
  doc.fillColor('#10B981').font('Helvetica-Bold').text(data.amount, 470, 200)

  doc.fillColor('#1F2937').fontSize(11).font('Helvetica-Bold').text('Somme a regler', 330, 250)
  doc.fillColor('#10B981').text(data.amount, 470, 250)

  doc.fillColor('#6B7280').fontSize(9).font('Helvetica').text('Reglement', 330, 290)
  doc.fillColor('#10B981').font('Helvetica-Bold').text(data.paymentMethod, 470, 290)
  doc.fillColor('#6B7280').font('Helvetica').text('Type de reglement', 330, 304)
  doc.fillColor('#1F2937').font('Helvetica').text(data.paymentType, 470, 304)
  doc.fillColor('#6B7280').font('Helvetica').text('Date du reglement', 330, 318)
  doc.fillColor('#1F2937').font('Helvetica').text(data.paymentDate, 470, 318)
  doc.fillColor('#6B7280').font('Helvetica').text('Date de facturation', 330, 332)
  doc.fillColor('#1F2937').font('Helvetica').text(data.invoiceDate, 470, 332)

  doc.fillColor('#9CA3AF').fontSize(7).font('Helvetica')
  doc.text('TVA non applicable selon article 261, 4-1 du CGI', 40, 780)
  doc.text('Absence d escompte pour paiement anticipe', 40, 790)
  doc.text('En cas de retard, penalites suivant le taux minimum legal en vigueur', 40, 800)
  doc.text('Indemnite forfaitaire pour frais de recouvrement: 40 euros', 40, 810)

  doc.end()

  return done
}
