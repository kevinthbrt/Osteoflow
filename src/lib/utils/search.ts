/**
 * Split a search query into tokens, stripping characters that would break
 * the query-builder's OR filter parser (commas) or the SQL LIKE pattern (%/_).
 */
export function splitSearchTokens(query: string): string[] {
  return query
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/[%_]/g, ''))
    .filter((t) => t.length > 0)
}

/**
 * Parse a `JJ/MM/AAAA` search token into the ISO (`AAAA-MM-JJ`) fragment used
 * to match a `birth_date` column stored in that format. Returns null when the
 * token isn't a valid French-formatted date — in particular a plain string of
 * digits (e.g. a phone number typed without separators) never matches, since
 * the slash is required.
 */
export function parseDateSearchToken(token: string): string | null {
  const match = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
    return null
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Build one OR filter string per token, matching `ilike %token%` against each
 * provided column. Chain each result via `.or(...)` so the resulting SQL reads:
 *   (col1 ILIKE %t1% OR col2 ILIKE %t1%) AND (col1 ILIKE %t2% OR col2 ILIKE %t2%)
 * which lets "Martin Dupont" match a patient whose first_name is Martin and
 * last_name is Dupont (or vice versa).
 *
 * When `dateColumn` is given, a token written as `JJ/MM/AAAA` is also matched
 * against that column as an ISO date fragment, so a top-bar search like
 * "12/06/1980" finds patients by birth date alongside the other columns.
 */
export function buildSearchOrFilters(query: string, columns: string[], dateColumn?: string): string[] {
  const tokens = splitSearchTokens(query)
  return tokens.map((token) => {
    const parts = columns.map((col) => `${col}.ilike.%${token}%`)
    const datePattern = dateColumn ? parseDateSearchToken(token) : null
    if (datePattern) {
      parts.push(`${dateColumn}.like.%${datePattern}%`)
    }
    return parts.join(',')
  })
}
