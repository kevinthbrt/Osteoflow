import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'
import type { ExercisePrescriptionItem } from '@/types/exercise'

const C = {
  primary: '#0F766E',
  primaryLight: '#14B8A6',
  primaryBg: '#F0FDFA',
  primaryBgDark: '#CCFBF1',
  dark: '#0F172A',
  text: '#1E293B',
  textLight: '#64748B',
  textMuted: '#94A3B8',
  border: '#CBD5E1',
  borderLight: '#E2E8F0',
  white: '#FFFFFF',
  paramBg: '#F0FDFA',
}

const SP = { xs: 4, s: 8, m: 14, l: 22, xl: 32 }

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

// Helvetica avg char width ≈ fontSize × 0.55, line height ≈ fontSize × 1.5
function estimateTextHeight(text: string, fontSize: number, width: number): number {
  const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.55)))
  const lines = text.split('\n').reduce((total, line) => {
    return total + Math.max(1, Math.ceil((line.length || 1) / charsPerLine))
  }, 0)
  return lines * fontSize * 1.5
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58
}

export async function generateExercisePdf(data: ExercisePdfData): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  const PW = 595.28
  const PH = 841.89
  const ML = 48
  const MR = 48
  const CW = PW - ML - MR

  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  const done = new Promise<Uint8Array>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
  doc.pipe(stream)

  // ── HEADER ─────────────────────────────────────────────────────────────
  doc.rect(0, 0, PW, 6).fill(C.primary)

  let lY = 24
  doc.font('Helvetica-Bold').fontSize(17).fillColor(C.dark).text(data.practitionerName, ML, lY)
  lY += 22

  if (data.practitionerSpecialty) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.primary).text(data.practitionerSpecialty, ML, lY)
    lY += 16
  }

  doc.font('Helvetica').fontSize(8.5).fillColor(C.textLight)
  if (data.practitionerAddress) {
    doc.text(data.practitionerAddress, ML, lY)
    lY += 12
  }
  if (data.practitionerCityLine) {
    doc.text(data.practitionerCityLine, ML, lY)
  }

  const titleW = 200
  const titleX = PW - MR - titleW
  doc
    .font('Helvetica-Bold').fontSize(15).fillColor(C.primary)
    .text("PROGRAMME D'EXERCICES", titleX, 26, { width: titleW, align: 'right' })
  doc
    .font('Helvetica').fontSize(8.5).fillColor(C.textLight)
    .text(data.prescriptionDate, titleX, 46, { width: titleW, align: 'right' })

  // ── PATIENT CARD ────────────────────────────────────────────────────────
  const pCardY = 88
  const pCardH = 52

  doc.rect(ML, pCardY, CW, pCardH).fill(C.primaryBg)
  doc.rect(ML, pCardY, 4, pCardH).fill(C.primary)

  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.primary)
    .text('PATIENT', ML + 18, pCardY + 10, { characterSpacing: 1 })
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.dark)
    .text(data.patientName, ML + 18, pCardY + 22)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.primary)
    .text(data.prescriptionTitle, titleX, pCardY + 20, { width: titleW, align: 'right' })

  let curY = pCardY + pCardH + SP.l

  // ── GENERAL NOTES ───────────────────────────────────────────────────────
  if (data.notes) {
    doc.rect(ML, curY, CW, 1).fill(C.borderLight)
    curY += SP.s
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(C.textLight)
      .text(data.notes, ML, curY, { width: CW, lineGap: 2 })
    curY = doc.y + SP.l
  }

  // ── PRE-FETCH IMAGES ────────────────────────────────────────────────────
  const imageBuffers = new Map<string, Buffer>()
  for (const item of data.items) {
    if (item.illustration_url) {
      try {
        const r = await fetch(item.illustration_url, { signal: AbortSignal.timeout(5000) })
        if (r.ok) imageBuffers.set(item.illustration_url, Buffer.from(await r.arrayBuffer()))
      } catch { /* skip */ }
    }
  }

  // ── EXERCISE CARDS ──────────────────────────────────────────────────────
  const IMG_SIZE = 110
  const CIRCLE_R = 14
  // CIRCLE_CX: x center of the number circle
  const CIRCLE_CX = ML + CIRCLE_R          // = 62
  // CONTENT_X: where text starts — 14pt gap after circle right edge
  const CONTENT_X = ML + CIRCLE_R * 2 + 14 // = 90
  // CONTENT_W: available width between text start and image left edge
  const CONTENT_W = CW - CIRCLE_R * 2 - 14 - IMG_SIZE - SP.m  // ≈ 367

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]

    // Estimate card height for page-break detection
    const descH = estimateTextHeight(item.exercise_description, 9.5, CONTENT_W)
    const hasParams = !!(item.sets || item.reps || item.hold_time || item.rest_time || item.frequency)
    const notesH = item.notes ? estimateTextHeight(item.notes, 8.5, CONTENT_W) + SP.xs : 0
    const estimatedH = Math.max(
      CIRCLE_R * 2 + SP.s + 14 + SP.m + descH + (hasParams ? SP.s + 24 : 0) + notesH + SP.l,
      IMG_SIZE + SP.s
    )

    // Page break
    const FOOTER_H = 44
    if (curY + estimatedH > PH - FOOTER_H && i > 0) {
      doc.addPage()
      doc.rect(0, 0, PW, 6).fill(C.primary)
      curY = 28
    }

    const cardY = curY
    const imgX = PW - MR - IMG_SIZE
    const imgY = cardY
    const circleCenterY = cardY + CIRCLE_R  // vertical center of the circle

    // ── Image — fit mode shows the complete image without cropping ──────────
    const imgBuffer = item.illustration_url ? imageBuffers.get(item.illustration_url) : undefined
    if (imgBuffer) {
      try {
        // Light background for the image box (visible when image has whitespace with fit)
        doc.roundedRect(imgX, imgY, IMG_SIZE, IMG_SIZE, 5).fill('#F8FAFC')
        // Clip to prevent any overflow, then draw with fit to show full image
        doc.save()
        doc.roundedRect(imgX, imgY, IMG_SIZE, IMG_SIZE, 5).clip()
        doc.image(imgBuffer, imgX, imgY, {
          fit: [IMG_SIZE, IMG_SIZE],
          align: 'center',
          valign: 'center',
        })
        doc.restore()
        doc.roundedRect(imgX, imgY, IMG_SIZE, IMG_SIZE, 5).stroke(C.borderLight)
      } catch {
        drawPlaceholder(doc, imgX, imgY, IMG_SIZE, item.exercise_type)
      }
    } else {
      drawPlaceholder(doc, imgX, imgY, IMG_SIZE, item.exercise_type)
    }

    // ── Number circle ────────────────────────────────────────────────────
    doc.circle(CIRCLE_CX, circleCenterY, CIRCLE_R).fill(C.primary)

    // Manual x/y centering — more reliable than align:'center' with lineBreak:false
    const numFS = i >= 9 ? 8 : 10
    const numStr = String(i + 1)
    const numW = estimateTextWidth(numStr, numFS)
    // 0.40 × fontSize approximates half the cap height in PDFKit coordinates
    const numX = CIRCLE_CX - numW / 2
    const numY = circleCenterY - numFS * 0.40
    doc.font('Helvetica-Bold').fontSize(numFS).fillColor(C.white)
      .text(numStr, numX, numY, { lineBreak: false })

    // ── Exercise name — vertically centered with circle ───────────────────
    const nameFontSize = 13
    // 0.38 × fontSize ≈ cap height / 2 (vertical offset to center caps at circleCenterY)
    const nameY = circleCenterY - nameFontSize * 0.38
    doc.font('Helvetica-Bold').fontSize(nameFontSize).fillColor(C.dark)
      .text(item.exercise_name, CONTENT_X, nameY, { width: CONTENT_W, lineBreak: false })

    // ── Badges — below circle bottom, also respects name bottom ──────────
    const bY = Math.max(cardY + CIRCLE_R * 2 + SP.xs, doc.y + SP.xs)
    let bX = CONTENT_X

    const badges = [
      { text: item.exercise_region, bg: C.primaryBg,   fg: C.primary,   border: true },
      { text: item.exercise_type,   bg: C.borderLight,  fg: C.textLight, border: false },
      { text: `Niv. ${item.exercise_level}`, bg: '#334155', fg: C.white, border: false },
    ]

    for (const badge of badges) {
      const bW = Math.ceil(estimateTextWidth(badge.text, 7.5)) + 16
      doc.roundedRect(bX, bY, bW, 14, 3).fill(badge.bg)
      if (badge.border) doc.roundedRect(bX, bY, bW, 14, 3).stroke(C.primaryBgDark)
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(badge.fg)
        .text(badge.text, bX + 8, bY + 3.5, { width: bW - 16, align: 'center', lineBreak: false })
      bX += bW + SP.xs + 2
    }

    // ── Description ──────────────────────────────────────────────────────
    const descY = bY + 14 + SP.m
    doc.font('Helvetica').fontSize(9.5).fillColor(C.text)
      .text(item.exercise_description, CONTENT_X, descY, { width: CONTENT_W, lineGap: 3 })
    curY = doc.y + SP.m

    // ── Nerve target & Progression/Regression ────────────────────────────
    if (item.nerve_target) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#4F46E5')
        .text('Cible nerveuse : ', CONTENT_X, curY, { continued: true })
      doc.font('Helvetica').fillColor(C.text)
        .text(item.nerve_target, { width: CONTENT_W })
      curY = doc.y + SP.xs
    }
    if (item.progression_regression) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.textLight)
        .text('Progression/Régression : ', CONTENT_X, curY, { continued: true })
      doc.font('Helvetica').fillColor(C.text)
        .text(item.progression_regression, { width: CONTENT_W })
      curY = doc.y + SP.xs
    }
    if (item.nerve_target || item.progression_regression) {
      curY += SP.xs
    }

    // ── Params box ───────────────────────────────────────────────────────
    const params: string[] = []
    if (item.sets != null && item.reps)  params.push(`${item.sets} × ${item.reps}`)
    else if (item.sets != null)          params.push(`${item.sets} séries`)
    else if (item.reps)                  params.push(item.reps)
    if (item.hold_time != null)          params.push(`Maintien ${item.hold_time}s`)
    if (item.rest_time != null)          params.push(`Repos ${item.rest_time}s`)
    if (item.frequency)                  params.push(item.frequency)

    if (params.length > 0) {
      const paramText = params.join('   ·   ')
      const paramTextH = estimateTextHeight(paramText, 8.5, CONTENT_W - 16)
      const paramBoxH = Math.max(24, paramTextH + 16)
      doc.roundedRect(CONTENT_X, curY, CONTENT_W, paramBoxH, 4).fill(C.paramBg)
      doc.roundedRect(CONTENT_X, curY, 3, paramBoxH, 2).fill(C.primary)
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.primary)
        .text(paramText, CONTENT_X + 12, curY + 8, { width: CONTENT_W - 16, lineGap: 2 })
      curY += paramBoxH + SP.s
    }

    // ── Notes ────────────────────────────────────────────────────────────
    if (item.notes) {
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(C.textMuted)
        .text(`Note : ${item.notes}`, CONTENT_X, curY, { width: CONTENT_W, lineGap: 2 })
      curY = doc.y + SP.xs
    }

    // Ensure content clears the image
    curY = Math.max(curY, cardY + IMG_SIZE + SP.s)
    curY += SP.m

    // ── Separator ────────────────────────────────────────────────────────
    if (i < data.items.length - 1) {
      doc.rect(ML, curY, CW, 0.75).fill(C.borderLight)
      curY += SP.xl
    }
  }

  // ── FOOTER ──────────────────────────────────────────────────────────────
  const footerY = PH - 36
  doc.rect(ML, footerY - 6, CW, 0.75).fill(C.border)
  const footerParts = [data.practitionerName, data.practitionerCityLine].filter(Boolean).join('  ·  ')
  doc.font('Helvetica').fontSize(7.5).fillColor(C.textMuted).text(footerParts, ML, footerY)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.primary)
    .text('Osteoflow', PW - MR - 60, footerY, { width: 60, align: 'right' })

  doc.end()
  return done
}

const TYPE_BG: Record<string, string> = {
  renfo: '#DBEAFE',
  étirement: '#FFEDD5',
  mobilité: '#DCFCE7',
  neurodynamique: '#F3E8FF',
  proprio: '#FEF9C3',
  'renfo doux': '#CCFBF1',
}
const TYPE_FG: Record<string, string> = {
  renfo: '#1D4ED8',
  étirement: '#C2410C',
  mobilité: '#15803D',
  neurodynamique: '#7C3AED',
  proprio: '#A16207',
  'renfo doux': '#0F766E',
}

function drawPlaceholder(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, size: number, type: string
) {
  const bg = TYPE_BG[type] || '#F1F5F9'
  const fg = TYPE_FG[type] || '#64748B'
  doc.roundedRect(x, y, size, size, 6).fill(bg)
  const initial = type.charAt(0).toUpperCase()
  doc
    .font('Helvetica-Bold').fontSize(26).fillColor(fg)
    .text(initial, x, y + size / 2 - 16, { width: size, align: 'center', lineBreak: false })
  doc.font('Helvetica').fontSize(6.5).fillColor(fg)
    .text(type, x, y + size / 2 + 14, { width: size, align: 'center', lineBreak: false })
}
