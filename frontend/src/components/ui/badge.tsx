import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
      success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      pending: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
      info: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
      destructive: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
      outline: 'border border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300'
    }
  },
  defaultVariants: { variant: 'default' }
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />}
