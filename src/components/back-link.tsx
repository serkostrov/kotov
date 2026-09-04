import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackLink({
  to,
  label = 'Назад',
  className,
}: {
  to: string
  label?: string
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}
