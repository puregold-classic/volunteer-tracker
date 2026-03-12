import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends Omit<React.ComponentProps<'select'>, 'children'> {
  options: SelectOption[]
  placeholder?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, value, disabled, ...props }, ref) => {
    const selectedOption = options.find((opt) => opt.value === value)

    return (
      <div className="relative">
        <select
          ref={ref}
          value={value}
          disabled={disabled}
          className={cn(
            'flex h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-900 shadow-sm outline-none',
            'focus:border-sky-300 focus:ring-4 focus:ring-sky-100',
            'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50',
            'dark:focus:border-sky-500/60 dark:focus:ring-sky-500/10',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
