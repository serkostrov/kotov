import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { maskTimeInput, normalizeTimeValue, nowTimeISO } from '@/lib/format'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

type TimePickerProps = {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
  /** Step for minute buttons in the wheel (default 5). Typing still allows any minute. */
  minuteStep?: 1 | 5 | 10 | 15
}

function WheelColumn({
  items,
  selected,
  onSelect,
  label,
}: {
  items: string[]
  selected: string
  onSelect: (value: string) => void
  label: string
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${selected}"]`)
    el?.scrollIntoView({ block: 'center' })
  }, [selected])

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="mb-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div
        ref={listRef}
        className="relative h-44 overflow-y-auto overscroll-contain rounded-lg border border-border/70 bg-muted/30 py-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-9 -translate-y-1/2 rounded-md border border-primary/25 bg-primary/8" />
        <div className="relative z-0 flex flex-col items-stretch gap-0.5 px-1">
          {items.map((item) => {
            const active = item === selected
            return (
              <button
                key={item}
                type="button"
                data-value={item}
                onClick={() => onSelect(item)}
                className={cn(
                  'flex h-9 shrink-0 items-center justify-center rounded-md text-sm tabular transition-colors',
                  active ? 'font-semibold text-primary' : 'text-muted-foreground hover:bg-card hover:text-foreground',
                )}
              >
                {item}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TimePicker({
  value = '',
  onChange,
  placeholder = 'ЧЧ:ММ',
  clearable = true,
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
  minuteStep = 5,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value.slice(0, 5))

  const minutes = useMemo(() => {
    if (minuteStep === 1) return Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
    return Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, '0'))
  }, [minuteStep])

  const hour = (value || '00:00').slice(0, 2)
  const minuteRaw = (value || '00:00').slice(3, 5) || '00'
  const minute =
    minutes.find((m) => m === minuteRaw) ??
    minutes.reduce((best, m) => {
      const bestDiff = Math.abs(Number(best) - Number(minuteRaw))
      const nextDiff = Math.abs(Number(m) - Number(minuteRaw))
      return nextDiff < bestDiff ? m : best
    }, minutes[0] ?? '00')

  useEffect(() => {
    setDraft(value ? value.slice(0, 5) : '')
  }, [value])

  const commit = (next: string) => {
    if (!next.trim()) {
      onChange('')
      setDraft('')
      return
    }
    const normalized = normalizeTimeValue(next)
    if (normalized) {
      onChange(normalized)
      setDraft(normalized)
    } else {
      setDraft(value ? value.slice(0, 5) : '')
    }
  }

  const setParts = (h: string, m: string) => {
    const next = `${h}:${m}`
    onChange(next)
    setDraft(next)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative', className)}>
          <Clock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={id}
            aria-label={ariaLabel}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={draft}
            onChange={(e) => {
              const next = maskTimeInput(e.target.value)
              setDraft(next)
              if (next.length === 5) {
                const normalized = normalizeTimeValue(next)
                if (normalized) onChange(normalized)
              } else if (!next) {
                onChange('')
              }
            }}
            onBlur={() => commit(draft)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit(draft)
                setOpen(false)
              }
              if (e.key === 'Escape') setOpen(false)
            }}
            className="flex h-9 w-full rounded-md border border-input bg-card pl-9 pr-9 text-sm tabular transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {clearable && value && !disabled ? (
            <button
              type="button"
              aria-label="Очистить время"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
                setDraft('')
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[240px] p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex gap-2">
          <WheelColumn items={HOURS} selected={hour} onSelect={(h) => setParts(h, minute)} label="Часы" />
          <WheelColumn items={minutes} selected={minute} onSelect={(m) => setParts(hour, m)} label="Минуты" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = nowTimeISO()
              onChange(now)
              setDraft(now)
              setOpen(false)
            }}
          >
            Сейчас
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Готово
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
