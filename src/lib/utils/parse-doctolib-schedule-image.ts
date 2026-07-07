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
}

interface OcrWord {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

const TIME_REGEX = /^(\d{1,2}[:h]\d{2})$/
const LINE_Y_TOLERANCE = 12

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
    const { data } = await worker.recognize(imageSource, {}, { blocks: true })
    const words: OcrWord[] = ((data as unknown as { words?: OcrWord[] }).words ?? [])
      .filter((w) => w.text.trim().length > 0)

    const lines = groupWordsIntoLines(words)
    const entries: DoctolibScheduleEntry[] = []

    for (const line of lines) {
      if (line.length === 0) continue
      const [first, ...rest] = line
      const timeMatch = first.text.replace('h', ':').match(TIME_REGEX)
      if (!timeMatch || rest.length === 0) continue

      const time = normalizeTime(timeMatch[1])
      const nameTokens = rest.map((w) => w.text).filter((t) => /^[A-Za-zÀ-ÿ'’-]+$/.test(t))
      if (nameTokens.length < 2) continue

      const firstName = nameTokens[nameTokens.length - 1]
      const lastName = nameTokens.slice(0, -1).join(' ')
      entries.push({ time, firstName, lastName })
    }

    const suspectedWrongView = detectWrongView(words, entries)

    return { entries, suspectedWrongView }
  } finally {
    await worker.terminate()
  }
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

function normalizeTime(raw: string): string {
  const [h, m] = raw.split(':')
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
