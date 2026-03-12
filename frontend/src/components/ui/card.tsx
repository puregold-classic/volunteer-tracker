import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva('rounded-3xl border text-slate-950 dark:text-slate-50 transition-all duration-200', {
  variants: {
    variant: {
      default: 'border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/90',
      elevated: 'border-slate-200/80 bg-white shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/20',
      glass: 'border-white/60 bg-white/70 shadow-lg shadow-sky-100/40 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-black/20',
      interactive: 'border-slate-200/80 bg-white/95 shadow-sm hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-100/60 dark:border-slate-800 dark:bg-slate-950/90 dark:hover:border-sky-500/30 dark:hover:shadow-black/30'
    }
  },
  defaultVariants: { variant: 'default' }
})

interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}
const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('flex flex-col gap-1 p-6', className)} {...props} />)
CardHeader.displayName = 'CardHeader'
const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => <h3 ref={ref} className={cn('text-lg font-semibold tracking-tight', className)} {...props} />)
CardTitle.displayName = 'CardTitle'
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-slate-500 dark:text-slate-400', className)} {...props} />)
CardDescription.displayName = 'CardDescription'
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />)
CardContent.displayName = 'CardContent'
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('flex items-center gap-3 p-6 pt-0', className)} {...props} />)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
