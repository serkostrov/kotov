import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Compact filter strip used across list pages. */
export function FilterBar({
  children,
  trailing,
  className,
}: {
  children: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-col gap-2 rounded-xl border border-border/70 bg-card/80 p-2 shadow-[0_1px_0_oklch(1_0_0_/_0.5)_inset] backdrop-blur-[2px] sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
        {children}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2 sm:pl-1">{trailing}</div> : null}
    </div>
  )
}

export function FilterStat({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex h-9 min-w-[8.5rem] items-center justify-between gap-3 rounded-lg bg-muted/55 px-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="text-[13px] font-semibold tabular">{children}</div>
    </div>
  )
}
