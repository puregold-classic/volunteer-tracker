import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva('rounded-3xl border text-neutral-950 dark:text-neutral-50 transition-all duration-200', {
  variants: {
    variant: {
      default: 'border-neutral-200/80 bg-white/95 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/90',
      elevated: 'border-neutral-200/80 bg-white shadow-lg shadow-neutral-200/60 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-black/20',
      glass: 'border-white/60 bg-white/70 shadow-lg shadow-teal-100/40 backdrop-blur-xl dark:border-neutral-700/70 dark:bg-neutral-900/70 dark:shadow-black/20',
      interactive: 'border-neutral-200/80 bg-white/95 shadow-sm hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-100/60 dark:border-neutral-800 dark:bg-neutral-950/90 dark:hover:border-teal-500/30 dark:hover:shadow-black/30'
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
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-neutral-500 dark:text-neutral-400', className)} {...props} />)
CardDescription.displayName = 'CardDescription'
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />)
CardContent.displayName = 'CardContent'
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('flex items-center gap-3 p-6 pt-0', className)} {...props} />)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
