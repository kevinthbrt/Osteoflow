import { createWorker } from 'tesseract.js'

export interface DoctolibScheduleEntry {
  time: string
  firstName: string
  lastName: string
}

export interface DoctolibScheduleParseResult {
  entries: DoctolibScheduleEntry[]
  /** True when the image looks like it might be a week/month view rather than a single day. */
  suspectedWrongView: boolean
  /** True when OCR read no text at all from the image (wrong window, blank capture, OCR failure). */
  noTextDetected: boolean
}

interface OcrWord {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

// Matches a time either as its own token ("10:40") or glued to the next word
// by a missing space ("10:40TREHEUX") — Tesseract sometimes drops the space
// after a bold time label. Captures the time and (if glued) the remainder.
const TIME_LINE_REGEX = /(\d{1,2})[:h.](\d{2})\s*(.*)/
const LINE_Y_TOLERANCE = 14

/**
 * Runs local OCR (Tesseract, entirely offline — nothing is uploaded) on a
 * screenshot of Doctolib's "Journée" (day) agenda view, and extracts the
 * list of appointments as {time, name} pairs.
 */
export async function parseDoctolibScheduleImage(
  imageSource: string | Blob
): Promise<DoctolibScheduleParseResult> {
  const worker = await createWorker('fra')
  try {
    const { data } = await worker.recognize(imageSource, {}, { blocks: true, text: true })
    const words = extractWords(data)

    console.log(`[parse-doctolib-schedule] OCR: ${words.length} mots reconnus`)
    if (words.length === 0) {
      return { entries: [], suspectedWrongView: false, noTextDetected: true }
    }

    const lines = groupWordsIntoLines(words)
    const entries: DoctolibScheduleEntry[] = []

    for (const line of lines) {
      if (line.length === 0) continue
      const lineText = line.map((w) => w.text).join(' ').trim()
      const match = lineText.match(TIME_LINE_REGEX)
      if (!match) continue

      const restText = match[3] ?? ''
      const nameTokens = restText
        .split(/\s+/)
        .filter((t) => /^[A-Za-zÀ-ÿ'’-]{2,}$/.test(t))
      if (nameTokens.length < 2) continue

      const time = normalizeTime(match[1], match[2])
      const firstName = nameTokens[nameTokens.length - 1]
      const lastName = nameTokens.slice(0, -1).join(' ')
      entries.push({ time, firstName, lastName })
    }

    console.log(`[parse-doctolib-schedule] ${lines.length} lignes, ${entries.length} rendez-vous détectés`)

    const suspectedWrongView = detectWrongView(words, entries)

    return { entries, suspectedWrongView, noTextDetected: false }
  } finally {
    await worker.terminate()
  }
}

/**
 * Tesseract.js puts recognized words either as a flat `data.words` array, or
 * nested under `data.blocks[].paragraphs[].lines[].words[]` depending on
 * version/options — read whichever is actually populated.
 */
function extractWords(data: unknown): OcrWord[] {
  const d = data as {
    words?: OcrWord[]
    blocks?: Array<{ paragraphs?: Array<{ lines?: Array<{ words?: OcrWord[] }> }> }>
  }

  if (d.words && d.words.length > 0) {
    return d.words.filter((w) => w.text?.trim().length > 0)
  }

  const flattened: OcrWord[] = []
  for (const block of d.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          if (word.text?.trim().length > 0) flattened.push(word)
        }
      }
    }
  }
  return flattened
}

/** Group OCR words into horizontal "lines" using their vertical center. */
function groupWordsIntoLines(words: OcrWord[]): OcrWord[][] {
  const sorted = [...words].sort((a, b) => yCenter(a) - yCenter(b))
  const lines: OcrWord[][] = []

  for (const word of sorted) {
    const y = yCenter(word)
    const line = lines.find((l) => Math.abs(yCenter(l[0]) - y) <= LINE_Y_TOLERANCE)
    if (line) {
      line.push(word)
    } else {
      lines.push([word])
    }
  }

  return lines.map((line) => line.sort((a, b) => a.bbox.x0 - b.bbox.x0))
}

function yCenter(word: OcrWord): number {
  return (word.bbox.y0 + word.bbox.y1) / 2
}

function normalizeTime(h: string, m: string): string {
  return `${h.padStart(2, '0')}:${m}`
}

/**
 * Heuristic: a day view has one appointment column, so entries at the same
 * time are rare (only genuine overlaps/cancellations). A week/month view
 * crams many columns side by side, producing lots of same-time entries
 * spread across a wide horizontal range — a pattern this flags as suspect.
 */
function detectWrongView(words: OcrWord[], entries: DoctolibScheduleEntry[]): boolean {
  if (entries.length < 4) return false
  const byTime = new Map<string, number>()
  for (const e of entries) byTime.set(e.time, (byTime.get(e.time) ?? 0) + 1)
  const timesWithManyEntries = [...byTime.values()].filter((count) => count >= 3).length
  if (timesWithManyEntries > 0) return true

  // Multiple distinct short date-header tokens near the top strongly suggest
  // a week/month grid (day view shows a single date in the page title, not
  // repeated short headers across the agenda width).
  const topWords = words.filter((w) => w.bbox.y0 < 80)
  const dateHeaderLike = topWords.filter((w) => /^\d{1,2}$/.test(w.text) || /^[A-Za-zÀ-ÿ]{3}\.?$/.test(w.text))
  return dateHeaderLike.length >= 6
}
