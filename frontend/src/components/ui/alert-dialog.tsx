import * as React from 'react'
import { Dialog } from './dialog'
import { Button } from './button'

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  tone?: 'default' | 'destructive'
}

export function AlertDialog({ open, onOpenChange, title, description, confirmText = '确认', cancelText = '取消', onConfirm, tone = 'default' }: AlertDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{cancelText}</Button>
          <Button type="button" variant={tone === 'destructive' ? 'destructive' : 'default'} onClick={() => { onConfirm(); onOpenChange(false) }}>{confirmText}</Button>
        </>
      )}
    >
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">请确认当前操作，提交后将进入审核流程。</div>
    </Dialog>
  )
}
