import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DualProgress({
  production,
  installation,
  compact = false,
  dense = false,
}: {
  production: number | null
  installation: number | null
  compact?: boolean
  dense?: boolean
}) {
  const tight = dense || compact
  return (
    <div className={cn('grid min-w-0', dense ? 'gap-1' : tight ? 'gap-1.5' : 'gap-2')}>
      <ProgressRow label="Производство" value={production} barClass="bg-sky-600" dense={dense} compact={tight} />
      <ProgressRow label="Монтаж" value={installation} barClass="bg-primary" dense={dense} compact={tight} />
    </div>
  )
}

export function CompactProgress({
  value,
  label,
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
        <span>{label ?? 'Прогресс'}</span>
        <span className="font-mono tabular text-foreground">{formatPercent(pct)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  barClass,
  compact,
  dense,
}: {
  label: string
  value: number | null
  barClass: string
  compact?: boolean
  dense?: boolean
}) {
  const pct = value ?? 0
  if (dense) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-[4.75rem] shrink-0 truncate text-[11px] text-muted-foreground">{label}</span>
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500 ease-out', barClass)}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular text-foreground">
          {value === null ? '—' : formatPercent(value)}
        </span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-0.5 flex justify-between gap-2 text-[11px] font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-mono tabular">{value === null ? '—' : formatPercent(value)}</span>
      </div>
      <div className={cn('w-full overflow-hidden rounded-full bg-secondary', compact ? 'h-1' : 'h-1.5')}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', barClass)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  )
}
