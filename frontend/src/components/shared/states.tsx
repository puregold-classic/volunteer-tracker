import { AlertTriangle, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function EmptyState({ title = '暂无数据', description, actionLabel, onAction }: { title?: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <Card className="flex min-h-[220px] flex-col items-center justify-center gap-4 border-dashed text-center">
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Inbox className="h-6 w-6" /></div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actionLabel && onAction && <Button variant="outline" onClick={onAction}>{actionLabel}</Button>}
    </Card>
  )
}

export function ErrorState({ title = '加载失败', description, actionLabel = '重试', onAction }: { title?: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <Card className="flex min-h-[220px] flex-col items-center justify-center gap-4 border-rose-200/80 bg-rose-50/70 text-center dark:border-rose-900/70 dark:bg-rose-950/20">
      <div className="rounded-2xl bg-rose-100 p-4 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"><AlertTriangle className="h-6 w-6" /></div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-rose-700 dark:text-rose-200">{title}</h3>
        {description && <p className="max-w-md text-sm text-rose-600/80 dark:text-rose-300/80">{description}</p>}
      </div>
      {onAction && <Button variant="destructive" onClick={onAction}>{actionLabel}</Button>}
    </Card>
  )
}
