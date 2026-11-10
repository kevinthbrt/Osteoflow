/**
 * Lecture des CSV de l'export OsteoTools : séparateur point-virgule, BOM
 * UTF-8 en tête, champs entre guillemets pouvant contenir des retours à la
 * ligne (anamnèses, notes).
 */

export type CsvRow = Record<string, string>

export function parseSemicolonCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let start = 0

  const pushField = () => {
    row.push(field)
    field = ''
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += text.slice(start, i + 1)
          i++
          start = i + 1
          continue
        }
        field += text.slice(start, i)
        inQuotes = false
        start = i + 1
      }
      continue
    }
    if (char === '"') {
      field += text.slice(start, i)
      inQuotes = true
      start = i + 1
    } else if (char === ';') {
      field += text.slice(start, i)
      pushField()
      start = i + 1
    } else if (char === '\n' || char === '\r') {
      field += text.slice(start, i)
      pushField()
      if (row.some((cell) => cell !== '')) records.push(row)
      row = []
      if (char === '\r' && text[i + 1] === '\n') i++
      start = i + 1
    }
  }
  field += text.slice(start)
  if (field !== '' || row.length > 0) {
    pushField()
    if (row.some((cell) => cell !== '')) records.push(row)
  }

  if (records.length === 0) return []
  const headers = records[0].map((header) => header.trim())
  return records.slice(1).map((cells) => {
    const obj: CsvRow = {}
    headers.forEach((header, index) => {
      obj[header] = (cells[index] ?? '').replace(/\r\n?/g, '\n')
    })
    return obj
  })
}
