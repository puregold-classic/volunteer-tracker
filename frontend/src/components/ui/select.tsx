import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-11 w-full appearance-none rounded-xl border border-neutral-200 bg-white px-4 pr-10 text-base sm:text-sm text-neutral-900 shadow-sm outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:focus:border-teal-500/60 dark:focus:ring-teal-500/10',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
    </div>
  ),
)
Select.displayName = 'Select'

export { Select }
