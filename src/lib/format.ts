import { format, isValid, parse, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

const MOSCOW = 'Europe/Moscow'
const DATE_DISPLAY = 'dd.MM.yyyy'

const moneyFmt = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
})

const numberFmt = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
})

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return moneyFmt.format(Number(value))
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return numberFmt.format(Number(value))
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return format(parseISO(value), DATE_DISPLAY, { locale: ru })
  }
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return value.slice(0, 5)
  }
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`
}

/** ISO date `yyyy-MM-dd` → `dd.MM.yyyy` */
export function isoDateToDisplay(iso: string | null | undefined): string {
  if (!iso) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  return format(parseISO(iso), DATE_DISPLAY)
}

/** `dd.MM.yyyy` → ISO `yyyy-MM-dd`, or null if invalid */
export function displayDateToIso(display: string): string | null {
  const cleaned = display.trim()
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) return null
  const parsed = parse(cleaned, DATE_DISPLAY, new Date())
  if (!isValid(parsed)) return null
  return format(parsed, 'yyyy-MM-dd')
}

/** Mask typed digits into `dd.MM.yyyy` while typing */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

export function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export function normalizeTimeValue(value: string): string | null {
  const cleaned = value.trim()
  if (!/^\d{1,2}:\d{2}$/.test(cleaned)) return null
  const [hRaw, mRaw] = cleaned.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MOSCOW }).format(new Date())
}

export function nowTimeISO(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MOSCOW,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}

export function daysOverdue(planEnd: string | null, status: string): number | null {
  if (!planEnd || status === 'done') return null
  const today = todayISO()
  if (planEnd >= today) return null
  const a = new Date(`${planEnd}T00:00:00+03:00`)
  const b = new Date(`${today}T00:00:00+03:00`)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function fileSizeLabel(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}
