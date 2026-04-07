import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{value}</p>
          {hint && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
        </div>
        {icon && <div className="rounded-2xl bg-teal-100 p-3 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">{icon}</div>}
      </div>
    </Card>
  )
}
