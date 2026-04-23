/**
 * Split a search query into tokens, stripping characters that would break
 * the query-builder's OR filter parser (commas) or the SQL LIKE pattern (%/_).
 */
export function splitSearchTokens(query: string): string[] {
  return query
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/[%_]/g, ''))
    .filter((t) => t.length > 0)
}

/**
 * Build one OR filter string per token, matching `ilike %token%` against each
 * provided column. Chain each result via `.or(...)` so the resulting SQL reads:
 *   (col1 ILIKE %t1% OR col2 ILIKE %t1%) AND (col1 ILIKE %t2% OR col2 ILIKE %t2%)
 * which lets "Martin Dupont" match a patient whose first_name is Martin and
 * last_name is Dupont (or vice versa).
 */
export function buildSearchOrFilters(query: string, columns: string[]): string[] {
  const tokens = splitSearchTokens(query)
  return tokens.map((token) =>
    columns.map((col) => `${col}.ilike.%${token}%`).join(',')
  )
}
