import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'
import type { ExercisePrescriptionItem } from '@/types/exercise'

const colors = {
  primary: '#0F766E',
  primaryLight: '#14B8A6',
  primaryBg: '#F0FDFA',
  dark: '#0F172A',
  text: '#334155',
  textLight: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  white: '#FFFFFF',
}

export interface ExercisePdfData {
  practitionerName: string
  practitionerSpecialty?: string
  practitionerAddress?: string
  practitionerCityLine?: string
  patientName: string
  prescriptionTitle: string
  prescriptionDate: string
  notes?: string
  items: ExercisePrescriptionItem[]
}

// @react-pdf/pdfkit doesn't expose heightOfString — estimate manually.
// Helvetica average char width ≈ fontSize × 0.55, line height ≈ fontSize × 1.4
function estimateTextHeight(text: string, fontSize: number, width: number): number {
  const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.55)))
  const lines = text.split('\n').reduce((total, line) => {
    return total + Math.max(1, Math.ceil((line.length || 1) / charsPerLine))
  }, 0)
  return lines * fontSize * 1.4
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55
}

export async function generateExercisePdf(data: ExercisePdfData): Promise<Uint8Array> {
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

  // Teal header band
  doc.rect(0, 0, pageWidth, 8).fill(colors.primary)

  // Header: practitioner left, title right
  const headerY = 30

  doc.font('Helvetica-Bold').fontSize(18).fillColor(colors.dark).text(data.practitionerName, margin, headerY)

  let practY = headerY + 24
  if (data.practitionerSpecialty) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.primary).text(data.practitionerSpecialty, margin, practY)
    practY += 20
  }

  doc.font('Helvetica').fontSize(9).fillColor(colors.textLight)
  if (data.practitionerAddress) {
    doc.text(data.practitionerAddress, margin, practY)
    practY += 12
  }
  if (data.practitionerCityLine) {
    doc.text(data.practitionerCityLine, margin, practY)
  }

  const titleX = pageWidth - margin - 180
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(colors.primary)
    .text("PROGRAMME D'EXERCICES", titleX, headerY, { width: 180, align: 'right' })

  // Patient card
  const patientY = 140
  const patientBoxHeight = 60

  doc.rect(margin, patientY, contentWidth, patientBoxHeight).fill(colors.primaryBg)
  doc.rect(margin, patientY, 4, patientBoxHeight).fill(colors.primary)

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(colors.primary)
    .text('PATIENT', margin + 20, patientY + 12)

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(colors.dark)
    .text(data.patientName, margin + 20, patientY + 26)

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(colors.textLight)
    .text(data.prescriptionDate, pageWidth - margin - 120, patientY + 12, { width: 120, align: 'right' })

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(colors.dark)
    .text(data.prescriptionTitle, pageWidth - margin - 200, patientY + 28, { width: 200, align: 'right' })

  let currentY = patientY + patientBoxHeight + 20

  if (data.notes) {
    doc.font('Helvetica').fontSize(9).fillColor(colors.textLight).text(data.notes, margin, currentY, {
      width: contentWidth,
    })
    currentY = doc.y + 12
  }

  // Pre-fetch all illustration images
  const imageBuffers = new Map<string, Buffer>()
  for (const item of data.items) {
    if (item.illustration_url) {
      try {
        const imgRes = await fetch(item.illustration_url, { signal: AbortSignal.timeout(5000) })
        if (imgRes.ok) {
          imageBuffers.set(item.illustration_url, Buffer.from(await imgRes.arrayBuffer()))
        }
      } catch {
        // skip missing images
      }
    }
  }

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    const imgSize = 60

    // Estimate card height for page break detection
    const hasIllustration = !!(item.illustration_url && imageBuffers.has(item.illustration_url))
    const descWidth = contentWidth - imgSize - 50
    const descHeight = estimateTextHeight(item.exercise_description, 9, descWidth)
    let estimatedHeight = 40 + Math.max(hasIllustration ? imgSize : 0, descHeight + 30)
    if (item.sets || item.reps || item.hold_time || item.rest_time || item.frequency) {
      estimatedHeight += 18
    }
    if (item.notes) {
      estimatedHeight += estimateTextHeight(item.notes, 8, descWidth) + 6
    }
    estimatedHeight += 28 // separator + padding

    const footerReserve = 60
    if (currentY + estimatedHeight > pageHeight - footerReserve && i > 0) {
      doc.addPage()
      doc.rect(0, 0, pageWidth, 8).fill(colors.primary)
      currentY = 30
    }

    const cardStartY = currentY

    // Number badge (circle)
    doc.circle(margin + 12, cardStartY + 12, 12).fill(colors.primary)
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.white)
      .text(String(i + 1), margin + 6, cardStartY + 7, { width: 12, align: 'center' })

    // Exercise name
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(colors.dark)
      .text(item.exercise_name, margin + 30, cardStartY + 5)

    // Region + type badges
    const badgeY = cardStartY + 21
    let badgeX = margin + 30

    const regionText = item.exercise_region
    const regionWidth = Math.ceil(estimateTextWidth(regionText, 8)) + 16
    doc.roundedRect(badgeX, badgeY, regionWidth, 14, 7).fill(colors.primaryBg)
    doc.rect(badgeX, badgeY, 3, 14).fill(colors.primary)
    doc.font('Helvetica').fontSize(8).fillColor(colors.primary).text(regionText, badgeX + 6, badgeY + 3, { width: regionWidth - 9 })
    badgeX += regionWidth + 6

    const typeText = item.exercise_type
    const typeWidth = Math.ceil(estimateTextWidth(typeText, 8)) + 16
    doc.roundedRect(badgeX, badgeY, typeWidth, 14, 7).fill(colors.borderLight)
    doc.font('Helvetica').fontSize(8).fillColor(colors.textLight).text(typeText, badgeX + 8, badgeY + 3, { width: typeWidth - 16 })

    // Illustration or letter placeholder
    const imgAreaX = pageWidth - margin - imgSize
    const imgAreaY = cardStartY

    const imgBuffer = item.illustration_url ? imageBuffers.get(item.illustration_url) : undefined
    if (imgBuffer) {
      try {
        doc.image(imgBuffer, imgAreaX, imgAreaY, { width: imgSize, height: imgSize })
      } catch {
        drawPlaceholder(doc, imgAreaX, imgAreaY, imgSize, item.exercise_type, colors)
      }
    } else {
      drawPlaceholder(doc, imgAreaX, imgAreaY, imgSize, item.exercise_type, colors)
    }

    // Description
    const descX = margin + 30
    const descY = badgeY + 20
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.text)
      .text(item.exercise_description, descX, descY, { width: descWidth })

    // Use doc.y after text draw to track position accurately
    currentY = doc.y + 8

    // Parameters line
    const params: string[] = []
    if (item.sets != null && item.reps) {
      params.push(`${item.sets}×${item.reps}`)
    } else if (item.sets != null) {
      params.push(`${item.sets} séries`)
    } else if (item.reps) {
      params.push(item.reps)
    }
    if (item.hold_time != null) params.push(`Maintien : ${item.hold_time}s`)
    if (item.rest_time != null) params.push(`Repos : ${item.rest_time}s`)
    if (item.frequency) params.push(item.frequency)

    if (params.length > 0) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(colors.primary)
        .text(params.join('  •  '), descX, currentY, { width: descWidth })
      currentY = doc.y + 4
    }

    if (item.notes) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(colors.textMuted)
        .text(item.notes, descX, currentY, { width: descWidth })
      currentY = doc.y + 4
    }

    // Ensure we're below the illustration area
    currentY = Math.max(currentY, cardStartY + imgSize + 4)
    currentY += 12

    // Separator between exercises
    if (i < data.items.length - 1) {
      doc.rect(margin, currentY, contentWidth, 0.5).fill(colors.border)
      currentY += 16
    }
  }

  // Footer
  const footerY = pageHeight - 50
  doc.rect(margin, footerY, contentWidth, 1).fill(colors.border)

  doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted)
  const footerParts: string[] = [data.practitionerName]
  if (data.practitionerCityLine) footerParts.push(data.practitionerCityLine)
  doc.text(footerParts.join('  •  '), margin, footerY + 10)

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(colors.primary)
    .text('Programme généré par Osteoflow', pageWidth - margin - 150, footerY + 10, {
      width: 150,
      align: 'right',
    })

  doc.end()

  return done
}

function drawPlaceholder(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  size: number,
  type: string,
  colors: Record<string, string>
) {
  doc.rect(x, y, size, size).fill(colors.primaryBg)
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(colors.primary)
    .text(type.charAt(0).toUpperCase(), x, y + size / 2 - 13, { width: size, align: 'center' })
}
