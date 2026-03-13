import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error('Tabs components must be used within <Tabs />')
  return context
}

export function Tabs({ value, onValueChange, className, children }: { value: string; onValueChange: (value: string) => void; className?: string; children: React.ReactNode }) {
  return <TabsContext.Provider value={{ value, setValue: onValueChange }}><div className={className}>{children}</div></TabsContext.Provider>
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('inline-flex w-full flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/80', className)} {...props} />
}

export function TabsTrigger({ value, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: currentValue, setValue } = useTabsContext()
  const active = currentValue === value
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition',
        active
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
        className,
      )}
      onClick={() => setValue(value)}
      {...props}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: currentValue } = useTabsContext()
  if (currentValue !== value) return null
  return <div className={className} {...props}>{children}</div>
}
