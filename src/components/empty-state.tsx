import { Inbox, type LucideIcon, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 px-5 py-10 text-center',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <p className="text-[13px] font-semibold">{title}</p>
        {description ? <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/25 bg-card px-5 py-8 text-center',
        className,
      )}
    >
      <p className="max-w-md text-[13px] text-destructive">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Повторить
        </Button>
      ) : null}
    </div>
  )
}
