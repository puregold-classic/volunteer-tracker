// chunk 6 phase D: retokenized to semantic Warm Editorial tokens.
// Mobile-friendly: full-width on small screens, max-w-lg on desktop,
// scroll inside the panel when content is tall.

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (!open) return
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className={cn(
          'flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden bg-card shadow-2xl',
          // Mobile: bottom sheet (rounded top only); Desktop: centered card
          'rounded-t-3xl sm:rounded-3xl border-t border-border sm:border',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" />

        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div>
              {title && <h3 className="font-serif text-lg font-semibold text-foreground">{title}</h3>}
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="关闭">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>

        {footer && (
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
