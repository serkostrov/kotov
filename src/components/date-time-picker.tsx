import { DatePicker } from '@/components/date-picker'
import { TimePicker } from '@/components/time-picker'
import { cn } from '@/lib/utils'

type DateTimePickerProps = {
  date?: string
  time?: string
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  datePlaceholder?: string
  timePlaceholder?: string
  clearable?: boolean
  disabled?: boolean
  className?: string
}

/** Combined date + time controls. Values stay as `yyyy-MM-dd` and `HH:mm`. */
export function DateTimePicker({
  date = '',
  time = '',
  onDateChange,
  onTimeChange,
  datePlaceholder,
  timePlaceholder,
  clearable,
  disabled,
  className,
}: DateTimePickerProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_0.8fr]', className)}>
      <DatePicker
        value={date}
        onChange={onDateChange}
        placeholder={datePlaceholder}
        clearable={clearable}
        disabled={disabled}
      />
      <TimePicker
        value={time}
        onChange={onTimeChange}
        placeholder={timePlaceholder}
        clearable={clearable}
        disabled={disabled}
      />
    </div>
  )
}
