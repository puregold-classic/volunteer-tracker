import * as React from 'react'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'

export interface InputProps extends React.ComponentProps<'input'> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const isPassword = type === 'password'
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

    return (
      <div className="relative">
        <input
          ref={ref}
          type={inputType}
          className={cn(
            'flex h-11 w-full rounded-xl border bg-white px-4 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400',
            'focus:ring-4 focus:ring-sky-100',
            'dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-sky-500/10',
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-700 dark:focus:border-red-500 dark:focus:ring-red-500/10'
              : 'border-slate-200 focus:border-sky-300 dark:border-slate-700 dark:focus:border-sky-500/60',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
