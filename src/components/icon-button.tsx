import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type IconButtonProps = Omit<ComponentProps<typeof Button>, 'children' | 'size'> & {
  icon: LucideIcon
  label: string
  size?: 'sm' | 'default'
}

export function IconButton({
  icon: Icon,
  label,
  className,
  variant = 'outline',
  size = 'sm',
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size === 'sm' ? 'icon-sm' : 'icon'}
          className={cn(className)}
          aria-label={label}
          {...props}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
