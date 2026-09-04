export function toCsv(rows: Record<string, string | number | null | undefined>[], columns: { key: string; header: string }[]): string {
  const header = columns.map((c) => escapeCsv(c.header)).join(';')
  const lines = rows.map((row) => columns.map((c) => escapeCsv(row[c.key])).join(';'))
  return `\uFEFF${[header, ...lines].join('\r\n')}`
}

function escapeCsv(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value)
  if (/[;"\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
