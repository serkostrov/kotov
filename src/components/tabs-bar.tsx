import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Tabs row with optional create/action controls matched to TabsList height (h-9). */
export function TabsBar({
  tabs,
  actions,
  className,
}: {
  tabs: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="min-w-0 flex-1 overflow-x-auto">{tabs}</div>
      {actions ? (
        <div className="flex h-9 shrink-0 flex-wrap items-center gap-1.5 [&_button]:h-9">{actions}</div>
      ) : null}
    </div>
  )
}
