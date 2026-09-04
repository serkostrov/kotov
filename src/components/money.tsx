import { formatMoney, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Money({
  value,
  signed = false,
  className,
}: {
  value: number | string | null | undefined
  signed?: boolean
  className?: string
}) {
  const n = Number(value ?? 0)
  const tone = signed ? (n > 0 ? 'text-success' : n < 0 ? 'text-destructive' : 'text-muted-foreground') : undefined
  return <span className={cn('font-mono tabular text-[0.95em]', tone, className)}>{formatMoney(n)}</span>
}

export function ProfitLine({
  profit,
  margin,
  contractAmount,
}: {
  profit: number
  margin: number | null
  contractAmount: number
}) {
  if (!contractAmount) {
    return <span className="text-sm text-muted-foreground">Сумма договора не указана</span>
  }
  return (
    <span className="inline-flex items-baseline gap-2">
      <Money value={profit} signed />
      <span className="text-xs text-muted-foreground">{formatPercent(margin)}</span>
    </span>
  )
}
