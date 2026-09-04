import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide transition-colors',
  {
    variants: {
      tone: {
        neutral: 'border border-transparent bg-secondary text-secondary-foreground',
        info: 'border border-sky-200/70 bg-sky-50 text-sky-900',
        warning: 'border border-amber-200/70 bg-amber-50 text-amber-950',
        success: 'border border-emerald-200/70 bg-emerald-50 text-emerald-900',
        danger: 'border border-red-200/70 bg-red-50 text-red-900',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge, badgeVariants }
