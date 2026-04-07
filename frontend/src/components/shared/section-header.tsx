import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SectionHeader({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-end md:justify-between', className)}>
      <div className="space-y-1">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600 dark:text-teal-300">{eyebrow}</p>}
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{title}</h2>
        {description && <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
