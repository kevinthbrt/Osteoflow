import PDFDocument from '@react-pdf/pdfkit'
import { PassThrough } from 'stream'
import type { ExercisePrescriptionItem } from '@/types/exercise'

type Doc = InstanceType<typeof PDFDocument>

const C = {
  primary: '#0F766E',
  primaryDark: '#134E4A',
  primaryLight: '#5EEAD4',
  primaryBg: '#F0FDFA',
  primaryLine: '#CCFBF1',
  dark: '#0F172A',
  text: '#334155',
  textLight: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  white: '#FFFFFF',
  warningBg: '#FFFBEB',
  warningLine: '#FDE68A',
  warningTitle: '#B45309',
  warningText: '#78350F',
}

const PW = 595.28
const PH = 841.89
const M = 44
const CW = PW - M * 2
const FOOTER_Y = PH - 30
const CONTENT_BOTTOM = FOOTER_Y - 12

export interface ExercisePdfData {
  practitionerName: string
  practitionerSpecialty?: string
  practitionerAddress?: string
  practitionerCityLine?: string
  patientName: string
  prescriptionTitle: string
  prescriptionDate: string
  notes?: string
  patient_intro?: string
  vigilance_points?: string
  weekly_routine?: string
  items: ExercisePrescriptionItem[]
}

// Les polices standard PDF n'encodent que WinAnsi : un caractère hors de ce
// jeu (≤, →, espace fine insécable, emoji) s'imprime en signe illisible.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
function pdfSafe(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/[    ]/g, ' ')
    .replace(/≤\s?/g, 'max. ')
    .replace(/≥\s?/g, 'min. ')
    .replace(/\s?[→⇒➜]\s?/g, ' puis ')
    .replace(/[‐‑]/g, '-')
    .split('')
    .filter(ch => ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(ch))
    .join('')
}

function lineHeight(fontSize: number, gap: number): number {
  return fontSize * 1.25 + gap
}

function wrapLines(doc: Doc, text: string, font: string, fontSize: number, maxWidth: number): string[] {
  doc.font(font).fontSize(fontSize)
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) { out.push(''); continue }
    let cur = ''
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w
      if (!cur || doc.widthOfString(test) <= maxWidth) {
        cur = test
      } else {
        out.push(cur)
        cur = w
      }
    }
    if (cur) out.push(cur)
  }
  return out
}

// Cette version de pdfkit ignore `align` quand `lineBreak` est désactivé :
// l'alignement est calculé à la main.
function textAt(
  doc: Doc, text: string, x: number, y: number, width: number,
  align: 'left' | 'center' | 'right' = 'left', spacing = 0,
) {
  const w = doc.widthOfString(text, { characterSpacing: spacing })
  const dx = align === 'right' ? width - w : align === 'center' ? (width - w) / 2 : 0
  doc.text(text, x + Math.max(0, dx), y, { lineBreak: false, characterSpacing: spacing })
}

interface TextStyle { font: string; size: number; color: string; width: number; gap?: number; spacing?: number }

function measure(doc: Doc, text: string, s: TextStyle): number {
  if (!text) return 0
  return wrapLines(doc, text, s.font, s.size, s.width).length * lineHeight(s.size, s.gap ?? 2)
}

// Écrit ligne par ligne (mise en page maîtrisée, sans saut de page implicite)
// et renvoie l'ordonnée sous le dernier texte.
function write(doc: Doc, text: string, x: number, y: number, s: TextStyle, align: 'left' | 'right' = 'left'): number {
  if (!text) return y
  const lh = lineHeight(s.size, s.gap ?? 2)
  const lines = wrapLines(doc, text, s.font, s.size, s.width)
  doc.font(s.font).fontSize(s.size).fillColor(s.color)
  let cy = y
  for (const line of lines) {
    textAt(doc, line, x, cy, s.width, align, s.spacing ?? 0)
    cy += lh
  }
  return cy
}

function eyebrow(doc: Doc, text: string, x: number, y: number, color = C.primary, width = CW, align: 'left' | 'right' = 'left') {
  doc.font('Helvetica-Bold').fontSize(7).fillColor(color)
  textAt(doc, text.toUpperCase(), x, y, width, align, 1.2)
}

function sectionTitle(doc: Doc, text: string, y: number): number {
  eyebrow(doc, text, M, y)
  doc.font('Helvetica-Bold').fontSize(7)
  const w = doc.widthOfString(text.toUpperCase(), { characterSpacing: 1.2 }) + 6
  doc.rect(M + w, y + 3.5, CW - w, 0.6).fill(C.border)
  return y + 18
}

// ── Carte exercice ───────────────────────────────────────────────────────────

const PAD = 14
const IMG = 96
const GUTTER = 16
const BODY_X_OFFSET = PAD + IMG + GUTTER
const BODY_W = CW - BODY_X_OFFSET - PAD

const S_NAME: TextStyle = { font: 'Helvetica-Bold', size: 12.5, color: C.dark, width: BODY_W - 28, gap: 1 }
const S_CAPTION: TextStyle = { font: 'Helvetica', size: 7.5, color: C.textMuted, width: BODY_W - 28, gap: 1 }
const S_DESC: TextStyle = { font: 'Helvetica', size: 9.5, color: C.text, width: BODY_W, gap: 2.5 }
const S_FREQ: TextStyle = { font: 'Helvetica-Bold', size: 9, color: C.primary, width: BODY_W, gap: 2 }
const S_NOTE: TextStyle = { font: 'Helvetica-Oblique', size: 8.75, color: C.text, width: BODY_W - 14, gap: 2 }
const S_SMALL: TextStyle = { font: 'Helvetica', size: 7.75, color: C.textLight, width: BODY_W, gap: 1.5 }
const S_CELL_VALUE = { font: 'Helvetica-Bold', size: 10.5, color: C.dark, gap: 1 }

interface Cell { label: string; value: string }

function dosageCells(item: ExercisePrescriptionItem): Cell[] {
  const cells: Cell[] = []
  if (item.sets != null) cells.push({ label: 'Séries', value: String(item.sets) })
  if (item.reps) cells.push({ label: 'Répétitions', value: pdfSafe(item.reps) })
  if (item.hold_time != null) cells.push({ label: 'Maintien', value: `${item.hold_time} s` })
  if (item.rest_time != null) cells.push({ label: 'Repos', value: `${item.rest_time} s` })
  return cells
}

function cellsHeight(doc: Doc, cells: Cell[]): number {
  if (cells.length === 0) return 0
  const cellW = BODY_W / cells.length
  const valueH = Math.max(...cells.map(c => measure(doc, c.value, { ...S_CELL_VALUE, width: cellW - 16 })))
  return 9 + 9 + 3 + valueH + 7
}

function captionFor(item: ExercisePrescriptionItem): string {
  return [item.exercise_region, item.exercise_type, `Niveau ${item.exercise_level}`].filter(Boolean).join('  ·  ')
}

function cardBodyHeight(doc: Doc, item: ExercisePrescriptionItem): number {
  let h = measure(doc, pdfSafe(item.exercise_name), S_NAME)
  h += 2 + measure(doc, captionFor(item), S_CAPTION)
  h += 10 + measure(doc, pdfSafe(item.exercise_description), S_DESC)
  const cells = dosageCells(item)
  if (cells.length) h += 10 + cellsHeight(doc, cells)
  if (item.frequency) h += 8 + measure(doc, `Fréquence : ${pdfSafe(item.frequency)}`, S_FREQ)
  if (item.notes) h += 10 + measure(doc, pdfSafe(item.notes), S_NOTE) + 12
  if (item.progression_regression) h += 8 + measure(doc, `Pour adapter : ${pdfSafe(item.progression_regression)}`, S_SMALL)
  if (item.nerve_target) h += 4 + measure(doc, `Nerf ciblé : ${pdfSafe(item.nerve_target)}`, S_SMALL)
  return h
}

function cardHeight(doc: Doc, item: ExercisePrescriptionItem): number {
  return Math.max(cardBodyHeight(doc, item), IMG) + PAD * 2
}

const TYPE_TINT: Record<string, [string, string]> = {
  renfo: ['#DBEAFE', '#1D4ED8'],
  étirement: ['#FFEDD5', '#C2410C'],
  mobilité: ['#DCFCE7', '#15803D'],
  neurodynamique: ['#F3E8FF', '#7C3AED'],
  proprio: ['#FEF9C3', '#A16207'],
  'renfo doux': ['#CCFBF1', '#0F766E'],
}

function drawPlaceholder(doc: Doc, x: number, y: number, type: string) {
  const [bg, fg] = TYPE_TINT[type] || ['#F1F5F9', '#64748B']
  doc.roundedRect(x, y, IMG, IMG, 8).fill(bg)
  doc.font('Helvetica-Bold').fontSize(24).fillColor(fg)
  textAt(doc, type.charAt(0).toUpperCase(), x, y + IMG / 2 - 16, IMG, 'center')
  doc.font('Helvetica').fontSize(7).fillColor(fg)
  textAt(doc, pdfSafe(type), x, y + IMG / 2 + 12, IMG, 'center')
}

function drawCard(doc: Doc, item: ExercisePrescriptionItem, index: number, y: number, img: Buffer | undefined, height: number) {
  const x = M
  doc.roundedRect(x, y, CW, height, 10).fillAndStroke(C.white, C.border)

  // Illustration
  const imgX = x + PAD
  const imgY = y + PAD
  let drawn = false
  if (img) {
    try {
      doc.roundedRect(imgX, imgY, IMG, IMG, 8).fill(C.surface)
      doc.save()
      doc.roundedRect(imgX, imgY, IMG, IMG, 8).clip()
      doc.image(img, imgX, imgY, { fit: [IMG, IMG], align: 'center', valign: 'center' })
      doc.restore()
      doc.lineWidth(0.6).roundedRect(imgX, imgY, IMG, IMG, 8).stroke(C.border)
      drawn = true
    } catch { /* image illisible : pictogramme */ }
  }
  if (!drawn) drawPlaceholder(doc, imgX, imgY, item.exercise_type)

  // Numéro + nom
  const bx = x + BODY_X_OFFSET
  let cy = y + PAD
  const r = 10
  doc.circle(bx + r, cy + r - 1, r).fill(C.primary)
  const num = String(index + 1)
  doc.font('Helvetica-Bold').fontSize(9.5)
  doc.fillColor(C.white)
  textAt(doc, num, bx, cy + r - 5.6, r * 2, 'center')

  const nameX = bx + 28
  cy = write(doc, pdfSafe(item.exercise_name), nameX, cy + 2, S_NAME) - 1
  cy = write(doc, captionFor(item), nameX, cy + 2, S_CAPTION)
  cy = Math.max(cy, y + PAD + r * 2)

  // Description
  cy = write(doc, pdfSafe(item.exercise_description), bx, cy + 10, S_DESC)

  // Dosage
  const cells = dosageCells(item)
  if (cells.length) {
    cy += 10
    const h = cellsHeight(doc, cells)
    const cellW = BODY_W / cells.length
    doc.roundedRect(bx, cy, BODY_W, h, 6).fill(C.primaryBg)
    cells.forEach((cell, i) => {
      const cx = bx + i * cellW
      if (i > 0) doc.rect(cx, cy + 8, 0.6, h - 16).fill(C.primaryLine)
      eyebrow(doc, cell.label, cx + 8, cy + 9, C.primary, cellW - 16)
      write(doc, cell.value, cx + 8, cy + 21, { ...S_CELL_VALUE, width: cellW - 16 })
    })
    cy += h
  }

  if (item.frequency) {
    cy = write(doc, `Fréquence : ${pdfSafe(item.frequency)}`, bx, cy + 8, S_FREQ)
  }

  if (item.notes) {
    cy += 10
    const noteH = measure(doc, pdfSafe(item.notes), S_NOTE) + 12
    doc.roundedRect(bx, cy, BODY_W, noteH, 6).fill(C.surface)
    doc.rect(bx, cy + 6, 2, noteH - 12).fill(C.primary)
    write(doc, pdfSafe(item.notes), bx + 12, cy + 6, S_NOTE)
    cy += noteH
  }

  if (item.progression_regression) {
    cy = write(doc, `Pour adapter : ${pdfSafe(item.progression_regression)}`, bx, cy + 8, S_SMALL)
  }
  if (item.nerve_target) {
    write(doc, `Nerf ciblé : ${pdfSafe(item.nerve_target)}`, bx, cy + 4, S_SMALL)
  }
}

// ── Fin de programme : suivi des séances + vigilance ────────────────────────

const TRACK_WEEKS = 4
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function trackerHeight(): number {
  return 18 + 14 + 16 + TRACK_WEEKS * 20
}

function drawTracker(doc: Doc, y: number): number {
  let cy = sectionTitle(doc, 'Suivi de vos séances', y)
  cy = write(doc, 'Cochez chaque jour où vous avez fait vos exercices et apportez cette feuille à votre prochaine consultation.', M, cy, {
    font: 'Helvetica', size: 8.5, color: C.textLight, width: CW, gap: 2,
  }) + 4

  const labelW = 70
  const box = 13
  const colW = (CW - labelW) / DAYS.length
  DAYS.forEach((d, i) => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.textMuted)
    textAt(doc, d, M + labelW + i * colW, cy, colW, 'center')
  })
  cy += 14
  for (let w = 0; w < TRACK_WEEKS; w++) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.text).text(`Semaine ${w + 1}`, M, cy + 2, { lineBreak: false })
    for (let i = 0; i < DAYS.length; i++) {
      const bxx = M + labelW + i * colW + (colW - box) / 2
      doc.lineWidth(0.8).roundedRect(bxx, cy, box, box, 3).stroke(C.primaryLight)
    }
    cy += 20
  }
  return cy
}

function vigilanceLines(text: string): string[] {
  return pdfSafe(text).split('\n').map(l => l.replace(/^\s*[•\-*]\s*/, '').trim()).filter(Boolean)
}

const S_VIG: TextStyle = { font: 'Helvetica', size: 9, color: C.warningText, width: CW - 40, gap: 2 }

function vigilanceHeight(doc: Doc, text: string): number {
  const lines = vigilanceLines(text)
  return 30 + lines.reduce((h, l) => h + measure(doc, l, S_VIG) + 3, 0) + 8
}

function drawVigilance(doc: Doc, text: string, y: number, height: number) {
  doc.roundedRect(M, y, CW, height, 8).fillAndStroke(C.warningBg, C.warningLine)
  eyebrow(doc, 'Arrêtez et contactez-moi si', M + 16, y + 14, C.warningTitle)
  let cy = y + 30
  for (const line of vigilanceLines(text)) {
    doc.circle(M + 20, cy + 4.6, 1.6).fill(C.warningTitle)
    cy = write(doc, line, M + 28, cy, S_VIG) + 3
  }
}

// ── Document ────────────────────────────────────────────────────────────────

export async function generateExercisePdf(data: ExercisePdfData): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  const done = new Promise<Uint8Array>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
  doc.pipe(stream)

  const practitioner = pdfSafe(data.practitionerName)
  const patient = pdfSafe(data.patientName)
  let page = 1

  const drawFooter = () => {
    doc.rect(M, FOOTER_Y - 8, CW, 0.6).fill(C.border)
    const left = [practitioner, pdfSafe(data.practitionerCityLine)].filter(Boolean).join('  ·  ')
    doc.font('Helvetica').fontSize(7.5).fillColor(C.textMuted).text(left, M, FOOTER_Y, { lineBreak: false })
    textAt(doc, `Page ${page}`, M, FOOTER_Y, CW, 'right')
  }

  const newPage = (): number => {
    drawFooter()
    doc.addPage()
    page++
    doc.rect(0, 0, PW, 4).fill(C.primary)
    doc.font('Helvetica').fontSize(7.5).fillColor(C.textMuted)
      .text(`Programme d'exercices  ·  ${patient}`, M, 22, { lineBreak: false })
    return 46
  }

  const ensureRoom = (y: number, needed: number): number =>
    y + needed > CONTENT_BOTTOM ? newPage() : y

  // Illustrations téléchargées en parallèle pendant la mise en page de l'en-tête.
  const imagesPromise = Promise.all(data.items.map(async (item) => {
    if (!item.illustration_url) return undefined
    try {
      const r = await fetch(item.illustration_url, { signal: AbortSignal.timeout(5000) })
      return r.ok ? Buffer.from(await r.arrayBuffer()) : undefined
    } catch {
      return undefined
    }
  }))

  // ── En-tête ──
  doc.rect(0, 0, PW, 4).fill(C.primary)

  const rightW = 180
  const leftW = CW - rightW - 20
  let y = 34
  y = write(doc, practitioner, M, y, { font: 'Helvetica-Bold', size: 13, color: C.dark, width: leftW, gap: 1 })
  if (data.practitionerSpecialty) {
    y = write(doc, pdfSafe(data.practitionerSpecialty), M, y + 1, { font: 'Helvetica', size: 9, color: C.primary, width: leftW, gap: 1 })
  }
  y += 3
  for (const line of [data.practitionerAddress, data.practitionerCityLine]) {
    if (line) y = write(doc, pdfSafe(line), M, y, { font: 'Helvetica', size: 8, color: C.textLight, width: leftW, gap: 1 })
  }
  eyebrow(doc, "Programme d'exercices", PW - M - rightW, 37, C.primary, rightW, 'right')
  write(doc, pdfSafe(data.prescriptionDate), PW - M - rightW, 50, { font: 'Helvetica', size: 8.5, color: C.textLight, width: rightW, gap: 1 }, 'right')

  y = Math.max(y, 70) + 14
  doc.rect(M, y, CW, 0.6).fill(C.border)
  y += 22

  // ── Titre ──
  eyebrow(doc, `Préparé pour ${patient}`, M, y, C.textLight)
  y = write(doc, pdfSafe(data.prescriptionTitle), M, y + 14, { font: 'Helvetica-Bold', size: 19, color: C.dark, width: CW, gap: 2 })
  const count = data.items.length
  y = write(doc, `${count} exercice${count > 1 ? 's' : ''} choisi${count > 1 ? 's' : ''} pour vous`, M, y + 2, {
    font: 'Helvetica', size: 9.5, color: C.textLight, width: CW,
  })
  y += 16

  // ── Message du praticien ──
  if (data.patient_intro) {
    const s: TextStyle = { font: 'Helvetica', size: 10, color: C.text, width: CW - 20, gap: 3 }
    const h = measure(doc, pdfSafe(data.patient_intro), s)
    doc.rect(M, y, 2.5, h + 16).fill(C.primaryLight)
    eyebrow(doc, 'Le mot de votre praticien', M + 16, y)
    write(doc, pdfSafe(data.patient_intro), M + 16, y + 14, s)
    y += h + 16 + 16
  }

  // ── Routine ──
  if (data.weekly_routine) {
    const s: TextStyle = { font: 'Helvetica-Bold', size: 10, color: C.primaryDark, width: CW - 32, gap: 2.5 }
    const h = measure(doc, pdfSafe(data.weekly_routine), s) + 34
    doc.roundedRect(M, y, CW, h, 8).fill(C.primaryBg)
    eyebrow(doc, 'Votre routine', M + 16, y + 12)
    write(doc, pdfSafe(data.weekly_routine), M + 16, y + 25, s)
    y += h + 22
  }

  // ── Exercices ──
  const images = await imagesPromise
  y = ensureRoom(y, 18 + (count ? cardHeight(doc, data.items[0]) : 0))
  y = sectionTitle(doc, 'Vos exercices', y)
  for (let i = 0; i < count; i++) {
    const item = data.items[i]
    const h = cardHeight(doc, item)
    y = ensureRoom(y, h)
    drawCard(doc, item, i, y, images[i], h)
    y += h + 12
  }

  // ── Suivi et vigilance ──
  y += 10
  y = ensureRoom(y, trackerHeight())
  y = drawTracker(doc, y) + 14

  if (data.vigilance_points) {
    const h = vigilanceHeight(doc, data.vigilance_points)
    y = ensureRoom(y, h)
    drawVigilance(doc, data.vigilance_points, y, h)
  }

  drawFooter()
  doc.end()
  return done
}
