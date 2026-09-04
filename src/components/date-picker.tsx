import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  displayDateToIso,
  isoDateToDisplay,
  maskDateInput,
  todayISO,
} from '@/lib/format'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

type DatePickerProps = {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
}

export function DatePicker({
  value = '',
  onChange,
  placeholder = 'ДД.ММ.ГГГГ',
  clearable = true,
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(isoDateToDisplay(value))
  const selected = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    return parseISO(value)
  }, [value])
  const [view, setView] = useState(() => selected ?? parseISO(todayISO()))

  useEffect(() => {
    setDraft(isoDateToDisplay(value))
  }, [value])

  useEffect(() => {
    if (open) setView(selected ?? parseISO(todayISO()))
  }, [open, selected])

  const days = useMemo(() => {
    const monthStart = startOfMonth(view)
    const start = startOfWeek(monthStart, { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [view])

  const commitDisplay = (display: string) => {
    if (!display.trim()) {
      onChange('')
      setDraft('')
      return
    }
    const iso = displayDateToIso(display)
    if (iso) {
      onChange(iso)
      setDraft(isoDateToDisplay(iso))
    } else {
      setDraft(isoDateToDisplay(value))
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative', className)}>
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={id}
            aria-label={ariaLabel}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={draft}
            onChange={(e) => {
              const next = maskDateInput(e.target.value)
              setDraft(next)
              if (next.length === 10) {
                const iso = displayDateToIso(next)
                if (iso) onChange(iso)
              } else if (!next) {
                onChange('')
              }
            }}
            onBlur={() => commitDisplay(draft)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitDisplay(draft)
                setOpen(false)
              }
              if (e.key === 'Escape') setOpen(false)
            }}
            className="flex h-9 w-full rounded-md border border-input bg-card pl-9 pr-9 text-sm tabular transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {clearable && value && !disabled ? (
            <button
              type="button"
              aria-label="Очистить дату"
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
      <PopoverContent className="w-[300px] p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setView((v) => subMonths(v, 1))}>
            <ChevronLeft />
          </Button>
          <p className="text-sm font-semibold capitalize tracking-tight">
            {format(view, 'LLLL yyyy', { locale: ru })}
          </p>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setView((v) => addMonths(v, 1))}>
            <ChevronRight />
          </Button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day) => {
            const inMonth = isSameMonth(day, view)
            const selectedDay = selected ? isSameDay(day, selected) : false
            const today = isToday(day)
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  const iso = format(day, 'yyyy-MM-dd')
                  onChange(iso)
                  setDraft(isoDateToDisplay(iso))
                  setOpen(false)
                }}
                className={cn(
                  'flex h-9 items-center justify-center rounded-lg text-[13px] tabular transition-colors',
                  !inMonth && 'text-muted-foreground/40',
                  inMonth && !selectedDay && 'text-foreground hover:bg-accent',
                  today && !selectedDay && 'ring-1 ring-primary/35',
                  selectedDay && 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/92',
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const iso = todayISO()
              onChange(iso)
              setDraft(isoDateToDisplay(iso))
              setView(parseISO(iso))
              setOpen(false)
            }}
          >
            Сегодня
          </Button>
          {clearable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange('')
                setDraft('')
                setOpen(false)
              }}
            >
              Очистить
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
