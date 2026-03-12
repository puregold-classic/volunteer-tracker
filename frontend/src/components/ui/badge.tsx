import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      info: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
      destructive: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
      outline: 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-transparent dark:text-slate-300'
    }
  },
  defaultVariants: { variant: 'default' }
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />}
