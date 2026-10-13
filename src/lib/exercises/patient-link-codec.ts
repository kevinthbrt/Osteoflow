/**
 * Format d'échange entre Osteoflow et l'appli patient (osteoupgrade /programme).
 *
 * Ce fichier existe à l'identique dans les deux dépôts :
 *   Osteoflow    src/lib/exercises/patient-link-codec.ts
 *   osteoupgrade lib/patient-link-codec.ts
 * Toute modification doit être reportée des deux côtés.
 *
 * Aucune donnée de santé ne transite par un serveur :
 * - le programme voyage dans le fragment de l'URL (après le #), que les
 *   navigateurs n'envoient jamais au serveur ;
 * - le bilan du patient revient au praticien par un QR code, un code court
 *   tapé à la main ou un texte collé, sans passer par internet.
 */

import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'

// ── Programme (Osteoflow vers patient) ──────────────────────────────────────

export interface LinkExercise {
  /** id de l'exercice dans la bibliothèque (illustration, texte par défaut) */
  e: string
  /** nom */
  n: string
  /** type (renfo, mobilité...) */
  t?: string
  s?: number | null
  r?: string | null
  h?: number | null
  p?: number | null
  f?: string | null
  /** conseil pour le patient */
  o?: string | null
  /** description, absente quand elle est identique à la bibliothèque */
  d?: string | null
  /** progression et régression, absente quand identique à la bibliothèque */
  a?: string | null
}

export interface LinkProgram {
  v: 1
  /** référence courte de la prescription, pour rattacher le bilan */
  id: string
  /** praticien, tel qu'affiché au patient */
  pr: string
  /** date de début (AAAA-MM-JJ) */
  d: string
  /** séances visées par semaine */
  n: number
  i?: string | null
  w?: string | null
  g?: string | null
  x: LinkExercise[]
}

const PROGRAM_PREFIX = '1.'

export function encodeProgram(program: LinkProgram): string {
  return PROGRAM_PREFIX + b64urlEncode(deflateSync(strToU8(JSON.stringify(program)), { level: 9 }))
}

export function decodeProgram(token: string): LinkProgram | null {
  try {
    const t = token.replace(/^#/, '').trim()
    if (!t.startsWith(PROGRAM_PREFIX)) return null
    const json = JSON.parse(strFromU8(inflateSync(b64urlDecode(t.slice(PROGRAM_PREFIX.length)))))
    if (json?.v !== 1 || !Array.isArray(json.x) || typeof json.id !== 'string') return null
    return json as LinkProgram
  } catch {
    return null
  }
}

/** Référence courte (8 caractères hexadécimaux) d'une prescription. */
export function shortRef(prescriptionId: string): string {
  return prescriptionId.replace(/[^0-9a-f]/gi, '').slice(0, 8).toLowerCase().padEnd(8, '0')
}

/**
 * Séances par semaine déduites de la routine puis des fréquences des
 * exercices. « 3 fois par semaine » donne 3, « 1 fois par jour » donne 7.
 */
export function sessionsPerWeek(routine: string | null | undefined, frequencies: Array<string | null | undefined>): number {
  const read = (text: string | null | undefined): number | null => {
    if (!text) return null
    const s = text.toLowerCase()
    const week = s.match(/(\d+)\s*(?:fois|x|×|séances?)\s*(?:par|\/|dans la)\s*semaine/)
    if (week) return Math.min(7, Math.max(1, Number(week[1])))
    if (/un jour sur deux|1 jour sur 2/.test(s)) return 3
    if (/par jour|\/\s*jour|quotidien|chaque jour|tous les jours|7\s*j(?:ours)?\s*(?:sur|\/)\s*7/.test(s)) return 7
    return null
  }
  const fromRoutine = read(routine)
  if (fromRoutine) return fromRoutine
  const counts = frequencies.map(read).filter((n): n is number => n != null)
  return counts.length ? Math.max(...counts) : 3
}

// ── Bilan (patient vers Osteoflow) ──────────────────────────────────────────

export interface ReportDay {
  /** jours depuis la date de début du programme */
  o: number
  /** douleur au réveil 0 à 10, ou null */
  m: number | null
  /** séance faite ce jour-là */
  x: boolean
  /** douleur maximale pendant la séance 0 à 10, ou null */
  p: number | null
}

export interface FullReport {
  v: 1
  id: string
  /** date de début du programme */
  s: string
  /** date à laquelle le bilan a été produit */
  at: string
  /** séances visées par semaine */
  n: number
  days: ReportDay[]
}

export interface WeekSummary {
  /** numéro de semaine depuis le début, 0 pour la première */
  week: number
  done: number
  /** moyenne de la douleur au réveil, arrondie au demi-point, ou null */
  morning: number | null
  /** douleur maximale en séance, ou null */
  maxPain: number | null
}

export interface ShortReport {
  /** 4 premiers caractères de la référence */
  ref4: string
  weeks: WeekSummary[]
}

const REPORT_PREFIX = 'B1.'

export function encodeFullReport(report: FullReport): string {
  const compact = { ...report, days: report.days.map(d => [d.o, d.m ?? -1, d.x ? 1 : 0, d.p ?? -1]) }
  return REPORT_PREFIX + b64urlEncode(deflateSync(strToU8(JSON.stringify(compact)), { level: 9 }))
}

/** Trouve et décode un bilan complet dans un texte (collé ou lu dans un QR). */
export function decodeFullReport(text: string): FullReport | null {
  const m = text.match(/B1\.[A-Za-z0-9_-]+/)
  if (!m) return null
  try {
    const raw = JSON.parse(strFromU8(inflateSync(b64urlDecode(m[0].slice(REPORT_PREFIX.length)))))
    if (raw?.v !== 1 || !Array.isArray(raw.days)) return null
    const n = (v: number) => (v < 0 ? null : v)
    return { ...raw, days: raw.days.map((d: number[]) => ({ o: d[0], m: n(d[1]), x: d[2] === 1, p: n(d[3]) })) }
  } catch {
    return null
  }
}

/** Résume un bilan complet par semaine (les 8 dernières au plus). */
export function summarizeWeeks(report: FullReport, maxWeeks = 8): WeekSummary[] {
  if (report.days.length === 0) return []
  const last = Math.max(...report.days.map(d => Math.floor(d.o / 7)))
  const first = Math.max(0, last - maxWeeks + 1)
  const out: WeekSummary[] = []
  for (let w = first; w <= last; w++) {
    const days = report.days.filter(d => Math.floor(d.o / 7) === w)
    const mornings = days.map(d => d.m).filter((v): v is number => v != null)
    const pains = days.map(d => d.p).filter((v): v is number => v != null)
    out.push({
      week: w,
      done: days.filter(d => d.x).length,
      morning: mornings.length ? Math.round((mornings.reduce((a, b) => a + b, 0) / mornings.length) * 2) / 2 : null,
      maxPain: pains.length ? Math.max(...pains) : null,
    })
  }
  return out
}

// Code court : base32 de Crockford, groupes de 4, dernier caractère de contrôle.
// Bits : version (2) · référence (16) · dernière semaine (6) · nombre de
// semaines moins 1 (3) · par semaine : séances (3), réveil × 2 (5), max (4).
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function encodeShortCode(ref: string, weeks: WeekSummary[]): string {
  const ws = weeks.slice(-8)
  if (ws.length === 0) throw new Error('Aucune semaine à résumer')
  const bits: number[] = []
  const put = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }
  put(1, 2)
  put(parseInt(shortRef(ref).slice(0, 4), 16), 16)
  put(Math.min(63, ws[ws.length - 1].week), 6)
  put(ws.length - 1, 3)
  for (const w of ws) {
    put(Math.min(7, w.done), 3)
    put(w.morning == null ? 31 : Math.round(w.morning * 2), 5)
    put(w.maxPain == null ? 15 : w.maxPain, 4)
  }
  while (bits.length % 5) bits.push(0)
  const syms: number[] = []
  for (let i = 0; i < bits.length; i += 5) syms.push(bits.slice(i, i + 5).reduce((a, b) => (a << 1) | b, 0))
  syms.push(checkSymbol(syms))
  const chars = syms.map(s => B32[s]).join('')
  return chars.match(/.{1,4}/g)!.join('-')
}

export function decodeShortCode(input: string): ShortReport | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (clean.length < 2 || /[^0-9A-HJKMNP-TV-Z]/.test(clean)) return null
  const syms = clean.split('').map(c => B32.indexOf(c))
  const check = syms.pop()!
  if (checkSymbol(syms) !== check) return null
  const bits = syms.flatMap(s => [4, 3, 2, 1, 0].map(i => (s >> i) & 1))
  let pos = 0
  const take = (width: number) => {
    if (pos + width > bits.length) throw new Error('court')
    let v = 0
    for (let i = 0; i < width; i++) v = (v << 1) | bits[pos++]
    return v
  }
  try {
    if (take(2) !== 1) return null
    const ref4 = take(16).toString(16).padStart(4, '0')
    const lastWeek = take(6)
    const count = take(3) + 1
    const weeks: WeekSummary[] = []
    for (let i = 0; i < count; i++) {
      const done = take(3), m = take(5), p = take(4)
      weeks.push({ week: lastWeek - (count - 1 - i), done, morning: m === 31 ? null : m / 2, maxPain: p === 15 ? null : p })
    }
    return { ref4, weeks }
  } catch {
    return null
  }
}

// Poids impairs : toute faute de frappe sur un seul caractère change la somme.
function checkSymbol(syms: number[]): number {
  return syms.reduce((acc, s, i) => (acc + s * (2 * i + 1)) % 32, 0)
}

// ── base64url sans dépendance à Buffer (navigateur et Node) ────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function b64urlEncode(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63]
    if (i + 2 < bytes.length) out += B64[n & 63]
  }
  return out
}

function b64urlDecode(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9_-]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const v = [0, 1, 2, 3].map(k => (i + k < clean.length ? B64.indexOf(clean[i + k]) : 0))
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3]
    if (o < out.length) out[o++] = (n >> 16) & 255
    if (o < out.length) out[o++] = (n >> 8) & 255
    if (o < out.length) out[o++] = n & 255
  }
  return out
}
