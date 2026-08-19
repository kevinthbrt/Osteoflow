/**
 * Sérialisation CSV pour l'export de données du praticien.
 *
 * Deux choix dictés par Excel en configuration française, où la plupart des
 * praticiens ouvriront le fichier :
 * - séparateur « ; » (avec la virgule, tout atterrit dans la colonne A) ;
 * - virgule décimale et BOM UTF-8 (sans lui, les accents ressortent en
 *   mojibake).
 *
 * Module pur : aucune dépendance Node ni navigateur, il sert aussi bien à la
 * route serveur qu'aux tests unitaires.
 */

export const CSV_DELIMITER = ';'

/** BOM UTF-8, à placer en tête de fichier pour qu'Excel décode l'UTF-8. */
export const CSV_BOM = '\uFEFF'

/**
 * Échappe une valeur pour une cellule CSV.
 *
 * Le préfixe apostrophe sur `= + - @` neutralise l'injection de formule : une
 * anamnèse commençant par « -20 kg » ou « =tension » ne doit pas devenir une
 * formule exécutable à l'ouverture du tableur.
 */
export function escapeCsvValue(value: unknown, delimiter: string = CSV_DELIMITER): string {
  if (value === null || value === undefined) return ''

  let text = String(value)
  if (text === '') return ''

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }

  if (text.includes(delimiter) || text.includes('"') || /[\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

/** Assemble un tableau de lignes en texte CSV (fins de ligne CRLF, cf. RFC 4180). */
export function toCsv(
  headers: string[],
  rows: unknown[][],
  delimiter: string = CSV_DELIMITER,
): string {
  const lines = [
    headers.map((header) => escapeCsvValue(header, delimiter)).join(delimiter),
    ...rows.map((row) => row.map((cell) => escapeCsvValue(cell, delimiter)).join(delimiter)),
  ]
  return lines.join('\r\n')
}

/**
 * Formate une date stockée en base vers « JJ/MM/AAAA ».
 *
 * Les dates de l'application sont écrites en heure locale et sans fuseau
 * (« 2026-03-15 » ou « 2026-03-15T09:30 ») : on les découpe à la chaîne, car
 * les passer par `new Date()` décalerait la veille tout fuseau à l'ouest de
 * Greenwich — un anniversaire de patient québécois changerait de jour.
 * Seules les valeurs explicitement UTC (suffixe Z) sont converties.
 */
export function formatCsvDate(value: unknown): string {
  const iso = toLocalIsoString(value)
  if (!iso) return ''
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/** Formate une date-heure stockée en base vers « JJ/MM/AAAA HH:MM ». */
export function formatCsvDateTime(value: unknown): string {
  const iso = toLocalIsoString(value)
  if (!iso) return ''
  const date = formatCsvDate(iso)
  const time = iso.slice(11, 16)
  return time ? `${date} ${time}` : date
}

/** Nombre avec virgule décimale, pour qu'Excel FR y voie bien un nombre. */
export function formatCsvNumber(value: unknown, decimals = 2): string {
  if (value === null || value === undefined || value === '') return ''
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return ''
  return numeric.toFixed(decimals).replace('.', ',')
}

/** Booléen SQLite (0/1) en « Oui »/« Non ». */
export function formatCsvBoolean(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  return value === 1 || value === true || value === '1' ? 'Oui' : 'Non'
}

/**
 * Normalise une valeur de date en chaîne locale « YYYY-MM-DD[THH:MM] ».
 * Renvoie null si la valeur n'est pas exploitable.
 */
function toLocalIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) return localIsoFromDate(value)

  const text = String(value).trim()
  if (!text) return null

  // Valeur horodatée en UTC : elle doit repasser en heure locale.
  if (/Z$|[+-]\d{2}:\d{2}$/.test(text)) {
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : localIsoFromDate(parsed)
  }

  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null

  return text.replace(' ', 'T')
}

function localIsoFromDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Nom de fichier horodaté, sans caractère interdit par les systèmes de fichiers. */
export function buildCsvFileName(datasetKey: string, startDate?: string, endDate?: string): string {
  const slug = datasetKey.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
  const period = startDate && endDate ? `_${startDate}_${endDate}` : ''
  const today = formatCsvDate(new Date()).replace(/\//g, '-')
  return `myosteoflow_${slug}${period || `_${today}`}.csv`
}
