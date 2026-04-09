// chunk 6 phase C: retokenized for Warm Editorial. v1 hardcoded
// emerald/amber/teal/red colors gone in favor of semantic tokens.

import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-muted text-foreground',
      success: 'bg-primary/15 text-primary ring-1 ring-primary/25',
      warning: 'bg-chart-4/15 text-chart-4 ring-1 ring-chart-4/25',
      pending: 'bg-chart-4/10 text-chart-4 ring-1 ring-chart-4/20',
      info: 'bg-accent/15 text-accent ring-1 ring-accent/25',
      destructive: 'bg-destructive/15 text-destructive ring-1 ring-destructive/25',
      department: 'bg-accent/10 text-accent ring-1 ring-accent/20',
      outline: 'border border-border bg-background text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
