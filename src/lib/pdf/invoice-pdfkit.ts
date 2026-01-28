import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'
import type { InvoicePDFData } from '@/lib/pdf/invoice-template'

// Palette de couleurs moderne
const colors = {
  primary: '#0F766E', // Teal profond
  primaryLight: '#14B8A6', // Teal clair
  primaryBg: '#F0FDFA', // Fond teal très léger
  dark: '#0F172A', // Slate 900
  text: '#334155', // Slate 700
  textLight: '#64748B', // Slate 500
  textMuted: '#94A3B8', // Slate 400
  border: '#E2E8F0', // Slate 200
  borderLight: '#F1F5F9', // Slate 100
  white: '#FFFFFF',
  success: '#059669', // Emerald 600
}

export async function generateInvoicePdf(data: InvoicePDFData): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  const pageWidth = 595.28
  const pageHeight = 841.89
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

  // ============================================
  // BANDE DÉCORATIVE EN HAUT
  // ============================================
  doc.rect(0, 0, pageWidth, 8).fill(colors.primary)

  // ============================================
  // EN-TÊTE : PRATICIEN (gauche) + TITRE FACTURE (droite)
  // ============================================
  const headerY = 30

  // Nom du praticien - grand et bold
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(colors.dark)
    .text(data.practitionerName, margin, headerY)

  // Spécialité en teal
  let practY = headerY + 24
  if (data.practitionerSpecialty) {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(colors.primary)
      .text(data.practitionerSpecialty, margin, practY)
    practY += 20
  }

  // Infos praticien
  doc.font('Helvetica').fontSize(9).fillColor(colors.textLight)
  if (data.practitionerAddress) {
    doc.text(data.practitionerAddress, margin, practY)
    practY += 12
  }
  if (data.practitionerCityLine) {
    doc.text(data.practitionerCityLine, margin, practY)
    practY += 14
  }
  if (data.practitionerSiret) {
    doc.fontSize(8).fillColor(colors.textMuted).text('SIREN', margin, practY)
    practY += 10
    doc.fontSize(9).fillColor(colors.textLight).text(data.practitionerSiret, margin, practY)
    practY += 14
  }
  if (data.practitionerRpps) {
    doc.fontSize(8).fillColor(colors.textMuted).text('RPPS', margin, practY)
    practY += 10
    doc.fontSize(9).fillColor(colors.textLight).text(data.practitionerRpps, margin, practY)
  }

  // TITRE "REÇU" à droite
  const titleX = pageWidth - margin - 120
  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor(colors.primary)
    .text('RECU', titleX, headerY, { width: 120, align: 'right' })

  // Numéro de facture
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(colors.textMuted)
    .text('N', titleX, headerY + 36, { width: 85, align: 'right', continued: true })
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(colors.dark)
    .text('  ' + data.invoiceNumber, { continued: false })

  // Date et lieu
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(colors.textLight)
    .text(data.locationLine, titleX, headerY + 54, { width: 120, align: 'right' })

  // ============================================
  // SECTION PATIENT - Carte moderne avec bordure accent
  // ============================================
  const patientY = 160
  const patientBoxHeight = 70

  // Fond de la carte patient
  doc.rect(margin, patientY, contentWidth, patientBoxHeight).fill(colors.primaryBg)

  // Bordure accent à gauche
  doc.rect(margin, patientY, 4, patientBoxHeight).fill(colors.primary)

  // Label "ADRESSÉ AU PATIENT"
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(colors.primary)
    .text('ADRESSE AU PATIENT', margin + 20, patientY + 15)

  // Nom du patient
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(colors.dark)
    .text(data.patientName, margin + 20, patientY + 30)

  // Email du patient
  if (data.patientEmail) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.textLight)
      .text(data.patientEmail, margin + 20, patientY + 48)
  }

  // ============================================
  // TABLE DES PRESTATIONS
  // ============================================
  const tableY = patientY + patientBoxHeight + 30
  const tableHeaderHeight = 36
  const tableRowHeight = 50
  const col1Width = contentWidth * 0.6
  const col2Width = contentWidth * 0.15
  const col3Width = contentWidth * 0.25

  // En-tête de table - fond sombre
  doc.roundedRect(margin, tableY, contentWidth, tableHeaderHeight, 6).fill(colors.dark)

  // Textes d'en-tête
  doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.white)
  doc.text('Description', margin + 16, tableY + 13)
  doc.text('Qte', margin + col1Width + 16, tableY + 13, { width: col2Width - 32, align: 'center' })
  doc.text('Montant', margin + col1Width + col2Width, tableY + 13, { width: col3Width - 16, align: 'right' })

  // Ligne de prestation
  const rowY = tableY + tableHeaderHeight + 2
  doc.rect(margin, rowY, contentWidth, tableRowHeight).fill(colors.white)
  doc.rect(margin, rowY + tableRowHeight - 1, contentWidth, 1).fill(colors.borderLight)

  // Titre de la prestation
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(colors.dark)
    .text(data.sessionTypeLabel, margin + 16, rowY + 12)

  // Sous-titre
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(colors.textLight)
    .text('Consultation osteopathique', margin + 16, rowY + 28)

  // Quantité
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(colors.text)
    .text('1', margin + col1Width + 16, rowY + 18, { width: col2Width - 32, align: 'center' })

  // Montant
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(colors.dark)
    .text(data.amount, margin + col1Width + col2Width, rowY + 18, { width: col3Width - 16, align: 'right' })

  // ============================================
  // SECTION TOTAUX
  // ============================================
  const totalsY = rowY + tableRowHeight + 20
  const totalsBoxWidth = 220
  const totalsX = pageWidth - margin - totalsBoxWidth

  // Sous-total HT
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(colors.textLight)
    .text('Sous-total HT', totalsX + 16, totalsY)
  doc
    .fillColor(colors.text)
    .text(data.amount, totalsX + totalsBoxWidth - 16 - 80, totalsY, { width: 80, align: 'right' })

  // TVA
  doc
    .fillColor(colors.textLight)
    .text('TVA (0%)', totalsX + 16, totalsY + 22)
  doc
    .fillColor(colors.text)
    .text('0.00 EUR', totalsX + totalsBoxWidth - 16 - 80, totalsY + 22, { width: 80, align: 'right' })

  // Total TTC - encadré coloré
  const grandTotalY = totalsY + 48
  doc.roundedRect(totalsX, grandTotalY, totalsBoxWidth, 42, 6).fill(colors.primary)

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(colors.white)
    .text('Total TTC', totalsX + 16, grandTotalY + 14)
  doc
    .fontSize(14)
    .text(data.amount, totalsX + totalsBoxWidth - 16 - 100, grandTotalY + 12, { width: 100, align: 'right' })

  // ============================================
  // SECTION PAIEMENT
  // ============================================
  const paymentY = grandTotalY + 60
  const paymentBoxHeight = 90

  // Fond gris clair
  doc.roundedRect(margin, paymentY, contentWidth, paymentBoxHeight, 8).fill(colors.borderLight)

  // Titre
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(colors.dark)
    .text('INFORMATIONS DE PAIEMENT', margin + 20, paymentY + 15)

  // Grille d'informations (2 colonnes)
  const paymentCol1X = margin + 20
  const paymentCol2X = margin + contentWidth / 2

  // Mode de règlement
  doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text('MODE DE REGLEMENT', paymentCol1X, paymentY + 35)
  // Badge pour la méthode de paiement
  const badgeWidth = doc.widthOfString(data.paymentMethod) + 20
  doc.roundedRect(paymentCol1X, paymentY + 47, badgeWidth, 20, 10).fill(colors.success)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.white).text(data.paymentMethod, paymentCol1X + 10, paymentY + 53)

  // Type
  doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text('TYPE', paymentCol2X, paymentY + 35)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text(data.paymentType, paymentCol2X, paymentY + 48)

  // Date du règlement
  doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text('DATE DU REGLEMENT', paymentCol1X, paymentY + 70)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text(data.paymentDate, paymentCol1X, paymentY + 82)

  // Date de facturation
  doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text('DATE DE FACTURATION', paymentCol2X, paymentY + 70)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text(data.invoiceDate, paymentCol2X, paymentY + 82)

  // ============================================
  // CACHET / SIGNATURE
  // ============================================
  if (data.stampUrl) {
    try {
      const response = await fetch(data.stampUrl)
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer())
        const stampY = paymentY + paymentBoxHeight + 20

        // Label
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(colors.textMuted)
          .text('CACHET ET SIGNATURE', pageWidth - margin - 140, stampY, { width: 140, align: 'center' })

        // Image
        doc.image(buffer, pageWidth - margin - 140, stampY + 15, { width: 140 })
      }
    } catch (error) {
      console.warn('Invoice PDF: unable to load stamp image.', error)
    }
  }

  // ============================================
  // FOOTER
  // ============================================
  const footerY = pageHeight - 60

  // Ligne de séparation
  doc.rect(margin, footerY, contentWidth, 1).fill(colors.border)

  // Textes légaux à gauche
  doc.font('Helvetica').fontSize(7).fillColor(colors.textMuted)
  doc.text('TVA non applicable selon article 261, 4-1 du CGI', margin, footerY + 12)
  doc.text('Absence d escompte pour paiement anticipe - En cas de retard, penalites suivant le taux minimum legal en vigueur', margin, footerY + 22)
  doc.text('Indemnite forfaitaire pour frais de recouvrement: 40 euros', margin, footerY + 32)

  // Marque à droite
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(colors.primary)
    .text('Osteoflow', pageWidth - margin - 60, footerY + 20, { width: 60, align: 'right' })

  doc.end()

  return done
}
